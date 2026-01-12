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

### Architecture Choice: PreStop Lifecycle Hooks

The architecture uses Kubernetes `preStop` lifecycle hooks for automatic failure diagnostics rather than separate jobs because:

1. **Immediate Execution**: Diagnostics run immediately when containers terminate (success or failure)
2. **No Additional Resources**: Runs in the same container without creating separate pods
3. **Reliable Triggering**: Kubernetes guarantees preStop hook execution before container termination
4. **Automatic Context**: Has access to all the same environment variables and configuration as the main process

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
│                 PreStop Lifecycle Hooks                   │
├─────────────────────────────────────────────────────────────┤
│ • Automatic execution on container termination            │
│ • Failure diagnostics and status reporting                │
│ • Direct integration with exit_handler.py                 │
│ • No additional resource overhead                         │
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

### 3. PreStop Lifecycle Hooks

Automatic failure diagnostics and status reporting using Kubernetes `preStop` lifecycle hooks.

#### How PreStop Hooks Work

All containers include a `preStop` lifecycle hook that automatically executes when containers terminate:

```yaml
lifecycle:
  preStop:
    exec:
      command: ["python", "exit_handler.py"]
```

This ensures **automatic execution** for all termination scenarios:
- Normal completion (success or failure)
- Manual `killIngestion()` calls  
- Pod evictions (resource pressure, node draining)
- Job timeouts (`activeDeadlineSeconds`)
- Cluster scaling events
- Node failures (SIGTERM/SIGKILL)

#### Exit Handler Process

The `exit_handler.py` script automatically:

1. **Environment Access**: Uses same environment variables as main container:
   - `config`: Complete pipeline configuration YAML (includes OpenMetadata server connection details)
   - `jobName`: Kubernetes job name for pod discovery
   - `namespace`: Kubernetes namespace
   - `pipelineRunId`: Unique run identifier

2. **Diagnostic Collection**:
   - Pod discovery using job-name label selector
   - Log collection from failed containers
   - Status analysis (exit codes, termination reasons)
   - Error reporting with detailed failure information

3. **Status Reporting**: Direct update to OpenMetadata with comprehensive diagnostics and failure details

## Configuration

### Basic Configuration

```yaml
pipelineServiceClientConfiguration:
  className: "org.openmetadata.service.clients.pipeline.k8s.K8sPipelineClient"
  parameters:
    namespace: "openmetadata-pipelines"
    ingestionImage: "docker.getcollate.io/openmetadata/ingestion:1.4.0"
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
      - name: main
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

## PreStop Hook Validation and Debugging

The preStop lifecycle hooks provide automatic failure diagnostics for all pipeline runs. This section explains how to validate that the hooks are working correctly and troubleshoot issues.

### How to Verify PreStop Hook Execution

#### 1. Check Pod Lifecycle Configuration

Verify that pods have the preStop hook configured:

```bash
# Check a specific pod's lifecycle configuration
kubectl get pod <pod-name> -n <namespace> -o yaml | grep -A 10 -B 5 lifecycle

# Expected output should show:
# lifecycle:
#   preStop:
#     exec:
#       command:
#       - python
#       - exit_handler.py
```

#### 2. Monitor Kubernetes Events

The most reliable way to check if preStop hooks execute is through Kubernetes events:

```bash
# Check for preStop hook events (success or failure)
kubectl get events -n <namespace> --sort-by='.lastTimestamp' | grep -i prestop

# Look for these event types:
# - Normal: No events (successful execution)
# - Warning: "FailedPreStopHook" (hook failed to execute)
```

#### 3. Check Termination Timing

PreStop hooks cause pods to spend more time in `Terminating` status:

```bash
# Watch pod termination timing
kubectl describe pod <pod-name> -n <namespace> | grep -A 5 -B 5 "Terminated\|Finished"

# Check termination grace period (should be 60 seconds)
kubectl get pod <pod-name> -n <namespace> -o yaml | grep terminationGracePeriodSeconds
```

#### 4. Validate Environment Variables

Ensure pods have required environment variables for exit_handler.py:

```bash
# Check environment variables in running or failed pods
kubectl get pod <pod-name> -n <namespace> -o yaml | grep -A 20 "env:"

# Required variables:
# - config: Pipeline configuration YAML (includes server connection details)
# - jobName: Kubernetes job name (om-job-{pipeline}-{runId})
# - namespace: Kubernetes namespace
# - pipelineRunId: Unique run identifier
```

### Troubleshooting PreStop Hook Issues

#### Common Problems and Solutions

**1. FailedPreStopHook Events**

```bash
# Check for failed preStop hooks
kubectl get events -n <namespace> | grep FailedPreStopHook

