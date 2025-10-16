
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import pinoHttp from 'pino-http';
import { appRouter } from './routers/_app';
import { createTRPCContext } from './trpc';
import { logger, serverLogger, proxyLogger } from './lib/logger';
import { requestLoggerMiddleware } from './logger';
import { 
  authRateLimit, 
  signupRateLimit, 
  passwordResetRateLimit, 
  emailVerificationRateLimit, 
  refreshTokenRateLimit,
  generalApiRateLimit 
} from './middleware/rateLimit';
import superjson from 'superjson';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 3002;
const OPENMETADATA_URL = process.env.OPENMETADATA_URL || 'http://localhost:8585';


// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
const corsOptions = {
  origin: function (origin: string | undefined, callback: Function) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      process.env.FRONTEND_URL || 'http://localhost:3000'
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

app.use(cors(corsOptions));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use(requestLoggerMiddleware);

// Rate limiting
app.use('/trpc', generalApiRateLimit);

// JWT middleware for /trpc routes (except login/refreshToken)
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
app.use('/trpc', (req: any, res: any, next: any) => {
  // DEBUG: Log the request body to inspect tRPC batch structure
  console.log('JWT middleware /trpc req.body:', JSON.stringify(req.body));
  console.log('JWT middleware /trpc req.url:', req.url);
  console.log('JWT middleware /trpc req.query:', req.query);
  
  // Allow unauthenticated access only to login and refreshToken
  let isAuthRoute = false;
  
  // Check URL path first - look for auth.login or auth.refreshToken in the URL
  if (req.url.includes('auth.login') || req.url.includes('auth.refreshToken')) {
    isAuthRoute = true;
    console.log('JWT middleware: detected auth route from URL:', req.url);
  }
  
  if (req.method === 'POST' && req.body) {
    // Check for tRPC batch format - look for auth.login or auth.refreshToken in the batch
    if (Array.isArray(req.body)) {
      // For array format, check if any element contains auth data
      isAuthRoute = req.body.some((call: any) => {
        if (call && typeof call === 'object') {
          // Check for method property (standard tRPC format)
          if (call.method === 'auth.login' || call.method === 'auth.refreshToken') {
            return true;
          }
          // Check for numbered keys with auth data (superjson format)
          for (const key of Object.keys(call)) {
            const val = call[key];
            if (val && typeof val === 'object') {
              // Check if it has email/password (login data) or json wrapper
              if ((val.email && val.password) || (val.json && val.json.email && val.json.password)) {
                return true;
              }
            }
          }
        }
        return false;
      });
    } else if (typeof req.body === 'object') {
      // Check for single call format
      const method = req.body.method || req.query?.method;
      if (method === 'auth.login' || method === 'auth.refreshToken') {
        isAuthRoute = true;
      }
      
      // Check for batch format with numbered keys
      for (const key of Object.keys(req.body)) {
        const val = req.body[key];
        if (val && typeof val === 'object') {
          // Check for method property
          if (val.method && (val.method === 'auth.login' || val.method === 'auth.refreshToken')) {
            isAuthRoute = true;
            break;
          }
          // Check for email/password data (login credentials)
          if ((val.email && val.password) || (val.json && val.json.email && val.json.password)) {
            isAuthRoute = true;
            break;
          }
        }
      }
    }
  }
  
  console.log('JWT middleware: isAuthRoute =', isAuthRoute);
  if (isAuthRoute) {
    console.log('JWT middleware: allowing unauthenticated login/refreshToken request');
    return next();
  }
  
  // For all other routes, require JWT authentication
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('JWT middleware: blocking request, no token provided');
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    console.log('JWT middleware: valid token, proceeding');
    next();
  } catch (err) {
    console.log('JWT middleware: invalid or expired token');
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
});

// Specific rate limiting for auth endpoints
app.use('/trpc/auth.signin', authRateLimit);
app.use('/trpc/auth.signup', signupRateLimit);
app.use('/trpc/auth.refreshToken', refreshTokenRateLimit);
app.use('/trpc/auth.requestPasswordReset', passwordResetRateLimit);
app.use('/trpc/auth.requestEmailVerification', emailVerificationRateLimit);

// HTTP request logging middleware
app.use(pinoHttp({
  logger: logger,
  customLogLevel: function (req: any, res: any, err: any) {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn';
    } else if (res.statusCode >= 500 || err) {
      return 'error';
    } else if (res.statusCode >= 300 && res.statusCode < 400) {
      return 'silent';
    }
    return 'info';
  },
  serializers: {
    req: (req: any) => ({
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
      },
    }),
    res: (res: any) => ({
      statusCode: res.statusCode,
    }),
  },
}));


// OpenMetadata API Proxy - Direct proxy for OpenMetadata API endpoints
app.use('/api/openmetadata', createProxyMiddleware({
  target: OPENMETADATA_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api/openmetadata': '/api/v1', // Rewrite path to match OpenMetadata API structure
  },
  onProxyReq: (proxyReq: any, req: any, res: any) => {
    proxyLogger.info({
      method: req.method,
      url: req.url,
      target: OPENMETADATA_URL,
    }, `Proxying ${req.method} ${req.url} to ${OPENMETADATA_URL}`);
  },
  onError: (err: any, req: any, res: any) => {
    proxyLogger.error({
      err,
      method: req.method,
      url: req.url,
      target: OPENMETADATA_URL,
    }, 'OpenMetadata Proxy Error');
    res.status(500).json({ 
      error: 'OpenMetadata service unavailable',
      message: err.message 
    });
  },
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'tRPC Server is running' });
});

// tRPC middleware
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext: createTRPCContext,
    // transformer: superjson, // Temporarily disabled to test
  })
);

// Start server
app.listen(PORT, () => {
  serverLogger.info({
    port: PORT,
    openmetadataUrl: OPENMETADATA_URL,
    endpoints: {
      dashboard: `http://localhost:${PORT}/trpc/dashboard.getDashboardData`,
      actionItems: `http://localhost:${PORT}/trpc/actionItems.getActionItems`,
      auth: `http://localhost:${PORT}/trpc/auth.login`,
      insights: `http://localhost:${PORT}/trpc/insights.getInsightReport`,
      techniques: `http://localhost:${PORT}/trpc/techniques.getTechniques`,
      proxy: `http://localhost:${PORT}/api/openmetadata/*`,
      health: `http://localhost:${PORT}/health`,
    },
  }, 'tRPC Server started successfully');
});

export default app;
