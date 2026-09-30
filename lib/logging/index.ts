export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: unknown;
}

const SENSITIVE_KEYS = [
  "password",
  "passwordHash",
  "token",
  "secret",
  "authSecret",
  "authorization",
  "cookie",
  "creditCard",
  "ssn",
];

function sanitizeContext(ctx?: LogContext): LogContext | undefined {
  if (!ctx) return undefined;

  const sanitized: LogContext = {};
  for (const [key, value] of Object.entries(ctx)) {
    const isSensitive = SENSITIVE_KEYS.some((sensitive) =>
      key.toLowerCase().includes(sensitive.toLowerCase())
    );

    if (isSensitive) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeContext(value as LogContext);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV !== "production";

  private formatMessage(level: LogLevel, message: string, ctx?: LogContext): string {
    const timestamp = new Date().toISOString();
    const sanitizedCtx = sanitizeContext(ctx);
    const ctxString = sanitizedCtx ? ` ${JSON.stringify(sanitizedCtx)}` : "";

    return `[${timestamp}] [${level.toUpperCase()}] ${message}${ctxString}`;
  }

  public debug(message: string, ctx?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage("debug", message, ctx));
    }
  }

  public info(message: string, ctx?: LogContext): void {
    console.info(this.formatMessage("info", message, ctx));
  }

  public warn(message: string, ctx?: LogContext): void {
    console.warn(this.formatMessage("warn", message, ctx));
  }

  public error(message: string, ctx?: LogContext, error?: Error): void {
    const errorCtx = error
      ? { ...ctx, errorMessage: error.message, stack: error.stack }
      : ctx;
    console.error(this.formatMessage("error", message, errorCtx));
  }
}

export const logger = new Logger();
