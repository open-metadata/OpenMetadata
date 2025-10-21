# Running ThirdEye UI on Port 80

ThirdEye UI is configured to run on port 80 (standard HTTP port) so users don't need to specify the port in the URL.

## Why Port 80?

- Standard HTTP port - no need for `:3000` in URLs
- Better user experience: `http://coming.live` vs `http://coming.live:3000`
- Easier to remember and share

## Challenge: Port 80 Requires Elevated Privileges

On Linux systems, ports below 1024 (including port 80) require root/administrator privileges to bind.

## Solutions

### Option 1: Use setcap (Recommended)

Grant Node.js permission to bind to privileged ports:

```bash
# Give Node.js capability to bind to port 80
sudo setcap 'cap_net_bind_service=+ep' $(which node)

# Now you can run without sudo
PORT=80 npm run start

# Or with PM2
PORT=80 pm2 start npm --name "thirdeye-ui" -- run start
pm2 save
```

**Pros:**
- Don't need to run as root
- Secure - only grants specific capability
- Works with PM2

**Cons:**
- Need to reapply after Node.js updates
- Requires `setcap` utility

### Option 2: Run with sudo

Simply run the application with sudo:

```bash
# With npm
sudo PORT=80 npm run start

# With PM2
sudo PORT=80 pm2 start npm --name "thirdeye-ui" -- run start
```

**Pros:**
- Simple and straightforward
- Works everywhere

**Cons:**
- Running as root is less secure
- PM2 running as root can cause permission issues

### Option 3: Use authbind

Install and configure authbind:

```bash
# Install authbind (CentOS/RHEL)
sudo yum install authbind -y

# Or for Ubuntu/Debian
sudo apt-get install authbind -y

# Configure port 80 for your user
sudo touch /etc/authbind/byport/80
sudo chmod 500 /etc/authbind/byport/80
sudo chown $(whoami) /etc/authbind/byport/80

# Run with authbind
authbind --deep PORT=80 npm run start

# Or with PM2
authbind --deep PORT=80 pm2 start npm --name "thirdeye-ui" -- run start
```

**Pros:**
- Don't need to run as root
- More secure than sudo
- Port-specific permission

**Cons:**
- Need to install authbind
- More complex setup

### Option 4: nginx Reverse Proxy (Best for Production)

Use nginx to handle port 80 and proxy to your app on a higher port:

```nginx
# /etc/nginx/conf.d/thirdeye.conf
server {
    listen 80;
    server_name coming.live;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then run your app on port 3000:
```bash
# In .env.local, set:
# PORT=3000
# NEXTAUTH_URL=http://coming.live

pm2 start npm --name "thirdeye-ui" -- run start
```

**Pros:**
- Most secure option
- Can easily add SSL/HTTPS later
- Better performance (static file serving, caching)
- Load balancing capabilities
- Standard production setup

**Cons:**
- Requires nginx installation and configuration
- Additional service to manage

## Firewall Configuration

Ensure port 80 is open in your firewall:

```bash
# Check if port 80 is open
firewall-cmd --list-ports

# Port 80 is usually open by default for HTTP
# If not, open it:
firewall-cmd --permanent --add-service=http
# Or specifically:
firewall-cmd --permanent --add-port=80/tcp

# Reload firewall
firewall-cmd --reload
```

## Current Configuration

The ThirdEye UI is configured to use port 80 via:

1. **Environment variable:** `PORT=80` in `.env.local`
2. **Next.js:** Reads the `PORT` environment variable
3. **Google OAuth:** Callback URLs updated to use port 80

## Testing

After starting on port 80:

```bash
# Check if the service is running
curl http://localhost
# or
curl http://coming.live

# Check which process is using port 80
sudo lsof -i :80
# or
sudo netstat -tulpn | grep :80

# Test the auth endpoint
curl http://coming.live/api/auth/me
```

## Troubleshooting

### "Permission denied" or "EACCES" error
- You're trying to bind to port 80 without privileges
- Use one of the solutions above (setcap, sudo, authbind, or nginx)

### Port 80 already in use
```bash
# Find what's using port 80
sudo lsof -i :80

# Common culprits: Apache, nginx, or another web server
# Stop them if not needed:
sudo systemctl stop httpd  # Apache on CentOS
sudo systemctl stop apache2  # Apache on Ubuntu
sudo systemctl stop nginx
```

### Can't access from outside
- Check firewall settings
- Verify the service is listening on 0.0.0.0, not just 127.0.0.1
- Check cloud provider security groups (if applicable)

## Recommendation

For production deployments, we recommend:

1. **Short term:** Use `setcap` (Option 1)
   - Quick to set up
   - Secure enough for most use cases
   - Easy to implement

2. **Long term:** Use nginx reverse proxy (Option 4)
   - More robust
   - Easier to add HTTPS/SSL
   - Better performance
   - Industry standard

## Upgrading to HTTPS

When ready to add SSL:

1. Get an SSL certificate (Let's Encrypt is free)
2. Use nginx as reverse proxy
3. Update all URLs to use `https://`
4. Update Google OAuth redirect URIs

Example with Let's Encrypt:
```bash
# Install certbot
sudo yum install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d coming.live

# Auto-renewal
sudo certbot renew --dry-run
```

