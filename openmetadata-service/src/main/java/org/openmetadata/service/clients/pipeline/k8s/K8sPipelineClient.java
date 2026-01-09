/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.clients.pipeline.k8s;

import com.google.common.annotations.VisibleForTesting;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import io.kubernetes.client.openapi.ApiClient;
import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.Configuration;
import io.kubernetes.client.openapi.apis.BatchV1Api;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1Capabilities;
import io.kubernetes.client.openapi.models.V1ConfigMap;
import io.kubernetes.client.openapi.models.V1Container;
import io.kubernetes.client.openapi.models.V1CronJob;
import io.kubernetes.client.openapi.models.V1CronJobSpec;
import io.kubernetes.client.openapi.models.V1EnvVar;
import io.kubernetes.client.openapi.models.V1EnvVarSource;
import io.kubernetes.client.openapi.models.V1ExecAction;
import io.kubernetes.client.openapi.models.V1Job;
import io.kubernetes.client.openapi.models.V1JobList;
import io.kubernetes.client.openapi.models.V1JobSpec;
import io.kubernetes.client.openapi.models.V1JobTemplateSpec;
import io.kubernetes.client.openapi.models.V1Lifecycle;
import io.kubernetes.client.openapi.models.V1LifecycleHandler;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.openapi.models.V1Pod;
import io.kubernetes.client.openapi.models.V1PodList;
import io.kubernetes.client.openapi.models.V1PodSecurityContext;
import io.kubernetes.client.openapi.models.V1PodSpec;
import io.kubernetes.client.openapi.models.V1PodTemplateSpec;
import io.kubernetes.client.openapi.models.V1ResourceRequirements;
import io.kubernetes.client.openapi.models.V1Secret;
import io.kubernetes.client.openapi.models.V1SecurityContext;
import io.kubernetes.client.util.ClientBuilder;
import io.kubernetes.client.util.Config;
import java.io.IOException;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exception.PipelineServiceClientException;
import org.openmetadata.service.clients.pipeline.PipelineServiceClient;
import org.openmetadata.service.clients.pipeline.config.WorkflowConfigBuilder;
import org.openmetadata.service.exception.IngestionPipelineDeploymentException;
import org.slf4j.MDC;

/**
 * Kubernetes-native Pipeline Service Client.
 *
 * This client deploys and manages ingestion pipelines as Kubernetes Jobs and CronJobs,
 * eliminating the need for Apache Airflow.
 *
 * Key features:
 * - Scheduled pipelines run as CronJobs
 * - On-demand runs create one-off Jobs
 * - Configuration stored in ConfigMaps
 * - Secrets stored in K8s Secrets
 * - Logs retrieved from pod logs or streamed to OM server
 */
@Slf4j
public class K8sPipelineClient extends PipelineServiceClient {

  private static final String PLATFORM = "Kubernetes";

  // K8s resource naming prefixes
  private static final String CONFIG_MAP_PREFIX = "om-config-";
  private static final String SECRET_PREFIX = "om-secret-";
  private static final String JOB_PREFIX = "om-job-";
  private static final String CRONJOB_PREFIX = "om-cronjob-";

  // Labels
  private static final String LABEL_APP = "app.kubernetes.io/name";
  private static final String LABEL_COMPONENT = "app.kubernetes.io/component";
  private static final String LABEL_MANAGED_BY = "app.kubernetes.io/managed-by";
  private static final String LABEL_PIPELINE = "app.kubernetes.io/pipeline";
  private static final String LABEL_PIPELINE_TYPE = "app.kubernetes.io/pipeline-type";
  private static final String LABEL_RUN_ID = "app.kubernetes.io/run-id";

  // Config keys for K8s client initialization
  private static final String IN_CLUSTER_KEY = "inCluster";
  private static final String KUBECONFIG_PATH_KEY = "kubeconfigPath";
  private static final String KUBECONFIG_CONTENT_KEY = "kubeConfigContent";
  private static final String SKIP_INIT_KEY = "skipInit";

  // MDC keys for correlation
  private static final String MDC_CORRELATION_ID = "correlationId";
  private static final String MDC_PIPELINE_NAME = "pipelineName";
  private static final String MDC_OPERATION = "operation";

  // Retry configuration for K8s API calls
  private static final RetryConfig RETRY_CONFIG =
      RetryConfig.custom()
          .maxAttempts(3)
          .waitDuration(Duration.ofMillis(500))
          .retryOnException(K8sPipelineClient::isRetryableException)
          .build();

  private final Retry retry = Retry.of("k8s-api", RETRY_CONFIG);

  // K8s API clients
  private BatchV1Api batchApi;
  private CoreV1Api coreApi;

  // Configuration
  private final K8sPipelineClientConfig k8sConfig;
  private final String metadataApiEndpoint;

  // Failure diagnostics
  private final K8sFailureDiagnostics failureDiagnostics;

  public K8sPipelineClient(PipelineServiceClientConfiguration clientConfig) {
    super(clientConfig);
    this.setPlatform(PLATFORM);

    Map<String, Object> params =
        clientConfig.getParameters() != null
            ? clientConfig.getParameters().getAdditionalProperties()
            : new HashMap<>();

    boolean skipInit = Boolean.parseBoolean(getStringParam(params, SKIP_INIT_KEY, "false"));

    if (!skipInit) {
      ApiClient client = initializeK8sClient(params);
      Configuration.setDefaultApiClient(client);
      this.batchApi = new BatchV1Api(client);
      this.coreApi = new CoreV1Api(client);
    } else {
      this.batchApi = null;
      this.coreApi = null;
    }

    this.k8sConfig = new K8sPipelineClientConfig(params);
    this.metadataApiEndpoint = clientConfig.getMetadataApiEndpoint();

    // Initialize failure diagnostics
    this.failureDiagnostics =
        new K8sFailureDiagnostics(coreApi, batchApi, k8sConfig, metadataApiEndpoint);

    // Validate k8sConfig.getNamespace() exists
    if (!skipInit) {
      validateNamespaceExists();
    }

    LOG.info(
        "K8sPipelineClient initialized - namespace: {}, image: {}",
        k8sConfig.getNamespace(),
        k8sConfig.getIngestionImage());
  }

  /** Validates that the target k8sConfig.getNamespace() exists. Fails fast with a clear error if not. */
  private void validateNamespaceExists() {
    try {
      coreApi.readNamespace(k8sConfig.getNamespace()).execute();
      LOG.debug("Validated namespace exists: {}", k8sConfig.getNamespace());
    } catch (ApiException e) {
      if (e.getCode() == 404) {
        throw new PipelineServiceClientException(
            String.format(
                "Namespace '%s' does not exist. Create it with: kubectl create namespace %s",
                k8sConfig.getNamespace(), k8sConfig.getNamespace()));
      }
      // For other errors, log warning but don't fail - k8sConfig.getNamespace() might be accessible
      // but not
      // readable
      LOG.warn(
          "Could not validate k8sConfig.getNamespace() '{}' exists (HTTP {}): {}. Proceeding anyway.",
          k8sConfig.getNamespace(),
          e.getCode(),
          e.getMessage());
    }
  }

  /** Check if an exception is retryable (transient K8s API errors). */
  private static boolean isRetryableException(Throwable throwable) {
    if (throwable instanceof ApiException) {
      int code = ((ApiException) throwable).getCode();
      // Retry on: 429 (Too Many Requests), 500, 502, 503, 504 (Server errors)
      return code == 429 || code == 500 || code == 502 || code == 503 || code == 504;
    }
    // Retry on IO exceptions (network issues)
    return throwable instanceof IOException;
  }

