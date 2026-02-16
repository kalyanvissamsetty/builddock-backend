export enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  DEBUG = "DEBUG",
}

export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[${new Date().toISOString()}] [${LogLevel.INFO}] ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[${new Date().toISOString()}] [${LogLevel.WARN}] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[${new Date().toISOString()}] [${LogLevel.ERROR}] ${message}`, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    console.debug(`[${new Date().toISOString()}] [${LogLevel.DEBUG}] ${message}`, ...args);
  },
};
