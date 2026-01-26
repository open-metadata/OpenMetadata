# OpenMetadata Kubernetes Operator

A Kubernetes operator that provides guaranteed exit handler execution for OpenMetadata pipeline jobs using a two-stage execution pattern similar to Argo Workflows' `onExit` handlers.

## Overview

The OMJob operator addresses fundamental limitations of Kubernetes `preStop` lifecycle hooks by implementing a custom resource (`OMJob`) that ensures exit handlers execute for **ALL** pod termination scenarios:

- ✅ Normal completion (exit code 0)
- ✅ Application failures (exit code > 0)  
- ✅ Application crashes and exceptions
- ✅ OOM kills by container runtime
- ✅ Manual pod termination
- ✅ Node failures and evictions

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   K8s Pipeline  │───▶│   OMJob CRD     │───▶│ OMJob Operator  │
│     Client      │    │   Resource      │    │   Controller    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                   ┌───────────────────┼───────────────────┐
                                   ▼                   ▼                   ▼
                          ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
                          │   Main Pod      │ │ Exit Handler    │ │   Cleanup &     │
                          │  (Ingestion)    │ │     Pod         │ │   Monitoring    │
                          └─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Execution Flow

1. **OMJob Creation**: K8sPipelineClient creates OMJob instead of regular Job
2. **Main Pod**: Operator creates main ingestion pod from `mainPodSpec`
3. **Monitoring**: Operator watches main pod until completion (ANY reason)
4. **Exit Handler**: Operator creates exit handler pod from `exitHandlerSpec` 
5. **Status Update**: Exit handler reports final status to OpenMetadata
6. **Cleanup**: TTL-based cleanup of pods and resources

## Building and Running

### Prerequisites

- Java 21+
- Maven 3.8+
- Docker (for container builds)
- Kubernetes cluster access

### Build

```bash
# Compile the operator
mvn clean compile

# Run unit tests
mvn test

# Build fat JAR
mvn package

# Build Docker image
mvn package -Pdocker
```

### Local Development

```bash
# Run operator locally (requires kubeconfig)
mvn spring-boot:run

# Or run the built JAR
java -jar target/openmetadata-k8s-operator-1.12.0-SNAPSHOT-boot.jar
```

### Configuration

The operator is configured via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `OPERATOR_NAMESPACE` | `default` | Namespace where operator runs |
| `LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARN, ERROR) |
| `RECONCILIATION_THREADS` | `5` | Number of concurrent reconciliation threads |
| `HEALTH_CHECK_PORT` | `8080` | Health check endpoint port |
| `METRICS_PORT` | `8081` | Prometheus metrics port |

### Health Checks

The operator exposes health check endpoints:

- `GET /health` - Liveness and readiness probe
- `GET /metrics` - Prometheus metrics
- `GET /info` - Application information

## Deployment

### Helm Deployment

The operator is deployed as part of the OpenMetadata Helm chart:

```yaml
# values.yaml
omjobOperator:
  enabled: true

openmetadata:
  config:
    pipelineServiceClientConfig:
      type: "k8s"
      k8s:
        useOMJobOperator: true
        # ... other configuration
```

### Manual Deployment

1. **Deploy CRD**:
```bash
kubectl apply -f charts/openmetadata/templates/omjob-crd.yaml
```

2. **Deploy RBAC**:
```bash
kubectl apply -f charts/openmetadata/templates/omjob-operator-rbac.yaml
```

3. **Deploy Operator**:
```bash
kubectl apply -f charts/openmetadata/templates/omjob-operator-deployment.yaml
```

## Custom Resource Definition

### OMJob Specification

```yaml
apiVersion: pipelines.openmetadata.org/v1
kind: OMJob
metadata:
  name: om-job-mysql-pipeline-a1b2c3d4
  namespace: openmetadata-pipelines
spec:
  # Main ingestion pod specification
  mainPodSpec:
    image: "openmetadata/ingestion-base:1.5.0"
    imagePullPolicy: "IfNotPresent"
    serviceAccountName: "openmetadata-ingestion"
    command: ["python", "main.py"]
    env:
      - name: config
        value: |
          # Complete pipeline configuration YAML
    resources:
      requests:
        cpu: "500m"
        memory: "1Gi"
      limits:
        cpu: "2"
        memory: "4Gi"
    
  # Exit handler pod specification  
  exitHandlerSpec:
    image: "openmetadata/ingestion-base:1.5.0"
    imagePullPolicy: "IfNotPresent"
    command: ["python", "exit_handler.py"]
    env:
      - name: config
        value: |
          # Minimal configuration for status updates
    resources:
      requests:
        cpu: "100m"
        memory: "256Mi"
      limits:
        cpu: "500m"
        memory: "512Mi"
  
  # Cleanup configuration
  ttlSecondsAfterFinished: 604800  # 1 week
