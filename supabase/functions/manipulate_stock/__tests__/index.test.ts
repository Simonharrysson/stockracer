import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.3";

/**
 * The suite below acts like a friendly sanity check for the manipulate_stock
 * edge function. We prod it with the same kinds of requests a real player
 * would make and confirm that it answers with the right HTTP codes and portfolio
 * math.
 */

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;

const envValues = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
};

const serveMock = jest.fn();
const envGetMock = jest.fn((key: string) => envValues[key as keyof typeof envValues]);

async function loadHandler() {
  (globalThis as any).Deno = {
    env: { get: envGetMock },
    serve: serveMock,
  };

  await jest.isolateModulesAsync(async () => {
    await import("../index.ts");
  });

  expect(serveMock).toHaveBeenCalledTimes(1);
  const handler = serveMock.mock.calls[0][0];
  if (typeof handler !== "function") {
    throw new Error("serve handler was not registered");
  }
  return handler as (req: Request) => Promise<Response>;
}

beforeEach(() => {
  jest.resetModules();
  serveMock.mockReset();
  envGetMock.mockReset();
  envGetMock.mockImplementation((key: string) => envValues[key as keyof typeof envValues]);
  createClientMock.mockReset();
});

afterEach(() => {
  delete (globalThis as any).Deno;
});

it("politely refuses anything that is not a POST", async () => {
  createClientMock.mockImplementation(() => {
    throw new Error("createClient should not be called for non-POST requests");
  });

  const handler = await loadHandler();
  const res = await handler(new Request("https://example.com", { method: "GET" }));

  expect(res.status).toBe(405);
  expect(await res.text()).toContain("Only POST");
  expect(createClientMock).not.toHaveBeenCalled();
});

it("asks for a bearer token before doing anything risky", async () => {
  createClientMock.mockImplementation(() => {
    throw new Error("createClient should not be called when auth is missing");
  });

  const handler = await loadHandler();
  const res = await handler(new Request("https://example.com", { method: "POST" }));

  expect(res.status).toBe(401);
  expect(await res.text()).toContain("Missing Bearer token");
  expect(createClientMock).not.toHaveBeenCalled();
});

it("double-checks the payload before reaching out to Supabase", async () => {
  createClientMock.mockImplementation(() => {
    throw new Error("createClient should not be called for invalid payloads");
  });

  const handler = await loadHandler();
  const res = await handler(new Request("https://example.com", {
    method: "POST",
    headers: { Authorization: "Bearer token" },
    body: JSON.stringify({ symbol: " amzn ", side: "HOLD", quantity: 0, price: -1 }),
  }));

  expect(res.status).toBe(400);
  expect(await res.text()).toContain("Invalid payload");
  expect(createClientMock).not.toHaveBeenCalled();
});

it("bubbles up auth failures from Supabase", async () => {
  const getUser = jest.fn().mockResolvedValue({ data: { user: null }, error: { message: "nope" } });
  const userClient = {
    auth: { getUser },
    from: jest.fn(),
  } as const;

  createClientMock.mockImplementationOnce(() => userClient as any);

  const handler = await loadHandler();
  const res = await handler(new Request("https://example.com", {
    method: "POST",
    headers: { Authorization: "Bearer token" },
    body: JSON.stringify({ symbol: "AMZN", side: "BUY", quantity: 1, price: 100 }),
  }));

  expect(res.status).toBe(401);
  expect(await res.text()).toContain("Unauthorized");
  expect(getUser).toHaveBeenCalledTimes(1);
  expect(createClientMock).toHaveBeenCalledTimes(1);
});

type TransactionRow = {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
};

async function prepareTradingHandler(options: {
  existingTransactions?: TransactionRow[];
  quotes?: Array<{ symbol: string; current_price?: number; prev_close?: number }>;
}) {
  const transactionLog: TransactionRow[] = [...(options.existingTransactions ?? [])];

  const insert = jest.fn(async (row: any) => {
    transactionLog.push({
      symbol: row.symbol,
      side: row.side,
      quantity: row.quantity,
      price: row.price,
    });
    return { error: null };
  });

  const getUser = jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  const userClient = {
    auth: { getUser },
    from: jest.fn(() => ({ insert })),
  } as const;

  const upsert = jest.fn().mockResolvedValue({ error: null });

  const adminFrom = jest.fn((table: string) => {
    if (table === "transactions") {
      return {
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({
              data: transactionLog.map((t) => ({ ...t })),
              error: null,
            })),
          })),
        })),
      };
    }
    if (table === "symbols") {
      return {
        select: jest.fn(() => ({
          in: jest.fn(() => Promise.resolve({
            data: options.quotes ?? [],
            error: null,
          })),
        })),
      };
    }
    if (table === "portfolios") {
      return { upsert };
    }
    throw new Error(`unexpected table ${table}`);
  });

  createClientMock.mockImplementation((_, key) => {
    if (key === envValues.SUPABASE_ANON_KEY) {
      return userClient as any;
    }
    if (key === envValues.SUPABASE_SERVICE_ROLE_KEY) {
      return { from: adminFrom } as any;
    }
    throw new Error(`unexpected key ${key}`);
  });

  const handler = await loadHandler();
  return { handler, insert, upsert, getUser, adminFrom, transactionLog };
}

