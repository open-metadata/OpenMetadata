# ThirdEye Operations Runbook

Quick reference guide for common operational tasks.

## 📋 Quick Links

- **Server**: `ssh root@108.181.162.31`
- **Production URL**: https://coming.live
- **Logs**: `/opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/logs/`
- **Project**: `/opt/thirdeye-deployment/OpenMetadata/`

---

## 🚀 Service Management

### Check Service Status

```bash
# Python Service
ps aux | grep uvicorn | grep 8587
ss -tlnp | grep 8587
curl http://localhost:8587/api/v1/thirdeye/health

# UI
pm2 status
pm2 list | grep thirdeye-ui

# MySQL
docker ps | grep mysql
```

### Start Services

```bash
# Python Service
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
source venv/bin/activate
export PYTHONPATH=src
nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload > logs/thirdeye-service.log 2>&1 &

# UI
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui
pm2 start npm --name "thirdeye-ui" -- start

# MySQL (if needed)
docker start openmetadata_mysql
```

### Stop Services

```bash
# Python Service
pkill -f "uvicorn.*8587"

# UI
pm2 stop thirdeye-ui

# MySQL (careful!)
docker stop openmetadata_mysql
```

### Restart Services

```bash
# Python Service
pkill -f "uvicorn.*8587"
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
source venv/bin/activate
export PYTHONPATH=src
nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload > logs/thirdeye-service.log 2>&1 &

# UI
pm2 restart thirdeye-ui

# MySQL
docker restart openmetadata_mysql
```

---

## 📊 Monitoring

### View Logs

```bash
# Python Service (real-time)
tail -f /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/logs/thirdeye-service.log

# UI (real-time)
pm2 logs thirdeye-ui

# MySQL
docker logs -f openmetadata_mysql

# Last 100 lines
tail -100 /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/logs/thirdeye-service.log

# Search for errors
grep -i error /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/logs/thirdeye-service.log | tail -20
```

### Check Resource Usage

```bash
# Disk space
df -h

# Memory
free -h

# CPU and processes
top
htop

# Specific process memory
ps aux --sort=-%mem | head -10

# Network connections
ss -tunap | grep -E "8587|3000|3306"
```

### Database Checks

```bash
# Connect to MySQL
docker exec -it openmetadata_mysql mysql -u root -ppassword

# Check databases
docker exec -i openmetadata_mysql mysql -u root -ppassword -e "SHOW DATABASES;"

# Check ThirdEye tables
docker exec -i openmetadata_mysql mysql -u root -ppassword thirdeye -e "SHOW TABLES;"

# Check data
docker exec -i openmetadata_mysql mysql -u root -ppassword thirdeye -e "SELECT COUNT(*) FROM v_table_purge_scores;"
```

---

## 🔄 Deployment

### Quick Deploy (Pull Latest Code)

```bash
cd /opt/thirdeye-deployment/OpenMetadata

# Pull code
git stash
git pull origin feat/thirdeye-py-graphql

# Update Python service
cd thirdeye-py-service
source venv/bin/activate
pip install -r requirements.txt
pkill -f "uvicorn.*8587"
export PYTHONPATH=src
nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload > logs/thirdeye-service.log 2>&1 &

# Update UI
cd ../thirdeye-ui
npm install
npm run build
pm2 restart thirdeye-ui
```

### Full Rebuild

```bash
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui

# Stop UI
pm2 stop thirdeye-ui

# Clean build
rm -rf .next node_modules
npm install
npm run build

# Restart
pm2 start thirdeye-ui
```

---

## 🔧 Troubleshooting

### Python Service Won't Start

```bash
# 1. Check if port is in use
ss -tlnp | grep 8587
pkill -f "uvicorn.*8587"

# 2. Check virtual environment
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
source venv/bin/activate
which python  # Should point to venv

# 3. Test import
python -c "import thirdeye; print('OK')"

# 4. Check dependencies
pip list | grep -E "fastapi|uvicorn|sqlalchemy"

# 5. Check logs
tail -50 logs/thirdeye-service.log

# 6. Test manually (foreground)
export PYTHONPATH=src
python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587
```

### UI Won't Start

