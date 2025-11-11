# Kubernetes Manifests for Distributed Ingestion

This directory contains Kubernetes manifests for deploying OpenMetadata distributed ingestion with Argo Workflows.

## Files Overview

### `00-namespace-and-rbac.yaml`

Creates the foundational Kubernetes resources:
- **Namespace:** `openmetadata` - isolated environment for ingestion workflows
- **ServiceAccount:** `openmetadata-ingestion` - identity for workflow pods
- **Role:** `workflow-executor` - permissions for pod/workflow management
- **RoleBinding:** Binds role to service account
- **ClusterRole:** Cross-namespace workflow access (optional)
- **ClusterRoleBinding:** Binds cluster role to service account

**Apply:**
```bash
kubectl apply -f 00-namespace-and-rbac.yaml
```

**Verify:**
```bash
kubectl get namespace openmetadata
kubectl get serviceaccount openmetadata-ingestion -n openmetadata
kubectl get role workflow-executor -n openmetadata
```

---

### `01-redshift-workflow-template.yaml`

Argo WorkflowTemplate defining the distributed ingestion pattern:
- **Discovery Phase:** Single pod lists all entities (tables, dashboards, etc.)
- **Processing Phase:** N parallel worker pods process entities
- **Dynamic Fan-out:** Uses `withParam` to spawn workers based on discovery results
- **Retry Logic:** Automatic retries for failed workers
- **Resource Limits:** Configurable CPU/memory per worker

**Features:**
- Reusable template for any database/dashboard connector
- Configurable parallelism (default: 20 workers)
- Shared volume for discovery artifacts
- Built-in retry with exponential backoff

**Apply:**
```bash
kubectl apply -f 01-redshift-workflow-template.yaml
```

**Verify:**
```bash
kubectl get workflowtemplate openmetadata-ingestion-distributed -n openmetadata
```

---

### `02-example-redshift-configmap.yaml`

Example ConfigMap containing workflow configuration for Redshift ingestion.

**IMPORTANT:** This is a template with placeholders. Before applying:

1. Set environment variables:
```bash
export REDSHIFT_USER="your_username"
export REDSHIFT_PASSWORD="your_password"
export REDSHIFT_HOST="your-cluster.region.redshift.amazonaws.com"
export REDSHIFT_DATABASE="dev"
export OM_JWT_TOKEN="your-jwt-token"
```

2. Apply with substitution:
```bash
envsubst < 02-example-redshift-configmap.yaml | kubectl apply -f -
```

**Verify:**
```bash
kubectl get configmap redshift-workflow-config -n openmetadata
kubectl describe configmap redshift-workflow-config -n openmetadata
```

**Security Note:** For production, use Kubernetes Secrets instead of ConfigMap for credentials:
```bash
kubectl create secret generic redshift-credentials \
  --from-literal=username=$REDSHIFT_USER \
  --from-literal=password=$REDSHIFT_PASSWORD \
  -n openmetadata
```

---

## Quick Start

### 1. Setup Kubernetes and Argo

```bash
# Run automated setup
../../scripts/k8s-setup.sh

# Or manually:
kubectl create namespace argo
kubectl apply -n argo -f https://github.com/argoproj/argo-workflows/releases/download/v3.5.5/install.yaml
kubectl apply -f 00-namespace-and-rbac.yaml
kubectl apply -f 01-redshift-workflow-template.yaml
```

### 2. Create Workflow Configuration

```bash
# Set credentials
export REDSHIFT_USER="..."
export REDSHIFT_PASSWORD="..."
export REDSHIFT_HOST="..."
export REDSHIFT_DATABASE="..."
export OM_JWT_TOKEN="..."

# Create ConfigMap
envsubst < 02-example-redshift-configmap.yaml | kubectl apply -f -
```

### 3. Submit Workflow

Create `workflow-instance.yaml`:
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  generateName: redshift-ingestion-
  namespace: openmetadata
spec:
  workflowTemplateRef:
    name: openmetadata-ingestion-distributed
  arguments:
    parameters:
      - name: workflow-config
        value: "redshift-workflow-config"
      - name: parallelism
        value: "20"
```

Submit:
```bash
kubectl create -f workflow-instance.yaml -n openmetadata
```

### 4. Monitor Execution

```bash
# List workflows
kubectl get workflows -n openmetadata

# Watch pods
kubectl get pods -n openmetadata -w

# View discovery logs
kubectl logs -n openmetadata -l step-name=discover-entities -f

# View worker logs
kubectl logs -n openmetadata -l step-name=process-entities --tail=20 -f
```

### 5. Access Argo UI

```bash
# Port forward
kubectl -n argo port-forward svc/argo-server 2746:2746

# Open browser
open http://localhost:2746
```

---

## Configuration Reference

### Parallelism

Adjust based on database size:

```yaml
arguments:
  parameters:
    - name: parallelism
      value: "10"   # Small: < 100 tables
      # value: "20"   # Medium: 100-1000 tables
      # value: "50"   # Large: 1000-10000 tables
      # value: "100"  # Very large: 10000+ tables
```

### Resource Limits

Edit `01-redshift-workflow-template.yaml`:

```yaml
resources:
  requests:
    cpu: "500m"      # Minimum CPU
    memory: "1Gi"    # Minimum memory
  limits:
    cpu: "1"         # Maximum CPU
    memory: "2Gi"    # Maximum memory
