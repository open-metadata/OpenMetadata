# Kubernetes Pipeline Service Client

This module provides Kubernetes-native pipeline execution for OpenMetadata ingestion pipelines. It implements the `PipelineServiceClient` interface to run ingestion workflows as Kubernetes Jobs instead of using external orchestrators like Airflow.

## Architecture Overview

The K8s Pipeline Client consists of three main components:

```
┌─────────────────────────────────────────────────────────────┐
│                   K8sPipelineClient                        │
├─────────────────────────────────────────────────────────────┤
│ • Pipeline lifecycle management                            │
│ • Job creation and monitoring                              │
│ • Status tracking and reporting                            │
│ • Integration with K8s APIs                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                K8sPipelineClientConfig                     │
├─────────────────────────────────────────────────────────────┤
│ • Configuration parsing and validation                     │
│ • Default value management                                 │
│ • Resource specifications                                  │
│ • Security context settings                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                K8sFailureDiagnostics                       │
├─────────────────────────────────────────────────────────────┤
│ • Failure detection and analysis                          │
│ • Diagnostic job execution                                 │
│ • Pod logs and status collection                          │
│ • Error reporting integration                              │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. K8sPipelineClient

The main client class that implements the OpenMetadata `PipelineServiceClient` interface for Kubernetes environments.

#### Key Features:
- **Pipeline Deployment**: Creates CronJobs for scheduled pipelines with ConfigMaps and Secrets for configuration
- **On-Demand Execution**: Runs Jobs for immediate pipeline execution
- **Status Monitoring**: Tracks job status and maps to OpenMetadata pipeline states
- **Resource Management**: Handles cleanup of Jobs, CronJobs, ConfigMaps, and Secrets
- **Exit Handler Integration**: Automatic status reporting when containers terminate

#### Lifecycle Management:
1. **Deploy**: `deployPipeline()` → Creates CronJob + ConfigMap + Secret
2. **Run**: `runPipeline()` → Creates Job for immediate execution
3. **Monitor**: `getQueuedPipelineStatusInternal()` → Tracks job status
4. **Kill**: `killIngestion()` → Graceful termination with exit handler
5. **Cleanup**: `deletePipeline()` → Removes all resources

#### Exit Handler Integration

All containers include a `preStop` lifecycle hook that automatically runs the exit handler when containers terminate for any reason:

This ensures proper status reporting for:
- Manual `killIngestion()` calls
- Pod evictions (resource pressure, node draining)  
- Job timeouts or failures
- Cluster scaling events
- Node failures or SIGTERM/SIGKILL signals

### 2. K8sPipelineClientConfig

Centralized configuration management with validation and type-safe parsing.

#### Configuration Parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `namespace` | `openmetadata-pipelines` | Kubernetes namespace for resources |
| `ingestionImage` | `docker.getcollate.io/openmetadata/ingestion:latest` | Container image for ingestion jobs |
| `imagePullPolicy` | `IfNotPresent` | Image pull policy |
| `serviceAccountName` | `openmetadata-ingestion` | Service account for pods |
| `ttlSecondsAfterFinished` | `86400` | Time to keep completed jobs (24h) |
| `activeDeadlineSeconds` | `7200` | Maximum job runtime (2h) |
| `backoffLimit` | `3` | Maximum retry attempts |
| `startingDeadlineSeconds` | `0` | CronJob catch-up prevention (0 = no catch-up) |
| `successfulJobsHistoryLimit` | `3` | Number of successful jobs to keep |
| `failedJobsHistoryLimit` | `3` | Number of failed jobs to keep |
| `runAsUser` | `1000` | Pod security context user ID |
| `runAsGroup` | `1000` | Pod security context group ID |
| `fsGroup` | `1000` | Pod security context filesystem group |
| `runAsNonRoot` | `true` | Require non-root execution |
| `failureDiagnosticsEnabled` | `false` | Enable automatic failure analysis |

#### Resource Configuration:
```yaml
resources:
  limits:
    cpu: "2"
    memory: "4Gi"
  requests:
    cpu: "500m"
    memory: "1Gi"
