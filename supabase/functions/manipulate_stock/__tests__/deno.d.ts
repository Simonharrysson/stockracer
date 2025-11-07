declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (...args: any[]) => any;
};