# Common causes:
# - exit_handler.py script missing or not executable
# - Environment variables not set correctly
# - Permission issues accessing OpenMetadata server
# - Network connectivity problems
```

**2. Missing Environment Variables**

If `exit_handler.py` fails with environment variable errors:

```bash
# Verify jobName format matches actual job name
kubectl get jobs -n <namespace> | grep om-job-
kubectl get pod <pod-name> -n <namespace> -o yaml | grep "jobName\|value:"

# jobName should be: om-job-{pipeline-name}-{8-char-runId}
# NOT the full UUID runId
```

**3. Hook Timeout Issues**

PreStop hooks have a maximum execution time based on `terminationGracePeriodSeconds`:

```bash
# Check if hooks are timing out (default: 60 seconds)
kubectl describe pod <pod-name> -n <namespace> | grep -i "grace\|timeout"

# If needed, increase termination grace period in job template
```

**4. Permission Issues**

Verify service account has required permissions:

```bash
# Check service account permissions
kubectl auth can-i get pods --as=system:serviceaccount:<namespace>:<service-account>
kubectl auth can-i list jobs --as=system:serviceaccount:<namespace>:<service-account>
kubectl auth can-i get pods/log --as=system:serviceaccount:<namespace>:<service-account>
```

#### Debug PreStop Hook Execution

**1. Test Exit Handler Manually**

```bash
# Create a test pod with same environment to test exit_handler.py
kubectl run debug-exit-handler \
  --image=<ingestion-image> \
  --restart=Never \
  -n <namespace> \
  --env="config=<config-yaml>" \
  --env="jobName=test-job" \
  --env="namespace=<namespace>" \
  --env="pipelineRunId=test-run" \
  --command -- python exit_handler.py

# Check logs
kubectl logs debug-exit-handler -n <namespace>
kubectl delete pod debug-exit-handler -n <namespace>
```

**2. Verify Exit Handler Script**

```bash
# Check if exit_handler.py exists in the container
kubectl run debug-script-check \
  --image=<ingestion-image> \
  --restart=Never \
  -n <namespace> \
  --rm \
  --command -- ls -la /ingestion/exit_handler.py

# Verify script is executable
kubectl run debug-script-exec \
  --image=<ingestion-image> \
  --restart=Never \
  -n <namespace> \
  --rm \
  --command -- python -c "import sys; print(sys.executable); import exit_handler"
```

**3. Test PreStop Hook with Custom Pod**

```yaml
# test-prestop.yaml
apiVersion: v1
kind: Pod
metadata:
  name: test-prestop
  namespace: <namespace>
spec:
  containers:
  - name: test
    image: <ingestion-image>
    command: ["sleep", "30"]
    env:
    - name: config
      value: |
        workflowConfig:
          loggerLevel: "INFO"
        ingestionPipelineFQN: "test.pipeline"
    - name: jobName
      value: "test-job"
    - name: namespace
      value: "<namespace>"
    - name: pipelineRunId
      value: "test-run"
    lifecycle:
      preStop:
        exec:
          command: ["sh", "-c", "echo 'PreStop starting'; python exit_handler.py; echo 'PreStop done'"]
  restartPolicy: Never
```

```bash
# Deploy test pod
kubectl apply -f test-prestop.yaml

# Kill pod to trigger preStop hook
kubectl delete pod test-prestop -n <namespace> --grace-period=30

# Check events for hook execution
kubectl get events -n <namespace> --sort-by='.lastTimestamp' | tail -10
```

### Expected Behavior

**Successful PreStop Hook Execution:**
- No `FailedPreStopHook` events in `kubectl get events`
- Pod spends ~5-10 seconds in `Terminating` status
- Exit handler updates pipeline status in OpenMetadata
- No error logs related to missing environment variables

**Failed PreStop Hook Execution:**
- `FailedPreStopHook` warning event appears
- Pod may terminate immediately or after full grace period
- Pipeline status may not be updated in OpenMetadata
- Manual status checking required

### Monitoring PreStop Hook Health

Set up monitoring to track preStop hook execution:

```bash
# Create alert for failed preStop hooks
kubectl get events --all-namespaces --watch | grep FailedPreStopHook

# Monitor termination grace period usage
kubectl get events --all-namespaces | grep -i "grace\|terminated" | head -20

