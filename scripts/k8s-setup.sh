#!/bin/bash
# Quick setup script for local Kubernetes + Argo testing
# This automates the manual steps in KUBERNETES_LOCAL_SETUP.md

set -e

echo "========================================================================"
echo "OpenMetadata Distributed Ingestion - Local K8s Setup"
echo "========================================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "Step 1: Checking prerequisites..."
echo ""

# Check kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}✗ kubectl not found. Please install kubectl.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ kubectl found${NC}"

# Check Docker Desktop K8s
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}✗ Kubernetes not running. Please enable Kubernetes in Docker Desktop.${NC}"
    echo "  Docker Desktop → Settings → Kubernetes → Enable Kubernetes"
    exit 1
fi
echo -e "${GREEN}✓ Kubernetes cluster is running${NC}"

# Check context is docker-desktop
CURRENT_CONTEXT=$(kubectl config current-context)
if [ "$CURRENT_CONTEXT" != "docker-desktop" ]; then
    echo -e "${YELLOW}⚠ Current context is '$CURRENT_CONTEXT', switching to 'docker-desktop'...${NC}"
    kubectl config use-context docker-desktop
fi
echo -e "${GREEN}✓ Using docker-desktop context${NC}"
echo ""

# Install Argo Workflows
echo "Step 2: Installing Argo Workflows..."
echo ""

if kubectl get namespace argo &> /dev/null; then
    echo -e "${YELLOW}⚠ Namespace 'argo' already exists${NC}"
else
    echo "Creating namespace 'argo'..."
    kubectl create namespace argo
    echo -e "${GREEN}✓ Created namespace 'argo'${NC}"
fi

if kubectl get deployment argo-server -n argo &> /dev/null; then
    echo -e "${YELLOW}⚠ Argo Workflows already installed${NC}"
else
    echo "Installing Argo Workflows v3.5.5..."
    kubectl apply -n argo -f https://github.com/argoproj/argo-workflows/releases/download/v3.5.5/install.yaml

    echo "Waiting for Argo pods to be ready..."
    kubectl wait --for=condition=Ready pods --all -n argo --timeout=300s
    echo -e "${GREEN}✓ Argo Workflows installed and ready${NC}"
fi
echo ""

# Patch Argo Server for insecure mode (local testing only)
echo "Step 3: Configuring Argo Server (insecure mode for local testing)..."
echo ""
kubectl patch deployment argo-server -n argo --type='json' \
  -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/args", "value": [
  "server",
  "--auth-mode=server",
  "--secure=false"
]}]' 2>/dev/null || echo -e "${YELLOW}⚠ Argo server already patched${NC}"

echo "Waiting for Argo server to restart..."
sleep 10
kubectl wait --for=condition=Ready pods -l app=argo-server -n argo --timeout=120s
echo -e "${GREEN}✓ Argo Server configured${NC}"
echo ""

# Create OpenMetadata namespace and RBAC
echo "Step 4: Creating OpenMetadata namespace and service account..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$SCRIPT_DIR/../k8s/distributed-ingestion"

if kubectl get namespace openmetadata &> /dev/null; then
    echo -e "${YELLOW}⚠ Namespace 'openmetadata' already exists${NC}"
else
    echo "Applying namespace and RBAC configuration..."
    kubectl apply -f "$K8S_DIR/00-namespace-and-rbac.yaml"
    echo -e "${GREEN}✓ Created namespace and service account${NC}"
fi
echo ""

# Build Docker image
echo "Step 5: Building OpenMetadata ingestion Docker image..."
echo ""

INGESTION_DIR="$SCRIPT_DIR/../ingestion"

if docker images | grep -q "openmetadata-ingestion.*local"; then
    echo -e "${YELLOW}⚠ Docker image 'openmetadata-ingestion:local' already exists${NC}"
    read -p "Rebuild? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Building Docker image..."
        cd "$INGESTION_DIR"
        docker build -t openmetadata-ingestion:local -f Dockerfile .
        echo -e "${GREEN}✓ Docker image built${NC}"
    fi
else
    echo "Building Docker image (this may take 5-10 minutes)..."
    cd "$INGESTION_DIR"
    docker build -t openmetadata-ingestion:local -f Dockerfile .
    echo -e "${GREEN}✓ Docker image built${NC}"
fi
echo ""

# Apply WorkflowTemplate
echo "Step 6: Creating Argo WorkflowTemplate..."
echo ""
kubectl apply -f "$K8S_DIR/01-redshift-workflow-template.yaml"
echo -e "${GREEN}✓ WorkflowTemplate created${NC}"
echo ""

# Summary
echo "========================================================================"
echo -e "${GREEN}Setup Complete!${NC}"
echo "========================================================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Start Argo UI:"
echo "   kubectl -n argo port-forward svc/argo-server 2746:2746"
echo "   Then open: http://localhost:2746"
echo ""
echo "2. Create workflow configuration:"
echo "   export REDSHIFT_USER='your_user'"
echo "   export REDSHIFT_PASSWORD='your_password'"
echo "   export REDSHIFT_HOST='your-cluster.region.redshift.amazonaws.com'"
echo "   export REDSHIFT_DATABASE='dev'"
echo "   export OM_JWT_TOKEN='your-jwt-token'"
echo ""
echo "   envsubst < k8s/distributed-ingestion/02-example-redshift-configmap.yaml | kubectl apply -f -"
echo ""
echo "3. Submit workflow:"
echo "   kubectl create -f k8s/distributed-ingestion/01-redshift-workflow-template.yaml"
echo ""
echo "4. Monitor workflow:"
echo "   kubectl get workflows -n openmetadata"
echo "   kubectl get pods -n openmetadata -w"
echo ""
echo "See KUBERNETES_LOCAL_SETUP.md for detailed instructions."
echo ""
