# ThirdEye Authentication Guide

## Overview

ThirdEye supports **dual authentication** - users can sign in using either:
1. **Email/Password** (Traditional login)
2. **Google OAuth** (Single Sign-On)

Both methods work seamlessly together on the same deployment.

---

## Current Configuration

### OpenMetadata Backend
- **Primary Provider**: Google OAuth
- **Self-Signup Enabled**: Yes (users can register on first Google login)
- **Basic Auth**: Supported for API access and existing users

### ThirdEye UI
- **Email/Password Login**: `/api/auth/signin` route
- **Google OAuth Login**: `/api/auth/google` and `/api/auth/google/callback` routes
- **Landing Page**: Both options available at `http://coming.live/auth/signin`

---

## How It Works

### 1. Email/Password Authentication

**User Flow:**
```
User enters email/password → ThirdEye UI → OpenMetadata /api/v1/users/login → JWT token → Authenticated
```

**Requirements:**
- User account must exist in OpenMetadata
- Admin must create users via OpenMetadata UI or API
- Users get email/password credentials

**Use Cases:**
- Internal users with managed accounts
- Service accounts
- API access
- Development/testing

### 2. Google OAuth Authentication

**User Flow:**
```
User clicks "Continue with Google" → Google login → OAuth callback → OpenMetadata validates → JWT token → Authenticated
```

**Requirements:**
- Google OAuth configured in OpenMetadata (✅ Done)
- User has Google account
- Auto-registration enabled (✅ Done)

**Use Cases:**
- External users
- Easy onboarding (no account creation needed)
- Enterprise Google Workspace organizations
- SSO requirements

---

## User Experience

### Sign In Page Features

**Available Options:**
1. ✅ Email/Password form
2. ✅ "Continue with Google" button
3. ✅ "Remember me" checkbox
4. ✅ "Forgot password?" link
5. ✅ Link to sign up page

**Session Management:**
- Both methods create the same JWT session token
- Sessions last 7 days (or 30 days with "Remember me")
- Users can switch between methods after initial registration

---

## Configuration Files

### OpenMetadata (docker-compose.yml)
```yaml
AUTHENTICATION_PROVIDER: google
AUTHENTICATION_ENABLE_SELF_SIGNUP: true
AUTHENTICATION_CLIENT_ID: 634674389410-bm9ufb4akv29f65e5vatkuif3p3ncet3.apps.googleusercontent.com
AUTHENTICATION_CALLBACK_URL: http://coming.live:8585/callback
```

### ThirdEye UI (.env.local)
```env
OPENMETADATA_BASE_URL=http://coming.live:8585
NEXTAUTH_URL=http://coming.live
JWT_SECRET=f8dae17e1fb2e869b479988a3069a2b929b34dba60768fb78027bcaf126780ef
```

---

## User Management

### Creating Email/Password Users

**Option 1: OpenMetadata UI**
1. Go to `http://coming.live:8585`
2. Navigate to Settings → Users
3. Click "Add User"
4. Fill in details and set password

**Option 2: API**
```bash
curl -X POST http://coming.live:8585/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "john.doe",
    "email": "john@example.com",
    "password": "SecurePassword123"
  }'
```

### Google OAuth Users
- **Auto-created on first login** (no manual setup needed)
- User profile pulled from Google account
- Email becomes the primary identifier

---

## Security Features

### Both Methods Support:
- ✅ HTTP-only cookies
- ✅ JWT session tokens
- ✅ 7-day expiration (configurable)
- ✅ Secure flag on HTTPS
- ✅ Same authorization/permissions model

### Additional OAuth Security:
- ✅ State parameter validation
- ✅ Nonce for replay protection
- ✅ Token validation against Google's public keys
- ✅ Domain restrictions (configurable)

---

## Testing Both Methods

### Test Email/Password Login
```bash
# 1. Create a test user in OpenMetadata
# 2. Go to http://coming.live/auth/signin
# 3. Enter email and password
# 4. Click "Sign In"
# Expected: Redirect to /dashboard/thirdeye
```

### Test Google OAuth Login
```bash
# 1. Go to http://coming.live/auth/signin
# 2. Click "Continue with Google"
# 3. Select Google account
# 4. Authorize access
# Expected: Redirect to /dashboard/thirdeye
```

---

## Troubleshooting

### Email/Password Issues

**Problem**: "Invalid credentials"
- **Solution**: Verify user exists in OpenMetadata
- **Check**: `http://coming.live:8585/api/v1/users`

**Problem**: "User not found"
- **Solution**: Create user via OpenMetadata UI or API

### Google OAuth Issues

**Problem**: "redirect_uri_mismatch"
- **Solution**: Update Google Cloud Console redirect URIs:
  - `http://coming.live:8585/callback`
  - `http://coming.live/api/auth/google/callback`

**Problem**: "OAuth not configured"
- **Solution**: Verify OpenMetadata environment variables
- **Check**: `docker-compose logs openmetadata-server | grep AUTH`

### Cookie/Session Issues

**Problem**: "Not staying logged in"
- **Solution**: Check browser allows cookies
- **Check**: JWT_SECRET is configured in ThirdEye UI

---

## Best Practices

### For Organizations

1. **Use Google OAuth for most users**
   - Easier onboarding
   - No password management
   - Better security (Google handles 2FA)

2. **Use Email/Password for:**
   - Admin accounts (backup access)
   - Service accounts
   - API integrations
   - Development environments

### For Developers

1. **Always test both methods** after configuration changes
2. **Keep JWT_SECRET secure** and don't commit to git
3. **Use HTTPS in production** for secure cookies
4. **Monitor auth logs** for unusual activity

---

## Migration Scenarios

### From Email/Password to OAuth
1. User signs in with email/password
2. Admin enables Google OAuth
3. User can now sign in with Google (same email)
4. Both methods work for the same account

### From OAuth to Email/Password
1. Admin creates password for OAuth user via OpenMetadata
2. User can now use either method

---

## API Authentication

Both methods result in the same JWT token that can be used for API calls:

```bash
# After login, extract token from cookie
TOKEN="your-jwt-token"

# Use in API requests
curl -X GET http://coming.live:8585/api/v1/tables \
  -H "Authorization: Bearer $TOKEN"
```

---

## Summary

✅ **Both authentication methods are fully enabled and working**  
✅ **Users can choose their preferred method**  
✅ **No conflicts between the two methods**  
✅ **Same permissions and authorization model**  
✅ **Seamless user experience**

---

## Support

For issues or questions:
- Check logs: `pm2 logs thirdeye-ui`
- Check OpenMetadata: `docker-compose logs openmetadata-server`
- Review configuration: See files listed above