# Check for pods stuck in terminating state
kubectl get pods --all-namespaces | grep Terminating
```

This ensures reliable pipeline status reporting and early detection of issues with the automatic failure diagnostics system.

## OMJob Operator: Guaranteed Exit Handler Execution

### Overview

The **OMJob Operator** provides guaranteed exit handler execution for all pipeline termination scenarios, addressing fundamental limitations of Kubernetes `preStop` lifecycle hooks.

### Problem with PreStop Hooks

While `preStop` hooks work for many scenarios, they have a critical limitation:

**PreStop hooks only execute when pods are terminated by Kubernetes**, not when containers exit naturally due to application errors, completion, or internal failures.

#### PreStop Hook Execution Matrix

| Termination Scenario | PreStop Hook Executes |
|----------------------|----------------------|
| Manual `kubectl delete pod` | ✅ Yes |
| Pod eviction (resource pressure) | ✅ Yes |
| Node drain/failure | ✅ Yes |
| Job timeout (`activeDeadlineSeconds`) | ✅ Yes |
| **Container exit code 0 (success)** | ❌ **No** |
| **Container exit code 1 (error)** | ❌ **No** |
| **Application crash/exception** | ❌ **No** |
| **OOM kill by container runtime** | ❌ **No** |

### OMJob Operator Solution

The OMJob operator guarantees exit handler execution for **ALL** termination scenarios by implementing a **two-stage execution pattern** similar to Argo Workflows' `onExit` handlers.

#### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     OMJob Operator                         │
├─────────────────────────────────────────────────────────────┤
│ • Watches for OMJob custom resources                       │
│ • Orchestrates two-stage execution workflow                │
│ • Guarantees exit handler execution for ALL scenarios      │
│ • Updates OMJob status throughout lifecycle                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       OMJob CRD                            │
├─────────────────────────────────────────────────────────────┤
│ • mainPodSpec: Main ingestion workflow specification       │
│ • exitHandlerSpec: Exit handler pod specification          │
│ • ttlSecondsAfterFinished: Cleanup configuration          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Two-Stage Execution                       │
├─────────────────────────────────────────────────────────────┤
│ Stage 1: Main Pod → Ingestion workflow (any exit reason)   │
│ Stage 2: Exit Handler Pod → Status reporting (guaranteed)  │
└─────────────────────────────────────────────────────────────┘
```

#### Execution Flow

1. **OMJob Resource Creation**: K8sPipelineClient creates OMJob instead of regular Job
2. **Main Pod Execution**: Operator creates main ingestion pod from `mainPodSpec`
3. **Completion Detection**: Operator watches main pod until completion (ANY reason)
4. **Exit Handler Execution**: Operator creates exit handler pod from `exitHandlerSpec`
5. **Status Reporting**: Exit handler updates OpenMetadata with final status
6. **Cleanup**: Operator manages TTL-based cleanup of all resources

#### OMJob Custom Resource

```yaml
apiVersion: pipelines.openmetadata.org/v1
kind: OMJob
metadata:
  name: om-job-mysql-pipeline-a1b2c3d4
  namespace: openmetadata-pipelines
  labels:
    app.kubernetes.io/name: openmetadata
    app.kubernetes.io/component: ingestion
    app.kubernetes.io/pipeline: mysql-pipeline
    app.kubernetes.io/run-id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
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
          workflowConfig:
            openMetadataServerConfig:
              hostPort: "http://openmetadata:8585/api"
            # ... complete pipeline configuration
      - name: pipelineType
        value: "metadata"
      - name: pipelineRunId
        value: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
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
          workflowConfig:
            openMetadataServerConfig:
              hostPort: "http://openmetadata:8585/api"
            # ... minimal configuration for status updates
      - name: pipelineRunId
        value: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
      - name: jobName
        value: "om-job-mysql-pipeline-a1b2c3d4"
      - name: namespace
        value: "openmetadata-pipelines"
    resources:
      requests:
        cpu: "100m"
        memory: "256Mi"
      limits:
        cpu: "500m"
        memory: "512Mi"
  
  # Cleanup configuration
  ttlSecondsAfterFinished: 604800  # 1 week
status:
  phase: "Pending"  # Pending → Running → ExitHandlerRunning → Succeeded/Failed
  mainPodName: "om-job-mysql-pipeline-a1b2c3d4-main"
  exitHandlerPodName: "om-job-mysql-pipeline-a1b2c3d4-exit"
  startTime: "2025-01-09T15:30:00Z"
  completionTime: "2025-01-09T15:45:00Z"
  message: "Main pod completed successfully, exit handler executed"
  mainPodExitCode: 0
```

