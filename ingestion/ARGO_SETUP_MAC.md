# Setting Up Argo Workflows on Mac

## Quick Setup Guide (5-10 minutes)

### Step 1: Enable Kubernetes in Docker Desktop

1. Open **Docker Desktop** application
2. Go to **Settings** (gear icon) → **Kubernetes**
3. Check **Enable Kubernetes**
4. Click **Apply & Restart**
5. Wait 2-3 minutes for Kubernetes to start

Verify it's running:
```bash
kubectl cluster-info
# Should show: Kubernetes control plane is running at https://kubernetes.docker.internal:6443
```

### Step 2: Install Argo Workflows

```bash
# Create argo namespace
kubectl create namespace argo

# Install Argo Workflows
kubectl apply -n argo -f https://github.com/argoproj/argo-workflows/releases/download/v3.5.4/install.yaml

# Wait for Argo to be ready (1-2 minutes)
kubectl wait --for=condition=Ready pods --all -n argo --timeout=300s

# Verify installation
kubectl get pods -n argo
# Should see: argo-server, workflow-controller (both Running)
```

### Step 3: Configure Service Account with Permissions

```bash
# Create service account
kubectl create serviceaccount argo-workflow -n argo

# Grant admin permissions (for testing)
kubectl create rolebinding argo-workflow-admin \
  --clusterrole=admin \
  --serviceaccount=argo:argo-workflow \
  -n argo
```

### Step 4: Access Argo UI (Optional)

```bash
# Port forward to access Argo UI
kubectl -n argo port-forward deployment/argo-server 2746:2746 &

# Open browser to: https://localhost:2746
# (Accept the self-signed certificate warning)
```

### Step 5: Build Docker Image with Distributed Code

```bash
cd /Users/harsha/Code/OpenMetadata/ingestion

# Build the Docker image
docker build -t openmetadata-ingestion-distributed:local -f- . <<'EOF'
FROM openmetadata/ingestion:1.10.0

# Copy the distributed code
COPY src/metadata/ingestion/api/distributed.py /home/airflow/ingestion/src/metadata/ingestion/api/distributed.py
COPY src/metadata/distributed/ /home/airflow/ingestion/src/metadata/distributed/
COPY src/metadata/distributed_cmd/ /home/airflow/ingestion/src/metadata/distributed_cmd/
COPY src/metadata/ingestion/source/database/common_db_source.py /home/airflow/ingestion/src/metadata/ingestion/source/database/common_db_source.py
COPY src/metadata/ingestion/source/database/redshift/metadata.py /home/airflow/ingestion/src/metadata/ingestion/source/database/redshift/metadata.py
COPY src/metadata/workflow/ingestion.py /home/airflow/ingestion/src/metadata/workflow/ingestion.py

# Install the modified code
WORKDIR /home/airflow/ingestion
RUN pip install -e .

WORKDIR /home/airflow
EOF

# Verify image was built
docker images | grep openmetadata-ingestion-distributed
```

### Step 6: Create Argo Workflow Config

Create `test-distributed-argo.yaml`:

```yaml
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
    hostPort: http://host.docker.internal:8585/api  # Access host from container
    authProvider: openmetadata
    securityConfig:
      jwtToken: "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"

  distributedExecution:
    enabled: true
    orchestrator: argo
    parallelism: 20                    # Start with 20 parallel pods
    namespace: argo
    serviceAccount: argo-workflow
    image: openmetadata-ingestion-distributed:local
    waitForCompletion: true
    timeoutSeconds: 3600              # 1 hour timeout
    retryPolicy:
      maxAttempts: 2

  loggerLevel: INFO
```

### Step 7: Run the Distributed Ingestion

```bash
# Activate virtual environment
source /Users/harsha/Code/OpenMetadata/env/bin/activate
cd /Users/harsha/Code/OpenMetadata/ingestion

# Run with Argo
metadata ingest -c test-distributed-argo.yaml
```

### Step 8: Monitor the Workflow

```bash
# Watch workflow progress
kubectl get workflows -n argo -w

# Get workflow logs
WORKFLOW_NAME=$(kubectl get workflows -n argo -o name | head -1)
kubectl logs -n argo $WORKFLOW_NAME --follow

# Or use Argo UI at https://localhost:2746
```

## Troubleshooting

### Issue: Pods can't pull image

**Solution**: The image needs to be available in Docker Desktop's local registry:

```bash
# List images
docker images | grep openmetadata-ingestion-distributed

# If not found, rebuild:
docker build -t openmetadata-ingestion-distributed:local .
```

### Issue: Pods can't reach OpenMetadata API

**Error**: `Connection refused to localhost:8585`

**Solution**: Use `host.docker.internal` instead of `localhost`:
```yaml
hostPort: http://host.docker.internal:8585/api
```

### Issue: Pods can't reach Redshift

**Solution**: Make sure Redshift security group allows connections from your Mac's IP

### Issue: Out of memory

**Solution**: Reduce parallelism:
```yaml
parallelism: 10  # Reduce from 20 to 10
```

## Performance Comparison

After running, compare with sequential mode:

### Sequential Mode
```bash
# Run sequential (for comparison)
metadata ingest -c test-sequential.yaml
```

### Expected Results

| Mode | Tables | Expected Duration | Speedup |
|------|--------|-------------------|---------|
| Sequential | 10,098 | 28 minutes | 1x |
| Argo (20 pods) | 10,098 | 4-6 minutes | 5-7x |
| Argo (50 pods) | 10,098 | 2-4 minutes | 7-14x |

## Cleanup

```bash
# Delete workflows
kubectl delete workflows --all -n argo

# Stop port forward
pkill -f "port-forward.*argo-server"

# Uninstall Argo (optional)
kubectl delete namespace argo
```

## Next Steps

If this works well:
1. Deploy to production Kubernetes cluster
2. Increase parallelism to 50+ pods
3. Monitor resource usage and adjust
4. Set up automated workflows

## Quick Reference Commands

```bash
# Check Argo pods
kubectl get pods -n argo

# View workflows
kubectl get workflows -n argo

# Describe workflow
kubectl describe workflow <name> -n argo

# Get workflow logs
kubectl logs -n argo <pod-name>

# Delete stuck workflow
kubectl delete workflow <name> -n argo

# Restart Argo
kubectl rollout restart deployment/argo-server -n argo
kubectl rollout restart deployment/workflow-controller -n argo
```
