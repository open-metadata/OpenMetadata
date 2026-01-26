# Running OpenMetadata in Kubernetes (Local with Docker Desktop)

This guide walks you through setting up OpenMetadata in a local Kubernetes environment using Docker Desktop's built-in Kubernetes.

## Prerequisites

### 1. Install Required Tools

```bash
# Install Helm (Kubernetes package manager)
brew install helm

# Verify kubectl is available (comes with Docker Desktop)
kubectl version --client

# Verify Docker Desktop Kubernetes is enabled
kubectl cluster-info
```

### 2. Enable Kubernetes in Docker Desktop

1. Open **Docker Desktop**
2. Go to **Settings** → **Kubernetes**
3. Check **"Enable Kubernetes"**
4. Click **"Apply & Restart"**
5. Wait for Kubernetes to start (green indicator)

### 3. Verify Kubernetes is Running

```bash
# Check cluster status
kubectl cluster-info

# Check nodes
kubectl get nodes

# Should show: docker-desktop
```

## Step-by-Step Setup

### Step 1: Start Local Dependencies (PostgreSQL + OpenSearch)

OpenMetadata needs a database and search engine. We'll run these in Docker Compose:

```bash
cd docker/development/helm

# Start PostgreSQL and OpenSearch
docker-compose -f docker-compose-deps.yml up -d

# Wait for services to be ready (2-3 minutes)
docker-compose -f docker-compose-deps.yml logs -f

# In another terminal, verify services are running:
curl http://localhost:9200/_cluster/health
docker exec openmetadata_postgres_test psql -U openmetadata_user -d openmetadata_db -c "SELECT 1"
```

**Services Started:**
- **PostgreSQL**: `localhost:5433` (mapped from container port 5432)
- **OpenSearch**: `localhost:9200`

### Step 2: Clone OpenMetadata Helm Charts

The Helm charts are in a separate repository:

```bash
# Clone the Helm charts repository
cd ~/Projects  # or your preferred location
git clone https://github.com/open-metadata/openmetadata-helm-charts.git
cd openmetadata-helm-charts
```

### Step 3: Create Kubernetes Secrets

Create the secrets that OpenMetadata expects:

```bash
# Create PostgreSQL secret
kubectl create secret generic postgres-secrets \
  --from-literal=openmetadata-postgres-password=openmetadata_password

# Create Airflow secret (if using Airflow)
kubectl create secret generic airflow-secrets \
  --from-literal=openmetadata-airflow-password=admin

# Verify secrets
kubectl get secrets
```

### Step 4: Install OpenMetadata with Helm

#### Option A: Kubernetes Native Pipeline Client (Recommended)

This uses Kubernetes Jobs directly without Airflow:

```bash
# Navigate to the chart directory
cd charts/openmetadata

# Install OpenMetadata with K8s native configuration
helm install openmetadata . \
  --values /Users/dheerajrampally/Projects/OpenMetadata/docker/development/helm/values-k8s-test.yaml \
  --namespace openmetadata \
  --create-namespace \
  --timeout 10m \
  --wait

# Check deployment status
kubectl get pods -n openmetadata -w
```

#### Option B: With Airflow (Traditional)

If you prefer using Airflow for pipeline orchestration:

```bash
helm install openmetadata . \
  --values /Users/dheerajrampally/Projects/OpenMetadata/docker/development/helm/values-airflow-test.yaml \
  --namespace openmetadata \
  --create-namespace \
  --timeout 10m \
  --wait
```

### Step 5: Access OpenMetadata

#### Port Forwarding (Easiest for Local)

```bash
# Forward OpenMetadata service to localhost
kubectl port-forward -n openmetadata svc/openmetadata 8585:8585

# Keep this terminal open, then access:
# http://localhost:8585
```

#### Using LoadBalancer (Alternative)

If your values file uses `LoadBalancer` service type:

```bash
# Check service external IP
kubectl get svc -n openmetadata

# Access via the external IP or localhost
```

### Step 6: Verify Installation

```bash
# Check all pods are running
kubectl get pods -n openmetadata

# Check OpenMetadata logs
kubectl logs -n openmetadata -l app.kubernetes.io/name=openmetadata -f

# Test health endpoint
curl http://localhost:8585/api/v1/system/health

# Test API
curl http://localhost:8585/api/v1/system/config
```

## Configuration Details

### Database Connection

The configuration uses `host.docker.internal` to connect from Kubernetes pods to Docker containers:

- **Host**: `host.docker.internal` (special DNS name for Docker Desktop)
- **Port**: `5433` (PostgreSQL)
- **Database**: `openmetadata_db`
- **User**: `openmetadata_user`
- **Password**: `openmetadata_password` (from secret)

