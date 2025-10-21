#!/bin/bash
# Deploy ThirdEye Service and UI with OpenMetadata

set -e

DEPLOY_DIR="/opt/thirdeye-deployment"
OPENMETADATA_VERSION="1.5.0"
SERVER_IP="108.181.162.31"

echo "================================"
echo "THIRDEYE DEPLOYMENT SCRIPT"
echo "================================"
echo ""

# Create deployment directory
echo "1. Creating deployment directory..."
mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

# Clone repository (if not already cloned)
echo "2. Setting up codebase..."
if [ ! -d "$DEPLOY_DIR/OpenMetadata" ]; then
    git clone https://github.com/open-metadata/OpenMetadata.git
    cd OpenMetadata
    # Checkout the branch with ThirdEye
    git checkout feat/thirdeye-service-internal 2>/dev/null || git checkout main
else
    echo "Repository already exists, pulling latest changes..."
    cd OpenMetadata
    git pull
fi

echo ""
echo "================================"
echo "DEPLOYING OPENMETADATA"
echo "================================"

# Deploy OpenMetadata using Docker
echo "3. Deploying OpenMetadata..."
cd $DEPLOY_DIR/OpenMetadata/docker/docker-compose-quickstart
docker-compose down || true
docker-compose up -d

echo "Waiting for OpenMetadata to start..."
sleep 30

# Check if OpenMetadata is running
if docker-compose ps | grep -q "Up"; then
    echo "✓ OpenMetadata is running"
    echo "  Access at: http://$SERVER_IP:8585"
else
    echo "✗ OpenMetadata failed to start. Check logs with: docker-compose logs"
fi

echo ""
echo "================================"
echo "DEPLOYING THIRDEYE SERVICE"
echo "================================"

# Build and deploy ThirdEye Python Service
echo "4. Building ThirdEye Service..."
cd $DEPLOY_DIR/OpenMetadata/thirdeye-py-service

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://postgres:password@localhost:5432/thirdeye
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
ENVIRONMENT=production
LOG_LEVEL=INFO
OPENMETADATA_API_URL=http://localhost:8585/api
EOF

# Initialize database
echo "5. Initializing database..."
python3 -m src.thirdeye.db.migrate

# Create systemd service for ThirdEye
echo "6. Creating systemd service..."
cat > /etc/systemd/system/thirdeye-service.service << EOF
[Unit]
Description=ThirdEye Python Service
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=$DEPLOY_DIR/OpenMetadata/thirdeye-py-service
Environment="PATH=$DEPLOY_DIR/OpenMetadata/thirdeye-py-service/venv/bin"
ExecStart=$DEPLOY_DIR/OpenMetadata/thirdeye-py-service/venv/bin/uvicorn src.thirdeye.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start ThirdEye service
systemctl daemon-reload
systemctl enable thirdeye-service
systemctl restart thirdeye-service

echo "Waiting for ThirdEye service to start..."
sleep 10

if systemctl is-active --quiet thirdeye-service; then
    echo "✓ ThirdEye Service is running"
    echo "  Access at: http://$SERVER_IP:8000"
    echo "  Health check: http://$SERVER_IP:8000/health"
else
    echo "✗ ThirdEye Service failed to start. Check logs with: journalctl -u thirdeye-service -f"
fi

echo ""
echo "================================"
echo "DEPLOYING THIRDEYE UI"
echo "================================"

# Build and deploy ThirdEye UI
echo "7. Building ThirdEye UI..."
cd $DEPLOY_DIR/OpenMetadata/thirdeye-ui

# Install dependencies
npm install

# Create .env file
cat > .env.production << EOF
NEXT_PUBLIC_API_URL=http://$SERVER_IP:8000
NEXT_PUBLIC_OPENMETADATA_URL=http://$SERVER_IP:8585
EOF

# Build the application
npm run build

# Create systemd service for ThirdEye UI
echo "8. Creating systemd service for UI..."
cat > /etc/systemd/system/thirdeye-ui.service << EOF
[Unit]
Description=ThirdEye UI Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$DEPLOY_DIR/OpenMetadata/thirdeye-ui
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start ThirdEye UI
systemctl daemon-reload
systemctl enable thirdeye-ui
systemctl restart thirdeye-ui

echo "Waiting for ThirdEye UI to start..."
sleep 10

if systemctl is-active --quiet thirdeye-ui; then
    echo "✓ ThirdEye UI is running"
    echo "  Access at: http://$SERVER_IP:3000"
else
    echo "✗ ThirdEye UI failed to start. Check logs with: journalctl -u thirdeye-ui -f"
fi

echo ""
echo "================================"
echo "DEPLOYMENT SUMMARY"
echo "================================"
echo ""
echo "Services Status:"
echo "----------------"
echo "OpenMetadata:     http://$SERVER_IP:8585"
docker-compose -f $DEPLOY_DIR/OpenMetadata/docker/docker-compose-quickstart/docker-compose.yml ps
echo ""
echo "ThirdEye Service: http://$SERVER_IP:8000"
systemctl status thirdeye-service --no-pager | head -3
echo ""
echo "ThirdEye UI:      http://$SERVER_IP:3000"
systemctl status thirdeye-ui --no-pager | head -3
echo ""
echo "================================"
echo "DEPLOYMENT COMPLETE!"
echo "================================"
echo ""
echo "Useful Commands:"
echo "  - View ThirdEye Service logs: journalctl -u thirdeye-service -f"
echo "  - View ThirdEye UI logs: journalctl -u thirdeye-ui -f"
echo "  - View OpenMetadata logs: docker-compose -f $DEPLOY_DIR/OpenMetadata/docker/docker-compose-quickstart/docker-compose.yml logs -f"
echo "  - Restart services:"
echo "    systemctl restart thirdeye-service"
echo "    systemctl restart thirdeye-ui"
echo "    docker-compose -f $DEPLOY_DIR/OpenMetadata/docker/docker-compose-quickstart/docker-compose.yml restart"