### OMJob vs Regular Jobs

| Aspect | Regular K8s Jobs + preStop | OMJob Operator |
|--------|----------------------------|----------------|
| **Exit handler execution** | ❌ Only on external termination | ✅ Guaranteed for ALL scenarios |
| **Success completion** | ❌ No exit handler | ✅ Exit handler runs |
| **Application crashes** | ❌ No exit handler | ✅ Exit handler runs |
| **OOM kills** | ❌ No exit handler | ✅ Exit handler runs |
| **Manual termination** | ✅ preStop hook runs | ✅ Exit handler runs |
| **Resource overhead** | Lower (single pod) | Slightly higher (operator + 2 pods) |
| **Complexity** | Lower | Higher (requires operator) |
| **Reliability** | Partial coverage | Complete coverage |

### Configuration

#### K8sPipelineClient Configuration

```yaml
# openmetadata.yaml
pipelineServiceClientConfiguration:
  className: "org.openmetadata.service.clients.pipeline.k8s.K8sPipelineClient"
  parameters:
    # Enable OMJob operator usage
    useOMJobOperator: true
    
    # Standard configuration (applies to both mainPodSpec and exitHandlerSpec)
    namespace: "openmetadata-pipelines"
    ingestionImage: "openmetadata/ingestion-base:1.5.0"
    imagePullPolicy: "IfNotPresent"
    serviceAccountName: "openmetadata-ingestion"
    ttlSecondsAfterFinished: 604800
    
    # Resource configuration (mainPodSpec gets full resources, exitHandlerSpec gets minimal)
    resources:
      limits:
        cpu: "2"
        memory: "4Gi"
      requests:
        cpu: "500m"
        memory: "1Gi"
```

#### Helm Configuration

```yaml
# Enable OMJob operator installation
omjobOperator:
  enabled: true

# Enable OMJob usage in pipeline client
openmetadata:
  config:
    pipelineServiceClientConfig:
      type: "k8s"
      k8s:
        useOMJobOperator: true
        namespace: "openmetadata-pipelines"
        ingestionImage: "openmetadata/ingestion-base:1.5.0"
        # ... other k8s configuration
```

### Operator Implementation

The OMJob operator is implemented using the [Java Operator SDK](https://github.com/operator-framework/java-operator-sdk) and follows cloud-native patterns:

#### Required Components

1. **OMJob CRD**: Custom resource definition for pipeline jobs
2. **Operator Deployment**: Controller pod that watches OMJob resources
3. **RBAC**: Permissions for operator to manage pods and OMJobs
4. **K8sPipelineClient Integration**: Creates OMJob resources instead of Jobs

#### Operator Responsibilities

- **Resource Watching**: Monitor OMJob custom resources in target namespace
- **Pod Lifecycle Management**: Create, monitor, and clean up main and exit handler pods
- **Status Reporting**: Update OMJob status throughout execution phases
- **Error Handling**: Manage failures in both main and exit handler pods
- **Cleanup**: Implement TTL-based resource cleanup

### Benefits

1. **Guaranteed Status Updates**: Pipeline status is always reported to OpenMetadata
2. **Complete Coverage**: Works for all termination scenarios (success, failure, crash, OOM, external kill)
3. **Kubernetes Native**: Uses custom resources and controller pattern
4. **Resource Efficiency**: Exit handler pods use minimal resources (100m CPU, 256Mi memory)
5. **Debugging**: Failed pods remain available for log inspection
6. **Consistency**: Same behavior regardless of termination cause

### When to Use OMJob Operator

**Use OMJob Operator when:**
- Critical pipelines require guaranteed status reporting
- Running in environments with frequent OOM kills or resource pressure
- Need debugging capabilities for failed ingestion processes
- Compliance requires audit trails of all pipeline executions

**Use Regular Jobs when:**
- Simple ingestion scenarios with reliable infrastructure
- Resource constraints make operator overhead significant
- Development/testing environments where occasional missed status updates are acceptable

### Operator Development

The OMJob operator is located in the `openmetadata-k8s-operator` module and implements:

- **OMJobReconciler**: Main controller logic for OMJob lifecycle management
- **OMJobStatus**: Status tracking and phase transitions
- **PodManager**: Pod creation and monitoring utilities
- **Configuration**: Operator settings and resource defaults

See `openmetadata-k8s-operator/README.md` for implementation details and development setup.