  /** Execute a K8s API call with retry logic. */
  private <T> T executeWithRetry(K8sApiCall<T> call) throws ApiException {
    try {
      return Retry.decorateCheckedSupplier(retry, call::execute).get();
    } catch (Throwable t) {
      if (t instanceof ApiException) {
        throw (ApiException) t;
      }
      LOG.error("K8s API call failed after retries", t);
      throw new PipelineServiceClientException("K8s API call failed: " + t.getMessage());
    }
  }

  /** Functional interface for K8s API calls that can throw ApiException. */
  @FunctionalInterface
  private interface K8sApiCall<T> {
    T execute() throws ApiException;
  }

  private ApiClient initializeK8sClient(Map<String, Object> params) {
    try {
      boolean inCluster = Boolean.parseBoolean(getStringParam(params, IN_CLUSTER_KEY, "true"));

      if (inCluster) {
        LOG.info("Using in-cluster Kubernetes configuration");
        return ClientBuilder.cluster().build();
      }

      String kubeConfigContent = getStringParam(params, KUBECONFIG_CONTENT_KEY, "");
      if (StringUtils.isNotBlank(kubeConfigContent)) {
        LOG.info("Using kubeconfig from provided content");
        ApiClient client = Config.fromConfig(new StringReader(kubeConfigContent));
        client.setReadTimeout(30000);
        client.setConnectTimeout(10000);
        return client;
      }

      String kubeconfigPath = getStringParam(params, KUBECONFIG_PATH_KEY, "");
      if (StringUtils.isNotBlank(kubeconfigPath)) {
        LOG.info("Using kubeconfig from: {}", kubeconfigPath);
        return Config.fromConfig(kubeconfigPath);
      }

      LOG.info("Using default kubeconfig (~/.kube/config)");
      return Config.defaultClient();
    } catch (IOException e) {
      throw new PipelineServiceClientException(
          "Failed to initialize Kubernetes client: " + e.getMessage());
    }
  }

  @Override
  public PipelineServiceClientResponse deployPipeline(
      IngestionPipeline ingestionPipeline, ServiceEntityInterface service) {
    String pipelineName = sanitizeName(ingestionPipeline.getName());
    String correlationId = UUID.randomUUID().toString().substring(0, 8);

    // Set MDC for correlation
    MDC.put(MDC_CORRELATION_ID, correlationId);
    MDC.put(MDC_PIPELINE_NAME, pipelineName);
    MDC.put(MDC_OPERATION, "deploy");

    try {
      LOG.info("Starting pipeline deployment [correlationId={}]", correlationId);

      // Track created resources for rollback on failure
      List<Runnable> rollbacks = new ArrayList<>();

      try {
        // Create ConfigMap
        V1ConfigMap configMap = buildConfigMap(ingestionPipeline, service);
        boolean created = createOrUpdateConfigMap(configMap);
        if (created) {
          final String configMapName = configMap.getMetadata().getName();
          rollbacks.add(() -> safeDeleteConfigMap(configMapName));
        }

        // Create Secret
        V1Secret secret = buildSecret(ingestionPipeline);
        created = createOrUpdateSecret(secret);
        if (created) {
          final String secretName = secret.getMetadata().getName();
          rollbacks.add(() -> safeDeleteSecret(secretName));
        }

        // Create/Update CronJob if scheduled
        if (hasSchedule(ingestionPipeline)) {
          V1CronJob cronJob = buildCronJob(ingestionPipeline);
          created = createOrUpdateCronJob(cronJob);
          if (created) {
            final String cronJobName = cronJob.getMetadata().getName();
            rollbacks.add(() -> safeDeleteCronJob(cronJobName));
          }
          LOG.info(
              "Created CronJob for scheduled pipeline: {} (startingDeadlineSeconds={}s)",
              pipelineName,
              k8sConfig.getStartingDeadlineSeconds());
        } else {
          deleteCronJobIfExists(CRONJOB_PREFIX + pipelineName);
          LOG.info("Pipeline {} is on-demand only (no schedule)", pipelineName);
        }

        ingestionPipeline.setDeployed(true);
        LOG.info("Pipeline deployment completed successfully [correlationId={}]", correlationId);
        return buildSuccessResponse("Pipeline deployed successfully to Kubernetes");

      } catch (ApiException e) {
        // Rollback created resources in reverse order
        LOG.warn(
            "Deployment failed, rolling back {} created resources [correlationId={}]",
            rollbacks.size(),
            correlationId);
        Collections.reverse(rollbacks);
        for (Runnable rollback : rollbacks) {
          try {
            rollback.run();
          } catch (Exception rollbackError) {
            LOG.warn("Rollback failed: {}", rollbackError.getMessage());
          }
        }
        throw e;
      }

    } catch (ApiException e) {
      LOG.error(
          "Failed to deploy pipeline {} [correlationId={}]: HTTP {} - {}",
          pipelineName,
          correlationId,
          e.getCode(),
          parseK8sErrorMessage(e));
      throw IngestionPipelineDeploymentException.byMessage(
          pipelineName, DEPLOYMENT_ERROR, buildDetailedErrorMessage("deploy", pipelineName, e));
    } finally {
      MDC.clear();
    }
  }

  /** Safe delete methods for rollback - swallow exceptions */
  private void safeDeleteConfigMap(String name) {
    try {
      deleteConfigMapIfExists(name);
    } catch (Exception e) {
      LOG.debug("Rollback: failed to delete ConfigMap {}: {}", name, e.getMessage());
    }
  }

  private void safeDeleteSecret(String name) {
    try {
      deleteSecretIfExists(name);
    } catch (Exception e) {
      LOG.debug("Rollback: failed to delete Secret {}: {}", name, e.getMessage());
    }
  }

  private void safeDeleteCronJob(String name) {
    try {
      deleteCronJobIfExists(name);
    } catch (Exception e) {
      LOG.debug("Rollback: failed to delete CronJob {}: {}", name, e.getMessage());
    }
  }

  /** Build a detailed error message for K8s API failures. */
  private String buildDetailedErrorMessage(String operation, String resourceName, ApiException e) {
    String k8sMessage = parseK8sErrorMessage(e);
    String hint = getErrorHint(e.getCode());
    return String.format(
        "Failed to %s '%s' in k8sConfig.getNamespace() '%s': HTTP %d - %s.%s",
        operation, resourceName, k8sConfig.getNamespace(), e.getCode(), k8sMessage, hint);
  }

  /** Parse the K8s error message from the response body. */
  private String parseK8sErrorMessage(ApiException e) {
    String body = e.getResponseBody();
    if (StringUtils.isBlank(body)) {
      return e.getMessage();
    }
    try {
      // Try to extract 'message' field from K8s error response
      if (body.contains("\"message\"")) {
        int start = body.indexOf("\"message\"") + 11;
        int end = body.indexOf("\"", start);
        if (end > start) {
          return body.substring(start, end);
        }
      }
    } catch (Exception ignored) {
      // Fall back to full body
    }
    return body.length() > 200 ? body.substring(0, 200) + "..." : body;
  }

  /** Get a helpful hint based on the error code. */
  private String getErrorHint(int code) {
    return switch (code) {
      case 401 -> " Check ServiceAccount token and RBAC configuration.";
      case 403 -> " The ServiceAccount lacks permissions. Ensure proper Role/RoleBinding exists.";
      case 404 -> " Resource not found. Verify the namespace and resource names.";
      case 409 -> " Resource conflict. The resource may have been modified by another process.";
      case 422 -> " Invalid resource specification. Check the resource configuration.";
      case 429 -> " Rate limited by K8s API. Consider reducing request frequency.";
      default -> "";
    };
  }

  @Override
  public PipelineServiceClientResponse runPipeline(
      IngestionPipeline ingestionPipeline, ServiceEntityInterface service) {
    return runPipeline(ingestionPipeline, service, null);
  }