```

### 3. K8sFailureDiagnostics

Advanced failure analysis system that provides detailed diagnostic information when pipeline jobs fail.

#### Diagnostic Process

When a pipeline job fails and diagnostics are enabled:

1. **Detection**: `mapJobToPipelineStatus()` detects `FAILED` job status
2. **Job Creation**: Creates diagnostic job with environment variables:
   - `jobName`: Name of the failed job
   - `namespace`: Kubernetes namespace
   - `pipelineRunId`: Unique run identifier
   - `pipelineStatus`: "Failed"
   - `config`: Pipeline configuration YAML

3. **exit_handler.py Execution**:
   - Pod discovery using job-name label selector
   - Log collection (last 500 lines from ingestion container)
   - Status analysis (pod phase, reason, message, container states)
   - Event gathering (if permissions allow)
   - Error reporting with exit codes and termination reasons

4. **Status Update**: Direct update to OpenMetadata with comprehensive diagnostics

## Configuration

### Basic Configuration

```yaml
pipelineServiceClientConfiguration:
  className: "org.openmetadata.service.clients.pipeline.k8s.K8sPipelineClient"
  parameters:
    namespace: "openmetadata-pipelines"
    ingestionImage: "docker.getcollate.io/openmetadata/ingestion:1.4.0"
    failureDiagnosticsEnabled: true
    startingDeadlineSeconds: 0  # Prevents AutoPilot duplicate executions
```

### Advanced Configuration

```yaml
pipelineServiceClientConfiguration:
  className: "org.openmetadata.service.clients.pipeline.k8s.K8sPipelineClient"
  parameters:
    # Basic settings
    namespace: "data-platform-ingestion"
    ingestionImage: "my-registry.com/openmetadata/ingestion:latest"
    imagePullPolicy: "Always"
    imagePullSecrets: "registry-secret"
    serviceAccountName: "data-ingestion-sa"
    
    # Resource limits
    resources:
      limits:
        cpu: "4"
        memory: "8Gi"
      requests:
        cpu: "1"
        memory: "2Gi"
    
    # Job configuration
    ttlSecondsAfterFinished: 3600  # 1 hour
    activeDeadlineSeconds: 10800   # 3 hours
    backoffLimit: 5
    successfulJobsHistoryLimit: 5
    failedJobsHistoryLimit: 10
    startingDeadlineSeconds: 0     # No catch-up execution
    
    # Security context
    runAsUser: 1001
    runAsGroup: 1001
    fsGroup: 1001
    runAsNonRoot: true
    
    # Node selection
    nodeSelector: "workload-type=data-processing,zone=us-west1-a"
    
    # Pod annotations
    podAnnotations: "prometheus.io/scrape=true,prometheus.io/port=8080"
    
    # Extra environment variables
    extraEnvVars:
      - "DATABASE_URL:postgresql://postgres.data.svc.cluster.local:5432/metadata"
      - "LOG_LEVEL:DEBUG"
      - "JAVA_OPTS:-Xmx2g -XX:+UseG1GC"
    
    # Failure diagnostics
    failureDiagnosticsEnabled: true
