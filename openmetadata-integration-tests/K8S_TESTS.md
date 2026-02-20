# Kubernetes Integration Tests

## Overview

OpenMetadata has two types of Kubernetes integration tests:

1. **K8sIngestionPipelineResourceIT** - Tests ingestion pipelines using native Kubernetes Jobs/CronJobs
2. **K8sOMJobOperatorIT** - Tests the custom OMJob operator (requires operator deployment)

## Key Configuration

TestSuiteBootstrap automatically configures the K8s pipeline client with:
- `useOMJobOperator=false` - Uses native Kubernetes Jobs and CronJobs instead of custom OMJob CRDs

This means all K8s tests use standard Kubernetes resources by default, no custom operators needed!

## Running K8s Tests

### K8sIngestionPipelineResourceIT (Native Jobs/CronJobs)

This test uses standard Kubernetes resources (Jobs and CronJobs):

```bash
# Run with K8s enabled
ENABLE_K8S_TESTS=true mvn test -pl :openmetadata-integration-tests -Dtest=K8sIngestionPipelineResourceIT

# Or using system property
mvn test -pl :openmetadata-integration-tests -DENABLE_K8S_TESTS=true -Dtest=K8sIngestionPipelineResourceIT
```

The test will:
- Start K3s using TestContainers
- Use native Kubernetes Jobs and CronJobs (not custom CRDs)
- Test pipeline deployment, triggering, deletion, etc.

### K8sOMJobOperatorIT (Custom OMJob Operator)

This test is for the custom OMJob operator and is disabled by default:
- Has `@Disabled` annotation
- Requires the OMJob operator to be deployed in the cluster
- Tests custom CRD functionality

## What Happens When K8s is Enabled

1. TestSuiteBootstrap starts a K3s container using TestContainers
2. Creates namespace `openmetadata-pipelines`
3. Configures the pipeline service client with K3s kubeconfig
4. **Sets `useOMJobOperator=false` by default** (native Jobs/CronJobs)
5. OpenMetadata server can now deploy pipelines to K8s

## Requirements

- Docker must be running
- TestContainers will automatically pull the K3s image
- Tests take ~30-60 seconds longer due to K3s startup

## Test Output

When K8s is enabled, you'll see:
```
K8s tests enabled: true
Starting K3s container with image: rancher/k3s:v1.28.5-k3s1
K3s container started
K8s pipeline service client configured and ready
```

## Troubleshooting

### Tests skip with "K8s tests disabled"
- Set `ENABLE_K8S_TESTS=true` environment variable
- The tests use `assumeTrue` to skip gracefully when K8s is not enabled

### NullPointerException for pipelineServiceClient
- K8s must be enabled BEFORE the test suite starts
- Use the environment variable approach (not system property during test)

### Tests timeout
- K3s container startup can take 30-60 seconds
- Ensure Docker has sufficient resources allocated