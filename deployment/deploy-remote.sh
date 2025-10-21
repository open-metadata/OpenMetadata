#!/bin/bash
# Remote Deployment Script - Run this from your local machine

SERVER="108.181.162.31"
USER="root"
REMOTE_DIR="/root/deployment"

echo "================================"
echo "REMOTE DEPLOYMENT TO $SERVER"
echo "================================"
echo ""

# Check if we can connect
echo "1. Testing SSH connection..."
ssh -o ConnectTimeout=10 $USER@$SERVER "echo 'Connection successful'" || {
    echo "Failed to connect to server. Please check:"
    echo "  - Server IP: $SERVER"
    echo "  - SSH credentials"
    echo "  - Network connectivity"
    exit 1
}

# Create remote directory
echo "2. Creating remote directory..."
ssh $USER@$SERVER "mkdir -p $REMOTE_DIR"

# Upload scripts
echo "3. Uploading deployment scripts..."
scp deployment/server-check.sh $USER@$SERVER:$REMOTE_DIR/
scp deployment/install-dependencies.sh $USER@$SERVER:$REMOTE_DIR/
scp deployment/deploy-thirdeye.sh $USER@$SERVER:$REMOTE_DIR/
scp deployment/README.md $USER@$SERVER:$REMOTE_DIR/

# Make scripts executable
echo "4. Making scripts executable..."
ssh $USER@$SERVER "chmod +x $REMOTE_DIR/*.sh"

echo ""
echo "✓ Scripts uploaded successfully!"
echo ""
echo "================================"
echo "NEXT STEPS"
echo "================================"
echo ""
echo "Choose an option:"
echo ""
echo "Option 1: Run all steps automatically (recommended)"
echo "  ssh $USER@$SERVER 'bash $REMOTE_DIR/server-check.sh && bash $REMOTE_DIR/install-dependencies.sh && bash $REMOTE_DIR/deploy-thirdeye.sh'"
echo ""
echo "Option 2: Run steps manually"
echo "  1. Connect to server: ssh $USER@$SERVER"
echo "  2. Run system check: bash $REMOTE_DIR/server-check.sh"
echo "  3. Install dependencies: bash $REMOTE_DIR/install-dependencies.sh"
echo "  4. Deploy services: bash $REMOTE_DIR/deploy-thirdeye.sh"
echo ""
echo "Option 3: Auto-deploy now (will start immediately)"
read -p "Do you want to start automatic deployment now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Starting automatic deployment..."
    echo "================================"
    echo ""
    
    echo "Step 1: System Check"
    echo "--------------------"
    ssh $USER@$SERVER "bash $REMOTE_DIR/server-check.sh"
    
    echo ""
    read -p "Continue with installation? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 0
    fi
    
    echo ""
    echo "Step 2: Installing Dependencies"
    echo "--------------------------------"
    ssh $USER@$SERVER "bash $REMOTE_DIR/install-dependencies.sh"
    
    echo ""
    read -p "Continue with deployment? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 0
    fi
    
    echo ""
    echo "Step 3: Deploying Services"
    echo "--------------------------"
    ssh $USER@$SERVER "bash $REMOTE_DIR/deploy-thirdeye.sh"
    
    echo ""
    echo "================================"
    echo "DEPLOYMENT COMPLETE!"
    echo "================================"
    echo ""
    echo "Access your services at:"
    echo "  - OpenMetadata: http://$SERVER:8585"
    echo "  - ThirdEye Service: http://$SERVER:8000"
    echo "  - ThirdEye UI: http://$SERVER:3000"
else
    echo "Automatic deployment cancelled. Run scripts manually."
fi

