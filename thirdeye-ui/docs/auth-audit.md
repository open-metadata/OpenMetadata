# Authentication Audit - ZeroHuman UI

## Current State Analysis

### Environment Configuration
- **OpenMetadata Backend**: `http://localhost:8585` (via OPENMETADATA_BASE_URL)
- **Proxy Configuration**: `/api/v1/*` routes proxy to OpenMetadata backend
- **Demo Mode**: Fallback authentication when backend unavailable

### Current Authentication Flow

#### 1. Login Process
- **Endpoint**: `/api/auth/signin` (Next.js API route)
- **Backend Call**: `/api/v1/users/login` (proxied to OpenMetadata)
- **Payload**: `{ email: string, password: string }`
- **Response**: `{ accessToken: string, refreshToken: string, tokenType: string, expiryDuration: number, email: string }`

#### 2. Cookie Storage
- **Frontend JWT**: `auth-token` (httpOnly, secure, sameSite: 'lax')
- **OpenMetadata Token**: `metadata-access-token` (httpOnly, secure, sameSite: 'lax')
- **TTL**: 7 days (30 days if rememberMe)

#### 3. Current Issues Identified
- ✅ **Proxy Setup**: Working correctly
- ✅ **Fallback Auth**: Demo mode functioning
- ⚠️ **Password Encoding**: OpenMetadata expects base64 encoded password
- ⚠️ **Token Refresh**: Not implemented
- ⚠️ **Session Management**: Basic implementation

### OpenMetadata UI Reference

#### API Endpoints Used by OM UI:
1. **Login**: `POST /api/v1/users/login`
   - Payload: `{ email: string, password: string }` (password in base64)
   - Response: `AccessTokenResponse`

2. **Signup**: `POST /api/v1/users/signup`
   - Payload: `RegistrationRequest`

3. **Password Reset**: `POST /api/v1/users/generatePasswordResetLink`
   - Payload: `{ email: string }`

4. **Password Reset Confirm**: `POST /api/v1/users/password/reset`
   - Payload: `PasswordResetRequest`

5. **Registration Confirmation**: `PUT /api/v1/users/registrationConfirmation?token={token}`

6. **Token Refresh**: `POST /api/v1/users/refresh`
   - Payload: `TokenRefreshRequest`

7. **Logout**: `POST /api/v1/users/logout`
   - Payload: `LogoutRequest`

#### Authentication Providers Supported:
- Basic Auth (email/password)
- LDAP
- SAML SSO
- OIDC (Google, Auth0, Azure, Okta, AWS Cognito, Custom)

### Current Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Basic Login | ✅ Working | Demo mode + proxy |
| Password Encoding | ❌ Missing | Need base64 encoding |
| Token Refresh | ❌ Missing | Need refresh token handling |
| Signup | ❌ Missing | Need registration flow |
| Password Reset | ❌ Missing | Need reset flow |
| User Management | ❌ Missing | Need user/team management |
| Session Guards | ⚠️ Basic | Need middleware improvements |
| SSO Support | ❌ Missing | Need SSO provider detection |

### Next Steps
1. Fix password encoding (base64)
2. Implement token refresh mechanism
3. Add proper signup flow
4. Implement password reset
5. Add user management UI
6. Enhance session middleware
7. Add SSO provider detection

### Root Cause Analysis
- **401 Errors**: Likely due to password not being base64 encoded
- **Authentication Flow**: Working but incomplete
- **Session Management**: Basic but functional
