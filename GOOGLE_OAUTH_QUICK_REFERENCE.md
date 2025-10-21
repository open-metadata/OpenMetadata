# Google OAuth Quick Reference
**Server: http://coming.live/**

## Google Cloud Console Settings

### Authorized JavaScript origins:
```
http://coming.live:8585
http://coming.live
```

### Authorized redirect URIs:
```
http://coming.live:8585/callback
http://coming.live/api/auth/google/callback
```

## Server Commands

### On Server (SSH to coming.live):

```bash
# Navigate to project
cd /path/to/OpenMetadata

# Method 1: Use deployment script (Recommended)
chmod +x deployment/deploy-google-oauth.sh
./deployment/deploy-google-oauth.sh

# Method 2: Manual deployment
# 1. Update docker-compose.yml with your Google Client ID
#    Edit: docker/docker-compose-quickstart/docker-compose.yml
#    Replace: <YOUR_GOOGLE_CLIENT_ID>
#    With: your-actual-client-id.apps.googleusercontent.com

# 2. Create ThirdEye UI environment file
cd thirdeye-ui
cp env.production.template .env.local
# Edit .env.local and update JWT_SECRET

# 3. Restart OpenMetadata
cd ../docker/docker-compose-quickstart
docker-compose down
docker-compose up -d

# 4. Build and start ThirdEye UI on port 80
cd ../../thirdeye-ui
npm install
npm run build

# Option 1: Use setcap to allow binding to port 80
sudo setcap 'cap_net_bind_service=+ep' $(which node)
PORT=80 pm2 start npm --name "thirdeye-ui" -- run start

# Option 2: Run with sudo
sudo PORT=80 pm2 start npm --name "thirdeye-ui" -- run start
```

## Testing

1. Open: http://coming.live/auth/signin
2. Click: "Continue with Google"
3. Complete Google authentication
4. Expect redirect to: http://coming.live/dashboard/thirdeye

## Troubleshooting Commands

```bash
# Check OpenMetadata logs
cd docker/docker-compose-quickstart
docker-compose logs -f openmetadata-server | grep -i "auth"

# Check if Google OAuth is configured
curl http://coming.live:8585/api/v1/system/config/auth

# Check ThirdEye UI logs
pm2 logs thirdeye-ui

# Restart everything
docker-compose restart
pm2 restart thirdeye-ui

# Check if ports are open
netstat -tuln | grep -E '3000|8585'

# Check firewall
firewall-cmd --list-ports
```

## Files Modified

1. `docker/docker-compose-quickstart/docker-compose.yml`
   - Changed: AUTHENTICATION_PROVIDER to "google"
   - Changed: AUTHENTICATION_PUBLIC_KEYS to include Google certs
   - Changed: AUTHENTICATION_CLIENT_ID placeholder
   - Changed: AUTHENTICATION_CALLBACK_URL to server URL

2. `thirdeye-ui/env.production.template` (NEW)
   - Template for .env.local
   - Contains server-specific URLs

3. `deployment/deploy-google-oauth.sh` (NEW)
   - Automated deployment script

4. `GOOGLE_OAUTH_SERVER_SETUP.md` (NEW)
   - Comprehensive setup guide

## Important Notes

- **YOU MUST** replace `<YOUR_GOOGLE_CLIENT_ID>` in docker-compose.yml
- **YOU MUST** update `JWT_SECRET` in .env.local with a secure random value
- Generate JWT_SECRET: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- For HTTPS, you'll need SSL certificates and nginx configuration

## Support

If Google OAuth doesn't work:
1. Check Google Cloud Console redirect URIs match exactly
2. Verify Client ID is correct in docker-compose.yml
3. Check OpenMetadata logs for errors
4. Ensure ports 3000 and 8585 are accessible
5. Try basic auth first to verify OpenMetadata works

