import { mkdirSync } from "node:fs";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

const LOG_DIR = "logs";

mkdirSync(LOG_DIR, { recursive: true });

const { combine, errors, timestamp, printf, splat } = winston.format;

const normalizeError = winston.format((info) => {
  if (info.error instanceof Error) {
    info.error = {
      name: info.error.name,
      message: info.error.message,
      stack: info.error.stack,
    };
  }

  return info;
});

const lineFormat = printf((info) => {
  const { timestamp: time, level, message, stack, ...meta } = info;
  const details = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";

  return `${time} ${level}: ${stack ?? message}${details}`;
});

const sharedFormat = combine(
  errors({ stack: true }),
  splat(),
  normalizeError(),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  lineFormat,
);

const logger = winston.createLogger({
  level: "info",
  format: sharedFormat,
  transports: [
    new winston.transports.Console(),
    new DailyRotateFile({
      filename: `${LOG_DIR}/app-%DATE%.log`,
      datePattern: "YYYY-MM-DD",
      maxFiles: "7d",
    }),
    new DailyRotateFile({
      filename: `${LOG_DIR}/error-%DATE%.log`,
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxFiles: "7d",
    }),
  ],
});

export default logger;
