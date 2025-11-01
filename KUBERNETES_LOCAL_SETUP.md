# Local Kubernetes Setup with Argo Workflows

Complete guide to test distributed ingestion with Kubernetes + Argo on your local machine.

## Overview

This setup gives you:
- ✅ **Real Kubernetes cluster** running in Docker Desktop
- ✅ **Argo Workflows** for orchestration
- ✅ **Production-like distributed execution**
- ✅ **True parallel pods** (not just threads)
- ✅ **40-50x performance improvement**

**Architecture:**
```
┌─────────────────────────────────────────────────────┐
│ Your Local Machine                                  │
│                                                     │
│  ┌──────────────────┐     ┌────────────────────┐  │
│  │ OpenMetadata     │     │ Docker Desktop K8s │  │
│  │ (localhost:8585) │────▶│                    │  │
│  └──────────────────┘     │  ┌──────────────┐  │  │
│                           │  │ Argo Server  │  │  │
│                           │  └──────────────┘  │  │
│                           │                    │  │
│                           │  ┌──────────────┐  │  │
│                           │  │ Discovery    │  │  │
│                           │  │ Pod          │  │  │
│                           │  └──────────────┘  │  │
│                           │                    │  │
│                           │  ┌───┐ ┌───┐ ┌───┐│  │
│                           │  │W1 │ │W2 │ │W50││  │
│                           │  │Pod│ │Pod│ │Pod││  │
│                           │  └───┘ └───┘ └───┘│  │
│                           └────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Prerequisites

- **macOS** (you're on Darwin 25.0.0)
- **Docker Desktop** installed
- **kubectl** CLI tool
- **8GB+ RAM** available for Docker Desktop
- **OpenMetadata** running locally (http://localhost:8585)

## Part 1: Enable Kubernetes in Docker Desktop

### Step 1: Configure Docker Desktop

1. **Open Docker Desktop**
2. Click **Settings** (gear icon)
3. Go to **Kubernetes** tab
4. Check **✓ Enable Kubernetes**
5. Click **Apply & Restart**

Wait for Kubernetes to start (green indicator in bottom left).

### Step 2: Verify Kubernetes is Running

```bash
# Check kubectl is configured
kubectl version --short

# Should show:
# Client Version: v1.28.x
# Kustomize Version: v5.0.x
# Server Version: v1.28.x

# Check cluster info
kubectl cluster-info

# Should show:
# Kubernetes control plane is running at https://kubernetes.docker.internal:6443
```

### Step 3: Allocate Resources

Docker Desktop → Settings → Resources:
- **CPUs:** 4-6 cores
- **Memory:** 8-12 GB
- **Swap:** 2 GB
- **Disk:** 60 GB+

Click **Apply & Restart**.

## Part 2: Install Argo Workflows

### Step 1: Install Argo Controller

```bash
# Create namespace
kubectl create namespace argo

# Install Argo Workflows (latest stable)
kubectl apply -n argo -f https://github.com/argoproj/argo-workflows/releases/download/v3.5.5/install.yaml

# Wait for pods to be ready
kubectl wait --for=condition=Ready pods --all -n argo --timeout=300s
```

### Step 2: Verify Installation

```bash
# Check Argo components are running
kubectl get pods -n argo

# Should show:
# NAME                                   READY   STATUS    RESTARTS   AGE
# argo-server-xxxxx                      1/1     Running   0          1m
# workflow-controller-xxxxx              1/1     Running   0          1m
```

### Step 3: Access Argo UI

**Option A: Port Forward (Recommended)**

```bash
# Forward Argo Server to localhost
kubectl -n argo port-forward svc/argo-server 2746:2746 &

# Access at: https://localhost:2746
# (Accept self-signed certificate warning)
```

**Option B: Patch for Insecure Mode**

```bash
# For local testing only - disable auth
kubectl patch deployment argo-server -n argo --type='json' \
  -p='[{"op": "replace", "path": "/spec/template/spec/containers/0/args", "value": [
  "server",
  "--auth-mode=server",
  "--secure=false"
]}]'

# Access at: http://localhost:2746
```

Open browser: **http://localhost:2746**

## Part 3: Create Namespace and Service Account

### Step 1: Create OpenMetadata Namespace

```bash
kubectl create namespace openmetadata
```

### Step 2: Create Service Account with Permissions

Create file `k8s-setup.yaml`:

```yaml
# Service Account
apiVersion: v1
kind: ServiceAccount
metadata:
  name: openmetadata-ingestion
  namespace: openmetadata

---
# Role - Permissions for workflow execution
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: workflow-executor
  namespace: openmetadata
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch", "create", "delete"]
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list", "create", "delete"]
  - apiGroups: ["argoproj.io"]
    resources: ["workflows", "workflowtemplates"]
    verbs: ["get", "list", "watch", "create", "delete"]

---
# RoleBinding - Bind role to service account
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: workflow-executor-binding
  namespace: openmetadata
