# Google OAuth Setup for Server coming.live

## Step 1: Configure Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
5. If prompted, configure the OAuth consent screen first:
   - User Type: External (or Internal if using Google Workspace)
   - App name: ThirdEye / OpenMetadata
   - Support email: your email
   - Authorized domains: (leave empty for IP-based access)
   - Save and Continue

6. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: `OpenMetadata ThirdEye`

7. **Add Authorized JavaScript origins:**
   ```
   http://coming.live:8585
   http://coming.live
   ```

8. **Add Authorized redirect URIs:**
   ```
   http://coming.live:8585/callback
   http://coming.live/api/auth/google/callback
   ```

9. Click **CREATE**

10. **IMPORTANT:** Copy and save:
    - **Client ID** (looks like: `xxxxx.apps.googleusercontent.com`)
    - **Client Secret** (keep this secure!)

## Step 2: Update Configuration Files

The following files have been updated in your repository:

### File 1: `docker/docker-compose-quickstart/docker-compose.yml`
- Updated with Google OAuth environment variables
- **ACTION REQUIRED:** Replace `<YOUR_GOOGLE_CLIENT_ID>` with your actual Client ID

### File 2: `thirdeye-ui/.env.local`
- Created with server-specific configuration
- **ACTION REQUIRED:** Update JWT_SECRET to a strong random value

## Step 3: Deploy to Server

### On your server (SSH to coming.live):

```bash
# Pull latest code
cd /path/to/OpenMetadata
git pull

# Restart OpenMetadata containers
cd docker/docker-compose-quickstart
docker-compose down
docker-compose up -d

# Check logs to ensure Google OAuth is configured
docker-compose logs -f openmetadata-server | grep -i "auth"

# Navigate to ThirdEye UI directory
cd ../../thirdeye-ui

# Install dependencies (if needed)
npm install

# Build for production
npm run build

# Option A: Start with npm on port 80 (requires root/sudo)
sudo PORT=80 npm run start

# Option B: Start with PM2 on port 80 (recommended for production)
npm install -g pm2
sudo PORT=80 pm2 start npm --name "thirdeye-ui" -- run start
pm2 save
pm2 startup  # Follow the instructions it provides

# Option C: Use nginx reverse proxy (recommended for production)
# See the nginx configuration section below
```

## Step 4: Test the Setup

1. Open browser and go to: `http://coming.live/auth/signin`
2. Click **Continue with Google**
3. You should be redirected to Google login
4. After successful login, you should land on: `http://coming.live/dashboard/thirdeye`

## Troubleshooting

### Error: "redirect_uri_mismatch"
- Verify the redirect URIs in Google Cloud Console match exactly
- Check for typos or missing ports

### Error: "Google OAuth is not configured"
- Ensure `AUTHENTICATION_PROVIDER=google` in docker-compose.yml
- Restart OpenMetadata containers
- Check logs: `docker-compose logs openmetadata-server`

### Error: "Authentication failed"
- Verify the Client ID is correct
- Check OpenMetadata logs for detailed error messages
- Ensure the Google user's email domain is allowed

### Cannot access port 80 externally
- Check firewall: `firewall-cmd --list-ports`
- Port 80 should already be open (standard HTTP port)
- If not: `firewall-cmd --permanent --add-port=80/tcp && firewall-cmd --reload`

### Permission denied when starting on port 80
Port 80 requires elevated privileges. Options:

**Option 1: Run with sudo (simple but less secure)**
```bash
sudo PORT=80 pm2 start npm --name "thirdeye-ui" -- run start
```

**Option 2: Use authbind (recommended)**
```bash
# Install authbind
sudo yum install authbind -y  # CentOS
# or
sudo apt-get install authbind -y  # Ubuntu

# Allow port 80 for your user
sudo touch /etc/authbind/byport/80
sudo chmod 500 /etc/authbind/byport/80
sudo chown $(whoami) /etc/authbind/byport/80

# Run with authbind
authbind --deep npm run start
```

**Option 3: Use setcap (recommended)**
```bash
# Give Node.js permission to bind to port 80
sudo setcap 'cap_net_bind_service=+ep' $(which node)

# Now you can run without sudo
PORT=80 pm2 start npm --name "thirdeye-ui" -- run start
```

**Option 4: Use nginx reverse proxy (best for production)**
See nginx configuration section below

## Security Recommendations

1. **Use HTTPS in production:**
   - Get SSL certificate (Let's Encrypt)
   - Set up nginx reverse proxy
   - Update all URLs to use https://

2. **Generate a strong JWT_SECRET:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Restrict email domains** (optional):
   In docker-compose.yml, add:
   ```yaml
   AUTHORIZER_ALLOWED_REGISTRATION_DOMAIN: '["yourdomain.com"]'
   ```

4. **Regular security updates:**
   - Keep OpenMetadata updated
   - Update Node.js packages regularly
   - Monitor security advisories

## Quick Reference

**Server URLs:**
- OpenMetadata: http://coming.live:8585
- ThirdEye UI: http://coming.live
- Sign In: http://coming.live/auth/signin

**Google OAuth Endpoints:**
- Authorization: https://accounts.google.com/o/oauth2/v2/auth
- Token: https://oauth2.googleapis.com/token
- UserInfo: https://openidconnect.googleapis.com/v1/userinfo

**Required Scopes:**
- openid
- email
- profile

