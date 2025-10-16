# ZeroHuman Authentication Guide

## Overview

ZeroHuman implements a comprehensive authentication system that integrates with OpenMetadata backend while providing fallback demo functionality for development and testing.

## Architecture

### Authentication Flow
1. **Frontend**: Next.js with JWT tokens stored in HTTP-only cookies
2. **Backend Integration**: Proxy to OpenMetadata API with fallback to demo mode
3. **Session Management**: Middleware-based route protection with automatic token refresh

### Key Components
- **Login/Signup**: Email/password authentication with OpenMetadata integration
- **Password Reset**: Email-based password reset flow
- **Session Management**: JWT-based sessions with automatic cleanup
- **User Management**: Read-only user and team management interface
- **Route Protection**: Middleware-based authentication guards

## Configuration

### Environment Variables

```env
# OpenMetadata Backend
OPENMETADATA_BASE_URL=http://localhost:8585

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-key-change-this-in-production

# Email Configuration (for production)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

### OpenMetadata Configuration

ZeroHuman supports the following OpenMetadata authentication modes:

#### Basic Authentication
- Email/password login
- Self-signup (if enabled)
- Password reset via email

#### LDAP Authentication
- LDAP directory integration
- Group-based team assignment

#### SSO Authentication
- SAML SSO
- OIDC (Google, Auth0, Azure, Okta, AWS Cognito)
- Custom OIDC providers

## API Endpoints

### Authentication Endpoints

#### Login
```http
POST /api/auth/signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "rememberMe": false
}
```

**Response:**
```json
{
  "message": "Sign in successful",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "company": "Company Name",
    "role": "User"
  }
}
```

#### Signup
```http
POST /api/auth/signup
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "user@example.com",
  "password": "password123",
  "confirmPassword": "password123",
  "company": "Company Name",
  "acceptTerms": true
}
```

#### Password Reset Request
```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### Password Reset Confirmation
```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "token": "reset-token",
  "newPassword": "newpassword123",
  "confirmPassword": "newpassword123"
}
```

#### Logout
```http
POST /api/auth/logout
```

#### Session Check
```http
GET /api/auth/me
```

### OpenMetadata Proxy Endpoints

All `/api/v1/*` requests are automatically proxied to the OpenMetadata backend:

- `POST /api/v1/users/login` - OpenMetadata login
- `POST /api/v1/users/signup` - OpenMetadata registration
- `POST /api/v1/users/generatePasswordResetLink` - Password reset request
- `POST /api/v1/users/password/reset` - Password reset confirmation
- `GET /api/v1/users/profile` - User profile
- `GET /api/v1/users` - List users
- `GET /api/v1/teams` - List teams

## Security Features

### Cookie Security
- **httpOnly**: Prevents XSS attacks
- **secure**: HTTPS only in production
- **sameSite**: 'lax' for CSRF protection
- **path**: '/' for proper scope
- **maxAge**: 7 days (30 days with rememberMe)

### Token Management
- **JWT Tokens**: Signed with JWT_SECRET
- **Expiration**: Automatic token expiry
- **Refresh**: Automatic token refresh (planned)
- **Cleanup**: Automatic cookie cleanup on logout

### Route Protection
- **Middleware**: Automatic route protection
- **Redirects**: Automatic redirect to login for protected routes
- **Headers**: User info injected into request headers

## Demo Mode

When OpenMetadata backend is unavailable, ZeroHuman automatically falls back to demo mode:

### Demo Credentials
- **Email**: `admin@zerohuman.com`
- **Password**: `password123`

### Demo Features
- Full authentication flow
- Mock user and team data
- All UI functionality
- Realistic data for testing

## User Management

### User Interface
- **User List**: Paginated user listing with search
- **Team Filtering**: Filter users by team membership
- **Role Display**: Admin/User role indicators
- **Status Badges**: Active/Inactive/Bot status

### User Actions (Planned)
- User activation/deactivation
- Role assignment
- Team membership management
- User invitation system

## Troubleshooting

### Common Issues

#### 1. 401 Authentication Errors
**Cause**: Password not base64 encoded
**Solution**: Ensure passwords are base64 encoded before sending to OpenMetadata

#### 2. Proxy Connection Failed
**Cause**: OpenMetadata backend not running
**Solution**: Start OpenMetadata backend or use demo mode

#### 3. Cookie Not Set
**Cause**: HTTPS required in production
**Solution**: Ensure HTTPS is enabled or use HTTP for development

#### 4. Token Expired
**Cause**: JWT token has expired
**Solution**: User will be automatically redirected to login

### Debug Mode

Enable debug logging by setting:
```env
DEBUG=auth:*
```

### Health Checks

Check authentication health:
```bash
# Check if OpenMetadata backend is accessible
curl http://localhost:8585/api/v1/system/version

# Check if proxy is working
curl http://localhost:3000/api/v1/system/version
```

## Development Setup

### Local Development
1. Start OpenMetadata backend: `http://localhost:8585`
2. Start ZeroHuman UI: `npm run dev`
3. Access: `http://localhost:3000`

### Without Backend
1. Start ZeroHuman UI: `npm run dev`
2. Use demo credentials: `admin@zerohuman.com` / `password123`
3. Access: `http://localhost:3000`

## Production Deployment

### Security Checklist
- [ ] Change JWT_SECRET to strong random value
- [ ] Enable HTTPS
- [ ] Configure proper CORS settings
- [ ] Set up SMTP for password reset emails
- [ ] Configure OpenMetadata authentication
- [ ] Enable rate limiting
- [ ] Set up monitoring and logging

### Environment Setup
1. Configure OpenMetadata backend
2. Set up SMTP server
3. Configure domain and SSL
4. Set production environment variables
5. Deploy with proper security headers

## API Reference

### OpenMetadata Integration

ZeroHuman uses the following OpenMetadata API endpoints:

#### Authentication
- `POST /api/v1/users/login` - User login
- `POST /api/v1/users/signup` - User registration
- `POST /api/v1/users/generatePasswordResetLink` - Password reset
- `POST /api/v1/users/password/reset` - Password reset confirmation
- `POST /api/v1/users/logout` - User logout

#### User Management
- `GET /api/v1/users/profile` - Current user profile
- `GET /api/v1/users` - List users
- `GET /api/v1/teams` - List teams

#### System
- `GET /api/v1/system/version` - System version

### Request/Response Formats

All requests to OpenMetadata use the exact same format as the official OpenMetadata UI:

#### Login Request
```json
{
  "email": "user@example.com",
  "password": "base64-encoded-password"
}
```

#### Login Response
```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "tokenType": "Bearer",
  "expiryDuration": 3600,
  "email": "user@example.com"
}
```

## Support

For issues and questions:
1. Check this documentation
2. Review the audit document: `docs/auth-audit.md`
3. Check OpenMetadata documentation
4. Create an issue in the repository