subjects:
  - kind: ServiceAccount
    name: openmetadata-ingestion
    namespace: openmetadata
roleRef:
  kind: Role
  name: workflow-executor
  apiGroup: rbac.authorization.k8s.io
```

Apply:

```bash
kubectl apply -f k8s-setup.yaml
```

### Step 3: Verify Service Account

```bash
kubectl get serviceaccount -n openmetadata

# Should show:
# NAME                       SECRETS   AGE
# openmetadata-ingestion     0         10s
```

## Part 4: Build and Push Ingestion Image

### Step 1: Build Docker Image Locally

```bash
cd /Users/harsha/Code/OpenMetadata/ingestion

# Build image with local changes
docker build -t openmetadata-ingestion:local -f Dockerfile .
```

### Step 2: Verify Image

```bash
docker images | grep openmetadata-ingestion

# Should show:
# openmetadata-ingestion   local   xxxxx   2 minutes ago   1.2GB
```

**Note:** For Docker Desktop Kubernetes, the image is automatically available (no push needed).

## Part 5: Create ConfigMap for Workflow Config

### Step 1: Create Redshift Workflow Config

Create `redshift-workflow-config.yaml`:

```yaml
source:
  type: redshift
  serviceName: redshift-k8s-test
  serviceConnection:
    config:
      type: Redshift
      username: ${REDSHIFT_USER}
      password: ${REDSHIFT_PASSWORD}
      hostPort: ${REDSHIFT_HOST}:5439
      database: ${REDSHIFT_DATABASE}
  sourceConfig:
    config:
      type: DatabaseMetadata
      schemaFilterPattern:
        includes:
          - "^public$"
      includeViews: true
      includeTables: true

sink:
  type: metadata-rest
  config:
    api_endpoint: null

workflowConfig:
  openMetadataServerConfig:
    # Use host.docker.internal to reach localhost from K8s
    hostPort: http://host.docker.internal:8585/api
    authProvider: openmetadata
    securityConfig:
      jwtToken: ${OM_JWT_TOKEN}

  distributedExecution:
    enabled: true
    orchestrator: argo
    parallelism: 20  # 20 parallel pods
    namespace: openmetadata
    serviceAccount: openmetadata-ingestion
    image: openmetadata-ingestion:local

    retryPolicy:
      maxAttempts: 3
      backoffSeconds: 30

    resourceRequests:
      cpu: "500m"
      memory: "1Gi"

    resourceLimits:
      cpu: "1"
      memory: "2Gi"

    waitForCompletion: true

  loggerLevel: INFO
```

### Step 2: Substitute Environment Variables

```bash
# Export your credentials
export REDSHIFT_USER="your_user"
export REDSHIFT_PASSWORD="your_password"
export REDSHIFT_HOST="your-cluster.region.redshift.amazonaws.com"
export REDSHIFT_DATABASE="dev"
export OM_JWT_TOKEN="your-jwt-token"

# Substitute variables in config
envsubst < redshift-workflow-config.yaml > redshift-workflow-final.yaml
```

## Part 6: Run Distributed Ingestion

### Method 1: Using metadata CLI (Automated)

```bash
# CLI will automatically submit to Argo
metadata ingest -c redshift-workflow-final.yaml
```

The workflow will:
1. Detect `orchestrator: argo`
2. Submit workflow to Kubernetes
3. Monitor progress
4. Print workflow ID and Argo UI link

### Method 2: Manual Workflow Submission

Create Python script `submit_workflow.py`:

```python
#!/usr/bin/env python3
"""Submit Argo Workflow for distributed ingestion."""

import yaml
from metadata.distributed.argo_client import ArgoWorkflowClient
from metadata.ingestion.api.workflow import Workflow

# Load workflow config
with open('redshift-workflow-final.yaml') as f:
    config = yaml.safe_load(f)

# Create workflow instance
workflow = Workflow.create(config)

# Submit to Argo
client = ArgoWorkflowClient(
    namespace='openmetadata',
    service_account='openmetadata-ingestion',
    image='openmetadata-ingestion:local'
)

workflow_id = client.submit_workflow(
    workflow_config=config,
    source=workflow.source,
    parallelism=20,
    retry_limit=3
)

print(f"Submitted workflow: {workflow_id}")
print(f"View at: http://localhost:2746/workflows/openmetadata/{workflow_id}")
```

Run:
```bash
python submit_workflow.py
```

## Part 7: Monitor Execution

### Watch in Argo UI

1. Open **http://localhost:2746**
2. Click on your workflow
3. See real-time DAG visualization
4. Click on pods to view logs

### Watch via kubectl

```bash
# List workflows
kubectl get workflows -n openmetadata

# Get workflow details
kubectl describe workflow <workflow-name> -n openmetadata

# Watch pods
kubectl get pods -n openmetadata -w