```bash
# 1. Check PM2 status
pm2 status
pm2 describe thirdeye-ui

# 2. Check logs
pm2 logs thirdeye-ui --lines 50

# 3. Delete and recreate
pm2 delete thirdeye-ui
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui
npm run build
pm2 start npm --name "thirdeye-ui" -- start
pm2 save

# 4. Check environment
cat .env.local | grep THIRDEYE_BACKEND_URL

# 5. Clear cache and rebuild
rm -rf .next
npm run build
pm2 restart thirdeye-ui
```

### Database Connection Issues

```bash
# 1. Check MySQL is running
docker ps | grep mysql

# 2. Test connection
mysql -h localhost -P 3306 -u openmetadata_user -popen metadata_password

# 3. Check credentials in config
cat /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/src/thirdeye/config.py | grep -A 5 "mysql"

# 4. Check MySQL logs
docker logs openmetadata_mysql | tail -100

# 5. Restart MySQL
docker restart openmetadata_mysql
sleep 10
curl http://localhost:8587/api/v1/thirdeye/health
```

### API Errors (500, 404)

```bash
# 1. Check Python service logs
tail -50 /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/logs/thirdeye-service.log | grep ERROR

# 2. Test endpoint directly
curl -v http://localhost:8587/api/v1/thirdeye/health
curl -v http://localhost:8587/api/v1/thirdeye/dashboard/data

# 3. Check database views exist
docker exec -i openmetadata_mysql mysql -u root -ppassword thirdeye -e "SELECT COUNT(*) FROM v_table_purge_scores;"

# 4. Restart Python service
pkill -f "uvicorn.*8587"
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
source venv/bin/activate
export PYTHONPATH=src
nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload > logs/thirdeye-service.log 2>&1 &
```

### High Memory/CPU Usage

```bash
# 1. Identify culprit
top
ps aux --sort=-%mem | head -10
ps aux --sort=-%cpu | head -10

# 2. Restart services
pm2 restart thirdeye-ui
pkill -f "uvicorn.*8587" && ./start-service.sh

# 3. Check for memory leaks in logs
grep -i "memory\|oom" /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/logs/thirdeye-service.log
```

### Disk Space Full

```bash
# 1. Check disk usage
df -h

# 2. Find large files
du -sh /opt/thirdeye-deployment/OpenMetadata/* | sort -h
du -sh /var/lib/docker/* | sort -h

# 3. Clean Docker
docker system prune -a

# 4. Clean logs
pm2 flush
> /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/logs/thirdeye-service.log

# 5. Remove old node_modules
find /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui -name "node_modules" -type d -prune -exec rm -rf {} +

# 6. Remove Python cache
find /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service -type d -name __pycache__ -exec rm -rf {} +
```

---

## 📦 Backup & Restore

### Create Backup

```bash
# Full backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p /opt/thirdeye-deployment/backups/$TIMESTAMP

# Backup code
cp -r /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service /opt/thirdeye-deployment/backups/$TIMESTAMP/
cp -r /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui /opt/thirdeye-deployment/backups/$TIMESTAMP/

# Backup database
docker exec openmetadata_mysql mysqldump -u root -ppassword thirdeye > /opt/thirdeye-deployment/backups/$TIMESTAMP/thirdeye_db.sql

echo "Backup created: /opt/thirdeye-deployment/backups/$TIMESTAMP"
```

### Restore from Backup

```bash
# List backups
ls -lhtr /opt/thirdeye-deployment/backups/

# Restore specific backup
BACKUP_VERSION="20251028_120000"

# Stop services
pkill -f "uvicorn.*8587"
pm2 stop thirdeye-ui

# Restore code
cp -r /opt/thirdeye-deployment/backups/$BACKUP_VERSION/* /opt/thirdeye-deployment/OpenMetadata/

# Restore database (if needed)
docker exec -i openmetadata_mysql mysql -u root -ppassword thirdeye < /opt/thirdeye-deployment/backups/$BACKUP_VERSION/thirdeye_db.sql

# Restart services
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
source venv/bin/activate
export PYTHONPATH=src
nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload > logs/thirdeye-service.log 2>&1 &

cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui
pm2 restart thirdeye-ui
```

---

## 🔐 Security

### Update Passwords

```bash
# Generate new JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Update .env.local
nano /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui/.env.local
# Change JWT_SECRET=

# Rebuild UI
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui
npm run build
pm2 restart thirdeye-ui
```

### SSL Certificate Renewal

```bash
# Renew Let's Encrypt certificate
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run

# Reload Nginx
sudo nginx -t
sudo systemctl reload nginx
```

