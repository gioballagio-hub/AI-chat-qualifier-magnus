// Privacy-safe logger: never logs PII fields (data, ipHash, webhookSecret)
type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const REDACTED_KEYS = new Set(["data", "ipHash", "webhookSecret", "password", "token"]);
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, REDACTED_KEYS.has(k) ? "[REDACTED]" : v])
  );
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    context: context ? sanitize(context) : undefined,
    timestamp: new Date().toISOString(),
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
};