```

## Kubernetes Resources

### Job Template

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: om-job-{name}-{runId}
  namespace: openmetadata-pipelines
  labels:
    app.kubernetes.io/name: openmetadata
    app.kubernetes.io/component: ingestion
    app.kubernetes.io/pipeline: {pipelineName}
    app.kubernetes.io/run-id: {runId}
spec:
  backoffLimit: 3
  activeDeadlineSeconds: 7200
  ttlSecondsAfterFinished: 86400
  template:
    spec:
      serviceAccountName: openmetadata-ingestion
      restartPolicy: Never
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
        runAsNonRoot: true
      containers:
      - name: ingestion
        image: docker.getcollate.io/openmetadata/ingestion:latest
        imagePullPolicy: IfNotPresent
        command: ["python", "main.py"]
        lifecycle:
          preStop:
            exec:
              command: ["python", "exit_handler.py"]
        resources:
          requests:
            cpu: "500m"
            memory: "1Gi"
          limits:
            cpu: "2"
            memory: "4Gi"
        securityContext:
          runAsNonRoot: true
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: false
          capabilities:
            drop: ["ALL"]
        env:
        - name: jobName
          value: "om-job-{name}-{runId}"
        - name: namespace  
          value: "openmetadata-pipelines"
```

### CronJob Template

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: om-cronjob-{name}
  namespace: openmetadata-pipelines
spec:
  schedule: "0 2 * * 0"  # Weekly on Sunday
  timeZone: "UTC"
  concurrencyPolicy: Forbid
  startingDeadlineSeconds: 0  # No catch-up execution
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  suspend: false
  jobTemplate:
    # Same as Job template above
```

### Required RBAC

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: openmetadata-ingestion
  namespace: openmetadata-pipelines
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: openmetadata-ingestion
  namespace: openmetadata-pipelines
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log", "configmaps", "secrets", "events"]
  verbs: ["get", "list", "create", "update", "patch", "delete"]
- apiGroups: ["batch"]
  resources: ["jobs", "cronjobs"]
  verbs: ["get", "list", "create", "update", "patch", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: openmetadata-ingestion
  namespace: openmetadata-pipelines
subjects:
- kind: ServiceAccount
  name: openmetadata-ingestion
  namespace: openmetadata-pipelines
roleRef:
  kind: Role
  name: openmetadata-ingestion
  apiGroup: rbac.authorization.k8s.io
```

## Pipeline Status Mapping

| Kubernetes Job Status | OpenMetadata Status | Description |
|----------------------|-------------------|-------------|
| `Pending` | `QUEUED` | Job created but not scheduled |
| `Running` | `RUNNING` | Job pods are executing |
| `Succeeded` | `SUCCESS` | Job completed successfully |
| `Failed` | `FAILED` | Job failed (with diagnostics if enabled) |
| `Unknown` | `QUEUED` | Status cannot be determined |

## AutoPilot Integration

The K8s Pipeline Client prevents duplicate executions when used with AutoPilot by setting `startingDeadlineSeconds: 0` on CronJobs. This ensures:

- **Scheduled pipelines**: Run only at their configured schedule
- **On-demand executions**: Run immediately when triggered by AutoPilot
- **No catch-up behavior**: CronJobs don't attempt to run missed schedules

## Environment Variables

All containers receive these environment variables:

- `config`: Complete pipeline configuration YAML (includes OpenMetadata server connection)
- `pipelineType`: Type of ingestion pipeline
- `pipelineRunId`: Unique run identifier
- `ingestionPipelineFQN`: Pipeline fully qualified name
- `jobName`: Kubernetes job name for diagnostics
- `namespace`: Kubernetes namespace

## Best Practices

### Security
- Use dedicated service accounts with minimal required permissions
- Set `runAsNonRoot: true` and appropriate user/group IDs
- Use image pull secrets for private registries
- Enable pod security policies or admission controllers

### Resource Management
- Set appropriate resource requests and limits
- Configure `ttlSecondsAfterFinished` to clean up completed jobs
- Use `activeDeadlineSeconds` to prevent runaway jobs
- Set `startingDeadlineSeconds: 0` to prevent duplicate executions

### Monitoring
- Enable failure diagnostics for better error visibility
- Use pod annotations for Prometheus scraping
- Monitor job completion rates and failure patterns
- Set up alerts for failed jobs

### Configuration
- Use environment variable overrides for environment-specific settings
- Keep sensitive data in Kubernetes Secrets
- Use ConfigMaps for non-sensitive configuration
- Test configuration changes in staging environments