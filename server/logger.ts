const LOGTAIL_HOST = "https://s2306988.eu-fsn-3.betterstackdata.com";
const LOGTAIL_TOKEN = process.env.LOGTAIL_SOURCE_TOKEN;

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
  if (!LOGTAIL_TOKEN) {
    // Fallback to console in dev / when token is missing
    const fn = payload.level === "error" ? console.error : payload.level === "warn" ? console.warn : console.log;
    fn(`[${payload.level.toUpperCase()}] ${payload.message}`, {
      route: payload.route,
      error: payload.error,
      stack: payload.stack,
      meta: payload.meta,
    });
    return;
  }

  // Fire-and-forget — don't await in request path
  fetch(LOGTAIL_HOST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOGTAIL_TOKEN}`,
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    // If Logtail itself fails, at least write to stdout so the platform captures it
    console.error("[logger] Failed to send to Logtail:", payload.message);
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
