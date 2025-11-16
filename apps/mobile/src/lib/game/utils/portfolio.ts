import type { Portfolio } from "../types";
import { formatShortDate } from "./date";

export function describePortfolioStatus(portfolio: Portfolio) {
  switch (portfolio.status) {
    case "LOBBY":
      return "Share the code and get ready to draft";
    case "DRAFTING":
      return `Draft round ${portfolio.current_pick_round ?? 1}`;
    case "ACTIVE": {
      const started = formatShortDate(portfolio.start_time, "");
      return started ? `Live since ${started}` : "Live portfolio";
    }
    case "FINISHED": {
      const ended = formatShortDate(
        portfolio.end_time || portfolio.start_time,
        "",
      );
      return ended ? `Finished ${ended}` : "Season finished";
    }
    default:
      return "";
  }
}
