# ThirdEye Development Setup

This document describes how to set up the development environment for the ThirdEye UI similar to OpenMetadata's webpack development configuration.

## 🗂️ Our Directory Structure

```
OpenMetadata/
├── openmetadata-ui/           # Main OpenMetadata UI 
├── thirdeye-ui/               # Our ThirdEye UI location ⭐
└── openmetadata-docker/        # Backend services
```

## 🚀 Quick Start for ThirdEye UI

```bash
# 1. Cross-platform development with proxy
npm install

# 2. Check development environment requirements  
npm run dev:setup

# 3. Verify backend connectivity
npm run dev:health

# 4. Start ThirdEye development with proxy
npm run dev:proxy
```

## 🔧 Development Configuration

This ThirdEye UI implements a development proxy configuration similar to OpenMetadata's webpack setup:

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEV_SERVER_TARGET` | Target backend URL for proxy | `http://localhost:8585/` |
| `OPENMETADATA_BASE_URL` | Backend OpenMetadata URL | `http://localhost:8585` |

### Development Scripts

```bash
# Standard development
npm run dev

# With explicit proxy configuration
npm run dev:proxy

# Using custom backend URL
npm run dev:custom

# Check backend health
npm run dev:health
```

## 🔄 Proxy Configuration

Similar to OpenMetadata's webpack configuration, this setup includes:

- **API Proxy**: `/api/v1/*` → Backend OpenMetadata API
- **Health Check**: `/health` → Backend health endpoint
- **CORS Support**: Automatic CORS headers for development
- **Hot Reload**: File watching and hot replacement

## 🏗️ Architecture

### Next.js Configuration *(Similar to webpack.config.dev.js)*

```typescript
// next.config.ts
async rewrites() {
  return [
    {
      source: '/api/v1/:path*',
      destination: `${backendUrl}/api/v1/:path*`,
    },
  ];
}
```

### Development Server *(Like webpack devServer)*

```javascript
// proxy configuration
proxy: [
  {
    context: ['/api/v1/'],
    target: 'http://localhost:8585/',
    changeOrigin: true,
  }
]
```

## 🔍 Backend Integration

The development setup handles these OpenMetadata API endpoints automatically:

- ✅ `/api/v1/users/login` - Authentication
- ✅ `/api/v1/users/profile` - User information 
- ✅ `/api/v1/teams` - Team management
- ✅ `/api/v1/services` - Service catalog
- ✅ `/api/v1/search/*` - Search functionality
- ✅ `/api/v1/system/version` - Health checks

## 🛠️ Troubleshooting

### Backend Not Available

```bash
# Check backend health
npm run dev:health

# Ensure OpenMetadata server is running
curl http://localhost:8585/api/v1/system/version
```

### Proxy Not Working

1. Check environment variables:
   ```bash
   echo $DEV_SERVER_TARGET
   echo $OPENMETADATA_BASE_URL
   ```

2. Restart development server:
   ```bash
   npm run dev:proxy
   ```

### Development Logs

The development server logs all proxy activity:
```
🔄 Proxying POST /api/v1/users/login → http://localhost:8585/api/v1/users/login
```

This configuration mirrors OpenMetadata's webpack development setup but uses Next.js's built-in proxy capabilities for easier backend integration.
