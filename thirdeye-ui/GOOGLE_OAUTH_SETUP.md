# Google OAuth Setup Guide for ThirdEye UI

This guide explains how to enable Google OAuth authentication in ThirdEye UI using OpenMetadata's existing Google OAuth configuration.

## Prerequisites

1. OpenMetadata backend is running with Google OAuth configured
2. Google Cloud Console project with OAuth 2.0 credentials

## Option 1: Using OpenMetadata's OAuth (Recommended)

Since OpenMetadata already has Google OAuth configured, ThirdEye UI can leverage the same authentication.

### Step 1: Configure OpenMetadata for Google OAuth

Edit your `conf/openmetadata.yaml`:

```yaml
authenticationConfiguration:
  provider: "google"
  publicKeyUrls:
    - "https://www.googleapis.com/oauth2/v3/certs"
    - "http://localhost:8585/api/v1/system/config/jwks"
  authority: "https://accounts.google.com"
  clientId: "YOUR_GOOGLE_CLIENT_ID"
  callbackUrl: "http://localhost:8585/callback"
```

Or set environment variables:

```bash
export AUTHENTICATION_PROVIDER=google
export AUTHENTICATION_PUBLIC_KEYS=[https://www.googleapis.com/oauth2/v3/certs,http://localhost:8585/api/v1/system/config/jwks]
export AUTHENTICATION_AUTHORITY=https://accounts.google.com
export AUTHENTICATION_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
export AUTHENTICATION_CALLBACK_URL=http://localhost:8585/callback
```

### Step 2: Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Navigate to "APIs & Services" → "Credentials"
4. Create OAuth 2.0 Client ID (if not exists):
   - Application type: Web application
   - Authorized JavaScript origins:
     - `http://localhost:3000` (ThirdEye UI)
     - `http://localhost:8585` (OpenMetadata)
   - Authorized redirect URIs:
     - `http://localhost:8585/callback` (OpenMetadata callback)
     - `http://localhost:3000/api/auth/google/callback` (ThirdEye callback)

### Step 3: Update ThirdEye UI Environment

Create or update `thirdeye-ui/.env.local`:

```env
OPENMETADATA_BASE_URL=http://localhost:8585
NEXTAUTH_URL=http://localhost:3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

### Step 4: Restart Services

```bash
# Restart OpenMetadata
./bin/openmetadata.sh restart

# Restart ThirdEye UI
cd thirdeye-ui
npm run dev
```

## Option 2: Direct Google OAuth Integration

If you want ThirdEye UI to handle Google OAuth independently:

### Install NextAuth.js

```bash
cd thirdeye-ui
npm install next-auth @next-auth/prisma-adapter
```

### Configure NextAuth

Create `thirdeye-ui/src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Custom logic to sync with OpenMetadata
      return true
    },
  },
})

export { handler as GET, handler as POST }
```

### Update Environment Variables

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

## Testing

1. Navigate to `http://localhost:3000/auth/signin`
2. Click "Continue with Google"
3. Complete Google authentication
4. You should be redirected to `/dashboard/thirdeye`

## Troubleshooting

### "redirect_uri_mismatch" Error

- Ensure all redirect URIs are added to Google Cloud Console
- Check that the callback URL matches exactly (including http/https)

### "Google authentication not configured"

- Verify `AUTHENTICATION_PROVIDER=google` in OpenMetadata config
- Restart OpenMetadata backend

### "Authentication failed"

- Check OpenMetadata logs for errors
- Verify Google Client ID is correct
- Ensure user email domain is allowed in OpenMetadata

## Security Notes

1. **Production Setup:**
   - Use HTTPS for all URLs
   - Change JWT_SECRET to a strong random value
   - Restrict authorized domains in Google Console
   
2. **Domain Restrictions:**
   - Configure `authorizedEmailRegistrationDomains` in OpenMetadata
   - Only allow trusted email domains

3. **Token Security:**
   - Tokens are stored in HTTP-only cookies
   - Session expires after 7 days by default