### Search Connection

- **Host**: `host.docker.internal`
- **Port**: `9200` (OpenSearch)
- **Type**: OpenSearch

### Kubernetes Pipeline Configuration

When using K8s native pipeline client:
- **Namespace**: `openmetadata-pipelines-test`
- **Service Account**: `openmetadata-ingestion-test`
- **Image**: `openmetadata/ingestion-base:1.12.0-SNAPSHOT`

## Monitoring and Debugging

### View Pod Logs

```bash
# OpenMetadata server logs
kubectl logs -n openmetadata -l app.kubernetes.io/name=openmetadata -f

# All pods in namespace
kubectl logs -n openmetadata --all-containers=true -f
```

### Check Resource Status

```bash
# All resources in namespace
kubectl get all -n openmetadata

# Describe deployment
kubectl describe deployment -n openmetadata openmetadata

# Check events
kubectl get events -n openmetadata --sort-by='.lastTimestamp'
```

### Check Pipeline Jobs (K8s Native)

```bash
# List pipeline namespace
kubectl get namespace openmetadata-pipelines-test

# Check service account and RBAC
kubectl get serviceaccount,roles,rolebindings -n openmetadata-pipelines-test

# List jobs
kubectl get jobs -n openmetadata-pipelines-test

# View job logs
kubectl logs -n openmetadata-pipelines-test job/<job-name>
```

### Common Issues

#### Pods Not Starting

```bash
# Check pod status
kubectl describe pod -n openmetadata <pod-name>

# Check for image pull errors
kubectl get events -n openmetadata | grep -i "pull\|image"
```

#### Database Connection Issues

```bash
# Test connectivity from pod
kubectl exec -n openmetadata deployment/openmetadata -- \
  curl -v host.docker.internal:5433

# Check if PostgreSQL is accessible
docker exec openmetadata_postgres_test pg_isready -U openmetadata_user
```

#### Port Already in Use

```bash
# Check what's using port 8585
lsof -i :8585

# Use different port for port-forward
kubectl port-forward -n openmetadata svc/openmetadata 8586:8585
```

## Updating Configuration

### Update Helm Release

```bash
# Get current values
helm get values openmetadata -n openmetadata

# Upgrade with new values
helm upgrade openmetadata . \
  --values /path/to/values.yaml \
  --namespace openmetadata \
  --reuse-values
```

### Scale Deployment

```bash
# Scale OpenMetadata replicas
kubectl scale deployment openmetadata -n openmetadata --replicas=2
```

## Cleanup

### Remove OpenMetadata

```bash
# Uninstall Helm release
helm uninstall openmetadata -n openmetadata

# Delete namespace (removes all resources)
kubectl delete namespace openmetadata

# Clean up secrets
kubectl delete secret postgres-secrets airflow-secrets
```

### Stop Dependencies

```bash
# Stop Docker Compose services
cd docker/development/helm
docker-compose -f docker-compose-deps.yml down

# Remove volumes (optional - deletes data)
docker-compose -f docker-compose-deps.yml down -v
```

## Quick Reference Commands

```bash
# Start everything
cd docker/development/helm && docker-compose -f docker-compose-deps.yml up -d
kubectl create secret generic postgres-secrets --from-literal=openmetadata-postgres-password=openmetadata_password
helm install openmetadata ~/Projects/openmetadata-helm-charts/charts/openmetadata \
  --values docker/development/helm/values-k8s-test.yaml \
  --namespace openmetadata --create-namespace
kubectl port-forward -n openmetadata svc/openmetadata 8585:8585

# Check status
kubectl get pods -n openmetadata
kubectl logs -n openmetadata -l app.kubernetes.io/name=openmetadata -f

# Access UI
open http://localhost:8585

# Stop everything
helm uninstall openmetadata -n openmetadata
kubectl delete namespace openmetadata
cd docker/development/helm && docker-compose -f docker-compose-deps.yml down
```

## Default Credentials

- **Username**: `admin`
- **Password**: `admin`

## Next Steps

1. **Access the UI**: http://localhost:8585
2. **Configure Data Sources**: Add connectors for your databases, warehouses, etc.
3. **Run Ingestion**: Set up metadata ingestion pipelines
4. **Explore Features**: Data discovery, lineage, quality, governance

## Additional Resources

- [OpenMetadata Helm Charts Repository](https://github.com/open-metadata/openmetadata-helm-charts)
- [OpenMetadata Documentation](https://docs.open-metadata.org/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
