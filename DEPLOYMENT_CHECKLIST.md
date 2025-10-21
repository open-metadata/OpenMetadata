# Google OAuth Deployment Checklist for coming.live

## Configuration Summary

**Domain:** coming.live  
**Google Client ID:** 634674389410-bm9ufb4akv29f65e5vatkuif3p3ncet3.apps.googleusercontent.com  
**ThirdEye UI Port:** 80 (standard HTTP)  
**OpenMetadata Port:** 8585  

---

## ✅ Completed

- [x] Google OAuth routes implemented in ThirdEye UI
- [x] Docker Compose configured with Google OAuth settings
- [x] Environment template created for ThirdEye UI
- [x] Documentation created (setup guides and troubleshooting)
- [x] Deployment script created with automatic port 80 setup
- [x] Google Client ID configured in docker-compose.yml

---

## 📋 TODO: Complete These Steps on Server

### 1. Google Cloud Console Configuration ⚠️ REQUIRED

In Google Cloud Console (https://console.cloud.google.com/):

**Authorized JavaScript origins:**
```
http://coming.live:8585
http://coming.live
```

**Authorized redirect URIs:**
```
http://coming.live:8585/callback
http://coming.live/api/auth/google/callback
```

> **Note:** Your Client ID is already configured in the code. Just add the redirect URIs.

---

### 2. Server Deployment

**SSH to your server:**
```bash
ssh user@coming.live
# or
ssh user@108.181.162.31
```

**Pull latest code:**
```bash
cd /path/to/OpenMetadata
git pull origin feat/thirdeye-service-internal
```

**Option A: Use Automated Script (Recommended)**
```bash
chmod +x deployment/deploy-google-oauth.sh
./deployment/deploy-google-oauth.sh
```

**Option B: Manual Deployment**

1. **Create ThirdEye UI environment file:**
```bash
cd thirdeye-ui
cp env.production.template .env.local

# Generate a strong JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Edit .env.local and update JWT_SECRET with the generated value
nano .env.local
```

2. **Restart OpenMetadata:**
```bash
cd ../docker/docker-compose-quickstart
docker-compose down
docker-compose up -d

# Wait a minute for services to start, then check logs
docker-compose logs -f openmetadata-server | grep -i "auth"
```

3. **Build and start ThirdEye UI on port 80:**
```bash
cd ../../thirdeye-ui
npm install
npm run build

# Give Node.js permission to use port 80
sudo setcap 'cap_net_bind_service=+ep' $(which node)

# Start with PM2
npm install -g pm2
PORT=80 pm2 start npm --name "thirdeye-ui" -- run start
pm2 save
pm2 startup  # Follow the instructions
```

---

### 3. Verify Firewall Settings

```bash
# Check if port 80 is open (should be by default)
firewall-cmd --list-ports

# If not open, add it:
firewall-cmd --permanent --add-service=http
firewall-cmd --reload
```

---

### 4. Test the Setup

1. Open browser: **http://coming.live/auth/signin**
2. Click **"Continue with Google"**
3. Complete Google authentication
4. You should land on: **http://coming.live/dashboard/thirdeye**

---

## 🔍 Verification Commands

```bash
# Check OpenMetadata is running
curl http://coming.live:8585/api/v1/system/config/auth

# Check ThirdEye UI is running on port 80
curl http://coming.live

# Check which process is using port 80
sudo lsof -i :80

# View OpenMetadata logs
cd docker/docker-compose-quickstart
docker-compose logs -f openmetadata-server

# View ThirdEye UI logs
pm2 logs thirdeye-ui
```

---

## 🚨 Common Issues & Solutions

### Issue: "redirect_uri_mismatch"
**Solution:** Verify redirect URIs in Google Cloud Console match exactly

### Issue: "Google OAuth is not configured"
**Solution:** 
```bash
# Check docker-compose.yml has the correct client ID
grep "AUTHENTICATION_CLIENT_ID" docker/docker-compose-quickstart/docker-compose.yml

# Restart containers
cd docker/docker-compose-quickstart
docker-compose restart
```

### Issue: "Permission denied" on port 80
**Solution:**
```bash
# Use setcap
sudo setcap 'cap_net_bind_service=+ep' $(which node)

# Or run with sudo
sudo PORT=80 pm2 start npm --name "thirdeye-ui" -- run start
```

### Issue: Port 80 already in use
**Solution:**
```bash
# Find what's using port 80
sudo lsof -i :80

# Stop Apache/nginx if running
sudo systemctl stop httpd
sudo systemctl stop nginx
```

---

## 📚 Documentation Files

- **GOOGLE_OAUTH_SERVER_SETUP.md** - Complete setup guide
- **GOOGLE_OAUTH_QUICK_REFERENCE.md** - Quick command reference
- **thirdeye-ui/PORT_80_SETUP.md** - Port 80 configuration guide
- **deployment/deploy-google-oauth.sh** - Automated deployment script

---

## 🎯 Final URLs

After deployment is complete:

- **ThirdEye UI:** http://coming.live
- **Sign In:** http://coming.live/auth/signin  
- **Dashboard:** http://coming.live/dashboard/thirdeye
- **OpenMetadata:** http://coming.live:8585

---

## 🔐 Security Notes

1. **JWT_SECRET** - Generate a strong random value (REQUIRED)
2. **HTTPS** - Consider adding SSL for production
3. **Email Domains** - Restrict allowed domains in OpenMetadata settings
4. **Firewall** - Ensure only necessary ports are open

---

## ✨ Next Steps After Google OAuth Works

1. Add HTTPS/SSL using Let's Encrypt
2. Set up nginx reverse proxy for better performance
3. Configure email domain restrictions
4. Set up monitoring and logging
5. Configure backups for OpenMetadata database

---

## 📞 Need Help?

Refer to the troubleshooting sections in:
- GOOGLE_OAUTH_SERVER_SETUP.md (lines 96-151)
- GOOGLE_OAUTH_QUICK_REFERENCE.md

