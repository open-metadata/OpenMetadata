import pino from 'pino';

// Environment-based log level configuration
const getLogLevel = (): pino.Level => {
  const level = process.env.LOG_LEVEL?.toLowerCase() as pino.Level;
  const validLevels: pino.Level[] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
  return validLevels.includes(level) ? level : 'info';
};

// Pino configuration for structured logging
const pinoConfig: pino.LoggerOptions = {
  level: getLogLevel(),
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  base: {
    pid: process.pid,
    hostname: process.env.HOSTNAME || 'localhost',
    service: 'eye',
    version: process.env.npm_package_version || '1.0.0',
  },
};

// Development vs Production transport configuration
// In Docker containers, always use console output to avoid file system issues
const isDocker = process.env.DOCKER === 'true' || process.env.NODE_ENV === 'production';
const useConsoleOnly = isDocker || !process.env.LOG_TO_FILE;

const transport = useConsoleOnly
  ? pino.transport({
      targets: [
        {
          target: 'pino-pretty',
          options: {
            colorize: process.env.NODE_ENV !== 'production',
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            messageFormat: '{service}[{level}]: {msg}',
            errorLikeObjectKeys: ['err', 'error'],
          },
          level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
        }
      ]
    })
  : pino.transport({
      targets: [
        {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            messageFormat: '{service}[{level}]: {msg}',
            errorLikeObjectKeys: ['err', 'error'],
          },
          level: 'debug'
        },
        // Also save to file in development if LOG_TO_FILE is set
        ...(process.env.LOG_TO_FILE ? [{
          target: 'pino/file',
          options: { destination: './logs/dev.log' },
          level: 'info'
        }] : [])
      ]
    });

// Create the main logger instance
export const logger = pino(pinoConfig, transport);

// Create child loggers for different components
export const createChildLogger = (component: string, metadata?: Record<string, any>) => {
  return logger.child({ 
    component,
    ...metadata 
  });
};

// Specialized loggers for different parts of the application
export const serverLogger = createChildLogger('server');
export const dbLogger = createChildLogger('database');
export const trpcLogger = createChildLogger('trpc');
export const authLogger = createChildLogger('auth');
export const proxyLogger = createChildLogger('proxy');

// Utility functions for common logging patterns
export const logError = (logger: pino.Logger, error: Error, context?: Record<string, any>) => {
  logger.error({
    err: error,
    ...context,
  }, error.message);
};

export const logRequest = (logger: pino.Logger, method: string, url: string, metadata?: Record<string, any>) => {
  logger.info({
    method,
    url,
    ...metadata,
  }, `${method} ${url}`);
};

export const logResponse = (logger: pino.Logger, method: string, url: string, statusCode: number, duration: number, metadata?: Record<string, any>) => {
  logger.info({
    method,
    url,
    statusCode,
    duration,
    ...metadata,
  }, `${method} ${url} - ${statusCode} (${duration}ms)`);
};

export const logDatabaseQuery = (logger: pino.Logger, query: string, duration?: number, metadata?: Record<string, any>) => {
  logger.debug({
    query: query.substring(0, 200) + (query.length > 200 ? '...' : ''), // Truncate long queries
    duration,
    ...metadata,
  }, 'Database query executed');
};

export default logger;
