type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  level: LogLevel;
  message: string;
  route?: string;
  method?: string;
  error?: string;
  stack?: string;
  userId?: string;
  meta?: Record<string, unknown>;
  timestamp: string;
}

function send(payload: LogPayload) {
  const fn = payload.level === "error" ? console.error : payload.level === "warn" ? console.warn : console.log;
  fn(`[${payload.level.toUpperCase()}] ${payload.message}`, {
    route: payload.route,
    error: payload.error,
    stack: payload.stack,
    meta: payload.meta,
  });
}

function formatError(err: unknown): { error: string; stack?: string } {
  if (err instanceof Error) {
    return { error: err.message, stack: err.stack };
  }
  return { error: String(err) };
}

export const log = {
  info(message: string, opts?: { route?: string; method?: string; userId?: string; meta?: Record<string, unknown> }) {
    send({ level: "info", message, timestamp: new Date().toISOString(), ...opts });
  },

  warn(message: string, opts?: { route?: string; method?: string; userId?: string; meta?: Record<string, unknown> }) {
    send({ level: "warn", message, timestamp: new Date().toISOString(), ...opts });
  },

  error(message: string, err: unknown, opts?: { route?: string; method?: string; userId?: string; meta?: Record<string, unknown> }) {
    send({
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      ...formatError(err),
      ...opts,
    });
  },
};
