#!/bin/bash
# System Check Script for ThirdEye Deployment

echo "================================"
echo "SYSTEM INFORMATION CHECK"
echo "================================"
echo ""

echo "1. OS Information:"
cat /etc/os-release
echo ""

echo "2. Kernel Version:"
uname -r
echo ""

echo "3. CPU Information:"
echo "CPU Cores: $(nproc)"
lscpu | grep "Model name"
echo ""

echo "4. Memory Information:"
free -h
echo ""

echo "5. Disk Space:"
df -h /
echo ""

echo "6. Docker Status:"
if command -v docker &> /dev/null; then
    echo "Docker is installed"
    docker --version
    systemctl status docker --no-pager | head -3
else
    echo "Docker is NOT installed"
fi
echo ""

echo "7. Docker Compose Status:"
if command -v docker-compose &> /dev/null; then
    echo "Docker Compose is installed"
    docker-compose --version
else
    echo "Docker Compose is NOT installed"
fi
echo ""

echo "8. Git Status:"
if command -v git &> /dev/null; then
    echo "Git is installed"
    git --version
else
    echo "Git is NOT installed"
fi
echo ""

echo "9. Python Status:"
if command -v python3 &> /dev/null; then
    echo "Python3 is installed"
    python3 --version
else
    echo "Python3 is NOT installed"
fi
echo ""

echo "10. Node.js Status:"
if command -v node &> /dev/null; then
    echo "Node.js is installed"
    node --version
else
    echo "Node.js is NOT installed"
fi
echo ""

echo "11. Network Ports:"
echo "Checking if required ports are available..."
netstat -tuln | grep -E ':(3000|8000|8585|9200|3306|5432)' || echo "All required ports appear to be available"
echo ""

echo "12. Current Running Services:"
systemctl list-units --type=service --state=running | grep -E 'docker|mysql|postgresql|nginx' || echo "No related services running"
echo ""

echo "================================"
echo "CHECK COMPLETE"
echo "================================"