  @Override
  public PipelineServiceClientResponse runPipeline(
      IngestionPipeline ingestionPipeline,
      ServiceEntityInterface service,
      Map<String, Object> config) {
    String pipelineName = sanitizeName(ingestionPipeline.getName());
    String runId = UUID.randomUUID().toString();
    String correlationId = runId.substring(0, 8);
    String jobName = JOB_PREFIX + pipelineName + "-" + correlationId;

    MDC.put(MDC_CORRELATION_ID, correlationId);
    MDC.put(MDC_PIPELINE_NAME, pipelineName);
    MDC.put(MDC_OPERATION, "run");

    try {
      LOG.info("Running pipeline [correlationId={}]", correlationId);

      V1Job job = buildJob(ingestionPipeline, runId, config, service);
      executeWithRetry(() -> batchApi.createNamespacedJob(k8sConfig.getNamespace(), job).execute());

      LOG.info(
          "Created Job {} for pipeline {} [correlationId={}]",
          jobName,
          pipelineName,
          correlationId);
      return buildSuccessResponse(
          "Pipeline triggered successfully", Map.of("runId", runId, "jobName", jobName));

    } catch (ApiException e) {
      LOG.error(
          "Failed to run pipeline {} [correlationId={}]: HTTP {} - {}",
          pipelineName,
          correlationId,
          e.getCode(),
          parseK8sErrorMessage(e));
      throw IngestionPipelineDeploymentException.byMessage(
          pipelineName, TRIGGER_ERROR, buildDetailedErrorMessage("trigger", pipelineName, e));
    } finally {
      MDC.clear();
    }
  }

  @Override
  public PipelineServiceClientResponse deletePipeline(IngestionPipeline ingestionPipeline) {
    String pipelineName = sanitizeName(ingestionPipeline.getName());
    String correlationId = UUID.randomUUID().toString().substring(0, 8);

    MDC.put(MDC_CORRELATION_ID, correlationId);
    MDC.put(MDC_PIPELINE_NAME, pipelineName);
    MDC.put(MDC_OPERATION, "delete");

    try {
      LOG.info("Deleting pipeline [correlationId={}]", correlationId);

      List<String> errors = new ArrayList<>();

      // Delete in order: Jobs -> CronJob -> Secret -> ConfigMap
      try {
        deleteJobsForPipeline(pipelineName);
      } catch (ApiException e) {
        errors.add("Failed to delete jobs: " + parseK8sErrorMessage(e));
      }

      try {
        deleteCronJobIfExists(CRONJOB_PREFIX + pipelineName);
      } catch (ApiException e) {
        errors.add("Failed to delete cronjob: " + parseK8sErrorMessage(e));
      }

      try {
        deleteSecretIfExists(SECRET_PREFIX + pipelineName);
      } catch (ApiException e) {
        errors.add("Failed to delete secret: " + parseK8sErrorMessage(e));
      }

      try {
        deleteConfigMapIfExists(CONFIG_MAP_PREFIX + pipelineName);
      } catch (ApiException e) {
        errors.add("Failed to delete configmap: " + parseK8sErrorMessage(e));
      }

      if (!errors.isEmpty()) {
        LOG.warn("Errors during pipeline deletion [correlationId={}]: {}", correlationId, errors);
        return buildResponse(500, "Pipeline deleted with errors: " + String.join("; ", errors));
      }

      LOG.info("Pipeline deleted successfully [correlationId={}]", correlationId);
      return buildSuccessResponse("Pipeline deleted successfully");

    } finally {
      MDC.clear();
    }
  }

  @Override
  public PipelineServiceClientResponse toggleIngestion(IngestionPipeline ingestionPipeline) {
    String pipelineName = sanitizeName(ingestionPipeline.getName());
    String cronJobName = CRONJOB_PREFIX + pipelineName;
    String correlationId = UUID.randomUUID().toString().substring(0, 8);

    MDC.put(MDC_CORRELATION_ID, correlationId);
    MDC.put(MDC_PIPELINE_NAME, pipelineName);
    MDC.put(MDC_OPERATION, "toggle");

    try {
      LOG.info("Toggling pipeline [correlationId={}]", correlationId);

      V1CronJob cronJob =
          executeWithRetry(
              () ->
                  batchApi.readNamespacedCronJob(cronJobName, k8sConfig.getNamespace()).execute());

      boolean currentlySuspended = Boolean.TRUE.equals(cronJob.getSpec().getSuspend());
      cronJob.getSpec().setSuspend(!currentlySuspended);

      executeWithRetry(
          () ->
              batchApi
                  .replaceNamespacedCronJob(cronJobName, k8sConfig.getNamespace(), cronJob)
                  .execute());

      String newState = currentlySuspended ? "enabled" : "disabled";
      ingestionPipeline.setEnabled(currentlySuspended);
      LOG.info("Pipeline {} is now {} [correlationId={}]", pipelineName, newState, correlationId);

      return buildSuccessResponse("Pipeline " + newState);

    } catch (ApiException e) {
      if (e.getCode() == 404) {
        LOG.info(
            "Pipeline {} has no CronJob (on-demand only) [correlationId={}]",
            pipelineName,
            correlationId);
        return buildSuccessResponse("Pipeline toggle updated (on-demand pipeline)");
      }
      LOG.error(
          "Failed to toggle pipeline {} [correlationId={}]: HTTP {} - {}",
          pipelineName,
          correlationId,
          e.getCode(),
          parseK8sErrorMessage(e));
      throw new PipelineServiceClientException(
          buildDetailedErrorMessage("toggle", pipelineName, e));
    } finally {
      MDC.clear();
    }
  }

  @Override
  public PipelineServiceClientResponse killIngestion(IngestionPipeline ingestionPipeline) {
    String pipelineName = sanitizeName(ingestionPipeline.getName());
    String correlationId = UUID.randomUUID().toString().substring(0, 8);

    MDC.put(MDC_CORRELATION_ID, correlationId);
    MDC.put(MDC_PIPELINE_NAME, pipelineName);
    MDC.put(MDC_OPERATION, "kill");

    try {
      LOG.info("Killing pipeline [correlationId={}]", correlationId);

      String labelSelector = LABEL_PIPELINE + "=" + pipelineName;
      V1JobList jobs =
          executeWithRetry(
              () ->
                  batchApi
                      .listNamespacedJob(k8sConfig.getNamespace())
                      .labelSelector(labelSelector)
                      .execute());

      int killedCount = 0;
      for (V1Job job : jobs.getItems()) {
        if (isJobActive(job)) {
          String jobName = job.getMetadata().getName();

          // Delete the job - preStop hook handles exit status reporting
          executeWithRetry(
              () ->
                  batchApi
                      .deleteNamespacedJob(jobName, k8sConfig.getNamespace())
                      .propagationPolicy("Foreground")
                      .execute());
          killedCount++;
          LOG.info("Killed job: {} [correlationId={}]", jobName, correlationId);
        }
      }

      LOG.info(
          "Killed {} running job(s) for pipeline {} [correlationId={}]",
          killedCount,
          pipelineName,
          correlationId);
      return buildSuccessResponse(
          String.format("Killed %d running job(s) for pipeline %s", killedCount, pipelineName));

    } catch (ApiException e) {
      LOG.error(
          "Failed to kill pipeline {} [correlationId={}]: HTTP {} - {}",
          pipelineName,
          correlationId,
          e.getCode(),
          parseK8sErrorMessage(e));
      throw new PipelineServiceClientException(buildDetailedErrorMessage("kill", pipelineName, e));
    } finally {
      MDC.clear();
    }
  }

