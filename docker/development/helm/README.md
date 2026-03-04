# OpenMetadata Helm Chart Local Testing

Helper to test changes from https://github.com/open-metadata/openmetadata-helm-charts with local images while developing.

## Prerequisites

### Required Tools
```bash
# Install required tools
brew install helm kubectl minikube docker-compose

# Or on Ubuntu/Debian:
# sudo snap install helm kubectl minikube
# sudo apt-get install docker-compose
```

### Required Resources
- **CPU**: 4+ cores recommended
- **Memory**: 8GB+ RAM recommended  
- **Storage**: 20GB+ free space

## Quick Start

### 1. Start Local Dependencies

First, start the required database and search services:

```bash
cd docker/development/helm

# Start PostgreSQL and OpenSearch
docker-compose -f docker-compose-deps.yml up -d

# Wait for services to be ready (2-3 minutes)
docker-compose -f docker-compose-deps.yml logs -f

# Verify services are running
curl http://localhost:9200/_cluster/health
docker exec openmetadata_postgres_test psql -U openmetadata_user -d openmetadata_db -c "SELECT 1"
```

### 2. Start Kubernetes Cluster

```bash
# Start minikube with sufficient resources
minikube start --cpus 4 --memory 8192 --driver docker

# Enable ingress addon (optional)
minikube addons enable ingress

# Verify cluster is ready
kubectl cluster-info
kubectl get nodes
```

### 3. Create Required Secrets

```bash
# Create secrets that the chart expects
kubectl create secret generic postgres-secrets \
  --from-literal=openmetadata-postgres-password=openmetadata_password

kubectl create secret generic airflow-secrets \
  --from-literal=openmetadata-airflow-password=admin
```

## Test Scenarios

### Scenario A: Test Kubernetes Native Pipeline Client (NEW)

Test the new K8s native pipeline execution without Airflow dependencies.

```bash
# Use local chart directly, e.g.,
CHART_PATH="/Users/pmbrull/github/openmetadata-helm-charts/charts/openmetadata"

# Install with K8s native configuration
helm install openmetadata-k8s-test $CHART_PATH --values values-k8s-test.yaml

# Check deployment status
kubectl get pods -A
kubectl get jobs -n openmetadata-pipelines-test
kubectl get serviceaccounts,roles,rolebindings -n openmetadata-pipelines-test

# Check logs
kubectl logs -l app.kubernetes.io/name=openmetadata -f

# Test access
minikube tunnel  # In separate terminal
curl http://localhost:8585/api/v1/system/health
```

### Scenario B: Test Migrated Airflow Configuration

Test that the new nested Airflow configuration still works.

```bash
# Install with migrated Airflow configuration  
helm install openmetadata-airflow-test $CHART_PATH \
  --values values-airflow-test.yaml \
  --timeout 10m \
  --wait

# Check deployment
kubectl get pods -A
kubectl logs -l app.kubernetes.io/name=openmetadata -f
```

## Validation Checklist

### ✅ Basic Functionality

1. **Pod Health**
```bash
# Check all pods are running
kubectl get pods -A

# Check OpenMetadata pod logs
kubectl logs deployment/openmetadata-k8s-test -f

# Check database connectivity
kubectl exec deployment/openmetadata-k8s-test -- curl -f http://postgres:5432 || echo "DB connection test"
```

2. **API Health**
```bash
# Access health endpoint
curl http://localhost:8585/api/v1/system/health

# Check API response
curl http://localhost:8585/api/v1/system/config
```

### ✅ K8s Native Pipeline Features

1. **RBAC Resources**
```bash
# Check namespace creation
kubectl get namespace openmetadata-pipelines-test

# Check service account
kubectl get serviceaccount -n openmetadata-pipelines-test openmetadata-ingestion-test

# Check permissions
kubectl auth can-i create jobs \
  --as=system:serviceaccount:openmetadata-pipelines-test:openmetadata-ingestion-test \
  -n openmetadata-pipelines-test
```

2. **Configuration Validation**
```bash
# Check environment variables in pod
kubectl exec deployment/openmetadata-k8s-test -- env | grep K8S_

# Check secrets
kubectl get secret openmetadata-k8s-test-pipeline-secret -o yaml
kubectl get secret openmetadata-k8s-test-pipeline-secret -o jsonpath='{.data}' | base64 -d
```

