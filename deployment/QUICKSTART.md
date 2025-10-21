# Quick Start Deployment Guide

## Option 1: Automated Remote Deployment (Easiest)

Run this from your **local machine** (Windows):

```bash
cd /c/Users/shash/Documents/GitHub/OpenMetadata
bash deployment/deploy-remote.sh
```

This will:
1. Upload all scripts to the server
2. Give you options to run system check, install dependencies, and deploy
3. Walk you through each step with confirmations

## Option 2: Manual Deployment

### Step 1: Upload Scripts

```bash
scp deployment/*.sh root@108.181.162.31:/root/
```

### Step 2: Connect to Server

```bash
ssh root@108.181.162.31
```

### Step 3: Run Commands

```bash
# Make scripts executable
chmod +x /root/*.sh

# Check system
bash /root/server-check.sh

# Install dependencies (takes ~10-15 minutes)
bash /root/install-dependencies.sh

# Deploy services (takes ~20-30 minutes)
bash /root/deploy-thirdeye.sh
```

## Option 3: Copy-Paste Individual Commands

If you're already logged into the server, you can copy and paste commands from the scripts one by one.

### System Check Commands

```bash
# OS info
cat /etc/os-release

# Resources
free -h
df -h
nproc

# Check installed software
docker --version
docker-compose --version
python3 --version
node --version
```

### Install Dependencies Commands

```bash
# Update system
yum update -y

# Install Docker
yum install -y yum-utils
yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
yum install -y docker-ce docker-ce-cli containerd.io
systemctl start docker
systemctl enable docker

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Python & Node
yum install -y python3 python3-pip
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# Configure firewall
firewall-cmd --permanent --add-port=8585/tcp
firewall-cmd --permanent --add-port=3000/tcp
firewall-cmd --permanent --add-port=8000/tcp
firewall-cmd --reload
```

### Deploy Services Commands

```bash
# Create deployment directory
mkdir -p /opt/thirdeye-deployment
cd /opt/thirdeye-deployment

# Clone repo
git clone https://github.com/open-metadata/OpenMetadata.git
cd OpenMetadata
git checkout feat/thirdeye-service-internal

# Deploy OpenMetadata
cd docker/docker-compose-quickstart
docker-compose up -d

# Deploy ThirdEye Service
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create ThirdEye service
cat > /etc/systemd/system/thirdeye-service.service << 'EOF'
[Unit]
Description=ThirdEye Python Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service
Environment="PATH=/opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/venv/bin"
ExecStart=/opt/thirdeye-deployment/OpenMetadata/thirdeye-py-service/venv/bin/uvicorn src.thirdeye.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable thirdeye-service
systemctl start thirdeye-service

# Deploy ThirdEye UI
cd /opt/thirdeye-deployment/OpenMetadata/thirdeye-ui
npm install
npm run build

# Create ThirdEye UI service
cat > /etc/systemd/system/thirdeye-ui.service << 'EOF'
[Unit]
Description=ThirdEye UI
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/thirdeye-deployment/OpenMetadata/thirdeye-ui
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable thirdeye-ui
systemctl start thirdeye-ui
```

## Verify Deployment

```bash
# Check services
systemctl status thirdeye-service
systemctl status thirdeye-ui
docker ps

# Test endpoints
curl http://localhost:8000/health
curl http://localhost:8585/api/v1/system/version
curl http://localhost:3000
```

## Access Services

- **OpenMetadata**: http://108.181.162.31:8585
- **ThirdEye Service**: http://108.181.162.31:8000
- **ThirdEye UI**: http://108.181.162.31:3000

## Common Issues

### Port Already in Use
```bash
# Check what's using the port
netstat -tuln | grep :8000

# Kill the process
kill -9 $(lsof -t -i:8000)
```

### Service Won't Start
```bash
# View logs
journalctl -u thirdeye-service -f
journalctl -u thirdeye-ui -f
```

### Docker Issues
```bash
# Restart Docker
systemctl restart docker

# View container logs
docker logs <container-name>
```

## Need Help?

See the full [README.md](README.md) for detailed troubleshooting and configuration options.