  @Override
  public List<PipelineStatus> getQueuedPipelineStatusInternal(IngestionPipeline ingestionPipeline) {
    // READ-ONLY: Check for queued K8s jobs without storing anything
    String pipelineName = sanitizeName(ingestionPipeline.getName());
    List<PipelineStatus> queuedStatuses = new ArrayList<>();

    try {
      String labelSelector = LABEL_PIPELINE + "=" + pipelineName;
      V1JobList jobs =
          batchApi
              .listNamespacedJob(k8sConfig.getNamespace())
              .labelSelector(labelSelector)
              .execute();

      for (V1Job job : jobs.getItems()) {
        // Only return jobs that are QUEUED (created but not started)
        if (isJobQueued(job)) {
          String runId =
              job.getMetadata().getLabels() != null
                  ? job.getMetadata().getLabels().get(LABEL_RUN_ID)
                  : job.getMetadata().getName();

          Long startTime =
              job.getMetadata().getCreationTimestamp() != null
                  ? job.getMetadata().getCreationTimestamp().toInstant().toEpochMilli()
                  : null;

          // Create READ-ONLY status object (not persisted)
          PipelineStatus queuedStatus =
              new PipelineStatus()
                  .withRunId(runId)
                  .withPipelineState(PipelineStatusType.QUEUED)
                  .withStartDate(startTime)
                  .withTimestamp(startTime);

          queuedStatuses.add(queuedStatus);
        }
      }

    } catch (ApiException e) {
      LOG.error("Failed to check queued pipeline status: {}", e.getResponseBody());
    }

    return queuedStatuses;
  }

  private boolean isJobQueued(V1Job job) {
    if (job.getStatus() == null) {
      return true; // Job created but status not yet set = queued
    }

    Integer active = job.getStatus().getActive();
    Integer succeeded = job.getStatus().getSucceeded();
    Integer failed = job.getStatus().getFailed();

    // Check if job is being deleted (has deletion timestamp)
    if (job.getMetadata() != null && job.getMetadata().getDeletionTimestamp() != null) {
      return false; // Job is being terminated, not queued
    }

    // Queued = no active pods, no completed pods, no failed pods, and not being deleted
    return (active == null || active == 0)
        && (succeeded == null || succeeded == 0)
        && (failed == null || failed == 0);
  }

  @Override
  protected PipelineServiceClientResponse getServiceStatusInternal() {
    String namespace = k8sConfig.getNamespace();
    String serviceAccount = k8sConfig.getServiceAccountName();

    try {
      // Test basic namespace access
      coreApi.listNamespacedPod(namespace).limit(1).execute();
      batchApi.listNamespacedJob(namespace).limit(1).execute();

      // Test ConfigMap permissions (required for pipeline configuration)
      try {
        coreApi.listNamespacedConfigMap(namespace).limit(1).execute();
      } catch (ApiException e) {
        String error =
            String.format(
                "Kubernetes is available but missing ConfigMap permissions in namespace '%s' for service account '%s': %s",
                namespace, serviceAccount, e.getMessage());
        LOG.error(error);
        return buildUnhealthyStatus(error);
      }

      // Test Secret permissions (required for pipeline credentials)
      try {
        coreApi.listNamespacedSecret(namespace).limit(1).execute();
      } catch (ApiException e) {
        String error =
            String.format(
                "Kubernetes is available but missing Secret permissions in namespace '%s' for service account '%s': %s",
                namespace, serviceAccount, e.getMessage());
        LOG.error(error);
        return buildUnhealthyStatus(error);
      }

      String message =
          String.format(
              "Kubernetes pipeline client is available in namespace '%s' with service account '%s'",
              namespace, serviceAccount);

      return buildHealthyStatus(getKubernetesVersion()).withPlatform(message);

    } catch (ApiException e) {
      String error =
          String.format(
              "Failed to connect to Kubernetes API (namespace: %s, service account: %s): Message: %s\nHTTP response code: %d\nHTTP response body: %s",
              namespace, serviceAccount, e.getMessage(), e.getCode(), e.getResponseBody());
      LOG.error(error);
      return buildUnhealthyStatus(error);
    }
  }

  @Override
  public PipelineServiceClientResponse runAutomationsWorkflow(Workflow workflow) {
    String workflowName = sanitizeName(workflow.getName());
    String runId = UUID.randomUUID().toString();
    String jobName = "om-automation-" + workflowName + "-" + runId.substring(0, 8);

    LOG.info("Running automation workflow: {} with runId: {}", workflowName, runId);

    try {
      V1Job job = buildAutomationJob(workflow, runId, jobName);
      batchApi.createNamespacedJob(k8sConfig.getNamespace(), job).execute();

      return buildSuccessResponse(
          "Automation workflow triggered", Map.of("runId", runId, "jobName", jobName));

    } catch (ApiException e) {
      LOG.error("Failed to run automation workflow: {}", e.getResponseBody());
      throw IngestionPipelineDeploymentException.byMessage(
          workflowName, TRIGGER_ERROR, e.getResponseBody());
    }
  }

  @Override
  public PipelineServiceClientResponse runApplicationFlow(App application) {
    String appName = sanitizeName(application.getName());
    String runId = UUID.randomUUID().toString();
    String jobName = "om-app-" + appName + "-" + runId.substring(0, 8);

    LOG.info("Running application: {} with runId: {}", appName, runId);

    try {
      V1Job job = buildApplicationJob(application, runId, jobName);
      batchApi.createNamespacedJob(k8sConfig.getNamespace(), job).execute();

      return buildSuccessResponse(
          "Application triggered", Map.of("runId", runId, "jobName", jobName));

    } catch (ApiException e) {
      LOG.error("Failed to run application: {}", e.getResponseBody());
      throw IngestionPipelineDeploymentException.byMessage(
          appName, TRIGGER_ERROR, e.getResponseBody());
    }
  }

  @Override
  public PipelineServiceClientResponse validateAppRegistration(
      AppMarketPlaceDefinition appMarketPlaceDefinition) {
    // For K8s, we don't need external app validation
    return buildSuccessResponse("Application validated");
  }

  @Override
  public Map<String, String> getLastIngestionLogs(
      IngestionPipeline ingestionPipeline, String after) {
    String pipelineName = sanitizeName(ingestionPipeline.getName());

    try {
      String labelSelector = LABEL_PIPELINE + "=" + pipelineName;
      V1JobList jobs =
          batchApi
              .listNamespacedJob(k8sConfig.getNamespace())
              .labelSelector(labelSelector)
              .execute();

      if (jobs.getItems().isEmpty()) {
        return Map.of("logs", "No jobs found for this pipeline");
      }

      V1Job latestJob =
          jobs.getItems().stream()
              .sorted(
                  (a, b) -> {
                    OffsetDateTime timeA = a.getMetadata().getCreationTimestamp();
                    OffsetDateTime timeB = b.getMetadata().getCreationTimestamp();
                    return timeB.compareTo(timeA);
                  })
              .findFirst()
              .orElse(null);

      if (latestJob == null) {
        return Map.of("logs", "No jobs found for this pipeline");
      }

      String jobName = latestJob.getMetadata().getName();
      String podLabelSelector = "job-name=" + jobName;
      V1PodList pods =
          coreApi
              .listNamespacedPod(k8sConfig.getNamespace())
              .labelSelector(podLabelSelector)
              .execute();

      if (pods.getItems().isEmpty()) {
        return Map.of("logs", "No pods found for job: " + jobName);
      }

      V1Pod pod = pods.getItems().get(0);
      String podName = pod.getMetadata().getName();

      // Get full logs without line limit for proper pagination
      String logs =
          coreApi
              .readNamespacedPodLog(podName, k8sConfig.getNamespace())
              .container("ingestion")
              .execute();

      if (logs == null || logs.isEmpty()) {
        return Map.of("logs", "No logs available for pod: " + podName);
      }

      // Get task key from pipeline type for structured response
      String taskKey = TYPE_TO_TASK.get(ingestionPipeline.getPipelineType().value());
      if (taskKey == null) {
        taskKey = "ingestion_task"; // fallback
      }

      // Use IngestionLogHandler for pagination
      return IngestionLogHandler.buildLogResponse(logs, after, taskKey);

    } catch (ApiException e) {
      LOG.error("Failed to get logs for pipeline {}: {}", pipelineName, e.getResponseBody());
      return Map.of("logs", "Failed to retrieve logs: " + e.getMessage());
    }
  }

