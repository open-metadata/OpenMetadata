# ThirdEye Server Documentation

## 📋 Table of Contents

1. [Server Information](#server-information)
2. [SSH Access](#ssh-access)
3. [System Requirements](#system-requirements)
4. [Database Configuration](#database-configuration)
5. [Project Structure](#project-structure)
6. [Installation & Setup](#installation--setup)
7. [Building & Deployment](#building--deployment)
8. [Service Management](#service-management)
9. [Git Workflow](#git-workflow)
10. [CI/CD Pipeline](#cicd-pipeline)
11. [Monitoring & Logs](#monitoring--logs)
12. [Troubleshooting](#troubleshooting)
13. [Security](#security)

---

## 🖥️ Server Information

### Server Details
- **IP Address**: `108.181.162.31`
- **Hostname**: `vps-ujre`
- **Operating System**: CentOS Stream 8
- **Provider**: [Your VPS Provider]
- **Region**: [Your Region]

### Domain Configuration
- **Production URL**: `https://coming.live`
- **OpenMetadata**: `https://coming.live:8585`
- **ThirdEye Backend**: `http://coming.live:8587` (internal)

---

## 🔐 SSH Access

### Connection Details

```bash
# Standard SSH connection
ssh root@108.181.162.31

# With specific key
ssh -i ~/.ssh/your-key.pem root@108.181.162.31
```

### SSH Users

| Username | Role | Home Directory | Shell |
|----------|------|----------------|-------|
| `root` | Administrator | `/root` | `/bin/bash` |

### SSH Key Setup (Recommended)

```bash
# On your local machine
ssh-keygen -t rsa -b 4096 -f ~/.ssh/thirdeye-server -C "thirdeye-deployment"

# Copy key to server
ssh-copy-id -i ~/.ssh/thirdeye-server.pub root@108.181.162.31

# Connect without password
ssh -i ~/.ssh/thirdeye-server root@108.181.162.31
```

### SSH Configuration (~/.ssh/config)

```
Host thirdeye-server
    HostName 108.181.162.31
    User root
    IdentityFile ~/.ssh/thirdeye-server
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

Then connect with: `ssh thirdeye-server`

---

## 💻 System Requirements

### Installed Software

```bash
# Check versions
git --version          # git version 2.43.0
docker --version       # Docker version 26.1.3
python3 --version      # Python 3.6.8 (system)
python3.11 --version   # Python 3.11.7 (for ThirdEye)
node --version         # Node.js (via PM2)
npm --version          # npm package manager
```

### Required Packages

```bash
# System packages
sudo yum install -y git python3.11 python3.11-devel gcc make

# Python packages (installed in venv)
# See: thirdeye-py-service/requirements.txt

# Node.js packages (installed via npm)
# See: thirdeye-ui/package.json
```

### Process Manager

```bash
# PM2 for Node.js applications
npm install -g pm2

# Check PM2 version
pm2 --version
```

---

## 🗄️ Database Configuration

### MySQL (Docker Container)

#### Container Details
```bash
# Container name: openmetadata_mysql
# Image: docker.getcollate.io/openmetadata/db:1.9.9
# Port: 3306 (0.0.0.0:3306->3306/tcp)
```

#### Database Credentials

| Database | User | Password | Schema |
|----------|------|----------|--------|
| `openmetadata_db` | `openmetadata_user` | `openmetadata_password` | Default |
| `thirdeye` | `openmetadata_user` | `openmetadata_password` | `thirdeye` |
| MySQL Root | `root` | `password` | All |

#### Connection Strings

```bash
# OpenMetadata Database
mysql://openmetadata_user:openmetadata_password@localhost:3306/openmetadata_db

# ThirdEye Database
mysql://openmetadata_user:openmetadata_password@localhost:3306/thirdeye
```

#### Accessing MySQL

```bash
# Via Docker exec
docker exec -it openmetadata_mysql mysql -u root -p

# Via MySQL client
mysql -h localhost -P 3306 -u openmetadata_user -p

# One-liner for quick queries
docker exec -i openmetadata_mysql mysql -u root -ppassword -e "SHOW DATABASES;"
```

#### ThirdEye Database Views

```sql
-- Important views in thirdeye schema
USE thirdeye;

SHOW TABLES;
-- v_table_purge_scores
-- v_datalake_health_metrics
-- entity_* tables
```

#### Backup & Restore

```bash
# Backup ThirdEye database
docker exec openmetadata_mysql mysqldump -u root -ppassword thirdeye > thirdeye_backup_$(date +%Y%m%d).sql

# Restore ThirdEye database
docker exec -i openmetadata_mysql mysql -u root -ppassword thirdeye < thirdeye_backup_20251028.sql

# Backup all databases
docker exec openmetadata_mysql mysqldump -u root -ppassword --all-databases > full_backup_$(date +%Y%m%d).sql
```

---

## 📁 Project Structure

### Base Directory
```
/opt/thirdeye-deployment/OpenMetadata/
```

### Directory Layout

```
/opt/thirdeye-deployment/OpenMetadata/
├── .git/                              # Git repository
├── openmetadata-service/              # OpenMetadata backend (Java)
│   ├── src/main/java/
│   │   └── org/openmetadata/service/
│   │       ├── clients/
│   │       │   ├── ThirdEyeClient.java
│   │       │   └── ThirdEyeService.java
│   │       ├── config/
│   │       │   └── ThirdEyeConfiguration.java
│   │       ├── resources/
│   │       │   └── ThirdEyeResource.java
│   │       └── exception/
│   │           └── ThirdEyeServiceException.java
│   └── pom.xml
│
├── thirdeye-py-service/               # ThirdEye Python Backend
│   ├── src/
│   │   └── thirdeye/
│   │       ├── app.py                 # Main FastAPI application
│   │       ├── config.py              # Configuration
│   │       ├── db.py                  # Database connections
│   │       ├── routers/               # API endpoints
│   │       │   ├── health.py
│   │       │   ├── dashboard.py
│   │       │   ├── zi_score.py
│   │       │   ├── techniques.py
│   │       │   ├── insights.py
│   │       │   └── action_items.py
│   │       ├── graphql/               # GraphQL schema
│   │       ├── repo/                  # Data access layer
│   │       └── services/              # Business logic
│   ├── venv/                          # Python virtual environment
│   ├── logs/                          # Service logs
│   │   └── thirdeye-service.log
│   ├── requirements.txt               # Python dependencies
│   ├── start-service.sh               # Start script
│   └── .env                           # Environment variables
│
├── thirdeye-ui/                       # Next.js Frontend
│   ├── src/
│   │   ├── app/                       # Next.js 15 App Router
│   │   │   ├── dashboard/
│   │   │   │   └── thirdeye/
│   │   │   │       ├── page.tsx       # Main ThirdEye dashboard
│   │   │   │       ├── insights/
│   │   │   │       └── techniques/
│   │   │   └── api/
│   │   │       └── thirdeye/
│   │   │           └── [...path]/
│   │   │               └── route.ts   # ThirdEye API proxy
│   │   ├── components/
│   │   ├── lib/
│   │   │   └── thirdeyeClient.ts      # API client
│   │   └── middleware.ts              # Auth middleware
│   ├── .next/                         # Build output
│   ├── node_modules/                  # NPM dependencies
│   ├── package.json                   # NPM config
│   ├── next.config.ts                 # Next.js config
│   └── .env.local                     # Environment variables
│
└── deployment/                        # Deployment scripts
    ├── run-thirdeye-ui.sh
    └── run-thirdeye-py.sh
```

### Important Files

| File | Purpose | Location |
|------|---------|----------|
| ThirdEye Python Config | Database & API settings | `thirdeye-py-service/src/thirdeye/config.py` |
| ThirdEye UI Config | Backend URL & auth | `thirdeye-ui/.env.local` |
| Service Logs | Python service logs | `thirdeye-py-service/logs/thirdeye-service.log` |
| UI Logs | Next.js logs | PM2: `~/.pm2/logs/thirdeye-ui-*.log` |

---

## 🚀 Installation & Setup

### Initial Server Setup

```bash
# 1. Update system packages
sudo yum update -y

# 2. Install required packages
sudo yum install -y git python3.11 python3.11-devel gcc make curl wget

# 3. Install Node.js (via nvm or direct)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# 4. Install PM2
npm install -g pm2

# 5. Install Docker (if not already installed)
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
```

### Clone Repository

```bash
# Create deployment directory
mkdir -p /opt/thirdeye-deployment
cd /opt/thirdeye-deployment

# Clone from GitHub
git clone https://github.com/shashionline/OpenMetadata.git
cd OpenMetadata

# Checkout the correct branch
git checkout feat/thirdeye-py-graphql
git pull origin feat/thirdeye-py-graphql
```

### Setup ThirdEye Python Service

```bash
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service

# Create virtual environment with Python 3.11
python3.11 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# Create logs directory
mkdir -p logs

# Configure environment (if needed)
cp .env.example .env
nano .env
```

### Setup ThirdEye UI

```bash
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui

# Install dependencies
npm install

# Configure environment
cp env.production.template .env.local
nano .env.local

# Build for production
npm run build
```

---

## 🔨 Building & Deployment

### ThirdEye Python Service

#### Build Process

```bash
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
pip install -r requirements.txt

# No build step needed for Python (interpreted language)
```

#### Configuration

Edit `thirdeye-py-service/src/thirdeye/config.py`:

```python
class Settings(BaseSettings):
    # Database Configuration
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_user: str = "openmetadata_user"
    mysql_password: str = "openmetadata_password"
    mysql_database: str = "thirdeye"
    
    # API Configuration
    api_v1_prefix: str = "/api/v1/thirdeye"
    environment: str = "production"
    log_level: str = "INFO"
```

Or use environment variables in `.env`:

```bash
# Database
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=openmetadata_user
MYSQL_PASSWORD=openmetadata_password
MYSQL_DATABASE=thirdeye

# API
ENVIRONMENT=production
LOG_LEVEL=INFO
```

#### Start Service

```bash
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
source venv/bin/activate
export PYTHONPATH=src

# Start in foreground (for testing)
python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload

# Start in background (production)
nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload > logs/thirdeye-service.log 2>&1 &

# Or use the start script
./start-service.sh
```

### ThirdEye UI

#### Configuration

Edit `thirdeye-ui/.env.local`:

```bash
# OpenMetadata Backend URL
OPENMETADATA_BASE_URL=http://coming.live:8585

# ThirdEye Backend URL (Python Service)
THIRDEYE_BACKEND_URL=http://127.0.0.1:8587

# ThirdEye UI URL
NEXTAUTH_URL=http://coming.live

# Port
PORT=80

# JWT Secret (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Environment
NODE_ENV=production
```

#### Build Process

```bash
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui

# Install dependencies (if not done)
npm install

# Build for production
npm run build

# Output will be in .next/ directory
```

#### Start Service

```bash
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui

# Start with PM2
pm2 start npm --name "thirdeye-ui" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions printed by this command
```

#### Or use deployment script:

```bash
cd /opt/thirdeye-deployment/OpenMetadata
./deployment/run-thirdeye-ui.sh
```

---

## 🔧 Service Management

### ThirdEye Python Service

#### Check Status

```bash
# Check if process is running
ps aux | grep uvicorn | grep 8587 | grep -v grep

# Check if port is listening
ss -tlnp | grep 8587

# Test health endpoint
curl -s http://localhost:8587/api/v1/thirdeye/health
```

#### Start Service

```bash
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
source venv/bin/activate
export PYTHONPATH=src
nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload > logs/thirdeye-service.log 2>&1 &
echo $! > thirdeye-py.pid
```

#### Stop Service

```bash
# Find the process
ps aux | grep uvicorn | grep 8587

# Kill by PID
kill $(cat thirdeye-py.pid)

# Or kill all uvicorn processes on port 8587
pkill -f "uvicorn.*8587"
```

#### Restart Service

```bash
# Stop
pkill -f "uvicorn.*8587"

# Wait a moment
sleep 2

# Start
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
source venv/bin/activate
export PYTHONPATH=src
nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload > logs/thirdeye-service.log 2>&1 &
```

### ThirdEye UI (PM2)

#### Check Status

```bash
# PM2 status
pm2 status

# Detailed info
pm2 info thirdeye-ui

# Check if Next.js is running
ps aux | grep next-server
```

#### Start Service

```bash
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui
pm2 start npm --name "thirdeye-ui" -- start
pm2 save
```

#### Stop Service

```bash
pm2 stop thirdeye-ui
```

#### Restart Service

```bash
# Restart
pm2 restart thirdeye-ui

# Restart and rebuild
pm2 stop thirdeye-ui
npm run build
pm2 start thirdeye-ui
pm2 save
```

#### Delete Service

```bash
pm2 delete thirdeye-ui
```

### OpenMetadata (Docker)

#### Check Status

```bash
# List all containers
docker ps

# Check specific containers
docker ps | grep -E "openmetadata|mysql|elasticsearch"

# Check container health
docker inspect openmetadata_mysql | grep -A 5 "Health"
```

#### Start/Stop Containers

```bash
# Start all OpenMetadata services
docker-compose -f docker-compose.yml up -d

# Stop all services
docker-compose -f docker-compose.yml down

# Restart specific container
docker restart openmetadata_mysql
docker restart openmetadata_server
```

---

## 📝 Git Workflow

### Branches

| Branch | Purpose | Status |
|--------|---------|--------|
| `main` | Production-ready code | Stable |
| `feat/thirdeye-py-graphql` | Current development (ThirdEye integration) | Active |
| `feat/thirdeye-service-internal` | Previous feature branch | Deprecated |

### Common Git Commands

```bash
# Check current branch
git branch

# Switch to branch
git checkout feat/thirdeye-py-graphql

# Pull latest changes
git pull origin feat/thirdeye-py-graphql

# Check status
git status

# View recent commits
git log --oneline -10

# View changes
git diff

# Stash changes
git stash

# Apply stashed changes
git stash pop
```

### Deployment Workflow

```bash
# 1. SSH to server
ssh root@108.181.162.31

# 2. Navigate to project
cd /opt/thirdeye-deployment/OpenMetadata

# 3. Stash any local changes
git stash

# 4. Pull latest code
git fetch origin
git pull origin feat/thirdeye-py-graphql

# 5. Rebuild Python service (if needed)
cd thirdeye-py-service
source venv/bin/activate
pip install -r requirements.txt

# 6. Restart Python service
pkill -f "uvicorn.*8587"
export PYTHONPATH=src
nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload > logs/thirdeye-service.log 2>&1 &

# 7. Rebuild UI
cd ../thirdeye-ui
npm install
npm run build

# 8. Restart UI
pm2 restart thirdeye-ui

# 9. Verify deployment
curl -s http://localhost:8587/api/v1/thirdeye/health
pm2 status
```

### Creating a New Feature

```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feat/your-feature-name

# Make changes, then commit
git add .
git commit -m "feat: your feature description"

# Push to remote
git push origin feat/your-feature-name

# Create pull request on GitHub
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/deploy-thirdeye.yml`:

```yaml
name: Deploy ThirdEye

on:
  push:
    branches:
      - feat/thirdeye-py-graphql
      - main
  pull_request:
    branches:
      - main

jobs:
  test-python:
    name: Test Python Service
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Python 3.11
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd thirdeye-py-service
          pip install -r requirements.txt
      
      - name: Run tests
        run: |
          cd thirdeye-py-service
          export PYTHONPATH=src
          # pytest tests/  # When you add tests

  test-ui:
    name: Test Next.js UI
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd thirdeye-ui
          npm ci
      
      - name: Build UI
        run: |
          cd thirdeye-ui
          npm run build
      
      - name: Run linter
        run: |
          cd thirdeye-ui
          npm run lint

  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [test-python, test-ui]
    if: github.ref == 'refs/heads/feat/thirdeye-py-graphql'
    
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/thirdeye-deployment/OpenMetadata
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
            
            # Verify
            sleep 5
            curl -f http://localhost:8587/api/v1/thirdeye/health || exit 1
```

### GitHub Secrets Configuration

Go to your GitHub repository → Settings → Secrets and add:

```
SERVER_HOST = 108.181.162.31
SERVER_USER = root
SERVER_SSH_KEY = [Your private SSH key content]
```

### Manual Deployment Script

Create `deploy.sh` in project root:

```bash
#!/bin/bash

# ThirdEye Deployment Script
# Usage: ./deploy.sh [branch-name]

set -e

BRANCH=${1:-feat/thirdeye-py-graphql}
PROJECT_DIR="/opt/thirdeye-deployment/OpenMetadata"

echo "======================================"
echo "ThirdEye Deployment Script"
echo "======================================"
echo "Branch: $BRANCH"
echo "Directory: $PROJECT_DIR"
echo ""

# Navigate to project
cd $PROJECT_DIR

# Pull latest code
echo "Step 1: Pulling latest code..."
git stash
git fetch origin
git checkout $BRANCH
git pull origin $BRANCH
echo "✓ Code updated"
echo ""

# Update Python service
echo "Step 2: Updating Python service..."
cd thirdeye-py-service
source venv/bin/activate
pip install -r requirements.txt
pkill -f "uvicorn.*8587" || echo "No Python service running"
sleep 2
export PYTHONPATH=src
nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload > logs/thirdeye-service.log 2>&1 &
echo "✓ Python service restarted"
echo ""

# Update UI
echo "Step 3: Updating UI..."
cd ../thirdeye-ui
npm install
npm run build
pm2 restart thirdeye-ui
echo "✓ UI rebuilt and restarted"
echo ""

# Verify
echo "Step 4: Verifying deployment..."
sleep 5
if curl -sf http://localhost:8587/api/v1/thirdeye/health > /dev/null; then
    echo "✓ Python service is healthy"
else
    echo "✗ Python service health check failed"
    exit 1
fi

PM2_STATUS=$(pm2 list | grep thirdeye-ui | grep online || true)
if [ -n "$PM2_STATUS" ]; then
    echo "✓ UI is running"
else
    echo "✗ UI is not running"
    exit 1
fi

echo ""
echo "======================================"
echo "Deployment Complete!"
echo "======================================"
echo "Python Service: http://localhost:8587"
echo "UI: https://coming.live"
echo ""
echo "View logs:"
echo "  Python: tail -f $PROJECT_DIR/thirdeye-py-service/logs/thirdeye-service.log"
echo "  UI:     pm2 logs thirdeye-ui"
```

Make it executable:

```bash
chmod +x deploy.sh

# Run deployment
./deploy.sh feat/thirdeye-py-graphql
```

---

## 📊 Monitoring & Logs

### ThirdEye Python Service Logs

```bash
# View logs (real-time)
tail -f /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/logs/thirdeye-service.log

# View last 100 lines
tail -100 /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/logs/thirdeye-service.log

# Search for errors
grep -i error /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/logs/thirdeye-service.log

# View logs by date
grep "2025-10-27" /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/logs/thirdeye-service.log
```

### ThirdEye UI Logs (PM2)

```bash
# View logs (real-time)
pm2 logs thirdeye-ui

# View last 100 lines
pm2 logs thirdeye-ui --lines 100

# View only errors
pm2 logs thirdeye-ui --err

# View specific log file
tail -f ~/.pm2/logs/thirdeye-ui-out.log
tail -f ~/.pm2/logs/thirdeye-ui-error.log
```

### MySQL Logs

```bash
# Docker container logs
docker logs openmetadata_mysql

# Follow logs
docker logs -f openmetadata_mysql --tail 100

# MySQL error log
docker exec openmetadata_mysql tail -f /var/log/mysql/error.log
```

### OpenMetadata Logs

```bash
# Container logs
docker logs openmetadata_server

# Follow logs
docker logs -f openmetadata_server --tail 100
```

### System Monitoring

```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check CPU usage
top

# Check running processes
ps aux | grep -E "uvicorn|next-server|node"

# Check open ports
ss -tlnp

# Check network connections
netstat -tupln
```

### Log Rotation

Create `/etc/logrotate.d/thirdeye`:

```
/opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    missingok
    copytruncate
}
```

Test log rotation:

```bash
logrotate -f /etc/logrotate.d/thirdeye
```

---

## 🔧 Troubleshooting

### Python Service Won't Start

```bash
# Check if port is already in use
ss -tlnp | grep 8587

# Kill existing process
pkill -f "uvicorn.*8587"

# Check Python version
python3.11 --version

# Verify virtual environment
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
source venv/bin/activate
which python

# Check dependencies
pip list

# Test import
python -c "import thirdeye; print('OK')"

# Check logs for errors
tail -50 logs/thirdeye-service.log
```

### UI Won't Start

```bash
# Check PM2 status
pm2 status

# Check Node processes
ps aux | grep node

# Rebuild UI
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui
npm run build

# Check environment variables
cat .env.local

# Clear Next.js cache
rm -rf .next
npm run build

# Restart PM2
pm2 restart thirdeye-ui
```

### Database Connection Issues

```bash
# Test MySQL connection
mysql -h localhost -P 3306 -u openmetadata_user -p

# Check if MySQL container is running
docker ps | grep mysql

# Check MySQL logs
docker logs openmetadata_mysql | tail -50

# Restart MySQL
docker restart openmetadata_mysql

# Verify database exists
docker exec -i openmetadata_mysql mysql -u root -ppassword -e "SHOW DATABASES;"

# Verify ThirdEye schema
docker exec -i openmetadata_mysql mysql -u root -ppassword thirdeye -e "SHOW TABLES;"
```

### API Connection Issues

```bash
# Test Python service
curl -v http://localhost:8587/api/v1/thirdeye/health

# Test from UI perspective (IPv4 vs IPv6)
curl -v http://127.0.0.1:8587/api/v1/thirdeye/health

# Check firewall
iptables -L -n | grep 8587

# Check if service is listening on correct interface
ss -tlnp | grep 8587
# Should show: 0.0.0.0:8587 (not 127.0.0.1:8587)
```

### High Memory Usage

```bash
# Check memory
free -h

# Find memory-heavy processes
ps aux --sort=-%mem | head -10

# Restart services
pm2 restart thirdeye-ui
pkill -f "uvicorn.*8587" && ./start-service.sh
```

### Disk Space Issues

```bash
# Check disk usage
df -h

# Find large directories
du -sh /opt/thirdeye-deployment/OpenMetadata/* | sort -h

# Clean Docker
docker system prune -a

# Clean PM2 logs
pm2 flush

# Clean Python cache
find /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service -type d -name __pycache__ -exec rm -rf {} +

# Clean Next.js cache
rm -rf /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui/.next
```

---

## 🔒 Security

### Firewall Configuration

```bash
# Check current firewall status
iptables -L -n

# Allow SSH (if not already)
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow OpenMetadata
iptables -A INPUT -p tcp --dport 8585 -j ACCEPT

# ThirdEye backend (internal only - don't expose publicly)
# iptables -A INPUT -p tcp --dport 8587 -j ACCEPT  # Be careful!

# Save rules
service iptables save
```

### SSL/TLS Configuration

#### Using Certbot (Let's Encrypt)

```bash
# Install Certbot
sudo yum install -y certbot

# Get certificate
sudo certbot certonly --standalone -d coming.live

# Certificates will be in:
# /etc/letsencrypt/live/coming.live/fullchain.pem
# /etc/letsencrypt/live/coming.live/privkey.pem

# Auto-renewal
sudo certbot renew --dry-run
```

#### Configure Nginx as Reverse Proxy

```bash
# Install Nginx
sudo yum install -y nginx

# Configure
sudo nano /etc/nginx/conf.d/thirdeye.conf
```

```nginx
server {
    listen 80;
    server_name coming.live;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name coming.live;

    ssl_certificate /etc/letsencrypt/live/coming.live/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/coming.live/privkey.pem;

    # ThirdEye UI
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # OpenMetadata
    location /api/v1 {
        proxy_pass http://localhost:8585;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# Test configuration
sudo nginx -t

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Environment Variables Security

```bash
# Secure .env files
chmod 600 /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/.env
chmod 600 /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui/.env.local

# Generate strong JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Update .env.local with generated secret
```

### MySQL Security

```bash
# Run MySQL secure installation
docker exec -it openmetadata_mysql mysql_secure_installation

# Create limited user for ThirdEye
docker exec -i openmetadata_mysql mysql -u root -ppassword << EOF
CREATE USER 'thirdeye_app'@'%' IDENTIFIED BY 'strong_password_here';
GRANT SELECT, INSERT, UPDATE ON thirdeye.* TO 'thirdeye_app'@'%';
FLUSH PRIVILEGES;
EOF
```

### Regular Security Updates

```bash
# Update system packages
sudo yum update -y

# Update Python packages
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
source venv/bin/activate
pip list --outdated
pip install --upgrade [package-name]

# Update Node packages
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui
npm outdated
npm update
```

---

## 📚 Additional Resources

### Documentation Links

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [OpenMetadata Documentation](https://docs.open-metadata.org/)
- [MySQL Documentation](https://dev.mysql.com/doc/)

### Useful Commands Reference

```bash
# Quick service restart
pkill -f "uvicorn.*8587" && cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service && source venv/bin/activate && export PYTHONPATH=src && nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload > logs/thirdeye-service.log 2>&1 &

# Full rebuild and restart
cd /opt/thirdeye-deployment/OpenMetadata && git pull && cd thirdeye-py-service && pip install -r requirements.txt && pkill -f "uvicorn.*8587" && export PYTHONPATH=src && nohup python3.11 -m uvicorn thirdeye.app:app --host 0.0.0.0 --port 8587 --reload > logs/thirdeye-service.log 2>&1 & && cd ../thirdeye-ui && npm install && npm run build && pm2 restart thirdeye-ui

# Health check all services
echo "Python:" && curl -s http://localhost:8587/api/v1/thirdeye/health && echo "" && echo "UI:" && pm2 list | grep thirdeye-ui && echo "MySQL:" && docker ps | grep mysql
```

---

## 📞 Support & Contacts

### Team Contacts

| Role | Name | Contact |
|------|------|---------|
| Project Lead | [Your Name] | [Email/Slack] |
| DevOps | [Name] | [Email/Slack] |
| Backend Dev | [Name] | [Email/Slack] |
| Frontend Dev | [Name] | [Email/Slack] |

### Escalation Process

1. Check logs and troubleshooting section
2. Search documentation and GitHub issues
3. Contact team via Slack/Email
4. Create GitHub issue with details
5. Escalate to project lead if critical

---

**Last Updated**: October 28, 2025  
**Version**: 1.0.0  
**Maintained by**: ThirdEye Team