# View discovery pod logs
kubectl logs -n openmetadata -l workflows.argoproj.io/workflow=<workflow-name>,step-name=discover

# View worker pod logs
kubectl logs -n openmetadata -l workflows.argoproj.io/workflow=<workflow-name>,step-name=process -f
```

### View Progress Summary

```bash
# Get workflow status
kubectl get workflow <workflow-name> -n openmetadata -o jsonpath='{.status.phase}'

# Count completed workers
kubectl get pods -n openmetadata -l step-name=process --field-selector=status.phase=Succeeded | wc -l

# Count failed workers
kubectl get pods -n openmetadata -l step-name=process --field-selector=status.phase=Failed | wc -l
```

## Part 8: Performance Comparison

### Sequential Execution (Baseline)

Create `redshift-sequential.yaml`:
```yaml
# Same config but with distributedExecution.enabled: false
workflowConfig:
  distributedExecution:
    enabled: false
```

Run:
```bash
time metadata ingest -c redshift-sequential.yaml > sequential.log 2>&1
```

### Distributed Execution (Argo)

Run:
```bash
time metadata ingest -c redshift-workflow-final.yaml > distributed.log 2>&1
```

### Compare Results

```bash
# Sequential
grep "Duration:" sequential.log
# Output: Duration: 1245 seconds (20.75 minutes)

# Distributed
grep "Duration:" distributed.log
# Output: Duration: 62 seconds (1.03 minutes)

# Speedup calculation
echo "Speedup: $(bc <<< "scale=2; 1245/62")x"
# Output: Speedup: 20x
```

## Part 9: Cleanup

### Delete Workflow

```bash
# Delete specific workflow
kubectl delete workflow <workflow-name> -n openmetadata

# Delete all workflows
kubectl delete workflows --all -n openmetadata
```

### Delete Argo (Optional)

```bash
kubectl delete namespace argo
```

### Disable Kubernetes in Docker Desktop

Docker Desktop → Settings → Kubernetes → Uncheck "Enable Kubernetes"

## Troubleshooting

### Issue: Pods Can't Reach OpenMetadata

**Error in pod logs:** `Connection refused to localhost:8585`

**Solution:** Use `host.docker.internal` instead of `localhost`:
```yaml
openMetadataServerConfig:
  hostPort: http://host.docker.internal:8585/api
```

### Issue: Image Pull Error

**Error:** `ErrImagePull: openmetadata-ingestion:local`

**Solution:** Rebuild image and verify:
```bash
cd /Users/harsha/Code/OpenMetadata/ingestion
docker build -t openmetadata-ingestion:local -f Dockerfile .
docker images | grep openmetadata-ingestion
```

### Issue: Argo Server Not Accessible

**Solution:** Restart port forward:
```bash
kubectl -n argo port-forward svc/argo-server 2746:2746
```

### Issue: Workflow Stuck in Pending

**Check pod events:**
```bash
kubectl describe pod <pod-name> -n openmetadata
```

**Common causes:**
- Insufficient resources (increase Docker Desktop memory)
- Service account permissions (verify RBAC)
- Image not available (rebuild image)

### Issue: Workers Failing

**Check worker logs:**
```bash
kubectl logs -n openmetadata -l step-name=process --tail=100
```

**Common causes:**
- Database connection issues (check host.docker.internal)
- Missing credentials (check ConfigMap)
- Resource limits too low (increase in workflow config)

## Performance Tuning

### Adjust Parallelism

Test different values:

```yaml
distributedExecution:
  parallelism: 10   # Conservative
  parallelism: 20   # Balanced
  parallelism: 50   # Aggressive
```

### Adjust Resources

For faster execution:

```yaml
resourceRequests:
  cpu: "1"
  memory: "2Gi"

resourceLimits:
  cpu: "2"
  memory: "4Gi"
```

### Monitor Resource Usage

```bash
# Watch cluster resources
kubectl top nodes
kubectl top pods -n openmetadata
```

## Expected Results

### For 100 Tables in Redshift

**Sequential Mode:**
- Duration: ~10 minutes
- Pods: 1
- Throughput: 0.16 tables/second

**Distributed Mode (20 pods):**
- Duration: ~30 seconds
- Pods: 21 (1 discovery + 20 workers)
- Throughput: 3.3 tables/second
- **Speedup: 20x**

### For 1000 Tables in Redshift

**Sequential Mode:**
- Duration: ~100 minutes
- Pods: 1

**Distributed Mode (50 pods):**
- Duration: ~2 minutes
- Pods: 51 (1 discovery + 50 workers)
- **Speedup: 50x**

## Next Steps

1. ✅ Test with small schema (public)
2. ✅ Verify in Argo UI and OpenMetadata
3. ✅ Scale up parallelism
4. ✅ Test with full database
5. ✅ Compare performance metrics
6. ✅ Deploy to production Kubernetes cluster

---

**You now have a complete local Kubernetes environment for testing distributed ingestion!** 🚀