it("records a simple BUY trade and recomputes the portfolio", async () => {
  const { handler, insert, upsert } = await prepareTradingHandler({
    quotes: [{ symbol: "SAFE", current_price: 150, prev_close: 120 }],
  });

  const res = await handler(new Request("https://example.com", {
    method: "POST",
    headers: { Authorization: "Bearer token" },
    body: JSON.stringify({ symbol: "SAFE", side: "BUY", quantity: 2, price: 100 }),
  }));

  expect(res.status).toBe(200);
  const payload = await res.json();
  expect(payload.ok).toBe(true);
  expect(payload.portfolio).toMatchObject({
    tickers: ["SAFE"],
    total_worth: 300,
    total_invested: 200,
    unrealized_pnl: 100,
    total_change_pct: 0.5,
    position_count: 1,
  });
  expect(payload.portfolio.last_change_pct).toBeCloseTo((300 - 240) / 240);

  expect(insert).toHaveBeenCalledTimes(1);
  expect(upsert).toHaveBeenCalledTimes(1);
});

it("lets a player close out a position with a SELL", async () => {
  const { handler, insert, upsert, transactionLog } = await prepareTradingHandler({
    existingTransactions: [{ symbol: "SAFE", side: "BUY", quantity: 1, price: 100 }],
  });

  const res = await handler(new Request("https://example.com", {
    method: "POST",
    headers: { Authorization: "Bearer token" },
    body: JSON.stringify({ symbol: "SAFE", side: "SELL", quantity: 1, price: 125 }),
  }));

  expect(res.status).toBe(200);
  const payload = await res.json();
  expect(payload.ok).toBe(true);
  expect(payload.portfolio).toMatchObject({
    tickers: [],
    total_worth: 0,
    total_invested: 0,
    unrealized_pnl: 0,
    position_count: 0,
  });

  expect(transactionLog).toHaveLength(2);
  expect(insert).toHaveBeenCalledTimes(1);
  expect(upsert).toHaveBeenCalledTimes(1);
});

it("supports partial sales while keeping the remaining average cost", async () => {
  const { handler, upsert } = await prepareTradingHandler({
    existingTransactions: [{ symbol: "SAFE", side: "BUY", quantity: 2, price: 100 }],
    quotes: [{ symbol: "SAFE", current_price: 150, prev_close: 140 }],
  });

  const res = await handler(new Request("https://example.com", {
    method: "POST",
    headers: { Authorization: "Bearer token" },
    body: JSON.stringify({ symbol: "SAFE", side: "SELL", quantity: 1, price: 130 }),
  }));

  expect(res.status).toBe(200);
  const payload = await res.json();
  expect(payload.portfolio.tickers).toEqual(["SAFE"]);
  expect(payload.portfolio.total_worth).toBe(150);
  expect(payload.portfolio.total_invested).toBe(100);
  expect(payload.portfolio.unrealized_pnl).toBe(50);
  expect(payload.portfolio.total_change_pct).toBe(0.5);
  expect(payload.portfolio.last_change_pct).toBeCloseTo((150 - 140) / 140);

  expect(upsert).toHaveBeenCalledTimes(1);
  expect(upsert.mock.calls[0][0]).toMatchObject({
    tickers: ["SAFE"],
    total_worth: 150,
    total_invested: 100,
    unrealized_pnl: 50,
    position_count: 1,
  });
});

it("rejects a SELL when the player never owned the stock", async () => {
  const { handler, insert, upsert } = await prepareTradingHandler({
    existingTransactions: [],
  });

  const res = await handler(new Request("https://example.com", {
    method: "POST",
    headers: { Authorization: "Bearer token" },
    body: JSON.stringify({ symbol: "SAFE", side: "SELL", quantity: 1, price: 130 }),
  }));

  expect(res.status).toBe(400);
  expect(await res.text()).toContain("Sell exceeds position");
  expect(insert).toHaveBeenCalledTimes(1);
  expect(upsert).not.toHaveBeenCalled();
});

it("falls back to the trade price when there is no quote data", async () => {
  const { handler, upsert } = await prepareTradingHandler({
    quotes: [],
  });

  const res = await handler(new Request("https://example.com", {
    method: "POST",
    headers: { Authorization: "Bearer token" },
    body: JSON.stringify({ symbol: "MYST", side: "BUY", quantity: 1, price: 50 }),
  }));

  expect(res.status).toBe(200);
  const payload = await res.json();
  expect(payload.portfolio).toMatchObject({
    tickers: ["MYST"],
    total_worth: 50,
    total_invested: 50,
    unrealized_pnl: 0,
    position_count: 1,
  });

  expect(upsert).toHaveBeenCalledTimes(1);
});

it("refuses to process a SELL that would dip below zero holdings", async () => {
  const { handler, insert, upsert } = await prepareTradingHandler({
    existingTransactions: [{ symbol: "SAFE", side: "BUY", quantity: 5, price: 10 }],
  });

  const res = await handler(new Request("https://example.com", {
    method: "POST",
    headers: { Authorization: "Bearer token" },
    body: JSON.stringify({ symbol: "SAFE", side: "SELL", quantity: 10, price: 12 }),
  }));

  expect(res.status).toBe(400);
  expect(await res.text()).toContain("Sell exceeds position");
  expect(insert).toHaveBeenCalledTimes(1);
  expect(upsert).not.toHaveBeenCalled();
});
