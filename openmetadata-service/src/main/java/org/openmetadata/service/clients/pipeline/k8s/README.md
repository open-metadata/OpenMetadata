# Kubernetes Pipeline Service Client

This module provides Kubernetes-native pipeline execution for OpenMetadata ingestion pipelines. It implements the `PipelineServiceClient` interface to run ingestion workflows as Kubernetes Jobs instead of using external orchestrators like Airflow.

## Why Kubernetes-Native Architecture?

### Design Philosophy: Jobs > Pods

The K8s Pipeline Client uses **Jobs triggering Pods** rather than direct Pod management for several critical reasons:

1. **Built-in Retry Logic**: Jobs provide automatic retry mechanisms with backoff policies, eliminating the need to implement custom retry logic for transient failures (network issues, node problems, resource constraints).

2. **Lifecycle Management**: Jobs handle Pod lifecycle automatically - if a Pod fails, gets evicted, or terminates unexpectedly, the Job controller recreates it according to the retry policy. This provides resilience against infrastructure failures.

3. **Completion Tracking**: Jobs track completion status (Succeeded/Failed/Active) natively, making it easier to map to OpenMetadata's pipeline states without complex Pod phase monitoring.

4. **Resource Cleanup**: Jobs provide TTL-based cleanup (`ttlSecondsAfterFinished`) and history limits, preventing resource accumulation over time.

5. **Scheduling Semantics**: CronJobs provide cron-like scheduling with proper timezone support and prevent overlapping executions, making them ideal for scheduled ingestion pipelines.

### Why Not Direct Pod Management?

Managing Pods directly would require implementing:
- Custom retry logic for failures
- Pod lifecycle monitoring 
- Manual cleanup mechanisms
- Complex state tracking for pipeline status
- Error handling for Pod evictions and node failures

Jobs encapsulate all this complexity in Kubernetes-native primitives.

### Architecture Choice: Separate Diagnostic Jobs