  @Override
  protected Map<String, String> requestGetHostIp() {
    try {
      String podName = System.getenv("HOSTNAME");
      if (StringUtils.isNotBlank(podName)) {
        return Map.of("ip", "Pod: " + podName + " in namespace: " + k8sConfig.getNamespace());
      }
      return Map.of("ip", "Kubernetes cluster - namespace: " + k8sConfig.getNamespace());
    } catch (Exception e) {
      return Map.of("ip", "Kubernetes cluster");
    }
  }

  private V1ConfigMap buildConfigMap(IngestionPipeline pipeline, ServiceEntityInterface service) {
    String name = CONFIG_MAP_PREFIX + sanitizeName(pipeline.getName());
    String workflowConfig = buildWorkflowConfig(pipeline, service);

    return new V1ConfigMap()
        .metadata(
            new V1ObjectMeta()
                .name(name)
                .namespace(k8sConfig.getNamespace())
                .labels(buildLabels(pipeline, null)))
        .data(Map.of("config", workflowConfig));
  }

  private V1Secret buildSecret(IngestionPipeline pipeline) {
    String name = SECRET_PREFIX + sanitizeName(pipeline.getName());

    Map<String, byte[]> secretData = new HashMap<>();

    if (pipeline.getOpenMetadataServerConnection() != null
        && pipeline.getOpenMetadataServerConnection().getSecurityConfig() != null) {
      Object securityConfig = pipeline.getOpenMetadataServerConnection().getSecurityConfig();
      String configJson = JsonUtils.pojoToJson(securityConfig);
      secretData.put("securityConfig", configJson.getBytes(StandardCharsets.UTF_8));
    }

    return new V1Secret()
        .metadata(
            new V1ObjectMeta()
                .name(name)
                .namespace(k8sConfig.getNamespace())
                .labels(buildLabels(pipeline, null)))
        .data(secretData);
  }

  private V1CronJob buildCronJob(IngestionPipeline pipeline) {
    String name = CRONJOB_PREFIX + sanitizeName(pipeline.getName());
    String schedule = convertToCronSchedule(pipeline.getAirflowConfig().getScheduleInterval());

    return new V1CronJob()
        .metadata(
            new V1ObjectMeta()
                .name(name)
                .namespace(k8sConfig.getNamespace())
                .labels(buildLabels(pipeline, null)))
        .spec(
            new V1CronJobSpec()
                .schedule(schedule)
                .timeZone(pipeline.getAirflowConfig().getPipelineTimezone())
                .concurrencyPolicy("Forbid")
                .startingDeadlineSeconds((long) k8sConfig.getStartingDeadlineSeconds())
                .successfulJobsHistoryLimit(k8sConfig.getSuccessfulJobsHistoryLimit())
                .failedJobsHistoryLimit(k8sConfig.getFailedJobsHistoryLimit())
                .suspend(!Boolean.TRUE.equals(pipeline.getEnabled()))
                .jobTemplate(
                    new V1JobTemplateSpec()
                        .metadata(new V1ObjectMeta().labels(buildLabels(pipeline, null)))
                        .spec(buildJobSpecForCronJob(pipeline))));
  }

  private V1JobSpec buildJobSpecForCronJob(IngestionPipeline pipeline) {
    String pipelineName = sanitizeName(pipeline.getName());
    String configMapName = CONFIG_MAP_PREFIX + pipelineName;

    return new V1JobSpec()
        .backoffLimit(k8sConfig.getBackoffLimit())
        .activeDeadlineSeconds(k8sConfig.getActiveDeadlineSeconds())
        .ttlSecondsAfterFinished(k8sConfig.getTtlSecondsAfterFinished())
        .template(
            new V1PodTemplateSpec()
                .metadata(
                    new V1ObjectMeta()
                        .labels(buildLabels(pipeline, "scheduled"))
                        .annotations(
                            k8sConfig.getPodAnnotations().isEmpty()
                                ? null
                                : k8sConfig.getPodAnnotations()))
                .spec(
                    new V1PodSpec()
                        .serviceAccountName(k8sConfig.getServiceAccountName())
                        .restartPolicy("Never")
                        .terminationGracePeriodSeconds(60L) // Give exit handler more time
                        .imagePullSecrets(
                            k8sConfig.getImagePullSecrets().isEmpty()
                                ? null
                                : k8sConfig.getImagePullSecrets())
                        .nodeSelector(
                            k8sConfig.getNodeSelector().isEmpty()
                                ? null
                                : k8sConfig.getNodeSelector())
                        .securityContext(buildPodSecurityContext())
                        .containers(
                            List.of(
                                new V1Container()
                                    .name("ingestion")
                                    .image(k8sConfig.getIngestionImage())
                                    .imagePullPolicy(k8sConfig.getImagePullPolicy())
                                    .command(List.of("python", "main.py"))
                                    .env(buildEnvVarsForCronJob(pipeline, configMapName))
                                    .securityContext(buildContainerSecurityContext())
                                    .resources(
                                        new V1ResourceRequirements()
                                            .requests(k8sConfig.getResourceRequests())
                                            .limits(k8sConfig.getResourceLimits()))))));
  }

  private List<V1EnvVar> buildEnvVarsForCronJob(IngestionPipeline pipeline, String configMapName) {
    List<V1EnvVar> envVars = new ArrayList<>();

    envVars.add(new V1EnvVar().name("pipelineType").value(pipeline.getPipelineType().toString()));
    envVars.add(new V1EnvVar().name("pipelineRunId").value("scheduled"));
    envVars.add(
        new V1EnvVar().name("ingestionPipelineFQN").value(pipeline.getFullyQualifiedName()));
    envVars.add(
        new V1EnvVar()
            .name("config")
            .valueFrom(
                new V1EnvVarSource()
                    .configMapKeyRef(
                        new io.kubernetes.client.openapi.models.V1ConfigMapKeySelector()
                            .name(configMapName)
                            .key("config"))));
    envVars.add(new V1EnvVar().name("OPENMETADATA_SERVER_URL").value(metadataApiEndpoint));

    // Add extra environment variables from configuration
    if (k8sConfig.getExtraEnvVars() != null && !k8sConfig.getExtraEnvVars().isEmpty()) {
      k8sConfig
          .getExtraEnvVars()
          .forEach((key, value) -> envVars.add(new V1EnvVar().name(key).value(value)));
    }

    return envVars;
  }

  private V1Job buildJob(
      IngestionPipeline pipeline,
      String runId,
      Map<String, Object> configOverride,
      ServiceEntityInterface service) {
    String pipelineName = sanitizeName(pipeline.getName());
    String jobName = JOB_PREFIX + pipelineName + "-" + runId.substring(0, 8);

    return new V1Job()
        .metadata(
            new V1ObjectMeta()
                .name(jobName)
                .namespace(k8sConfig.getNamespace())
                .labels(buildLabels(pipeline, runId)))
        .spec(buildJobSpec(pipeline, runId, configOverride, service));
  }