3. **Pipeline Job Testing**
```bash
# Create a test pipeline job (manual)
cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: test-ingestion-job
  namespace: openmetadata-pipelines-test
spec:
  template:
    spec:
      serviceAccountName: openmetadata-ingestion-test
      containers:
      - name: test
        image: docker.getcollate.io/openmetadata/ingestion:latest
        command: ["echo", "Test pipeline job works"]
      restartPolicy: Never
EOF

# Check job execution
kubectl get jobs -n openmetadata-pipelines-test
kubectl logs job/test-ingestion-job -n openmetadata-pipelines-test
```

### ✅ Failure Diagnostics Testing

1. **Create Failing Job**
```bash
# Create a job that will fail
cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job  
metadata:
  name: test-failing-job
  namespace: openmetadata-pipelines-test
  labels:
    app.kubernetes.io/pipeline: test-pipeline
    app.kubernetes.io/run-id: test-123
spec:
  template:
    spec:
      serviceAccountName: openmetadata-ingestion-test
      containers:
      - name: main
        image: docker.getcollate.io/openmetadata/ingestion:latest
        command: ["sh", "-c", "echo 'Starting ingestion...'; sleep 10; echo 'Something went wrong!'; exit 1"]
      restartPolicy: Never
EOF

# Watch for diagnostic job creation
kubectl get jobs -n openmetadata-pipelines-test -w

# Check diagnostic job logs
kubectl logs -n openmetadata-pipelines-test -l app.kubernetes.io/component=diagnostics
```

### ✅ Configuration Migration Testing

1. **Test Both Configurations**
```bash
# Test that both airflow and k8s configs are valid
helm template test-airflow $CHART_PATH --values values-airflow-test.yaml > /tmp/airflow-manifest.yaml
helm template test-k8s $CHART_PATH --values values-k8s-test.yaml > /tmp/k8s-manifest.yaml

# Validate manifests
kubectl apply --dry-run=client -f /tmp/airflow-manifest.yaml
kubectl apply --dry-run=client -f /tmp/k8s-manifest.yaml
```

2. **Test Breaking Changes**
```bash
# Test old configuration format (should fail validation or show warnings)
cat > /tmp/old-values.yaml << EOF
openmetadata:
  config:
    pipelineServiceClientConfig:
      enabled: true
      className: "org.openmetadata.service.clients.pipeline.airflow.AirflowRESTClient"
      apiEndpoint: http://test
EOF

helm template test-old $CHART_PATH --values /tmp/old-values.yaml
```

### Debug Commands

```bash
# Get all resources
kubectl get all -A

# Describe OpenMetadata deployment
kubectl describe deployment openmetadata-k8s-test

# Get events
kubectl get events --sort-by='.lastTimestamp' -A

# Check helm release
helm list
helm status openmetadata-k8s-test
helm get values openmetadata-k8s-test
```

## Cleanup

### Remove Test Deployments
```bash
# Remove helm releases
helm uninstall openmetadata-k8s-test
helm uninstall openmetadata-airflow-test

# Clean up namespaces
kubectl delete namespace openmetadata-pipelines-test

# Clean up secrets
kubectl delete secret postgres-secrets airflow-secrets
```

## Expected Results

### Successful Deployment Indicators

1. ✅ **All pods running**: `kubectl get pods -A` shows all pods in `Running` state
2. ✅ **Health check passing**: `curl http://localhost:8585/api/v1/system/health` returns 200
3. ✅ **RBAC created**: K8s resources created in `openmetadata-pipelines-test` namespace
4. ✅ **Configuration loaded**: Environment variables properly set in pods
5. ✅ **No errors in logs**: `kubectl logs deployment/openmetadata-k8s-test` shows successful startup

### Performance Benchmarks

- **Startup time**: < 5 minutes for full deployment
- **Memory usage**: < 4GB total (including dependencies)
- **CPU usage**: < 2 cores under normal load
- **Job creation**: < 30 seconds for pipeline job creation and execution

This comprehensive testing suite validates both the new K8s native functionality and ensures backward compatibility with existing Airflow configurations.
