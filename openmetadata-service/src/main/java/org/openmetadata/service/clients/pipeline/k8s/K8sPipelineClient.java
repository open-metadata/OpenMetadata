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
import io.kubernetes.client.custom.Quantity;
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
import io.kubernetes.client.openapi.models.V1Job;
import io.kubernetes.client.openapi.models.V1JobList;
import io.kubernetes.client.openapi.models.V1JobSpec;
import io.kubernetes.client.openapi.models.V1JobTemplateSpec;
import io.kubernetes.client.openapi.models.V1LocalObjectReference;
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
import java.util.stream.Collectors;
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

  // Config keys
  private static final String NAMESPACE_KEY = "namespace";
  private static final String IN_CLUSTER_KEY = "inCluster";
  private static final String KUBECONFIG_PATH_KEY = "kubeconfigPath";
  private static final String KUBECONFIG_CONTENT_KEY = "kubeConfigContent";
  private static final String INGESTION_IMAGE_KEY = "ingestionImage";
  private static final String IMAGE_PULL_POLICY_KEY = "imagePullPolicy";
  private static final String IMAGE_PULL_SECRETS_KEY = "imagePullSecrets";
  private static final String SERVICE_ACCOUNT_KEY = "serviceAccountName";
  private static final String REQUESTS_CPU_KEY = "requestsCpu";
  private static final String REQUESTS_MEMORY_KEY = "requestsMemory";
  private static final String LIMITS_CPU_KEY = "limitsCpu";
  private static final String LIMITS_MEMORY_KEY = "limitsMemory";
  private static final String TTL_SECONDS_KEY = "ttlSecondsAfterFinished";
  private static final String ACTIVE_DEADLINE_KEY = "activeDeadlineSeconds";
  private static final String BACKOFF_LIMIT_KEY = "backoffLimit";
  private static final String SUCCESS_HISTORY_KEY = "successfulJobsHistoryLimit";
  private static final String FAILED_HISTORY_KEY = "failedJobsHistoryLimit";
  private static final String NODE_SELECTOR_KEY = "nodeSelector";
  private static final String SKIP_INIT_KEY = "skipInit";
  private static final String RUN_AS_USER_KEY = "runAsUser";
  private static final String RUN_AS_GROUP_KEY = "runAsGroup";
  private static final String FS_GROUP_KEY = "fsGroup";
  private static final String RUN_AS_NON_ROOT_KEY = "runAsNonRoot";
  private static final String EXTRA_ENV_VARS_KEY = "extraEnvVars";
  private static final String POD_ANNOTATIONS_KEY = "podAnnotations";

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
  private final String namespace;
  private final String ingestionImage;
  private final String imagePullPolicy;
  private final List<V1LocalObjectReference> imagePullSecrets;
  private final String serviceAccountName;
  private final Map<String, Quantity> resourceRequests;
  private final Map<String, Quantity> resourceLimits;
  private final int ttlSecondsAfterFinished;
  private final long activeDeadlineSeconds;
  private final int backoffLimit;
  private final int successfulJobsHistoryLimit;
  private final int failedJobsHistoryLimit;
  private final Map<String, String> nodeSelector;
  private final String metadataApiEndpoint;

  // Security context configuration
  private final Long runAsUser;
  private final Long runAsGroup;
  private final Long fsGroup;
  private final boolean runAsNonRoot;

  // P2: Extra configuration
  private final Map<String, String> extraEnvVars;
  private final Map<String, String> podAnnotations;

  public K8sPipelineClient(PipelineServiceClientConfiguration config) {
    super(config);
    this.setPlatform(PLATFORM);

    Map<String, Object> params =
        config.getParameters() != null
            ? config.getParameters().getAdditionalProperties()
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

    this.namespace = getStringParam(params, NAMESPACE_KEY, "openmetadata-pipelines");
    this.ingestionImage =
        getStringParam(
            params, INGESTION_IMAGE_KEY, "docker.getcollate.io/openmetadata/ingestion:latest");
    this.imagePullPolicy = getStringParam(params, IMAGE_PULL_POLICY_KEY, "IfNotPresent");
    this.imagePullSecrets =
        parseImagePullSecrets(getStringParam(params, IMAGE_PULL_SECRETS_KEY, ""));
    this.serviceAccountName = getStringParam(params, SERVICE_ACCOUNT_KEY, "openmetadata-ingestion");
    this.metadataApiEndpoint = config.getMetadataApiEndpoint();

    this.resourceRequests = new HashMap<>();
    this.resourceRequests.put(
        "cpu", new Quantity(getStringParam(params, REQUESTS_CPU_KEY, "500m")));
    this.resourceRequests.put(
        "memory", new Quantity(getStringParam(params, REQUESTS_MEMORY_KEY, "1Gi")));

    this.resourceLimits = new HashMap<>();
    this.resourceLimits.put("cpu", new Quantity(getStringParam(params, LIMITS_CPU_KEY, "2")));
    this.resourceLimits.put(
        "memory", new Quantity(getStringParam(params, LIMITS_MEMORY_KEY, "4Gi")));

    this.ttlSecondsAfterFinished = getIntParam(params, TTL_SECONDS_KEY, 86400);
    this.activeDeadlineSeconds = getIntParam(params, ACTIVE_DEADLINE_KEY, 7200);
    this.backoffLimit = getIntParam(params, BACKOFF_LIMIT_KEY, 3);
    this.successfulJobsHistoryLimit = getIntParam(params, SUCCESS_HISTORY_KEY, 3);
    this.failedJobsHistoryLimit = getIntParam(params, FAILED_HISTORY_KEY, 3);
    this.nodeSelector = parseNodeSelector(getStringParam(params, NODE_SELECTOR_KEY, ""));

    // Security context - default to running as non-root user 1000
    this.runAsUser = getLongParam(params, RUN_AS_USER_KEY, 1000L);
    this.runAsGroup = getLongParam(params, RUN_AS_GROUP_KEY, 1000L);
    this.fsGroup = getLongParam(params, FS_GROUP_KEY, 1000L);
    this.runAsNonRoot = Boolean.parseBoolean(getStringParam(params, RUN_AS_NON_ROOT_KEY, "true"));

    // P2: Extra configuration
    this.extraEnvVars = parseKeyValuePairs(getStringParam(params, EXTRA_ENV_VARS_KEY, ""));
    this.podAnnotations = parseKeyValuePairs(getStringParam(params, POD_ANNOTATIONS_KEY, ""));

    // Validate configuration
    validateConfiguration();

    // Validate namespace exists
    if (!skipInit) {
      validateNamespaceExists();
    }

    LOG.info("K8sPipelineClient initialized - namespace: {}, image: {}", namespace, ingestionImage);
  }

  /** Validates configuration parameters. Fails fast with clear error messages. */
  private void validateConfiguration() {
    List<String> errors = new ArrayList<>();

    // Validate image format
    if (StringUtils.isBlank(ingestionImage)) {
      errors.add("ingestionImage cannot be blank");
    } else if (!ingestionImage.matches("^[a-zA-Z0-9][a-zA-Z0-9._/-]*:[a-zA-Z0-9._-]+$")
        && !ingestionImage.matches("^[a-zA-Z0-9][a-zA-Z0-9._/-]*$")) {
      LOG.warn("ingestionImage '{}' may not be a valid container image reference", ingestionImage);
    }

    // Validate namespace format
    if (StringUtils.isBlank(namespace)) {
      errors.add("namespace cannot be blank");
    } else if (!namespace.matches("^[a-z0-9]([-a-z0-9]*[a-z0-9])?$")) {
      errors.add(
          String.format(
              "namespace '%s' is invalid - must be lowercase alphanumeric with hyphens",
              namespace));
    }

    // Validate resource quantities
    try {
      resourceRequests.values().forEach(Quantity::getNumber);
      resourceLimits.values().forEach(Quantity::getNumber);
    } catch (Exception e) {
      errors.add("Invalid resource quantity format: " + e.getMessage());
    }

    // Validate numeric ranges
    if (ttlSecondsAfterFinished < 0) {
      errors.add("ttlSecondsAfterFinished must be non-negative");
    }
    if (activeDeadlineSeconds <= 0) {
      errors.add("activeDeadlineSeconds must be positive");
    }
    if (backoffLimit < 0) {
      errors.add("backoffLimit must be non-negative");
    }

    if (!errors.isEmpty()) {
      throw new PipelineServiceClientException(
          "Invalid K8sPipelineClient configuration: " + String.join("; ", errors));
    }
  }

  /** Validates that the target namespace exists. Fails fast with a clear error if not. */
  private void validateNamespaceExists() {
    try {
      coreApi.readNamespace(namespace).execute();
      LOG.debug("Validated namespace exists: {}", namespace);
    } catch (ApiException e) {
      if (e.getCode() == 404) {
        throw new PipelineServiceClientException(
            String.format(
                "Namespace '%s' does not exist. Create it with: kubectl create namespace %s",
                namespace, namespace));
      }
      // For other errors, log warning but don't fail - namespace might be accessible but not
      // readable
      LOG.warn(
          "Could not validate namespace '{}' exists (HTTP {}): {}. Proceeding anyway.",
          namespace,
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
        V1ConfigMap configMap = buildConfigMap(ingestionPipeline);
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
          LOG.info("Created CronJob for scheduled pipeline: {}", pipelineName);
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
        "Failed to %s '%s' in namespace '%s': HTTP %d - %s.%s",
        operation, resourceName, namespace, e.getCode(), k8sMessage, hint);
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

      V1Job job = buildJob(ingestionPipeline, runId, config);
      executeWithRetry(() -> batchApi.createNamespacedJob(namespace, job).execute());

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
          executeWithRetry(() -> batchApi.readNamespacedCronJob(cronJobName, namespace).execute());

      boolean currentlySuspended = Boolean.TRUE.equals(cronJob.getSpec().getSuspend());
      cronJob.getSpec().setSuspend(!currentlySuspended);

      executeWithRetry(
          () -> batchApi.replaceNamespacedCronJob(cronJobName, namespace, cronJob).execute());

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
              () -> batchApi.listNamespacedJob(namespace).labelSelector(labelSelector).execute());

      int killedCount = 0;
      for (V1Job job : jobs.getItems()) {
        if (isJobActive(job)) {
          String jobName = job.getMetadata().getName();
          executeWithRetry(
              () ->
                  batchApi
                      .deleteNamespacedJob(jobName, namespace)
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
    String pipelineName = sanitizeName(ingestionPipeline.getName());
    List<PipelineStatus> statuses = new ArrayList<>();

    try {
      String labelSelector = LABEL_PIPELINE + "=" + pipelineName;
      V1JobList jobs = batchApi.listNamespacedJob(namespace).labelSelector(labelSelector).execute();

      for (V1Job job : jobs.getItems()) {
        PipelineStatus status = mapJobToPipelineStatus(job);
        if (status != null) {
          statuses.add(status);
        }
      }

    } catch (ApiException e) {
      LOG.error("Failed to get pipeline status: {}", e.getResponseBody());
    }

    return statuses;
  }

  @Override
  protected PipelineServiceClientResponse getServiceStatusInternal() {
    try {
      coreApi.listNamespacedPod(namespace).limit(1).execute();
      batchApi.listNamespacedJob(namespace).limit(1).execute();
      return buildHealthyStatus(getKubernetesVersion());

    } catch (ApiException e) {
      String error =
          String.format(
              "Failed to connect to Kubernetes API (namespace: %s): %s", namespace, e.getMessage());
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
      batchApi.createNamespacedJob(namespace, job).execute();

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
      batchApi.createNamespacedJob(namespace, job).execute();

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
      V1JobList jobs = batchApi.listNamespacedJob(namespace).labelSelector(labelSelector).execute();

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
          coreApi.listNamespacedPod(namespace).labelSelector(podLabelSelector).execute();

      if (pods.getItems().isEmpty()) {
        return Map.of("logs", "No pods found for job: " + jobName);
      }

      V1Pod pod = pods.getItems().get(0);
      String podName = pod.getMetadata().getName();

      String logs =
          coreApi
              .readNamespacedPodLog(podName, namespace)
              .container("ingestion")
              .tailLines(1000)
              .execute();

      return Map.of(
          "logs", logs != null ? logs : "No logs available",
          "jobName", jobName,
          "podName", podName);

    } catch (ApiException e) {
      LOG.error("Failed to get logs: {}", e.getResponseBody());
      return Map.of("logs", "Failed to retrieve logs: " + e.getMessage());
    }
  }

  @Override
  protected Map<String, String> requestGetHostIp() {
    try {
      String podName = System.getenv("HOSTNAME");
      if (StringUtils.isNotBlank(podName)) {
        return Map.of("ip", "Pod: " + podName + " in namespace: " + namespace);
      }
      return Map.of("ip", "Kubernetes cluster - namespace: " + namespace);
    } catch (Exception e) {
      return Map.of("ip", "Kubernetes cluster");
    }
  }

  private V1ConfigMap buildConfigMap(IngestionPipeline pipeline) {
    String name = CONFIG_MAP_PREFIX + sanitizeName(pipeline.getName());
    String workflowConfig = buildWorkflowConfig(pipeline);

    return new V1ConfigMap()
        .metadata(
            new V1ObjectMeta().name(name).namespace(namespace).labels(buildLabels(pipeline, null)))
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
            new V1ObjectMeta().name(name).namespace(namespace).labels(buildLabels(pipeline, null)))
        .data(secretData);
  }

  private V1CronJob buildCronJob(IngestionPipeline pipeline) {
    String name = CRONJOB_PREFIX + sanitizeName(pipeline.getName());
    String schedule = convertToCronSchedule(pipeline.getAirflowConfig().getScheduleInterval());

    return new V1CronJob()
        .metadata(
            new V1ObjectMeta().name(name).namespace(namespace).labels(buildLabels(pipeline, null)))
        .spec(
            new V1CronJobSpec()
                .schedule(schedule)
                .timeZone(pipeline.getAirflowConfig().getPipelineTimezone())
                .concurrencyPolicy("Forbid")
                .successfulJobsHistoryLimit(successfulJobsHistoryLimit)
                .failedJobsHistoryLimit(failedJobsHistoryLimit)
                .suspend(!Boolean.TRUE.equals(pipeline.getEnabled()))
                .jobTemplate(
                    new V1JobTemplateSpec()
                        .metadata(new V1ObjectMeta().labels(buildLabels(pipeline, null)))
                        .spec(buildJobSpec(pipeline, "scheduled", null))));
  }

  private V1Job buildJob(
      IngestionPipeline pipeline, String runId, Map<String, Object> configOverride) {
    String pipelineName = sanitizeName(pipeline.getName());
    String jobName = JOB_PREFIX + pipelineName + "-" + runId.substring(0, 8);

    return new V1Job()
        .metadata(
            new V1ObjectMeta()
                .name(jobName)
                .namespace(namespace)
                .labels(buildLabels(pipeline, runId)))
        .spec(buildJobSpec(pipeline, runId, configOverride));
  }

  private V1JobSpec buildJobSpec(
      IngestionPipeline pipeline, String runId, Map<String, Object> configOverride) {
    String pipelineName = sanitizeName(pipeline.getName());

    return new V1JobSpec()
        .backoffLimit(backoffLimit)
        .activeDeadlineSeconds(activeDeadlineSeconds)
        .ttlSecondsAfterFinished(ttlSecondsAfterFinished)
        .template(
            new V1PodTemplateSpec()
                .metadata(
                    new V1ObjectMeta()
                        .labels(buildLabels(pipeline, runId))
                        .annotations(podAnnotations.isEmpty() ? null : podAnnotations))
                .spec(
                    new V1PodSpec()
                        .serviceAccountName(serviceAccountName)
                        .restartPolicy("Never")
                        .imagePullSecrets(imagePullSecrets.isEmpty() ? null : imagePullSecrets)
                        .nodeSelector(nodeSelector.isEmpty() ? null : nodeSelector)
                        .securityContext(buildPodSecurityContext())
                        .containers(
                            List.of(
                                new V1Container()
                                    .name("ingestion")
                                    .image(ingestionImage)
                                    .imagePullPolicy(imagePullPolicy)
                                    .command(List.of("python", "main.py"))
                                    .env(buildEnvVars(pipeline, runId, configOverride))
                                    .securityContext(buildContainerSecurityContext())
                                    .resources(
                                        new V1ResourceRequirements()
                                            .requests(resourceRequests)
                                            .limits(resourceLimits))))));
  }

  private V1PodSecurityContext buildPodSecurityContext() {
    V1PodSecurityContext context = new V1PodSecurityContext();
    if (runAsNonRoot) {
      context.setRunAsNonRoot(true);
    }
    if (runAsUser != null) {
      context.setRunAsUser(runAsUser);
    }
    if (runAsGroup != null) {
      context.setRunAsGroup(runAsGroup);
    }
    if (fsGroup != null) {
      context.setFsGroup(fsGroup);
    }
    return context;
  }

  private V1SecurityContext buildContainerSecurityContext() {
    return new V1SecurityContext()
        .runAsNonRoot(runAsNonRoot)
        .runAsUser(runAsUser)
        .allowPrivilegeEscalation(false)
        .readOnlyRootFilesystem(false) // Ingestion may need to write temp files
        .capabilities(new V1Capabilities().drop(List.of("ALL")));
  }

  private List<V1EnvVar> buildEnvVars(
      IngestionPipeline pipeline, String runId, Map<String, Object> configOverride) {
    String pipelineName = sanitizeName(pipeline.getName());
    String configMapName = CONFIG_MAP_PREFIX + pipelineName;
    String secretName = SECRET_PREFIX + pipelineName;

    List<V1EnvVar> envVars = new ArrayList<>();

    envVars.add(new V1EnvVar().name("pipelineType").value(pipeline.getPipelineType().toString()));
    envVars.add(new V1EnvVar().name("pipelineRunId").value(runId));
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

    if (configOverride != null && !configOverride.isEmpty()) {
      envVars.add(
          new V1EnvVar().name("configOverride").value(JsonUtils.pojoToJson(configOverride)));
    }

    // P2: Add extra environment variables from configuration
    if (extraEnvVars != null && !extraEnvVars.isEmpty()) {
      extraEnvVars.forEach((key, value) -> envVars.add(new V1EnvVar().name(key).value(value)));
    }

    return envVars;
  }

  private V1Job buildAutomationJob(Workflow workflow, String runId, String jobName) {
    return new V1Job()
        .metadata(
            new V1ObjectMeta()
                .name(jobName)
                .namespace(namespace)
                .labels(
                    Map.of(
                        LABEL_APP, "openmetadata",
                        LABEL_COMPONENT, "automation",
                        LABEL_MANAGED_BY, "openmetadata",
                        LABEL_RUN_ID, runId)))
        .spec(
            new V1JobSpec()
                .backoffLimit(backoffLimit)
                .activeDeadlineSeconds(activeDeadlineSeconds)
                .ttlSecondsAfterFinished(ttlSecondsAfterFinished)
                .template(
                    new V1PodTemplateSpec()
                        .spec(
                            new V1PodSpec()
                                .serviceAccountName(serviceAccountName)
                                .restartPolicy("Never")
                                .imagePullSecrets(
                                    imagePullSecrets.isEmpty() ? null : imagePullSecrets)
                                .containers(
                                    List.of(
                                        new V1Container()
                                            .name("automation")
                                            .image(ingestionImage)
                                            .imagePullPolicy(imagePullPolicy)
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
                                                    .requests(resourceRequests)
                                                    .limits(resourceLimits)))))));
  }

  private V1Job buildApplicationJob(App application, String runId, String jobName) {
    return new V1Job()
        .metadata(
            new V1ObjectMeta()
                .name(jobName)
                .namespace(namespace)
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
                .backoffLimit(backoffLimit)
                .activeDeadlineSeconds(activeDeadlineSeconds)
                .ttlSecondsAfterFinished(ttlSecondsAfterFinished)
                .template(
                    new V1PodTemplateSpec()
                        .spec(
                            new V1PodSpec()
                                .serviceAccountName(serviceAccountName)
                                .restartPolicy("Never")
                                .imagePullSecrets(
                                    imagePullSecrets.isEmpty() ? null : imagePullSecrets)
                                .containers(
                                    List.of(
                                        new V1Container()
                                            .name("application")
                                            .image(ingestionImage)
                                            .imagePullPolicy(imagePullPolicy)
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
                                                    .requests(resourceRequests)
                                                    .limits(resourceLimits)))))));
  }

  private String buildWorkflowConfig(IngestionPipeline pipeline) {
    Map<String, Object> config = new HashMap<>();

    Map<String, Object> source = new HashMap<>();
    source.put("type", pipeline.getPipelineType().toString().toLowerCase());
    source.put("serviceName", pipeline.getService().getName());
    source.put("sourceConfig", pipeline.getSourceConfig());
    config.put("source", source);

    Map<String, Object> sink = new HashMap<>();
    sink.put("type", "metadata-rest");
    sink.put("config", Map.of());
    config.put("sink", sink);

    Map<String, Object> workflowConfig = new HashMap<>();
    workflowConfig.put(
        "loggerLevel",
        pipeline.getLoggerLevel() != null ? pipeline.getLoggerLevel().toString() : "INFO");
    workflowConfig.put("openMetadataServerConfig", Map.of("hostPort", metadataApiEndpoint));
    config.put("workflowConfig", workflowConfig);

    return JsonUtils.pojoToJson(config);
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
      V1ConfigMap existing = coreApi.readNamespacedConfigMap(name, namespace).execute();
      // Use resourceVersion for optimistic locking
      configMap.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
      coreApi.replaceNamespacedConfigMap(name, namespace, configMap).execute();
      LOG.debug("Updated ConfigMap: {}", name);
      return false;
    } catch (ApiException e) {
      if (e.getCode() == 404) {
        coreApi.createNamespacedConfigMap(namespace, configMap).execute();
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
      V1Secret existing = coreApi.readNamespacedSecret(name, namespace).execute();
      // Use resourceVersion for optimistic locking
      secret.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
      coreApi.replaceNamespacedSecret(name, namespace, secret).execute();
      LOG.debug("Updated Secret: {}", name);
      return false;
    } catch (ApiException e) {
      if (e.getCode() == 404) {
        coreApi.createNamespacedSecret(namespace, secret).execute();
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
      V1CronJob existing = batchApi.readNamespacedCronJob(name, namespace).execute();
      // Use resourceVersion for optimistic locking
      cronJob.getMetadata().setResourceVersion(existing.getMetadata().getResourceVersion());
      batchApi.replaceNamespacedCronJob(name, namespace, cronJob).execute();
      LOG.debug("Updated CronJob: {}", name);
      return false;
    } catch (ApiException e) {
      if (e.getCode() == 404) {
        batchApi.createNamespacedCronJob(namespace, cronJob).execute();
        LOG.debug("Created CronJob: {}", name);
        return true;
      } else {
        throw e;
      }
    }
  }

  private void deleteJobsForPipeline(String pipelineName) throws ApiException {
    String labelSelector = LABEL_PIPELINE + "=" + pipelineName;
    V1JobList jobs = batchApi.listNamespacedJob(namespace).labelSelector(labelSelector).execute();

    for (V1Job job : jobs.getItems()) {
      String jobName = job.getMetadata().getName();
      batchApi.deleteNamespacedJob(jobName, namespace).propagationPolicy("Background").execute();
      LOG.debug("Deleted Job: {}", jobName);
    }
  }

  private void deleteCronJobIfExists(String name) throws ApiException {
    try {
      batchApi.deleteNamespacedCronJob(name, namespace).execute();
      LOG.debug("Deleted CronJob: {}", name);
    } catch (ApiException e) {
      if (e.getCode() != 404) {
        throw e;
      }
    }
  }

  private void deleteSecretIfExists(String name) throws ApiException {
    try {
      coreApi.deleteNamespacedSecret(name, namespace).execute();
      LOG.debug("Deleted Secret: {}", name);
    } catch (ApiException e) {
      if (e.getCode() != 404) {
        throw e;
      }
    }
  }

  private void deleteConfigMapIfExists(String name) throws ApiException {
    try {
      coreApi.deleteNamespacedConfigMap(name, namespace).execute();
      LOG.debug("Deleted ConfigMap: {}", name);
    } catch (ApiException e) {
      if (e.getCode() != 404) {
        throw e;
      }
    }
  }

  private PipelineStatus mapJobToPipelineStatus(V1Job job) {
    if (job.getMetadata() == null || job.getStatus() == null) {
      return null;
    }

    String runId =
        job.getMetadata().getLabels() != null
            ? job.getMetadata().getLabels().get(LABEL_RUN_ID)
            : job.getMetadata().getName();

    PipelineStatusType state = mapJobStatusType(job);

    Long startTime =
        job.getStatus().getStartTime() != null
            ? job.getStatus().getStartTime().toInstant().toEpochMilli()
            : null;
    Long endTime =
        job.getStatus().getCompletionTime() != null
            ? job.getStatus().getCompletionTime().toInstant().toEpochMilli()
            : null;

    return new PipelineStatus()
        .withRunId(runId)
        .withPipelineState(state)
        .withStartDate(startTime)
        .withEndDate(endTime)
        .withTimestamp(startTime);
  }

  private PipelineStatusType mapJobStatusType(V1Job job) {
    if (job.getStatus() == null) {
      return PipelineStatusType.QUEUED;
    }

    Integer active = job.getStatus().getActive();
    Integer succeeded = job.getStatus().getSucceeded();
    Integer failed = job.getStatus().getFailed();

    if (active != null && active > 0) {
      return PipelineStatusType.RUNNING;
    }
    if (succeeded != null && succeeded > 0) {
      return PipelineStatusType.SUCCESS;
    }
    if (failed != null && failed > 0) {
      return PipelineStatusType.FAILED;
    }

    return PipelineStatusType.QUEUED;
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

  private int getIntParam(Map<String, Object> params, String key, int defaultValue) {
    Object value = params.get(key);
    if (value == null) {
      return defaultValue;
    }
    try {
      return Integer.parseInt(value.toString());
    } catch (NumberFormatException e) {
      return defaultValue;
    }
  }

  private Long getLongParam(Map<String, Object> params, String key, Long defaultValue) {
    Object value = params.get(key);
    if (value == null) {
      return defaultValue;
    }
    try {
      return Long.parseLong(value.toString());
    } catch (NumberFormatException e) {
      return defaultValue;
    }
  }

  private List<V1LocalObjectReference> parseImagePullSecrets(String secrets) {
    if (StringUtils.isBlank(secrets)) {
      return new ArrayList<>();
    }
    return java.util.Arrays.stream(secrets.split(","))
        .map(String::trim)
        .filter(s -> !s.isEmpty())
        .map(s -> new V1LocalObjectReference().name(s))
        .collect(Collectors.toList());
  }

  private Map<String, String> parseNodeSelector(String nodeSelectorStr) {
    return parseKeyValuePairs(nodeSelectorStr);
  }

  private Map<String, String> parseKeyValuePairs(String pairsStr) {
    Map<String, String> result = new HashMap<>();
    if (StringUtils.isBlank(pairsStr)) {
      return result;
    }
    // Expected format: key1=value1,key2=value2
    for (String pair : pairsStr.split(",")) {
      String[] kv = pair.split("=", 2);
      if (kv.length == 2) {
        result.put(kv[0].trim(), kv[1].trim());
      }
    }
    return result;
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