  private V1JobSpec buildJobSpec(
      IngestionPipeline pipeline,
      String runId,
      Map<String, Object> configOverride,
      ServiceEntityInterface service) {

    return new V1JobSpec()
        .backoffLimit(k8sConfig.getBackoffLimit())
        .activeDeadlineSeconds(k8sConfig.getActiveDeadlineSeconds())
        .ttlSecondsAfterFinished(k8sConfig.getTtlSecondsAfterFinished())
        .template(
            new V1PodTemplateSpec()
                .metadata(
                    new V1ObjectMeta()
                        .labels(buildLabels(pipeline, runId))
                        .annotations(
                            k8sConfig.getPodAnnotations().isEmpty()
                                ? null
                                : k8sConfig.getPodAnnotations()))
                .spec(
                    new V1PodSpec()
                        .serviceAccountName(k8sConfig.getServiceAccountName())
                        .restartPolicy("Never")
                        .terminationGracePeriodSeconds(60L) // Give exit handler more time
                        .imagePullSecrets(
                            k8sConfig.getImagePullSecrets().isEmpty()
                                ? null
                                : k8sConfig.getImagePullSecrets())
                        .nodeSelector(
                            k8sConfig.getNodeSelector().isEmpty()
                                ? null
                                : k8sConfig.getNodeSelector())
                        .securityContext(buildPodSecurityContext())
                        .containers(
                            List.of(
                                new V1Container()
                                    .name("ingestion")
                                    .image(k8sConfig.getIngestionImage())
                                    .imagePullPolicy(k8sConfig.getImagePullPolicy())
                                    .command(List.of("python", "main.py"))
                                    .env(buildEnvVars(pipeline, runId, configOverride, service))
                                    .lifecycle(buildContainerLifecycle())
                                    .securityContext(buildContainerSecurityContext())
                                    .resources(
                                        new V1ResourceRequirements()
                                            .requests(k8sConfig.getResourceRequests())
                                            .limits(k8sConfig.getResourceLimits()))))));
  }

  /**
   * Build container lifecycle with preStop hook to run exit handler.
   * Ensures proper status reporting when containers terminate for any reason.
   */
  private V1Lifecycle buildContainerLifecycle() {
    return new V1Lifecycle()
        .preStop(
            new V1LifecycleHandler()
                .exec(new V1ExecAction().command(List.of("python", "exit_handler.py"))));
  }

  private V1PodSecurityContext buildPodSecurityContext() {
    V1PodSecurityContext context = new V1PodSecurityContext();
    if (k8sConfig.isRunAsNonRoot()) {
      context.setRunAsNonRoot(true);
    }
    if (k8sConfig.getRunAsUser() != null) {
      context.setRunAsUser(k8sConfig.getRunAsUser());
    }
    if (k8sConfig.getRunAsGroup() != null) {
      context.setRunAsGroup(k8sConfig.getRunAsGroup());
    }
    if (k8sConfig.getFsGroup() != null) {
      context.setFsGroup(k8sConfig.getFsGroup());
    }
    return context;
  }

  private V1SecurityContext buildContainerSecurityContext() {
    return new V1SecurityContext()
        .runAsNonRoot(k8sConfig.isRunAsNonRoot())
        .runAsUser(k8sConfig.getRunAsUser())
        .allowPrivilegeEscalation(false)
        .readOnlyRootFilesystem(false) // Ingestion may need to write temp files
        .capabilities(new V1Capabilities().drop(List.of("ALL")));
  }

  private List<V1EnvVar> buildEnvVars(
      IngestionPipeline pipeline,
      String runId,
      Map<String, Object> configOverride,
      ServiceEntityInterface service) {
    String pipelineName = sanitizeName(pipeline.getName());

    List<V1EnvVar> envVars = new ArrayList<>();

    envVars.add(new V1EnvVar().name("pipelineType").value(pipeline.getPipelineType().toString()));
    envVars.add(new V1EnvVar().name("pipelineRunId").value(runId));
    envVars.add(
        new V1EnvVar().name("ingestionPipelineFQN").value(pipeline.getFullyQualifiedName()));

    // Build the complete workflow config including any overrides
    String workflowConfig = buildWorkflowConfigWithOverrides(pipeline, service, configOverride);
    envVars.add(new V1EnvVar().name("config").value(workflowConfig));

    // Add exit handler environment variables for proper status reporting
    envVars.add(new V1EnvVar().name("jobName").value("om-job-" + pipelineName + "-" + runId));
    envVars.add(new V1EnvVar().name("namespace").value(k8sConfig.getNamespace()));

    // P2: Add extra environment variables from configuration
    if (k8sConfig.getExtraEnvVars() != null && !k8sConfig.getExtraEnvVars().isEmpty()) {
      k8sConfig
          .getExtraEnvVars()
          .forEach((key, value) -> envVars.add(new V1EnvVar().name(key).value(value)));
    }

    return envVars;
  }

  private String buildWorkflowConfigWithOverrides(
      IngestionPipeline pipeline,
      ServiceEntityInterface service,
      Map<String, Object> configOverride) {
    try {
      // Ensure the pipeline has proper OpenMetadataServerConnection configured
      ensureServerConnectionConfigured(pipeline);
      // Use WorkflowConfigBuilder with the configOverride parameter
      return WorkflowConfigBuilder.buildIngestionStringYaml(pipeline, service, configOverride);
    } catch (Exception e) {
      LOG.error("Failed to build workflow config with overrides: {}", e.getMessage(), e);
      throw new RuntimeException("Workflow configuration building failed", e);
    }
  }

  private V1Job buildAutomationJob(Workflow workflow, String runId, String jobName) {
    return new V1Job()
        .metadata(
            new V1ObjectMeta()
                .name(jobName)
                .namespace(k8sConfig.getNamespace())
                .labels(
                    Map.of(
                        LABEL_APP, "openmetadata",
                        LABEL_COMPONENT, "automation",
                        LABEL_MANAGED_BY, "openmetadata",
                        LABEL_RUN_ID, runId)))
        .spec(
            new V1JobSpec()
                .backoffLimit(k8sConfig.getBackoffLimit())
                .activeDeadlineSeconds(k8sConfig.getActiveDeadlineSeconds())
                .ttlSecondsAfterFinished(k8sConfig.getTtlSecondsAfterFinished())
                .template(
                    new V1PodTemplateSpec()
                        .spec(
                            new V1PodSpec()
                                .serviceAccountName(k8sConfig.getServiceAccountName())
                                .restartPolicy("Never")
                                .imagePullSecrets(
                                    k8sConfig.getImagePullSecrets().isEmpty()
                                        ? null
                                        : k8sConfig.getImagePullSecrets())
                                .containers(
                                    List.of(
                                        new V1Container()
                                            .name("automation")
                                            .image(k8sConfig.getIngestionImage())
                                            .imagePullPolicy(k8sConfig.getImagePullPolicy())
                                            .command(List.of("python", "run_automation.py"))
                                            .env(
                                                List.of(
                                                    new V1EnvVar()
                                                        .name("config")
                                                        .value(JsonUtils.pojoToJson(workflow)),
                                                    new V1EnvVar()
                                                        .name("OPENMETADATA_SERVER_URL")
                                                        .value(metadataApiEndpoint)))
                                            .resources(
                                                new V1ResourceRequirements()
                                                    .requests(k8sConfig.getResourceRequests())
                                                    .limits(k8sConfig.getResourceLimits())))))));
  }