### Check for Updates

```bash
# System packages
sudo yum check-update

# Python packages
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
source venv/bin/activate
pip list --outdated

# Node packages
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui
npm outdated
```

---

## 📱 Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| On-Call Engineer | [Name] | [Phone/Email] |
| DevOps Lead | [Name] | [Phone/Email] |
| Database Admin | [Name] | [Phone/Email] |
| Project Lead | [Name] | [Phone/Email] |

---

## 🆘 Emergency Procedures

### Complete Service Outage

```bash
# 1. Check all services
docker ps
pm2 status
ps aux | grep uvicorn

# 2. Check MySQL
docker restart openmetadata_mysql
sleep 10

# 3. Restart Python service
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
source venv/bin/activate
export PYTHONPATH=src
pkill -f "uvicorn.*8587"
nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload > logs/thirdeye-service.log 2>&1 &

# 4. Restart UI
pm2 restart thirdeye-ui

# 5. Verify
curl http://localhost:8587/api/v1/thirdeye/health
pm2 list | grep thirdeye-ui

# 6. If still failing, rollback
/opt/thirdeye-deployment/OpenMetadata/deployment/rollback.sh
```

### Database Corruption

```bash
# 1. Stop all services
pkill -f "uvicorn.*8587"
pm2 stop thirdeye-ui

# 2. Backup current state
docker exec openmetadata_mysql mysqldump -u root -ppassword thirdeye > /tmp/thirdeye_emergency_backup.sql

# 3. Restore from latest good backup
ls -lhtr /opt/thirdeye-deployment/backups/
docker exec -i openmetadata_mysql mysql -u root -ppassword thirdeye < /opt/thirdeye-deployment/backups/LATEST/thirdeye_db.sql

# 4. Restart services
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
source venv/bin/activate
export PYTHONPATH=src
nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload > logs/thirdeye-service.log 2>&1 &

pm2 restart thirdeye-ui
```

### Server Crash/Reboot

```bash
# Services to restart after reboot:

# 1. Docker
sudo systemctl start docker

# 2. MySQL container
docker start openmetadata_mysql
docker start openmetadata_server
docker start openmetadata_elasticsearch

# 3. Python service
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
source venv/bin/activate
export PYTHONPATH=src
nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload > logs/thirdeye-service.log 2>&1 &

# 4. UI (should auto-start with PM2)
pm2 resurrect
pm2 restart thirdeye-ui

# 5. Verify all services
docker ps
pm2 status
curl http://localhost:8587/api/v1/thirdeye/health
```

---

## 📊 Health Check Script

Save as `/opt/thirdeye-deployment/health-check.sh`:

```bash
#!/bin/bash

echo "======================================"
echo "ThirdEye Health Check"
echo "======================================"
echo ""

# Python Service
echo "1. Python Service"
if curl -sf http://localhost:8587/api/v1/thirdeye/health > /dev/null; then
  echo "   ✓ Healthy (http://localhost:8587)"
else
  echo "   ✗ Unhealthy or unreachable"
fi

# UI
echo "2. ThirdEye UI"
if pm2 list | grep -q "thirdeye-ui.*online"; then
  echo "   ✓ Running"
else
  echo "   ✗ Not running"
fi

# MySQL
echo "3. MySQL Database"
if docker ps | grep -q "openmetadata_mysql.*Up"; then
  echo "   ✓ Running"
else
  echo "   ✗ Not running"
fi

# Disk Space
echo "4. Disk Space"
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 80 ]; then
  echo "   ✓ OK ($DISK_USAGE% used)"
else
  echo "   ⚠ Warning ($DISK_USAGE% used)"
fi

# Memory
echo "5. Memory Usage"
MEM_USAGE=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')
MEM_USAGE_INT=$(printf "%.0f" $MEM_USAGE)
if [ "$MEM_USAGE_INT" -lt 80 ]; then
  echo "   ✓ OK ($MEM_USAGE_INT% used)"
else
  echo "   ⚠ Warning ($MEM_USAGE_INT% used)"
fi

echo ""
echo "======================================"
```

Make it executable:
```bash
chmod +x /opt/thirdeye-deployment/health-check.sh

# Run it
/opt/thirdeye-deployment/health-check.sh
```

---

**Last Updated**: October 28, 2025  
**Version**: 1.0.0  
**For Emergencies**: Check #thirdeye-ops Slack channel

