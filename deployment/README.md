# ThirdEye & OpenMetadata Deployment Guide

This directory contains scripts for deploying ThirdEye and OpenMetadata on a remote server.

## Server Information
- **IP Address**: 108.181.162.31
- **OS**: CentOS/RHEL 8 (Linux 4.18.0-553.6.1.el8.x86_64)
- **User**: root

## Deployment Steps

### 1. Upload Scripts to Server

From your local machine, upload the scripts:

```bash
scp deployment/*.sh root@108.181.162.31:/root/
```

Or manually copy the scripts to the server.

### 2. Connect to Server

```bash
ssh root@108.181.162.31
```

### 3. Make Scripts Executable

```bash
chmod +x /root/*.sh
```

### 4. Run System Check

```bash
bash /root/server-check.sh
```

This will show you:
- OS information
- CPU, memory, and disk space
- Installed software (Docker, Git, Python, Node.js)
- Available ports
- Running services

### 5. Install Dependencies

```bash
bash /root/install-dependencies.sh
```

This will install:
- Docker & Docker Compose
- Python 3 & pip
- Node.js & npm
- Git and other basic tools
- Configure firewall for required ports

**Note**: This step may take 10-15 minutes.

### 6. Deploy Services

```bash
bash /root/deploy-thirdeye.sh
```

This will:
- Clone the OpenMetadata repository
- Deploy OpenMetadata using Docker Compose
- Build and deploy ThirdEye Python Service
- Build and deploy ThirdEye UI
- Create systemd services for automatic startup
- Configure all necessary environment variables

**Note**: This step may take 20-30 minutes depending on your server's internet speed.

## Services & Ports

After successful deployment, the following services will be available:

| Service | Port | URL |
|---------|------|-----|
| OpenMetadata | 8585 | http://108.181.162.31:8585 |
| ThirdEye Service | 8000 | http://108.181.162.31:8000 |
| ThirdEye UI | 3000 | http://108.181.162.31:3000 |
| MySQL | 3306 | localhost:3306 |
| Elasticsearch | 9200 | localhost:9200 |

## Service Management

### Check Service Status

```bash
# ThirdEye Service
systemctl status thirdeye-service

# ThirdEye UI
systemctl status thirdeye-ui

# OpenMetadata (Docker)
cd /opt/thirdeye-deployment/OpenMetadata/docker/docker-compose-quickstart
docker-compose ps
```

### View Logs

```bash
# ThirdEye Service logs
journalctl -u thirdeye-service -f

# ThirdEye UI logs
journalctl -u thirdeye-ui -f

# OpenMetadata logs
cd /opt/thirdeye-deployment/OpenMetadata/docker/docker-compose-quickstart
docker-compose logs -f
```

### Restart Services

```bash
# Restart ThirdEye Service
systemctl restart thirdeye-service

# Restart ThirdEye UI
systemctl restart thirdeye-ui

# Restart OpenMetadata
cd /opt/thirdeye-deployment/OpenMetadata/docker/docker-compose-quickstart
docker-compose restart
```

### Stop Services

```bash
# Stop ThirdEye Service
systemctl stop thirdeye-service

# Stop ThirdEye UI
systemctl stop thirdeye-ui

# Stop OpenMetadata
cd /opt/thirdeye-deployment/OpenMetadata/docker/docker-compose-quickstart
docker-compose down
```

## Troubleshooting

### Service Won't Start

1. Check logs for errors:
   ```bash
   journalctl -u thirdeye-service -n 50
   journalctl -u thirdeye-ui -n 50
   ```

2. Check if ports are already in use:
   ```bash
   netstat -tuln | grep -E ':(3000|8000|8585)'
   ```

3. Verify dependencies are installed:
   ```bash
   docker --version
   python3 --version
   node --version
   ```

### Database Connection Issues

1. Check if PostgreSQL container is running:
   ```bash
   docker ps | grep postgres
   ```

2. Check database logs:
   ```bash
   docker logs <postgres-container-id>
   ```

### UI Build Failures

1. Clear node_modules and rebuild:
   ```bash
   cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui
   rm -rf node_modules
   npm install
   npm run build
   ```

### Docker Issues

1. Restart Docker service:
   ```bash
   systemctl restart docker
   ```

2. Clean up Docker resources:
   ```bash
   docker system prune -a
   ```

## Updates & Maintenance

### Update ThirdEye Code

```bash
cd /opt/thirdeye-deployment/OpenMetadata
git pull
systemctl restart thirdeye-service
systemctl restart thirdeye-ui
```

### Update OpenMetadata

```bash
cd /opt/thirdeye-deployment/OpenMetadata/docker/docker-compose-quickstart
docker-compose pull
docker-compose up -d
```

## Security Recommendations

1. **Change default passwords** for all services
2. **Set up SSL/TLS** using Let's Encrypt or similar
3. **Configure a firewall** to limit access to required ports only
4. **Set up monitoring** for service health
5. **Enable automated backups** for databases
6. **Use environment variables** for sensitive configuration

## Additional Configuration

### Set up Nginx Reverse Proxy (Optional)

```bash
yum install -y nginx

# Configure Nginx for reverse proxy
# Create config at /etc/nginx/conf.d/thirdeye.conf
```

### Set up SSL with Let's Encrypt (Optional)

```bash
yum install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

## Support

For issues or questions:
- Check OpenMetadata documentation: https://docs.open-metadata.org
- Review ThirdEye service logs
- Verify all prerequisites are met

## Deployment Directory Structure

```
/opt/thirdeye-deployment/
├── OpenMetadata/
│   ├── docker/
│   │   └── docker-compose-quickstart/
│   ├── thirdeye-py-service/
│   │   ├── src/
│   │   ├── venv/
│   │   └── .env
│   └── thirdeye-ui/
│       ├── src/
│       ├── node_modules/
│       └── .env.production
```

