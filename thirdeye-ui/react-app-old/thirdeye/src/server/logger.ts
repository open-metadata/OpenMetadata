import pino from 'pino';
import { randomUUID } from 'crypto';

// Sensitive fields to redact
const REDACT_FIELDS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'session',
  'auth',
  'credentials',
  'key',
  'private',
  'sensitive',
  'hash',
  'salt',
  'nonce',
  'verificationToken',
  'resetToken',
  'emailToken',
  'confirmToken'
];

// Custom redaction function
function redactSensitiveData(obj: any, path: string = ''): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Check if the field name or path contains sensitive keywords
    const fieldName = path.split('.').pop()?.toLowerCase() || '';
    if (REDACT_FIELDS.some(field => fieldName.includes(field))) {
      return '[REDACTED]';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) => redactSensitiveData(item, `${path}[${index}]`));
  }

  if (typeof obj === 'object') {
    const redacted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const newPath = path ? `${path}.${key}` : key;
      const lowerKey = key.toLowerCase();
      
      // Redact if key matches sensitive fields
      if (REDACT_FIELDS.some(field => lowerKey.includes(field))) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactSensitiveData(value, newPath);
      }
    }
    return redacted;
  }

  return obj;
}

// Create logger instance
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
    log: (object) => {
      // Redact sensitive data
      const redacted = redactSensitiveData(object);
      return redacted;
    }
  },
  serializers: {
    req: (req) => {
      return {
        method: req.method,
        url: req.url,
        headers: {
          ...req.headers,
          // Always redact authorization header
          authorization: req.headers.authorization ? '[REDACTED]' : undefined,
          cookie: req.headers.cookie ? '[REDACTED]' : undefined
        },
        remoteAddress: req.remoteAddress,
        remotePort: req.remotePort
      };
    },
    res: (res) => {
      return {
        statusCode: res.statusCode,
        headers: {
          ...res.headers,
          // Redact sensitive response headers
          'set-cookie': res.headers['set-cookie'] ? '[REDACTED]' : undefined,
          'authorization': res.headers.authorization ? '[REDACTED]' : undefined
        }
      };
    },
    err: (err) => {
      return {
        type: err.constructor.name,
        message: err.message,
        stack: err.stack,
        code: err.code,
        statusCode: err.statusCode
      };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    pid: process.pid,
    hostname: process.env.HOSTNAME || 'unknown'
  }
});

// Request ID middleware
export function generateRequestId(): string {
  return randomUUID();
}

// Enhanced logger with request context
export class RequestLogger {
  private requestId: string;
  private userId?: string;
  private ip?: string;
  private userAgent?: string;

  constructor(requestId?: string) {
    this.requestId = requestId || generateRequestId();
  }

  setContext(context: {
    userId?: string;
    ip?: string;
    userAgent?: string;
  }) {
    if (context.userId) this.userId = context.userId;
    if (context.ip) this.ip = context.ip;
    if (context.userAgent) this.userAgent = context.userAgent;
  }

  private createLogObject(level: string, message: string, data?: any) {
    const logObj: any = {
      requestId: this.requestId,
      level,
      message,
      timestamp: new Date().toISOString()
    };

    if (this.userId) logObj.userId = this.userId;
    if (this.ip) logObj.ip = this.ip;
    if (this.userAgent) logObj.userAgent = this.userAgent;
    if (data) logObj.data = redactSensitiveData(data);

    return logObj;
  }

  info(message: string, data?: any) {
    const logObj = this.createLogObject('info', message, data);
    logger.info(logObj);
  }

  warn(message: string, data?: any) {
    const logObj = this.createLogObject('warn', message, data);
    logger.warn(logObj);
  }

  error(message: string, error?: Error | any, data?: any) {
    const logObj = this.createLogObject('error', message, data);
    if (error) {
      logObj.error = {
        message: error.message,
        stack: error.stack,
        code: error.code,
        statusCode: error.statusCode
      };
    }
    logger.error(logObj);
  }

  debug(message: string, data?: any) {
    const logObj = this.createLogObject('debug', message, data);
    logger.debug(logObj);
  }

  // Audit logging methods
  audit(action: string, details?: any) {
    const logObj = this.createLogObject('info', `AUDIT: ${action}`, {
      action,
      ...details
    });
    logger.info(logObj);
  }

  security(event: string, details?: any) {
    const logObj = this.createLogObject('warn', `SECURITY: ${event}`, {
      event,
      ...details
    });
    logger.warn(logObj);
  }
}

// Express middleware to add request logger
export function requestLoggerMiddleware(req: any, res: any, next: any) {
  const requestId = generateRequestId();
  const requestLogger = new RequestLogger(requestId);
  
  requestLogger.setContext({
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent')
  });

  req.requestId = requestId;
  req.logger = requestLogger;

  // Log request start
  requestLogger.info('Request started', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  });

  // Log response when finished
  res.on('finish', () => {
    requestLogger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: Date.now() - req.startTime
    });
  });

  req.startTime = Date.now();
  next();
}

// Global logger instance
export default logger;

// Convenience functions
export function createLogger(requestId?: string): RequestLogger {
  return new RequestLogger(requestId);
}

export function logAudit(action: string, userId?: string, details?: any) {
  const logger = createLogger();
  if (userId) logger.setContext({ userId });
  logger.audit(action, details);
}

export function logSecurity(event: string, details?: any) {
  const logger = createLogger();
  logger.security(event, details);
}
