# Development & Local Authentication Guide

## Overview

ThirdEye UI supports **dual authentication** for flexibility across environments:
- **Email/Password** - Works everywhere (recommended for development/local)
- **Google OAuth** - Production-ready SSO (requires configuration)

---

## 🔧 Development Setup (Email/Password)

### Prerequisites
- OpenMetadata running locally or accessible
- Node.js 18+ installed
- ThirdEye UI repository cloned

### Quick Start

#### 1. **Environment Configuration**

Create `.env.local` in `thirdeye-ui/` directory:

```env
# Local Development Configuration
OPENMETADATA_BASE_URL=http://localhost:8585
NEXTAUTH_URL=http://localhost:3000
PORT=3000
JWT_SECRET=your-local-dev-secret-key-12345
NODE_ENV=development
```

**Key Points:**
- `OPENMETADATA_BASE_URL` - Your local OpenMetadata instance
- `NEXTAUTH_URL` - Local UI URL (default: http://localhost:3000)
- `JWT_SECRET` - Any random string for development
- `NODE_ENV=development` - Enables dev features

#### 2. **Start OpenMetadata Backend**

```bash
cd docker/docker-compose-quickstart
docker-compose up -d
```

Wait for OpenMetadata to be ready:
```bash
curl http://localhost:8585/api/v1/system/status
```

#### 3. **Start ThirdEye UI**

```bash
cd thirdeye-ui
npm install
npm run dev
```

Access at: `http://localhost:3000`

---

## 👤 Creating Test Users for Development

### Method 1: Using OpenMetadata API

```bash
# Create a test user
curl -X POST http://localhost:8585/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "testuser",
    "email": "test@example.com",
    "password": "Test123!",
    "displayName": "Test User"
  }'
```

### Method 2: Using OpenMetadata UI

1. Open `http://localhost:8585`
2. Default admin login (if basic auth is primary):
   - Email: `admin@example.com`
   - Password: `admin` (or check your OpenMetadata config)
3. Navigate to **Settings** → **Users**
4. Click **Add User**
5. Fill in details and set password

### Method 3: Quick Test User Script

Create `thirdeye-ui/create-test-user.sh`:

```bash
#!/bin/bash

# Create test users for development
OM_URL="${OPENMETADATA_BASE_URL:-http://localhost:8585}"

# Create developer user
curl -X POST "$OM_URL/api/v1/users" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "developer",
    "email": "dev@local.test",
    "password": "DevPassword123!",
    "displayName": "Developer User",
    "roles": ["DataConsumer"]
  }'

echo "Test user created:"
echo "Email: dev@local.test"
echo "Password: DevPassword123!"
```

Make executable and run:
```bash
chmod +x create-test-user.sh
./create-test-user.sh
```

---

## 🔐 Login Flow (Development)

### Using Email/Password

1. Open `http://localhost:3000/auth/signin`
2. Enter credentials:
   - Email: `dev@local.test`
   - Password: `DevPassword123!`
3. Click **Sign In**
4. Redirected to: `http://localhost:3000/dashboard/thirdeye`

### Session Management

**Development sessions:**
- HTTP-only cookies work over HTTP (no HTTPS required)
- 7-day expiration (or 30 days with "Remember me")
- Cookie name: `auth-token`
- JWT stored with user info

**Debug session:**
```javascript
// In browser console
document.cookie.split(';').find(c => c.includes('auth-token'))
```

---

## 🔄 Environment-Specific Behavior

### Development (`NODE_ENV=development`)

✅ **Enabled:**
- Basic email/password login
- HTTP cookies (no HTTPS required)
- Detailed error messages
- Hot reload
- Source maps

❌ **Disabled:**
- `secure` cookie flag (works on HTTP)
- Production optimizations
- Google OAuth (optional - can be enabled if configured)

### Production (`NODE_ENV=production`)

✅ **Enabled:**
- Both email/password and Google OAuth
- HTTPS detection for secure cookies
- Minified bundles
- Optimized performance

---

## 🐛 Troubleshooting Development Auth

### Issue: "Invalid credentials"

**Solution:**
1. Verify OpenMetadata is running:
   ```bash
   curl http://localhost:8585/api/v1/system/status
   ```

2. Check if user exists:
   ```bash
   curl http://localhost:8585/api/v1/users/name/testuser
   ```

3. Verify password was set correctly (recreate user if needed)

### Issue: "Cannot connect to OpenMetadata"

**Solution:**
1. Check `OPENMETADATA_BASE_URL` in `.env.local`
2. Ensure OpenMetadata containers are running:
   ```bash
   docker ps | grep openmetadata
   ```
3. Check OpenMetadata logs:
   ```bash
   docker-compose logs openmetadata-server
   ```

### Issue: "Redirects to signin after login"

**Solution:**
1. Check browser console for errors
2. Verify `JWT_SECRET` is set in `.env.local`
3. Clear cookies and try again:
   ```javascript
   document.cookie.split(";").forEach(c => {
     document.cookie = c.trim().split("=")[0] + "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/";
   });
   ```

### Issue: "Google OAuth not working locally"

**Solution:**
- Google OAuth requires proper redirect URIs configured in Google Cloud Console
- For local development, **use email/password** instead
- Or configure OAuth redirect: `http://localhost:3000/api/auth/google/callback`

---

## 📝 Development Best Practices

### 1. **Use Separate Dev Users**
Don't use production credentials in development. Create dedicated test users.

### 2. **Environment Variables**
Never commit `.env.local` to git. Use `.env.example` as a template.

### 3. **Reset Development Data**
```bash
# Reset OpenMetadata for clean state
docker-compose down -v
docker-compose up -d
# Recreate test users
```

### 4. **Hot Reload Caveats**
- Changing `.env.local` requires restart
- Cookie changes may need browser refresh
- Clear cache if auth state is stuck

---

## 🎯 Quick Reference: Development Auth Commands

### Start Everything
```bash
# Terminal 1: OpenMetadata
cd docker/docker-compose-quickstart && docker-compose up

# Terminal 2: ThirdEye UI
cd thirdeye-ui && npm run dev
```

### Create Test User
```bash
curl -X POST http://localhost:8585/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"name":"test","email":"test@local","password":"Test123!"}'
```

### Login Test
```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@local","password":"Test123!"}'
```

### Check Session
```bash
# In browser console
fetch('/api/auth/me').then(r => r.json()).then(console.log)
```

---

## 🔄 Switching Between Development and Production

### Development → Production

1. Update `.env.local`:
```env
NODE_ENV=production
OPENMETADATA_BASE_URL=https://your-prod-server.com:8585
NEXTAUTH_URL=https://your-prod-server.com
```

2. Build production bundle:
```bash
npm run build
npm run start
```

3. Enable Google OAuth (optional):
- Configure Google Cloud Console
- Add credentials to environment
- Update OpenMetadata configuration

### Production → Development

1. Update `.env.local`:
```env
NODE_ENV=development
OPENMETADATA_BASE_URL=http://localhost:8585
NEXTAUTH_URL=http://localhost:3000
```

2. Restart dev server:
```bash
npm run dev
```

---

## 🚀 CI/CD & Testing Environments

### Test Environment Setup

```env
# .env.test
OPENMETADATA_BASE_URL=http://openmetadata-test:8585
NEXTAUTH_URL=http://thirdeye-test:3000
JWT_SECRET=test-secret-not-for-production
NODE_ENV=test
```

### Automated Testing

```bash
# Run tests with test environment
npm run test

# E2E tests with auth
npm run test:e2e
```

---

## 📚 Related Documentation

- **AUTHENTICATION_GUIDE.md** - Full authentication overview
- **GOOGLE_OAUTH_SETUP.md** - Google OAuth configuration
- **thirdeye-ui/env.production.template** - Production environment template

---

## ✅ Summary

**For Development:**
- ✅ Use email/password authentication
- ✅ Create test users via OpenMetadata API or UI
- ✅ Configure `.env.local` with localhost URLs
- ✅ No HTTPS required
- ✅ Google OAuth optional (skip for faster setup)

**For Production:**
- ✅ Both email/password and Google OAuth available
- ✅ HTTPS recommended
- ✅ Use secure JWT secrets
- ✅ Configure proper redirect URIs

**Key Advantage:**
Basic authentication works immediately in development without any OAuth configuration! 🎉