The architecture uses separate diagnostic Jobs (similar to Argo's onExit handlers) rather than sidecar containers because:

1. **Resource Isolation**: Diagnostic collection doesn't consume resources from the main ingestion process
2. **Failure Independence**: Diagnostics can run even if the main container is completely broken
3. **Extended Timeouts**: Diagnostic jobs can have different timeout policies than main ingestion jobs
4. **Clean Separation**: Main jobs focus solely on ingestion; diagnostic jobs handle failure analysis

### Why ConfigMaps for Pipeline Configuration?

The K8s Pipeline Client leverages **ConfigMaps** as the primary mechanism for storing pipeline configurations, following Kubernetes-native patterns:

**Problem Solved**: Ingestion pipelines need complex configuration data (database connections, processing rules, OpenMetadata server details) that must be:
- Accessible to multiple Job runs
- Updatable without rebuilding container images
- Separate from sensitive credentials
- Versioned and trackable

**ConfigMap Benefits**:

1. **Immutable Configuration**: Each pipeline gets its own ConfigMap (`om-config-{pipeline-name}`) containing the complete workflow YAML configuration
2. **Environment Variable Injection**: Configuration is injected via `configMapKeyRef`, making it available as the `config` environment variable
3. **Atomic Updates**: ConfigMaps support optimistic locking (resourceVersion) for safe concurrent updates
4. **Separation of Concerns**: Non-sensitive configuration in ConfigMaps, secrets in Kubernetes Secrets
5. **Native Kubernetes Pattern**: Follows standard K8s configuration management practices

**Configuration Flow**:
```
Pipeline Definition → WorkflowConfigBuilder → ConfigMap → Job Pod → Ingestion Process
```

**Why Not Alternatives?**:
- **Environment Variables**: Limited size, not suitable for large YAML configs
- **Volume Mounts**: More complex, unnecessary for simple key-value configuration
- **Init Containers**: Adds complexity and startup time
- **Image Embedding**: Requires rebuilding images for config changes

This approach provides **declarative configuration management** that integrates seamlessly with Kubernetes' configuration lifecycle.

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
| `ttlSecondsAfterFinished` | `604800` | Time to keep completed jobs (1 week) |
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

### ConfigMap Template

Each pipeline creates a dedicated ConfigMap containing its complete workflow configuration:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: om-config-{pipeline-name}
  namespace: openmetadata-pipelines
  labels:
    app.kubernetes.io/name: openmetadata
    app.kubernetes.io/component: ingestion
    app.kubernetes.io/pipeline: {pipelineName}
data:
  config: |
    workflowConfig:
      openMetadataServerConfig:
        hostPort: "http://openmetadata-server:8585/api"
        authProvider: openmetadata
        securityConfig:
          jwtToken: "<from-secret>"
      source:
        type: database
        serviceName: "mysql-service"
        sourceConfig:
          config:
            type: Database
            # ... database-specific configuration
      processor:
        type: orm-profiler
        # ... processor configuration
      sink:
        type: metadata-rest
        config:
          api_endpoint: "http://openmetadata-server:8585/api"
    ingestionPipelineFQN: "mysql-service.ingestion_pipeline"
```

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
        # Configuration injected from ConfigMap
        - name: config
          valueFrom:
            configMapKeyRef:
              name: om-config-{pipeline-name}
              key: config
        # Job metadata
        - name: pipelineType
          value: "metadata"
        - name: pipelineRunId
          value: "{runId}"
        - name: ingestionPipelineFQN
          value: "{pipeline-fqn}"
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

### Why `startingDeadlineSeconds: 0`?

The K8s Pipeline Client prevents duplicate executions when used with AutoPilot by setting `startingDeadlineSeconds: 0` on CronJobs. This design choice addresses a critical problem:

**Problem**: Without this setting, CronJobs have "catch-up" behavior where they attempt to run missed schedules if the cluster was down or the CronJob controller wasn't running. When AutoPilot also triggers "missed" pipelines, this creates duplicate executions.

**Solution**: Setting `startingDeadlineSeconds: 0` tells the CronJob controller to never run missed schedules - only run at the exact scheduled time if the cluster is available. This ensures:

- **Scheduled pipelines**: Run only at their configured schedule (no catch-up)
- **On-demand executions**: Run immediately when triggered by AutoPilot
- **No duplicates**: AutoPilot handles missed executions, not the CronJob controller

## Log Management

### Why Paginated Log Retrieval?

The K8s Pipeline Client provides paginated log retrieval for better performance with large log files:

**Problem**: Ingestion jobs can generate multi-gigabyte logs (especially for large databases), which can:
- Cause memory issues when transferring via HTTP
- Lead to timeouts in the UI
- Create poor user experience with slow loading

**Solution**: Chunked pagination approach:
- **Chunked Response**: Logs are split into ~1MB chunks for efficient transfer
- **Pagination Support**: Uses `after` parameter to retrieve subsequent chunks  
- **Task-specific Keys**: Logs are returned with pipeline-type-specific task keys (e.g., `ingestion_task`, `profiler_task`)
- **Long Retention**: Pods are retained for 1 week (configurable via `ttlSecondsAfterFinished`) to ensure log availability

### Log Response Format

```json
{
  "ingestion_task": "log content chunk",
  "total": "5",
  "after": "1"
}
```

- `<task_key>`: Log content for the current chunk
- `total`: Total number of chunks available
- `after`: Next chunk index (only present if more chunks available)

### Log Availability

Logs are available for pipelines in all states:
- **Running**: Live logs retrieved directly from pod
- **Success**: Historical logs from completed pods
- **Failed**: Error logs and failure diagnostics

## Environment Variables

All containers receive these environment variables:

- `config`: Complete pipeline configuration YAML (includes OpenMetadata server connection)
- `pipelineType`: Type of ingestion pipeline
- `pipelineRunId`: Unique run identifier
- `ingestionPipelineFQN`: Pipeline fully qualified name
- `jobName`: Kubernetes job name for diagnostics
- `namespace`: Kubernetes namespace
- `pipelineStatus`: "Failed" (set for exit handler when containers terminate)

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

## Architecture Validation

The K8s Pipeline Client architecture has been designed to be **simple and robust** by leveraging Kubernetes primitives instead of reinventing them:

✅ **Jobs over custom Pod management** - Uses built-in retry, lifecycle, and cleanup  
✅ **CronJobs over custom schedulers** - Leverages proven cron scheduling with timezone support  
✅ **Separate diagnostic jobs** - Clean separation of concerns and resource isolation  
✅ **ConfigMaps for configuration** - Immutable, versioned config with atomic updates and optimistic locking  
✅ **Secrets for sensitive data** - Proper separation of credentials from configuration  
✅ **Native log access** - Direct pod log access without additional infrastructure  
✅ **Label-based resource tracking** - Standard Kubernetes resource management  

### ConfigMap Architecture Benefits

The ConfigMap-based configuration approach provides:

- **No Custom Config Server**: Eliminates need for external configuration management systems
- **Atomic Configuration Updates**: Uses Kubernetes' optimistic locking for safe concurrent updates
- **Immutable Deployments**: Each Job gets a consistent configuration snapshot
- **Easy Rollbacks**: Previous ConfigMap versions enable quick rollbacks
- **Native Kubernetes Integration**: Works seamlessly with K8s RBAC, monitoring, and lifecycle management

This results in a **simpler, more maintainable architecture** that requires less custom code and leverages battle-tested Kubernetes features.