```

Higher limits = faster processing but more cluster resources consumed.

### Retry Policy

Edit `01-redshift-workflow-template.yaml`:

```yaml
retryStrategy:
  limit: "3"              # Max retry attempts
  retryPolicy: "Always"   # Retry on all failures
  backoff:
    duration: "30s"       # Initial backoff
    factor: "2"           # Exponential factor
    maxDuration: "10m"    # Max backoff time
```

---

## Adapting for Other Connectors

### PostgreSQL

Create `postgres-workflow-config.yaml`:
```yaml
source:
  type: postgres
  serviceName: postgres-distributed
  serviceConnection:
    config:
      type: Postgres
      username: ${POSTGRES_USER}
      password: ${POSTGRES_PASSWORD}
      hostPort: ${POSTGRES_HOST}:5432
      database: ${POSTGRES_DATABASE}
```

Apply:
```bash
envsubst < postgres-workflow-config.yaml | kubectl apply -f -
```

### Snowflake

```yaml
source:
  type: snowflake
  serviceName: snowflake-distributed
  serviceConnection:
    config:
      type: Snowflake
      username: ${SNOWFLAKE_USER}
      password: ${SNOWFLAKE_PASSWORD}
      account: ${SNOWFLAKE_ACCOUNT}
      warehouse: COMPUTE_WH
      database: PROD
```

### Looker

```yaml
source:
  type: looker
  serviceName: looker-distributed
  serviceConnection:
    config:
      type: Looker
      hostPort: https://your-instance.looker.com
      clientId: ${LOOKER_CLIENT_ID}
      clientSecret: ${LOOKER_CLIENT_SECRET}
```

**All use the same WorkflowTemplate** - just change the source configuration!

---

## Troubleshooting

### Pods Can't Pull Image

**Error:** `ErrImagePull: openmetadata-ingestion:local`

**Solution:**
```bash
cd ../../ingestion
docker build -t openmetadata-ingestion:local -f Dockerfile .
```

For Docker Desktop, image is automatically available to K8s.

### Pods Can't Reach OpenMetadata

**Error:** `Connection refused to localhost:8585`

**Solution:** Use `host.docker.internal` in ConfigMap:
```yaml
openMetadataServerConfig:
  hostPort: http://host.docker.internal:8585/api
```

### RBAC Permission Denied

**Error:** `pods is forbidden: User "system:serviceaccount:openmetadata:openmetadata-ingestion" cannot create resource "pods"`

**Solution:** Re-apply RBAC:
```bash
kubectl apply -f 00-namespace-and-rbac.yaml
```

### Workflow Stuck in Pending

**Check events:**
```bash
kubectl describe workflow <workflow-name> -n openmetadata
```

**Common causes:**
- Insufficient cluster resources (increase Docker Desktop memory)
- Invalid service account
- Missing WorkflowTemplate

### Workers Failing

**Check logs:**
```bash
kubectl logs <pod-name> -n openmetadata
```

**Common causes:**
- Database connection errors (check credentials)
- OpenMetadata API errors (check JWT token)
- Resource limits too low (increase memory/CPU)

---

## Performance Tips

### Start Small

Test with filtered schema first:
```yaml
sourceConfig:
  config:
    schemaFilterPattern:
      includes:
        - "^public$"  # Just one schema
```

### Monitor Resources

```bash
# Node resources
kubectl top nodes

# Pod resources
kubectl top pods -n openmetadata

# Cluster capacity
kubectl describe nodes
```

### Optimize Parallelism

Find optimal value by testing:
```bash
# Try different values
for p in 10 20 30 50; do
  echo "Testing parallelism: $p"
  # Submit workflow with parallelism=$p
  # Measure duration
done
```

Pick the value with best throughput (entities/second).

---

## Production Considerations

### High Availability

For production clusters, add:

**PodDisruptionBudget:**
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: ingestion-workers
  namespace: openmetadata
spec:
  minAvailable: 5
  selector:
    matchLabels:
      component: ingestion
```

### Monitoring

Integrate with observability tools:
- **Prometheus:** Scrape Argo metrics
- **Grafana:** Visualize workflow performance
- **CloudWatch/Stackdriver:** Cloud-native monitoring

### Cost Optimization

- Use node affinity for cheaper node pools
- Set aggressive resource limits
- Use preemptible/spot instances for workers
- Schedule during off-peak hours

---

## Cleanup

### Delete Workflows

```bash
# Delete specific workflow
kubectl delete workflow <workflow-name> -n openmetadata

# Delete all workflows
kubectl delete workflows --all -n openmetadata
```

### Delete Resources

```bash
# Delete ConfigMaps
kubectl delete configmap redshift-workflow-config -n openmetadata

# Delete WorkflowTemplate
kubectl delete workflowtemplate openmetadata-ingestion-distributed -n openmetadata

# Delete namespace (removes everything)
kubectl delete namespace openmetadata
```

---

## Additional Resources

- **Full Testing Guide:** [TESTING_DISTRIBUTED_INGESTION.md](../../TESTING_DISTRIBUTED_INGESTION.md)
- **Local K8s Setup:** [KUBERNETES_LOCAL_SETUP.md](../../KUBERNETES_LOCAL_SETUP.md)
- **Implementation Details:** [DISTRIBUTED_INGESTION_IMPLEMENTATION.md](../../DISTRIBUTED_INGESTION_IMPLEMENTATION.md)
- **Quick Start:** [QUICKSTART_REDSHIFT_LOCAL.md](../../QUICKSTART_REDSHIFT_LOCAL.md)
- **Argo Workflows Docs:** https://argo-workflows.readthedocs.io/

---

**Generated for OpenMetadata Distributed Ingestion Framework v1.0**