  private V1Job buildApplicationJob(App application, String runId, String jobName) {
    return new V1Job()
        .metadata(
            new V1ObjectMeta()
                .name(jobName)
                .namespace(k8sConfig.getNamespace())
                .labels(
                    Map.of(
                        LABEL_APP,
                        "openmetadata",
                        LABEL_COMPONENT,
                        "application",
                        LABEL_MANAGED_BY,
                        "openmetadata",
                        "app.kubernetes.io/app-name",
                        sanitizeName(application.getName()),
                        LABEL_RUN_ID,
                        runId)))
        .spec(
            new V1JobSpec()
                .backoffLimit(k8sConfig.getBackoffLimit())
                .activeDeadlineSeconds(k8sConfig.getActiveDeadlineSeconds())
                .ttlSecondsAfterFinished(k8sConfig.getTtlSecondsAfterFinished())
                .template(
                    new V1PodTemplateSpec()
                        .spec(
                            new V1PodSpec()
                                .serviceAccountName(k8sConfig.getServiceAccountName())
                                .restartPolicy("Never")
                                .imagePullSecrets(
                                    k8sConfig.getImagePullSecrets().isEmpty()
                                        ? null
                                        : k8sConfig.getImagePullSecrets())
                                .containers(
                                    List.of(
                                        new V1Container()
                                            .name("application")
                                            .image(k8sConfig.getIngestionImage())
                                            .imagePullPolicy(k8sConfig.getImagePullPolicy())
                                            .command(
                                                List.of(
                                                    "python", "-m", "metadata.applications.runner"))
                                            .env(
                                                List.of(
                                                    new V1EnvVar()
                                                        .name("config")
                                                        .value(JsonUtils.pojoToJson(application)),
                                                    new V1EnvVar()
                                                        .name("OPENMETADATA_SERVER_URL")
                                                        .value(metadataApiEndpoint)))
                                            .resources(
                                                new V1ResourceRequirements()
                                                    .requests(k8sConfig.getResourceRequests())
                                                    .limits(k8sConfig.getResourceLimits())))))));
  }

  private String buildWorkflowConfig(IngestionPipeline pipeline, ServiceEntityInterface service) {
    try {
      // Ensure the pipeline has proper OpenMetadataServerConnection configured
      ensureServerConnectionConfigured(pipeline);
      return WorkflowConfigBuilder.buildIngestionStringYaml(pipeline, service, null);
    } catch (Exception e) {
      LOG.error(
          "Failed to build workflow config using WorkflowConfigBuilder: {}", e.getMessage(), e);
      throw new IngestionPipelineDeploymentException(
          "Workflow configuration building failed: " + e.getMessage());
    }
  }

  /**
   * Ensures that the IngestionPipeline has a properly configured OpenMetadataServerConnection
   * with security configuration. This is critical for the Python ingestion to authenticate.
   *
   * If the pipeline doesn't have a server connection configured, this method will create one
   * based on the client configuration. This ensures backward compatibility and proper
   * authentication even when the service layer doesn't set the connection.
   */
  private void ensureServerConnectionConfigured(IngestionPipeline pipeline) {
    if (pipeline.getOpenMetadataServerConnection() == null) {
      LOG.warn(
          "Pipeline {} missing OpenMetadataServerConnection - creating default configuration from client config",
          pipeline.getName());

      // For unit tests, we don't require actual JWT token retrieval
      // Skip server connection configuration if skipInit is true
      if (k8sConfig.isSkipInit()) {
        LOG.debug("Skipping server connection configuration for unit tests");
        return;
      }

      // Create a default server connection based on client configuration
      // This ensures the pipeline can authenticate with the OpenMetadata server
      org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection
          serverConnection = createDefaultServerConnection();

      pipeline.setOpenMetadataServerConnection(serverConnection);
      LOG.info(
          "Set default OpenMetadataServerConnection for pipeline {} with endpoint {}",
          pipeline.getName(),
          serverConnection.getHostPort());
      return;
    }

    if (pipeline.getOpenMetadataServerConnection().getSecurityConfig() == null) {
      LOG.error(
          "Pipeline {} has OpenMetadataServerConnection but missing securityConfig. "
              + "The JWT token and authentication config are required for ingestion to work.",
          pipeline.getName());
      throw new IllegalStateException(
          "Pipeline OpenMetadataServerConnection.securityConfig is required but not set. "
              + "This indicates the JWT token or authentication configuration is missing.");
    }

    LOG.debug(
        "Pipeline {} has proper OpenMetadataServerConnection with security config",
        pipeline.getName());
  }

  /**
   * Creates a default OpenMetadataConnection based on the client configuration.
   * This is used when the pipeline doesn't have a server connection configured.
   * This includes retrieving the ingestion bot token for authentication.
   *
   * @return A properly configured OpenMetadataConnection with ingestion bot authentication
   */
  private org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection
      createDefaultServerConnection() {
    String jwtToken = getIngestionBotToken();
    if (jwtToken == null) {
      throw new IllegalStateException(
          "Failed to retrieve ingestion-bot JWT token. "
              + "The ingestion-bot user must exist and have a valid JWT authentication mechanism.");
    }

    LOG.info("Retrieved ingestion-bot JWT token for pipeline authentication");

    return new org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection()
        .withHostPort(metadataApiEndpoint)
        .withAuthProvider(
            org.openmetadata.schema.services.connections.metadata.AuthProvider.OPENMETADATA)
        .withSecurityConfig(
            new org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig()
                .withJwtToken(jwtToken))
        .withVerifySSL(org.openmetadata.schema.security.ssl.VerifySSL.NO_SSL)
        .withSecretsManagerLoader(
            org.openmetadata.schema.security.secrets.SecretsManagerClientLoader.NOOP)
        .withSecretsManagerProvider(
            org.openmetadata.schema.security.secrets.SecretsManagerProvider.DB);
  }

  /**
   * Retrieves the JWT token for the ingestion-bot user.
   * This follows the same pattern as OpenMetadataOperations.getIngestionBotToken().
   *
   * @return The JWT token string, or null if not available
   */
  private String getIngestionBotToken() {
    try {
      // Use the same pattern as OpenMetadataOperations
      org.openmetadata.service.jdbi3.BotRepository botRepository =
          (org.openmetadata.service.jdbi3.BotRepository)
              org.openmetadata.service.Entity.getEntityRepository(
                  org.openmetadata.service.Entity.BOT);
      org.openmetadata.service.jdbi3.UserRepository userRepository =
          (org.openmetadata.service.jdbi3.UserRepository)
              org.openmetadata.service.Entity.getEntityRepository(
                  org.openmetadata.service.Entity.USER);

      // First get the bot entity
      org.openmetadata.schema.entity.Bot bot =
          botRepository.getByName(
              null,
              org.openmetadata.service.Entity.INGESTION_BOT_NAME,
              new org.openmetadata.service.util.EntityUtil.Fields(java.util.Set.of()));
      if (bot == null || bot.getBotUser() == null) {
        LOG.error("Ingestion bot not found or bot has no associated user");
        return null;
      }

      // Get the bot user with authentication mechanism
      org.openmetadata.schema.entity.teams.User botUser =
          userRepository.getByName(
              null,
              bot.getBotUser().getFullyQualifiedName(),
              new org.openmetadata.service.util.EntityUtil.Fields(
                  java.util.Set.of("authenticationMechanism")));

      if (botUser == null || botUser.getAuthenticationMechanism() == null) {
        LOG.error("Bot user not found or has no authentication mechanism");
        return null;
      }

      // Extract JWT token from authentication mechanism
      org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism =
          botUser.getAuthenticationMechanism();
      if (authMechanism.getAuthType()
          != org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT) {
        LOG.error("Bot user authentication mechanism is not JWT: {}", authMechanism.getAuthType());
        return null;
      }

      org.openmetadata.schema.auth.JWTAuthMechanism jwtAuth =
          (org.openmetadata.schema.auth.JWTAuthMechanism) authMechanism.getConfig();
      return jwtAuth.getJWTToken();

    } catch (Exception e) {
      LOG.error("Failed to retrieve ingestion-bot token", e);
      return null;
    }
  }