```

### Status Tracking

The operator maintains detailed status information:

```yaml
status:
  phase: "ExitHandlerRunning"  # Pending → Running → ExitHandlerRunning → Succeeded/Failed
  mainPodName: "om-job-mysql-pipeline-a1b2c3d4-main"
  exitHandlerPodName: "om-job-mysql-pipeline-a1b2c3d4-exit"
  startTime: "2025-01-09T15:30:00Z"
  completionTime: "2025-01-09T15:45:00Z"
  message: "Exit handler running"
  mainPodExitCode: 0
  lastTransitionTime: "2025-01-09T15:32:00Z"
  observedGeneration: 1
```

## Monitoring and Observability

### Kubernetes Events

The operator publishes events for key lifecycle transitions:

```bash
# View OMJob events
kubectl get events --field-selector involvedObject.kind=OMJob

# Example events:
# Normal   MainPodCreated        Created main ingestion pod
# Normal   MainPodCompleted      Main pod completed with exit code: 0  
# Normal   ExitHandlerCreated    Created exit handler pod
# Normal   OMJobCompleted        Exit handler completed with exit code: 0
```

### Metrics

Prometheus metrics are available at `/metrics`:

- `omjob_reconciliations_total{status="success|error"}` - Reconciliation attempts
- `omjob_duration_seconds{phase="main|exit_handler"}` - Execution durations
- `omjob_pods_created_total{type="main|exit_handler"}` - Pod creation counts
- `omjob_status_transitions_total{from_phase,to_phase}` - Phase transitions

### Logs

Structured JSON logging with correlation IDs:

```bash
# View operator logs
kubectl logs -l app.kubernetes.io/name=omjob-operator -f

# Filter by OMJob
kubectl logs -l app.kubernetes.io/name=omjob-operator | grep "omjob.name=mysql-pipeline"
```

## Troubleshooting

### Common Issues

1. **OMJob stuck in PENDING**:
   - Check pod creation permissions (RBAC)
   - Verify image pull secrets and policies
   - Check resource quotas and limits

2. **Main pod fails to start**:
   - Verify image exists and is accessible  
   - Check environment variables and configuration
   - Review pod events and logs

3. **Exit handler not created**:
   - Check operator logs for errors
   - Verify main pod has actually completed
   - Check RBAC permissions for pod creation

### Debugging Commands

```bash
# Check OMJob status
kubectl get omjobs -A

# Describe specific OMJob
kubectl describe omjob <name> -n <namespace>

# Check operator status
kubectl get pods -l app.kubernetes.io/name=omjob-operator

# View operator logs
kubectl logs -l app.kubernetes.io/name=omjob-operator -f

# Check CRD installation
kubectl get crd omjobs.pipelines.openmetadata.org
```

### Enable Debug Logging

Set `LOG_LEVEL=DEBUG` environment variable in operator deployment:

```yaml
env:
- name: LOG_LEVEL
  value: "DEBUG"
```

## Development

### Project Structure

```
src/main/java/org/openmetadata/operator/
├── OMJobOperatorApplication.java     # Main application entry point
├── controller/
│   └── OMJobReconciler.java         # Core reconciliation logic
├── model/
│   ├── OMJobResource.java           # Custom resource model
│   ├── OMJobSpec.java               # Resource specification
│   ├── OMJobStatus.java             # Resource status  
│   └── OMJobPhase.java              # Lifecycle phases
├── service/
│   ├── PodManager.java              # Pod lifecycle management
│   └── EventPublisher.java          # Kubernetes event publishing
├── config/
│   └── OperatorConfig.java          # Configuration management
└── util/
    └── LabelBuilder.java            # Label and selector utilities
```

### Running Tests

```bash
# Unit tests
mvn test

# Integration tests (requires Docker)
mvn verify -Pfailsafe

# Test coverage
mvn jacoco:report
```

### Code Standards

- Java 21 language features
- Google Java Style formatting
- Comprehensive unit test coverage
- Integration tests with Testcontainers
- Detailed Javadoc documentation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run `mvn verify` to ensure all tests pass
5. Submit a pull request

## License

Licensed under the Apache License, Version 2.0. See `LICENSE` file for details.