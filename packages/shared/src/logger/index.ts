import { pino, Logger, LoggerOptions } from "pino";
import { loadConfig } from "../config/index.js";

const appConfig = loadConfig();

const pinoOptions: LoggerOptions = {
  level: appConfig.LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: ["req.headers.authorization", "req.headers['x-api-key']", "password"],
};

export const logger: Logger =
  appConfig.NODE_ENV === "development"
    ? pino({
        ...pinoOptions,
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      })
    : pino(pinoOptions);

export function createChildLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
