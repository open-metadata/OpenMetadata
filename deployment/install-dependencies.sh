#!/bin/bash
# Install Dependencies for ThirdEye and OpenMetadata Deployment

set -e

echo "================================"
echo "INSTALLING DEPENDENCIES"
echo "================================"
echo ""

# Update system
echo "1. Updating system packages..."
yum update -y

# Install basic tools
echo "2. Installing basic tools..."
yum install -y wget curl git vim net-tools

# Install Docker
echo "3. Installing Docker..."
if ! command -v docker &> /dev/null; then
    yum install -y yum-utils
    yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl start docker
    systemctl enable docker
    echo "Docker installed successfully"
else
    echo "Docker is already installed"
fi

# Install Docker Compose (standalone)
echo "4. Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo "Docker Compose installed successfully"
else
    echo "Docker Compose is already installed"
fi

# Install Python 3
echo "5. Installing Python 3..."
if ! command -v python3 &> /dev/null; then
    yum install -y python3 python3-pip python3-devel
    echo "Python 3 installed successfully"
else
    echo "Python 3 is already installed"
fi

# Install Node.js
echo "6. Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
    yum install -y nodejs
    echo "Node.js installed successfully"
else
    echo "Node.js is already installed"
fi

# Configure firewall
echo "7. Configuring firewall..."
if command -v firewall-cmd &> /dev/null; then
    # OpenMetadata UI
    firewall-cmd --permanent --add-port=8585/tcp
    # ThirdEye UI
    firewall-cmd --permanent --add-port=3000/tcp
    # ThirdEye Service
    firewall-cmd --permanent --add-port=8000/tcp
    # MySQL
    firewall-cmd --permanent --add-port=3306/tcp
    # Elasticsearch
    firewall-cmd --permanent --add-port=9200/tcp
    firewall-cmd --reload
    echo "Firewall configured"
else
    echo "Firewall not available or disabled"
fi

echo ""
echo "================================"
echo "INSTALLATION COMPLETE"
echo "================================"
echo ""
echo "Installed versions:"
docker --version
docker-compose --version
python3 --version
node --version
npm --version

