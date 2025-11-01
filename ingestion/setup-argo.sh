#!/bin/bash
set -e

echo "========================================"
echo "Argo Workflows Setup for Mac"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Kubernetes is enabled
echo "Step 1: Checking Kubernetes..."
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}ERROR: Kubernetes is not running!${NC}"
    echo "Please enable Kubernetes in Docker Desktop:"
    echo "  1. Open Docker Desktop"
    echo "  2. Go to Settings → Kubernetes"
    echo "  3. Check 'Enable Kubernetes'"
    echo "  4. Click 'Apply & Restart'"
    echo "  5. Wait 2-3 minutes, then run this script again"
    exit 1
fi
echo -e "${GREEN}✓ Kubernetes is running${NC}"
echo ""

# Install Argo Workflows
echo "Step 2: Installing Argo Workflows..."
kubectl create namespace argo 2>/dev/null || echo "Namespace 'argo' already exists"

echo "Applying Argo Workflows manifest..."
kubectl apply -n argo -f https://github.com/argoproj/argo-workflows/releases/download/v3.5.4/install.yaml

echo "Waiting for Argo pods to be ready (this may take 1-2 minutes)..."
kubectl wait --for=condition=Ready pods --all -n argo --timeout=300s || {
    echo -e "${YELLOW}Warning: Some pods may still be starting. Checking status...${NC}"
    kubectl get pods -n argo
}
echo -e "${GREEN}✓ Argo Workflows installed${NC}"
echo ""

# Create service account
echo "Step 3: Creating service account..."
kubectl create serviceaccount argo-workflow -n argo 2>/dev/null || echo "Service account already exists"

# Grant permissions
kubectl create rolebinding argo-workflow-admin \
  --clusterrole=admin \
  --serviceaccount=argo:argo-workflow \
  -n argo 2>/dev/null || echo "Role binding already exists"
echo -e "${GREEN}✓ Service account configured${NC}"
echo ""

# Build Docker image
echo "Step 4: Building Docker image with distributed code..."
cd /Users/harsha/Code/OpenMetadata/ingestion

cat > Dockerfile.distributed <<'EOF'
FROM openmetadata/ingestion:1.10.0

# Copy the distributed framework code (new files)
COPY src/metadata/ingestion/api/distributed.py /home/airflow/ingestion/src/metadata/ingestion/api/distributed.py
COPY src/metadata/distributed/ /home/airflow/ingestion/src/metadata/distributed/
COPY src/metadata/distributed_cmd/ /home/airflow/ingestion/src/metadata/distributed_cmd/

# Copy modified source files (overwrites existing)
COPY src/metadata/ingestion/source/database/common_db_source.py /home/airflow/ingestion/src/metadata/ingestion/source/database/common_db_source.py
COPY src/metadata/ingestion/source/database/redshift/metadata.py /home/airflow/ingestion/src/metadata/ingestion/source/database/redshift/metadata.py
COPY src/metadata/workflow/ingestion.py /home/airflow/ingestion/src/metadata/workflow/ingestion.py

# No need to reinstall - Python will pick up the changes automatically
WORKDIR /home/airflow
EOF

docker build -t openmetadata-ingestion-distributed:local -f Dockerfile.distributed .
echo -e "${GREEN}✓ Docker image built${NC}"
echo ""

# Create Argo config
echo "Step 5: Creating Argo workflow configuration..."
cat > test-distributed-argo.yaml <<'EOF'
source:
  type: redshift
  serviceName: redshift-distributed-test
  serviceConnection:
    config:
      type: Redshift
      hostPort: openmetadata-redshift-cluster.cdnpdclcdk2n.us-east-2.redshift.amazonaws.com:5439
      username: openmetadata
      password: 87MxnW1nmQ@@B9m@
      database: dev
  sourceConfig:
    config:
      type: DatabaseMetadata
      includeViews: true
      includeTables: true

sink:
  type: metadata-rest
  config:
    api_endpoint: null

workflowConfig:
  openMetadataServerConfig:
    hostPort: http://host.docker.internal:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"

  distributedExecution:
    enabled: true
    orchestrator: argo
    parallelism: 20
    namespace: argo
    serviceAccount: argo-workflow
    image: openmetadata-ingestion-distributed:local
    waitForCompletion: true
    timeoutSeconds: 3600
    retryPolicy:
      maxAttempts: 2

  loggerLevel: INFO
EOF
echo -e "${GREEN}✓ Configuration created: test-distributed-argo.yaml${NC}"
echo ""

# Start port forward for Argo UI
echo "Step 6: Starting Argo UI (optional)..."
kubectl -n argo port-forward deployment/argo-server 2746:2746 > /dev/null 2>&1 &
PORT_FORWARD_PID=$!
echo -e "${GREEN}✓ Argo UI available at: https://localhost:2746${NC}"
echo "  (Accept the self-signed certificate warning)"
echo ""

# Summary
echo "========================================"
echo -e "${GREEN}Setup Complete!${NC}"
echo "========================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Activate virtual environment:"
echo "   source /Users/harsha/Code/OpenMetadata/env/bin/activate"
echo ""
echo "2. Run distributed ingestion with Argo:"
echo "   cd /Users/harsha/Code/OpenMetadata/ingestion"
echo "   metadata ingest -c test-distributed-argo.yaml"
echo ""
echo "3. Monitor workflow:"
echo "   kubectl get workflows -n argo -w"
echo ""
echo "4. View Argo UI:"
echo "   open https://localhost:2746"
echo ""
echo "5. Get workflow logs:"
echo "   kubectl get workflows -n argo"
echo "   kubectl logs -n argo <workflow-name>"
echo ""
echo "To stop Argo UI:"
echo "   kill $PORT_FORWARD_PID"
echo ""
echo "To cleanup:"
echo "   kubectl delete workflows --all -n argo"
echo ""