  private Map<String, String> buildLabels(IngestionPipeline pipeline, String runId) {
    Map<String, String> labels = new HashMap<>();
    labels.put(LABEL_APP, "openmetadata");
    labels.put(LABEL_COMPONENT, "ingestion");
    labels.put(LABEL_MANAGED_BY, "openmetadata");
    labels.put(LABEL_PIPELINE, sanitizeName(pipeline.getName()));
    labels.put(LABEL_PIPELINE_TYPE, pipeline.getPipelineType().toString().toLowerCase());

    if (runId != null && !"scheduled".equals(runId)) {
      labels.put(LABEL_RUN_ID, runId);
    }

    return labels;
  }

  /**
   * Create or update a ConfigMap with optimistic locking.
   *
   * @return true if a new resource was created, false if updated
   */
  private boolean createOrUpdateConfigMap(V1ConfigMap configMap) throws ApiException {
    String name = configMap.getMetadata().getName();
    try {
      V1ConfigMap existing =
          coreApi.readNamespacedConfigMap(name, k8sConfig.getNamespace()).execute();
      // Use resourceVersion for optimistic locking
      configMap.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
      coreApi.replaceNamespacedConfigMap(name, k8sConfig.getNamespace(), configMap).execute();
      LOG.debug("Updated ConfigMap: {}", name);
      return false;
    } catch (ApiException e) {
      if (e.getCode() == 404) {
        coreApi.createNamespacedConfigMap(k8sConfig.getNamespace(), configMap).execute();
        LOG.debug("Created ConfigMap: {}", name);
        return true;
      } else {
        throw e;
      }
    }
  }

  /**
   * Create or update a Secret with optimistic locking.
   *
   * @return true if a new resource was created, false if updated
   */
  private boolean createOrUpdateSecret(V1Secret secret) throws ApiException {
    String name = secret.getMetadata().getName();
    try {
      V1Secret existing = coreApi.readNamespacedSecret(name, k8sConfig.getNamespace()).execute();
      // Use resourceVersion for optimistic locking
      secret.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
      coreApi.replaceNamespacedSecret(name, k8sConfig.getNamespace(), secret).execute();
      LOG.debug("Updated Secret: {}", name);
      return false;
    } catch (ApiException e) {
      if (e.getCode() == 404) {
        coreApi.createNamespacedSecret(k8sConfig.getNamespace(), secret).execute();
        LOG.debug("Created Secret: {}", name);
        return true;
      } else {
        throw e;
      }
    }
  }

  /**
   * Create or update a CronJob with optimistic locking.
   *
   * @return true if a new resource was created, false if updated
   */
  private boolean createOrUpdateCronJob(V1CronJob cronJob) throws ApiException {
    String name = cronJob.getMetadata().getName();
    try {
      V1CronJob existing = batchApi.readNamespacedCronJob(name, k8sConfig.getNamespace()).execute();
      // Use resourceVersion for optimistic locking
      cronJob.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
      batchApi.replaceNamespacedCronJob(name, k8sConfig.getNamespace(), cronJob).execute();
      LOG.debug("Updated CronJob: {}", name);
      return false;
    } catch (ApiException e) {
      if (e.getCode() == 404) {
        batchApi.createNamespacedCronJob(k8sConfig.getNamespace(), cronJob).execute();
        LOG.debug("Created CronJob: {}", name);
        return true;
      } else {
        throw e;
      }
    }
  }

  private void deleteJobsForPipeline(String pipelineName) throws ApiException {
    String labelSelector = LABEL_PIPELINE + "=" + pipelineName;
    V1JobList jobs =
        batchApi.listNamespacedJob(k8sConfig.getNamespace()).labelSelector(labelSelector).execute();

    for (V1Job job : jobs.getItems()) {
      String jobName = job.getMetadata().getName();
      batchApi
          .deleteNamespacedJob(jobName, k8sConfig.getNamespace())
          .propagationPolicy("Background")
          .execute();
      LOG.debug("Deleted Job: {}", jobName);
    }
  }

  private void deleteCronJobIfExists(String name) throws ApiException {
    try {
      batchApi.deleteNamespacedCronJob(name, k8sConfig.getNamespace()).execute();
      LOG.debug("Deleted CronJob: {}", name);
    } catch (ApiException e) {
      if (e.getCode() != 404) {
        throw e;
      }
    }
  }

  private void deleteSecretIfExists(String name) throws ApiException {
    try {
      coreApi.deleteNamespacedSecret(name, k8sConfig.getNamespace()).execute();
      LOG.debug("Deleted Secret: {}", name);
    } catch (ApiException e) {
      if (e.getCode() != 404) {
        throw e;
      }
    }
  }

  private void deleteConfigMapIfExists(String name) throws ApiException {
    try {
      coreApi.deleteNamespacedConfigMap(name, k8sConfig.getNamespace()).execute();
      LOG.debug("Deleted ConfigMap: {}", name);
    } catch (ApiException e) {
      if (e.getCode() != 404) {
        throw e;
      }
    }
  }

  private boolean isJobActive(V1Job job) {
    return job.getStatus() != null
        && job.getStatus().getActive() != null
        && job.getStatus().getActive() > 0;
  }

  private boolean hasSchedule(IngestionPipeline pipeline) {
    return pipeline.getAirflowConfig() != null
        && StringUtils.isNotBlank(pipeline.getAirflowConfig().getScheduleInterval());
  }

  private String convertToCronSchedule(String airflowSchedule) {
    if (airflowSchedule == null) {
      return "0 0 * * *";
    }

    return switch (airflowSchedule.toLowerCase()) {
      case "@hourly" -> "0 * * * *";
      case "@daily", "@midnight" -> "0 0 * * *";
      case "@weekly" -> "0 0 * * 0";
      case "@monthly" -> "0 0 1 * *";
      case "@yearly", "@annually" -> "0 0 1 1 *";
      default -> airflowSchedule;
    };
  }

  private String sanitizeName(String name) {
    // K8s names must be lowercase, alphanumeric, or '-'
    // Must start with alphanumeric, max 63 chars
    String sanitized =
        name.toLowerCase()
            .replaceAll("[^a-z0-9-]", "-")
            .replaceAll("-+", "-")
            .replaceAll("^-+|-+$", "");

    if (sanitized.length() > 53) { // Leave room for prefixes
      sanitized = sanitized.substring(0, 53);
    }

    if (!sanitized.matches("^[a-z0-9].*")) {
      sanitized = "p-" + sanitized;
    }

    return sanitized;
  }

  private String getKubernetesVersion() {
    try {
      io.kubernetes.client.openapi.apis.VersionApi versionApi =
          new io.kubernetes.client.openapi.apis.VersionApi(coreApi.getApiClient());
      return versionApi.getCode().execute().getGitVersion();
    } catch (Exception e) {
      return "kubernetes";
    }
  }

  private String getStringParam(Map<String, Object> params, String key, String defaultValue) {
    Object value = params.get(key);
    if (value == null) {
      return defaultValue;
    }
    return value.toString();
  }

  private PipelineServiceClientResponse buildSuccessResponse(String message) {
    return buildResponse(200, message);
  }

  private PipelineServiceClientResponse buildSuccessResponse(
      String message, Map<String, String> details) {
    return new PipelineServiceClientResponse()
        .withCode(200)
        .withReason(message + " - " + JsonUtils.pojoToJson(details))
        .withPlatform(PLATFORM);
  }

  private PipelineServiceClientResponse buildResponse(int code, String message) {
    return new PipelineServiceClientResponse()
        .withCode(code)
        .withReason(message)
        .withPlatform(PLATFORM);
  }

  @VisibleForTesting
  void setBatchApi(BatchV1Api batchApi) {
    this.batchApi = batchApi;
  }

  @VisibleForTesting
  void setCoreApi(CoreV1Api coreApi) {
    this.coreApi = coreApi;
  }
}
