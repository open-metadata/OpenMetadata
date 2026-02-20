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
import io.kubernetes.client.openapi.apis.CustomObjectsApi;
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
import io.kubernetes.client.openapi.models.V1ObjectFieldSelector;
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
  private static final String CRONOMJOB_PREFIX = "om-cronomjob-";

  // Labels
  private static final String LABEL_APP = "app.kubernetes.io/name";
  private static final String LABEL_COMPONENT = "app.kubernetes.io/component";
  private static final String LABEL_MANAGED_BY = "app.kubernetes.io/managed-by";
  private static final String LABEL_PIPELINE = "app.kubernetes.io/pipeline";
  private static final String LABEL_PIPELINE_TYPE = "app.kubernetes.io/pipeline-type";
  private static final String LABEL_RUN_ID = "app.kubernetes.io/run-id";
  private static final String OMJOB_LABEL_POD_TYPE = "omjob.pipelines.openmetadata.org/pod-type";
  private static final String OMJOB_POD_TYPE_MAIN = "main";
  private static final String CONTAINER_MAIN = "main";
  private static final String CONTAINER_INGESTION = CONTAINER_MAIN;

  private static final String OMJOB_GROUP = "pipelines.openmetadata.org";
  private static final String OMJOB_VERSION = "v1";
  private static final String CRONOMJOB_PLURAL = "cronomjobs";

  // Config keys for K8s client initialization
  private static final String IN_CLUSTER_KEY = "inCluster";
  private static final String KUBECONFIG_PATH_KEY = "kubeconfigPath";
  private static final String KUBECONFIG_CONTENT_KEY = "kubeConfigContent";
  private static final String SKIP_INIT_KEY = "skipInit";
  private static final String USE_OM_JOB_OPERATOR_KEY = "useOMJobOperator";

  // Container names
  private static final String CONTAINER_NAME_INGESTION = CONTAINER_MAIN;
  private static final String CONTAINER_NAME_AUTOMATION = CONTAINER_MAIN;
  private static final String CONTAINER_NAME_APPLICATION = CONTAINER_MAIN;

  // Commands
  private static final String PYTHON_MAIN_PY = "python";
  private static final String MAIN_PY = "main.py";
  private static final String EXIT_HANDLER_PY = "exit_handler.py";
  private static final String RUN_AUTOMATION_PY = "run_automation.py";
  private static final String APPLICATIONS_RUNNER = "-m";
  private static final String APPLICATIONS_RUNNER_MODULE = "metadata.applications.runner";

  // Environment variable names
  private static final String ENV_PIPELINE_TYPE = "pipelineType";
  private static final String ENV_PIPELINE_RUN_ID = "pipelineRunId";
  private static final String ENV_INGESTION_PIPELINE_FQN = "ingestionPipelineFQN";
  private static final String ENV_CONFIG = "config";
  private static final String ENV_JOB_NAME = "jobName";
  private static final String ENV_NAMESPACE = "namespace";
  private static final String ENV_HOSTNAME = "HOSTNAME";

  // Label values and keys
  private static final String LABEL_VALUE_OPENMETADATA = "openmetadata";
  private static final String LABEL_VALUE_INGESTION = "ingestion";
  private static final String LABEL_VALUE_AUTOMATION = "automation";
  private static final String LABEL_VALUE_APPLICATION = "application";
  private static final String LABEL_APP_NAME = "app.kubernetes.io/app-name";
  private static final String SCHEDULED_RUN_ID = "scheduled";
  // Placeholders for dynamic values - will be replaced by CronOMJobReconciler at runtime
  private static final String CRONOMJOB_DYNAMIC_RUN_ID = "{{ omjob.uid }}";
  private static final String CRONOMJOB_DYNAMIC_JOB_NAME = "{{ omjob.name }}";

  // Kubernetes resource values
  private static final String RESTART_POLICY_NEVER = "Never";
  private static final String PROPAGATION_POLICY_ORPHAN = "Orphan";
  private static final String PROPAGATION_POLICY_BACKGROUND = "Background";
  private static final String CONCURRENCY_POLICY_FORBID = "Forbid";
  private static final String CONFIG_MAP_KEY_CONFIG = "config";
  private static final String SECRET_KEY_SECURITY_CONFIG = "securityConfig";

  // Default values
  private static final String DEFAULT_CRON_SCHEDULE = "0 0 * * *";
  private static final String DEFAULT_TASK_KEY = "ingestion_task";
  private static final String POD_PREFIX = "Pod: ";
  private static final String NAMESPACE_PREFIX = " in namespace: ";
  private static final String KUBERNETES_CLUSTER_PREFIX = "Kubernetes cluster - namespace: ";
  private static final String KUBERNETES_CLUSTER = "Kubernetes cluster";
  private static final String NO_LOGS_MESSAGE = "No logs available for pod: ";
  private static final String NO_PODS_MESSAGE = "No pods found for this pipeline";
  private static final String FAILED_LOGS_MESSAGE = "Failed to retrieve logs: ";

  // Error messages
  private static final String NAMESPACE_NOT_EXISTS_ERROR =
      "Namespace '%s' does not exist. Create it with: kubectl create namespace %s";
  private static final String NAMESPACE_VALIDATION_WARNING =
      "Could not validate namespace '%s' exists (HTTP %d): %s. Proceeding anyway.";
  private static final String K8S_API_CALL_FAILED = "K8s API call failed: ";
  private static final String FAILED_TO_INITIALIZE_K8S_CLIENT =
      "Failed to initialize Kubernetes client: ";
  private static final String FAILED_OPERATION_FORMAT =
      "Failed to %s '%s' in namespace '%s': HTTP %d - %s.%s";
  private static final String FAILED_TO_CONNECT_K8S_FORMAT =
      "Failed to connect to Kubernetes API (namespace: %s, service account: %s): Message: %s\nHTTP response code: %d\nHTTP response body: %s";
  private static final String K8S_AVAILABLE_MISSING_CONFIGMAP_FORMAT =
      "Kubernetes is available but missing ConfigMap permissions in namespace '%s' for service account '%s': %s";
  private static final String K8S_AVAILABLE_MISSING_SECRET_FORMAT =
      "Kubernetes is available but missing Secret permissions in namespace '%s' for service account '%s': %s";
  private static final String K8S_AVAILABLE_FORMAT =
      "Kubernetes pipeline client is available in namespace '%s' with service account '%s'";
  private static final String PIPELINE_MISSING_CONNECTION_WARNING =
      "Pipeline %s missing OpenMetadataServerConnection - creating default configuration from client config";
  private static final String PIPELINE_MISSING_SECURITY_CONFIG_ERROR =
      "Pipeline %s has OpenMetadataServerConnection but missing securityConfig. The JWT token and authentication config are required for ingestion to work.";
  private static final String PIPELINE_PROPER_CONNECTION_DEBUG =
      "Pipeline %s has proper OpenMetadataServerConnection with security config";
  private static final String INGESTION_BOT_NOT_FOUND_ERROR =
      "Ingestion bot not found or bot has no associated user";
  private static final String BOT_USER_NOT_FOUND_ERROR =
      "Bot user not found or has no authentication mechanism";
  private static final String BOT_AUTH_NOT_JWT_ERROR =
      "Bot user authentication mechanism is not JWT: %s";
  private static final String FAILED_TO_RETRIEVE_BOT_TOKEN_ERROR =
      "Failed to retrieve ingestion-bot token";
  private static final String FAILED_TO_RETRIEVE_BOT_TOKEN_STATE_ERROR =
      "Failed to retrieve ingestion-bot JWT token. The ingestion-bot user must exist and have a valid JWT authentication mechanism.";
  private static final String RETRIEVED_BOT_TOKEN_INFO =
      "Retrieved ingestion-bot JWT token for pipeline authentication";
  private static final String PIPELINE_CONNECTION_STATE_ERROR =
      "Pipeline OpenMetadataServerConnection.securityConfig is required but not set. This indicates the JWT token or authentication configuration is missing.";
  private static final String SKIP_CONNECTION_CONFIG_DEBUG =
      "Skipping server connection configuration for unit tests";
  private static final String DEFAULT_CONNECTION_INFO =
      "Set default OpenMetadataServerConnection for pipeline %s with endpoint %s";
  private static final String WORKFLOW_CONFIG_BUILD_FAILED =
      "Workflow configuration building failed";
  private static final String WORKFLOW_CONFIG_BUILD_WITH_OVERRIDES_FAILED =
      "Workflow configuration building failed";

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
  private CustomObjectsApi customObjectsApi;

  // Configuration
  private final K8sPipelineClientConfig k8sConfig;
  private final String metadataApiEndpoint;
  private final boolean useOMJobOperator;

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
      this.customObjectsApi = new CustomObjectsApi(client);
    } else {
      this.batchApi = null;
      this.coreApi = null;
      this.customObjectsApi = null;
    }

    this.k8sConfig = new K8sPipelineClientConfig(params);
    this.metadataApiEndpoint = clientConfig.getMetadataApiEndpoint();
    this.useOMJobOperator =
        Boolean.parseBoolean(getStringParam(params, USE_OM_JOB_OPERATOR_KEY, "false"));

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
                NAMESPACE_NOT_EXISTS_ERROR, k8sConfig.getNamespace(), k8sConfig.getNamespace()));
      }
      // For other errors, log warning but don't fail - k8sConfig.getNamespace() might be accessible
      // but not
      // readable
      LOG.warn(NAMESPACE_VALIDATION_WARNING, k8sConfig.getNamespace(), e.getCode(), e.getMessage());
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
      throw new PipelineServiceClientException(K8S_API_CALL_FAILED + t.getMessage());
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
      throw new PipelineServiceClientException(FAILED_TO_INITIALIZE_K8S_CLIENT + e.getMessage());
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

        // Create/Update CronJob or CronOMJob if scheduled
        if (hasSchedule(ingestionPipeline)) {
          if (useOMJobOperator) {
            CronOMJob cronOMJob = buildCronOMJob(ingestionPipeline);
            created = createOrUpdateCronOMJob(cronOMJob);
            if (created) {
              final String cronOMJobName = cronOMJob.getMetadata().getName();
              rollbacks.add(() -> safeDeleteCronOMJob(cronOMJobName));
            }
            LOG.info(
                "Created CronOMJob for scheduled pipeline: {} (startingDeadlineSeconds={}s)",
                pipelineName,
                k8sConfig.getStartingDeadlineSeconds());
          } else {
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
          }
        } else {
          if (useOMJobOperator) {
            deleteCronOMJobIfExists(CRONOMJOB_PREFIX + pipelineName);
          } else {
            deleteCronJobIfExists(CRONJOB_PREFIX + pipelineName);
          }
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

  private void safeDeleteCronOMJob(String name) {
    try {
      deleteCronOMJobIfExists(name);
    } catch (Exception e) {
      LOG.debug("Rollback: failed to delete CronOMJob {}: {}", name, e.getMessage());
    }
  }

  /** Build a detailed error message for K8s API failures. */
  private String buildDetailedErrorMessage(String operation, String resourceName, ApiException e) {
    String k8sMessage = parseK8sErrorMessage(e);
    String hint = getErrorHint(e.getCode());
    return String.format(
        FAILED_OPERATION_FORMAT,
        operation,
        resourceName,
        k8sConfig.getNamespace(),
        e.getCode(),
        k8sMessage,
        hint);
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

      if (useOMJobOperator) {
        // Use OMJob operator for guaranteed exit handler execution
        OMJob omJob = buildOMJob(ingestionPipeline, runId, config, service);
        executeWithRetry(
            () ->
                customObjectsApi
                    .createNamespacedCustomObject(
                        "pipelines.openmetadata.org",
                        "v1",
                        k8sConfig.getNamespace(),
                        "omjobs",
                        omJob.toMap())
                    .execute());
        LOG.info(
            "Created OMJob {} for pipeline {} [correlationId={}]",
            jobName,
            pipelineName,
            correlationId);
      } else {
        // Use regular Job with lifecycle hooks
        V1Job job = buildJob(ingestionPipeline, runId, config, service);
        executeWithRetry(
            () -> batchApi.createNamespacedJob(k8sConfig.getNamespace(), job).execute());
        LOG.info(
            "Created Job {} for pipeline {} [correlationId={}]",
            jobName,
            pipelineName,
            correlationId);
      }
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

      // Delete in order: Jobs -> CronJob/CronOMJob -> Secret -> ConfigMap
      try {
        deleteJobsForPipeline(pipelineName);
      } catch (ApiException e) {
        errors.add("Failed to delete jobs: " + parseK8sErrorMessage(e));
      }

      try {
        if (useOMJobOperator) {
          deleteCronOMJobIfExists(CRONOMJOB_PREFIX + pipelineName);
        } else {
          deleteCronJobIfExists(CRONJOB_PREFIX + pipelineName);
        }
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
    String cronJobName =
        useOMJobOperator ? CRONOMJOB_PREFIX + pipelineName : CRONJOB_PREFIX + pipelineName;
    String correlationId = UUID.randomUUID().toString().substring(0, 8);

    MDC.put(MDC_CORRELATION_ID, correlationId);
    MDC.put(MDC_PIPELINE_NAME, pipelineName);
    MDC.put(MDC_OPERATION, "toggle");

    try {
      LOG.info("Toggling pipeline [correlationId={}]", correlationId);

      if (useOMJobOperator) {
        @SuppressWarnings("unchecked")
        Map<String, Object> originalCronOMJob =
            (Map<String, Object>)
                executeWithRetry(
                    () ->
                        customObjectsApi
                            .getNamespacedCustomObject(
                                OMJOB_GROUP,
                                OMJOB_VERSION,
                                k8sConfig.getNamespace(),
                                CRONOMJOB_PLURAL,
                                cronJobName)
                            .execute());

        // Create a defensive copy to handle potentially unmodifiable maps from Kubernetes API
        Map<String, Object> cronOMJob = new HashMap<>(originalCronOMJob);

        @SuppressWarnings("unchecked")
        Map<String, Object> spec = (Map<String, Object>) cronOMJob.get("spec");
        if (spec == null) {
          spec = new HashMap<>();
          cronOMJob.put("spec", spec);
        } else {
          // Create a defensive copy of the spec map as well
          spec = new HashMap<>(spec);
          cronOMJob.put("spec", spec);
        }
        boolean currentlySuspended = Boolean.TRUE.equals(spec.getOrDefault("suspend", false));
        spec.put("suspend", !currentlySuspended);

        executeWithRetry(
            () ->
                customObjectsApi
                    .replaceNamespacedCustomObject(
                        OMJOB_GROUP,
                        OMJOB_VERSION,
                        k8sConfig.getNamespace(),
                        CRONOMJOB_PLURAL,
                        cronJobName,
                        cronOMJob)
                    .execute());

        String newState = currentlySuspended ? "enabled" : "disabled";
        ingestionPipeline.setEnabled(currentlySuspended);
        LOG.info("Pipeline {} is now {} [correlationId={}]", pipelineName, newState, correlationId);

        return buildSuccessResponse("Pipeline " + newState);
      }

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
      int killedCount = 0;

      if (useOMJobOperator) {
        // Kill OMJobs
        Map<String, Object> omJobs =
            executeWithRetry(
                () ->
                    (Map<String, Object>)
                        customObjectsApi
                            .listNamespacedCustomObject(
                                "pipelines.openmetadata.org",
                                "v1",
                                k8sConfig.getNamespace(),
                                "omjobs")
                            .labelSelector(labelSelector)
                            .execute());

        List<Map<String, Object>> items = (List<Map<String, Object>>) omJobs.get("items");
        if (items != null) {
          for (Map<String, Object> item : items) {
            Map<String, Object> metadata = (Map<String, Object>) item.get("metadata");
            if (metadata == null) {
              LOG.warn("OMJob item missing metadata, skipping [correlationId={}]", correlationId);
              continue;
            }
            String omJobName = (String) metadata.get("name");
            if (omJobName == null || omJobName.isEmpty()) {
              LOG.warn("OMJob metadata missing name, skipping [correlationId={}]", correlationId);
              continue;
            }

            // Delete the OMJob - operator will handle pod cleanup
            executeWithRetry(
                () ->
                    customObjectsApi
                        .deleteNamespacedCustomObject(
                            "pipelines.openmetadata.org",
                            "v1",
                            k8sConfig.getNamespace(),
                            "omjobs",
                            omJobName)
                        .execute());
            killedCount++;
            LOG.info("Killed OMJob: {} [correlationId={}]", omJobName, correlationId);
          }
        }
      } else {
        // Kill regular Jobs
        V1JobList jobs =
            executeWithRetry(
                () ->
                    batchApi
                        .listNamespacedJob(k8sConfig.getNamespace())
                        .labelSelector(labelSelector)
                        .execute());

        for (V1Job job : jobs.getItems()) {
          if (isJobActive(job)) {
            String jobName = job.getMetadata().getName();

            // Delete the job but orphan the pods for debugging - TTL will clean them up later
            executeWithRetry(
                () ->
                    batchApi
                        .deleteNamespacedJob(jobName, k8sConfig.getNamespace())
                        .propagationPolicy(PROPAGATION_POLICY_ORPHAN)
                        .execute());
            killedCount++;
            LOG.info("Killed job: {} [correlationId={}]", jobName, correlationId);
          }
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
                K8S_AVAILABLE_MISSING_CONFIGMAP_FORMAT, namespace, serviceAccount, e.getMessage());
        LOG.error(error);
        return buildUnhealthyStatus(error);
      }

      // Test Secret permissions (required for pipeline credentials)
      try {
        coreApi.listNamespacedSecret(namespace).limit(1).execute();
      } catch (ApiException e) {
        String error =
            String.format(
                K8S_AVAILABLE_MISSING_SECRET_FORMAT, namespace, serviceAccount, e.getMessage());
        LOG.error(error);
        return buildUnhealthyStatus(error);
      }

      String message = String.format(K8S_AVAILABLE_FORMAT, namespace, serviceAccount);

      return buildHealthyStatus(getKubernetesVersion()).withPlatform(message);

    } catch (ApiException e) {
      String error =
          String.format(
              FAILED_TO_CONNECT_K8S_FORMAT,
              namespace,
              serviceAccount,
              e.getMessage(),
              e.getCode(),
              e.getResponseBody());
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
      if (useOMJobOperator) {
        OMJob omJob = buildApplicationOMJob(application, runId, jobName);
        executeWithRetry(
            () ->
                customObjectsApi
                    .createNamespacedCustomObject(
                        OMJOB_GROUP,
                        OMJOB_VERSION,
                        k8sConfig.getNamespace(),
                        "omjobs",
                        omJob.toMap())
                    .execute());
      } else {
        V1Job job = buildApplicationJob(application, runId, jobName);
        batchApi.createNamespacedJob(k8sConfig.getNamespace(), job).execute();
      }

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
      Map<String, String> labelSelectorMap = new HashMap<>();
      labelSelectorMap.put(LABEL_PIPELINE, pipelineName);

      V1PodList pods =
          coreApi
              .listNamespacedPod(k8sConfig.getNamespace())
              .labelSelector(buildLabelSelector(labelSelectorMap))
              .execute();

      // Early return if no pods found - avoid processing empty lists
      if (pods.getItems().isEmpty()) {
        LOG.debug("No pods found for pipeline: {}", pipelineName);
        return Map.of("logs", NO_PODS_MESSAGE);
      }

      // Select the latest pod from the available pods
      V1Pod latestPod = selectLatestPod(pods.getItems());
      if (latestPod == null) {
        // This should not happen given the isEmpty check above, but defensive programming
        LOG.warn(
            "selectLatestPod returned null despite having {} pods available",
            pods.getItems().size());
        return Map.of("logs", NO_PODS_MESSAGE);
      }

      String podName = latestPod.getMetadata().getName();
      String containerName = selectContainerName(latestPod);
      LOG.debug("Retrieving logs from pod: {} container: {}", podName, containerName);

      String logs =
          coreApi
              .readNamespacedPodLog(podName, k8sConfig.getNamespace())
              .container(containerName)
              .execute();

      if (logs == null || logs.isEmpty()) {
        LOG.debug("No logs available for pod: {}", podName);
        return Map.of("logs", NO_LOGS_MESSAGE + podName);
      }

      String taskKey = TYPE_TO_TASK.get(ingestionPipeline.getPipelineType().value());
      if (taskKey == null) {
        taskKey = DEFAULT_TASK_KEY;
      }

      return IngestionLogHandler.buildLogResponse(logs, after, taskKey);

    } catch (ApiException e) {
      LOG.error("Failed to get logs for pipeline {}: {}", pipelineName, e.getResponseBody());
      return Map.of("logs", FAILED_LOGS_MESSAGE + e.getMessage());
    }
  }

  private V1Pod selectLatestPod(List<V1Pod> pods) {
    // Early return if pod list is null or empty - avoid unnecessary stream processing
    if (pods == null || pods.isEmpty()) {
      LOG.debug("No pods available for selection");
      return null;
    }

    // Filter for main pods (preferred) - only process if we have pods
    List<V1Pod> mainPods =
        pods.stream()
            .filter(
                pod -> {
                  if (pod.getMetadata() == null) {
                    LOG.warn("Pod with null metadata found, skipping");
                    return false;
                  }
                  Map<String, String> labels = pod.getMetadata().getLabels();
                  return labels != null
                      && OMJOB_POD_TYPE_MAIN.equals(labels.get(OMJOB_LABEL_POD_TYPE));
                })
            .toList();

    // Use main pods if available, otherwise fall back to all pods
    List<V1Pod> candidates = mainPods.isEmpty() ? pods : mainPods;

    // Log selection strategy for debugging
    LOG.debug(
        "Selecting latest pod from {} candidates ({} main pods found out of {} total pods)",
        candidates.size(),
        mainPods.size(),
        pods.size());

    return candidates.stream()
        .filter(pod -> pod.getMetadata() != null) // Additional safety check
        .sorted(
            (a, b) -> {
              OffsetDateTime timeA = a.getMetadata().getCreationTimestamp();
              OffsetDateTime timeB = b.getMetadata().getCreationTimestamp();
              // Handle null timestamps gracefully
              if (timeA == null && timeB == null) return 0;
              if (timeA == null) return 1; // null timestamps go to end
              if (timeB == null) return -1;
              return timeB.compareTo(timeA); // Latest first
            })
        .findFirst()
        .orElse(null);
  }

  private String selectContainerName(V1Pod pod) {
    if (pod.getSpec() == null || pod.getSpec().getContainers() == null) {
      return CONTAINER_INGESTION;
    }
    boolean hasMain =
        pod.getSpec().getContainers().stream()
            .anyMatch(container -> CONTAINER_MAIN.equals(container.getName()));
    if (hasMain) {
      return CONTAINER_MAIN;
    }
    boolean hasIngestion =
        pod.getSpec().getContainers().stream()
            .anyMatch(container -> CONTAINER_INGESTION.equals(container.getName()));
    if (hasIngestion) {
      return CONTAINER_INGESTION;
    }
    return pod.getSpec().getContainers().get(0).getName();
  }

  private String buildLabelSelector(Map<String, String> labels) {
    if (labels == null || labels.isEmpty()) {
      return null;
    }
    return labels.entrySet().stream()
        .map(entry -> entry.getKey() + "=" + entry.getValue())
        .reduce((a, b) -> a + "," + b)
        .orElse(null);
  }

  @Override
  protected Map<String, String> requestGetHostIp() {
    try {
      String podName = System.getenv(ENV_HOSTNAME);
      if (StringUtils.isNotBlank(podName)) {
        return Map.of("ip", POD_PREFIX + podName + NAMESPACE_PREFIX + k8sConfig.getNamespace());
      }
      return Map.of("ip", KUBERNETES_CLUSTER_PREFIX + k8sConfig.getNamespace());
    } catch (Exception e) {
      return Map.of("ip", KUBERNETES_CLUSTER);
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
        .data(Map.of(CONFIG_MAP_KEY_CONFIG, workflowConfig));
  }

  private V1Secret buildSecret(IngestionPipeline pipeline) {
    String name = SECRET_PREFIX + sanitizeName(pipeline.getName());

    Map<String, byte[]> secretData = new HashMap<>();

    if (pipeline.getOpenMetadataServerConnection() != null
        && pipeline.getOpenMetadataServerConnection().getSecurityConfig() != null) {
      Object securityConfig = pipeline.getOpenMetadataServerConnection().getSecurityConfig();
      String configJson = JsonUtils.pojoToJson(securityConfig);
      secretData.put(SECRET_KEY_SECURITY_CONFIG, configJson.getBytes(StandardCharsets.UTF_8));
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
                .concurrencyPolicy(CONCURRENCY_POLICY_FORBID)
                .startingDeadlineSeconds((long) k8sConfig.getStartingDeadlineSeconds())
                .successfulJobsHistoryLimit(k8sConfig.getSuccessfulJobsHistoryLimit())
                .failedJobsHistoryLimit(k8sConfig.getFailedJobsHistoryLimit())
                .suspend(!Boolean.TRUE.equals(pipeline.getEnabled()))
                .jobTemplate(
                    new V1JobTemplateSpec()
                        .metadata(new V1ObjectMeta().labels(buildLabels(pipeline, null)))
                        .spec(buildJobSpecForCronJob(pipeline))));
  }

  @VisibleForTesting
  CronOMJob buildCronOMJob(IngestionPipeline pipeline) {
    String name = CRONOMJOB_PREFIX + sanitizeName(pipeline.getName());
    String schedule = convertToCronSchedule(pipeline.getAirflowConfig().getScheduleInterval());
    String pipelineName = sanitizeName(pipeline.getName());
    String configMapName = CONFIG_MAP_PREFIX + pipelineName;
    Map<String, String> labels = buildLabels(pipeline, "scheduled");
    // Use dynamic placeholder for pipelineRunId that will be replaced by CronOMJobReconciler at
    // runtime
    OMJob.OMJobSpec omJobSpec =
        buildIngestionOMJobSpec(
            pipeline, CRONOMJOB_DYNAMIC_RUN_ID, null, null, configMapName, labels);

    return CronOMJob.builder()
        .apiVersion(OMJOB_GROUP + "/" + OMJOB_VERSION)
        .kind("CronOMJob")
        .metadata(
            CronOMJob.CronOMJobMetadata.builder()
                .name(name)
                .namespace(k8sConfig.getNamespace())
                .labels(labels)
                .annotations(
                    k8sConfig.getPodAnnotations().isEmpty() ? null : k8sConfig.getPodAnnotations())
                .build())
        .spec(
            CronOMJob.CronOMJobSpec.builder()
                .schedule(schedule)
                .timeZone(pipeline.getAirflowConfig().getPipelineTimezone())
                .startingDeadlineSeconds(k8sConfig.getStartingDeadlineSeconds())
                .successfulJobsHistoryLimit(k8sConfig.getSuccessfulJobsHistoryLimit())
                .failedJobsHistoryLimit(k8sConfig.getFailedJobsHistoryLimit())
                .suspend(!Boolean.TRUE.equals(pipeline.getEnabled()))
                .omJobSpec(omJobSpec)
                .build())
        .build();
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
                        .restartPolicy(RESTART_POLICY_NEVER)
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
                                    .name(CONTAINER_NAME_INGESTION)
                                    .image(k8sConfig.getIngestionImage())
                                    .imagePullPolicy(k8sConfig.getImagePullPolicy())
                                    .command(List.of(PYTHON_MAIN_PY, MAIN_PY))
                                    .env(buildEnvVarsForCronJob(pipeline, configMapName))
                                    .securityContext(buildContainerSecurityContext())
                                    .resources(
                                        new V1ResourceRequirements()
                                            .requests(k8sConfig.getResourceRequests())
                                            .limits(k8sConfig.getResourceLimits()))))));
  }

  private List<V1EnvVar> buildEnvVarsForCronJob(IngestionPipeline pipeline, String configMapName) {
    List<V1EnvVar> envVars = new ArrayList<>();

    envVars.add(
        new V1EnvVar().name(ENV_PIPELINE_TYPE).value(pipeline.getPipelineType().toString()));

    // Handle pipelineRunId differently for standard CronJobs vs CronOMJobs
    if (useOMJobOperator) {
      // For CronOMJobs: Use placeholder that CronOMJobReconciler will replace at runtime
      envVars.add(new V1EnvVar().name(ENV_PIPELINE_RUN_ID).value(CRONOMJOB_DYNAMIC_RUN_ID));
    } else {
      // For standard K8s CronJobs: Use Downward API to inject pod's UID as runId
      // Pod UIDs are valid UUIDs and unique per pod execution
      envVars.add(
          new V1EnvVar()
              .name(ENV_PIPELINE_RUN_ID)
              .valueFrom(
                  new V1EnvVarSource()
                      .fieldRef(new V1ObjectFieldSelector().fieldPath("metadata.uid"))));
    }

    envVars.add(
        new V1EnvVar().name(ENV_INGESTION_PIPELINE_FQN).value(pipeline.getFullyQualifiedName()));
    envVars.add(
        new V1EnvVar()
            .name(ENV_CONFIG)
            .valueFrom(
                new V1EnvVarSource()
                    .configMapKeyRef(
                        new io.kubernetes.client.openapi.models.V1ConfigMapKeySelector()
                            .name(configMapName)
                            .key(CONFIG_MAP_KEY_CONFIG))));

    // Add extra environment variables from configuration
    if (k8sConfig.getExtraEnvVars() != null && !k8sConfig.getExtraEnvVars().isEmpty()) {
      k8sConfig
          .getExtraEnvVars()
          .forEach((key, value) -> envVars.add(new V1EnvVar().name(key).value(value)));
    }

    return envVars;
  }

  private List<V1EnvVar> buildExitHandlerEnvVarsForCronOMJob(
      IngestionPipeline pipeline, String configMapName) {
    List<V1EnvVar> envVars = new ArrayList<>(buildEnvVarsForCronJob(pipeline, configMapName));
    envVars.add(new V1EnvVar().name("jobName").value(CRONOMJOB_DYNAMIC_JOB_NAME));
    envVars.add(new V1EnvVar().name("namespace").value(k8sConfig.getNamespace()));
    return envVars;
  }

  private OMJob.OMJobSpec buildIngestionOMJobSpec(
      IngestionPipeline pipeline,
      String runId,
      Map<String, Object> configOverride,
      ServiceEntityInterface service,
      String configMapName,
      Map<String, String> labels) {
    List<V1EnvVar> mainEnv =
        configMapName == null
            ? buildEnvVars(pipeline, runId, configOverride, service)
            : buildEnvVarsForCronJob(pipeline, configMapName);
    List<V1EnvVar> exitEnv =
        configMapName == null
            ? buildExitHandlerEnvVars(pipeline, runId, configOverride, service)
            : buildExitHandlerEnvVarsForCronOMJob(pipeline, configMapName);

    OMJob.OMJobPodSpec mainPodSpec =
        OMJob.OMJobPodSpec.builder()
            .image(k8sConfig.getIngestionImage())
            .imagePullPolicy(k8sConfig.getImagePullPolicy())
            .imagePullSecrets(
                k8sConfig.getImagePullSecrets().isEmpty() ? null : k8sConfig.getImagePullSecrets())
            .serviceAccountName(k8sConfig.getServiceAccountName())
            .command(List.of(PYTHON_MAIN_PY, MAIN_PY))
            .env(mainEnv)
            .resources(
                new V1ResourceRequirements()
                    .requests(k8sConfig.getResourceRequests())
                    .limits(k8sConfig.getResourceLimits()))
            .nodeSelector(
                k8sConfig.getNodeSelector().isEmpty() ? null : k8sConfig.getNodeSelector())
            .securityContext(buildPodSecurityContext())
            .labels(labels)
            .annotations(
                k8sConfig.getPodAnnotations().isEmpty() ? null : k8sConfig.getPodAnnotations())
            .build();

    OMJob.OMJobPodSpec exitHandlerSpec =
        OMJob.OMJobPodSpec.builder()
            .image(k8sConfig.getIngestionImage())
            .imagePullPolicy(k8sConfig.getImagePullPolicy())
            .command(List.of(PYTHON_MAIN_PY, EXIT_HANDLER_PY))
            .env(exitEnv)
            .resources(
                new V1ResourceRequirements()
                    .requests(Map.of("cpu", new Quantity("100m"), "memory", new Quantity("256Mi")))
                    .limits(Map.of("cpu", new Quantity("500m"), "memory", new Quantity("512Mi"))))
            .serviceAccountName(k8sConfig.getServiceAccountName())
            .nodeSelector(
                k8sConfig.getNodeSelector().isEmpty() ? null : k8sConfig.getNodeSelector())
            .securityContext(buildPodSecurityContext())
            .labels(labels)
            .annotations(
                k8sConfig.getPodAnnotations().isEmpty() ? null : k8sConfig.getPodAnnotations())
            .build();

    return OMJob.OMJobSpec.builder()
        .mainPodSpec(mainPodSpec)
        .exitHandlerSpec(exitHandlerSpec)
        .ttlSecondsAfterFinished(k8sConfig.getTtlSecondsAfterFinished())
        .build();
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
                        .restartPolicy(RESTART_POLICY_NEVER)
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
                                    .name(CONTAINER_NAME_INGESTION)
                                    .image(k8sConfig.getIngestionImage())
                                    .imagePullPolicy(k8sConfig.getImagePullPolicy())
                                    .command(List.of(PYTHON_MAIN_PY, MAIN_PY))
                                    .env(buildEnvVars(pipeline, runId, configOverride, service))
                                    .securityContext(buildContainerSecurityContext())
                                    .resources(
                                        new V1ResourceRequirements()
                                            .requests(k8sConfig.getResourceRequests())
                                            .limits(k8sConfig.getResourceLimits()))))));
  }

  /**
   * Build OMJob custom resource for guaranteed exit handler execution.
   * Creates separate pod specs for main ingestion and exit handler execution.
   */
  private OMJob buildOMJob(
      IngestionPipeline pipeline,
      String runId,
      Map<String, Object> configOverride,
      ServiceEntityInterface service) {

    String pipelineName = sanitizeName(pipeline.getName());
    String jobName = JOB_PREFIX + pipelineName + "-" + runId.substring(0, 8);

    return OMJob.builder()
        .apiVersion(OMJOB_GROUP + "/" + OMJOB_VERSION)
        .kind("OMJob")
        .metadata(
            OMJob.OMJobMetadata.builder()
                .name(jobName)
                .namespace(k8sConfig.getNamespace())
                .labels(buildLabels(pipeline, runId))
                .annotations(
                    k8sConfig.getPodAnnotations().isEmpty() ? null : k8sConfig.getPodAnnotations())
                .build())
        .spec(
            buildIngestionOMJobSpec(
                pipeline, runId, configOverride, service, null, buildLabels(pipeline, runId)))
        .build();
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

  @VisibleForTesting
  List<V1EnvVar> buildEnvVars(
      IngestionPipeline pipeline,
      String runId,
      Map<String, Object> configOverride,
      ServiceEntityInterface service) {
    return buildCommonIngestionEnvVars(pipeline, runId, configOverride, service, true);
  }

  /**
   * Build environment variables for the exit handler pod.
   * The exit handler needs minimal environment to update pipeline status.
   */
  @VisibleForTesting
  List<V1EnvVar> buildExitHandlerEnvVars(
      IngestionPipeline pipeline,
      String runId,
      Map<String, Object> configOverride,
      ServiceEntityInterface service) {
    List<V1EnvVar> envVars =
        new ArrayList<>(
            buildCommonIngestionEnvVars(pipeline, runId, configOverride, service, true));

    return envVars;
  }

  private List<V1EnvVar> buildCommonIngestionEnvVars(
      IngestionPipeline pipeline,
      String runId,
      Map<String, Object> configOverride,
      ServiceEntityInterface service,
      boolean includeConfig) {
    String pipelineName = sanitizeName(pipeline.getName());

    List<V1EnvVar> envVars = new ArrayList<>();

    envVars.add(
        new V1EnvVar().name(ENV_PIPELINE_TYPE).value(pipeline.getPipelineType().toString()));
    envVars.add(new V1EnvVar().name(ENV_PIPELINE_RUN_ID).value(runId));
    envVars.add(
        new V1EnvVar().name(ENV_INGESTION_PIPELINE_FQN).value(pipeline.getFullyQualifiedName()));

    if (includeConfig) {
      // Build the complete workflow config including any overrides
      String workflowConfig = buildWorkflowConfigWithOverrides(pipeline, service, configOverride);
      envVars.add(new V1EnvVar().name(ENV_CONFIG).value(workflowConfig));
    }

    envVars.add(
        new V1EnvVar()
            .name(ENV_JOB_NAME)
            .value(JOB_PREFIX + pipelineName + "-" + runId.substring(0, 8)));
    envVars.add(new V1EnvVar().name(ENV_NAMESPACE).value(k8sConfig.getNamespace()));

    addExtraEnvVars(envVars);

    return envVars;
  }

  private void addExtraEnvVars(List<V1EnvVar> envVars) {
    if (k8sConfig.getExtraEnvVars() == null || k8sConfig.getExtraEnvVars().isEmpty()) {
      return;
    }
    k8sConfig
        .getExtraEnvVars()
        .forEach((key, value) -> envVars.add(new V1EnvVar().name(key).value(value)));
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
      throw new IngestionPipelineDeploymentException(
          WORKFLOW_CONFIG_BUILD_WITH_OVERRIDES_FAILED + ": " + e.getMessage());
    }
  }

  private V1Job buildAutomationJob(Workflow workflow, String runId, String jobName) {
    List<V1EnvVar> envVars = new ArrayList<>();
    envVars.add(new V1EnvVar().name(ENV_CONFIG).value(JsonUtils.pojoToJson(workflow)));
    addExtraEnvVars(envVars);

    return new V1Job()
        .metadata(
            new V1ObjectMeta()
                .name(jobName)
                .namespace(k8sConfig.getNamespace())
                .labels(
                    Map.of(
                        LABEL_APP, LABEL_VALUE_OPENMETADATA,
                        LABEL_COMPONENT, LABEL_VALUE_AUTOMATION,
                        LABEL_MANAGED_BY, LABEL_VALUE_OPENMETADATA,
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
                                .restartPolicy(RESTART_POLICY_NEVER)
                                .imagePullSecrets(
                                    k8sConfig.getImagePullSecrets().isEmpty()
                                        ? null
                                        : k8sConfig.getImagePullSecrets())
                                .containers(
                                    List.of(
                                        new V1Container()
                                            .name(CONTAINER_NAME_AUTOMATION)
                                            .image(k8sConfig.getIngestionImage())
                                            .imagePullPolicy(k8sConfig.getImagePullPolicy())
                                            .command(List.of(PYTHON_MAIN_PY, RUN_AUTOMATION_PY))
                                            .env(envVars)
                                            .resources(
                                                new V1ResourceRequirements()
                                                    .requests(k8sConfig.getResourceRequests())
                                                    .limits(k8sConfig.getResourceLimits())))))));
  }

  private V1Job buildApplicationJob(App application, String runId, String jobName) {
    Map<String, String> labels = buildApplicationLabels(application, runId);
    List<V1EnvVar> envVars = new ArrayList<>();
    envVars.add(new V1EnvVar().name(ENV_CONFIG).value(JsonUtils.pojoToJson(application)));
    addExtraEnvVars(envVars);

    return new V1Job()
        .metadata(
            new V1ObjectMeta().name(jobName).namespace(k8sConfig.getNamespace()).labels(labels))
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
                                .restartPolicy(RESTART_POLICY_NEVER)
                                .imagePullSecrets(
                                    k8sConfig.getImagePullSecrets().isEmpty()
                                        ? null
                                        : k8sConfig.getImagePullSecrets())
                                .containers(
                                    List.of(
                                        new V1Container()
                                            .name(CONTAINER_NAME_APPLICATION)
                                            .image(k8sConfig.getIngestionImage())
                                            .imagePullPolicy(k8sConfig.getImagePullPolicy())
                                            .command(
                                                List.of(
                                                    PYTHON_MAIN_PY,
                                                    APPLICATIONS_RUNNER,
                                                    APPLICATIONS_RUNNER_MODULE))
                                            .env(envVars)
                                            .resources(
                                                new V1ResourceRequirements()
                                                    .requests(k8sConfig.getResourceRequests())
                                                    .limits(k8sConfig.getResourceLimits())))))));
  }

  private OMJob buildApplicationOMJob(App application, String runId, String jobName) {
    Map<String, String> labels = buildApplicationLabels(application, runId);

    List<V1EnvVar> envVars = new ArrayList<>();
    envVars.add(new V1EnvVar().name(ENV_CONFIG).value(JsonUtils.pojoToJson(application)));
    addExtraEnvVars(envVars);

    OMJob.OMJobPodSpec mainPodSpec =
        OMJob.OMJobPodSpec.builder()
            .image(k8sConfig.getIngestionImage())
            .imagePullPolicy(k8sConfig.getImagePullPolicy())
            .imagePullSecrets(
                k8sConfig.getImagePullSecrets().isEmpty() ? null : k8sConfig.getImagePullSecrets())
            .serviceAccountName(k8sConfig.getServiceAccountName())
            .command(List.of(PYTHON_MAIN_PY, APPLICATIONS_RUNNER, APPLICATIONS_RUNNER_MODULE))
            .env(envVars)
            .resources(
                new V1ResourceRequirements()
                    .requests(k8sConfig.getResourceRequests())
                    .limits(k8sConfig.getResourceLimits()))
            .nodeSelector(
                k8sConfig.getNodeSelector().isEmpty() ? null : k8sConfig.getNodeSelector())
            .securityContext(buildPodSecurityContext())
            .labels(labels)
            .annotations(
                k8sConfig.getPodAnnotations().isEmpty() ? null : k8sConfig.getPodAnnotations())
            .build();

    OMJob.OMJobPodSpec exitHandlerSpec =
        OMJob.OMJobPodSpec.builder()
            .image(k8sConfig.getIngestionImage())
            .imagePullPolicy(k8sConfig.getImagePullPolicy())
            .command(List.of("sh", "-c", "exit 0"))
            .resources(
                new V1ResourceRequirements()
                    .requests(Map.of("cpu", new Quantity("100m"), "memory", new Quantity("256Mi")))
                    .limits(Map.of("cpu", new Quantity("500m"), "memory", new Quantity("512Mi"))))
            .serviceAccountName(k8sConfig.getServiceAccountName())
            .nodeSelector(
                k8sConfig.getNodeSelector().isEmpty() ? null : k8sConfig.getNodeSelector())
            .securityContext(buildPodSecurityContext())
            .labels(labels)
            .annotations(
                k8sConfig.getPodAnnotations().isEmpty() ? null : k8sConfig.getPodAnnotations())
            .build();

    OMJob.OMJobSpec omJobSpec =
        OMJob.OMJobSpec.builder()
            .mainPodSpec(mainPodSpec)
            .exitHandlerSpec(exitHandlerSpec)
            .ttlSecondsAfterFinished(k8sConfig.getTtlSecondsAfterFinished())
            .build();

    return OMJob.builder()
        .apiVersion(OMJOB_GROUP + "/" + OMJOB_VERSION)
        .kind("OMJob")
        .metadata(
            OMJob.OMJobMetadata.builder()
                .name(jobName)
                .namespace(k8sConfig.getNamespace())
                .labels(labels)
                .annotations(
                    k8sConfig.getPodAnnotations().isEmpty() ? null : k8sConfig.getPodAnnotations())
                .build())
        .spec(omJobSpec)
        .build();
  }

  private Map<String, String> buildApplicationLabels(App application, String runId) {
    return Map.of(
        LABEL_APP,
        LABEL_VALUE_OPENMETADATA,
        LABEL_COMPONENT,
        LABEL_VALUE_APPLICATION,
        LABEL_MANAGED_BY,
        LABEL_VALUE_OPENMETADATA,
        LABEL_APP_NAME,
        sanitizeName(application.getName()),
        LABEL_RUN_ID,
        runId);
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
          WORKFLOW_CONFIG_BUILD_FAILED + ": " + e.getMessage());
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
      LOG.warn(PIPELINE_MISSING_CONNECTION_WARNING, pipeline.getName());

      // For unit tests, we don't require actual JWT token retrieval
      // Skip server connection configuration if skipInit is true
      if (k8sConfig.isSkipInit()) {
        LOG.debug(SKIP_CONNECTION_CONFIG_DEBUG);
        return;
      }

      // Create a default server connection based on client configuration
      // This ensures the pipeline can authenticate with the OpenMetadata server
      org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection
          serverConnection = createDefaultServerConnection();

      pipeline.setOpenMetadataServerConnection(serverConnection);
      LOG.info(DEFAULT_CONNECTION_INFO, pipeline.getName(), serverConnection.getHostPort());
      return;
    }

    if (pipeline.getOpenMetadataServerConnection().getSecurityConfig() == null) {
      LOG.error(PIPELINE_MISSING_SECURITY_CONFIG_ERROR, pipeline.getName());
      throw new IllegalStateException(PIPELINE_CONNECTION_STATE_ERROR);
    }

    LOG.debug(PIPELINE_PROPER_CONNECTION_DEBUG, pipeline.getName());
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
      throw new IllegalStateException(FAILED_TO_RETRIEVE_BOT_TOKEN_STATE_ERROR);
    }

    LOG.info(RETRIEVED_BOT_TOKEN_INFO);

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
        LOG.error(INGESTION_BOT_NOT_FOUND_ERROR);
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
        LOG.error(BOT_USER_NOT_FOUND_ERROR);
        return null;
      }

      // Extract JWT token from authentication mechanism
      org.openmetadata.schema.entity.teams.AuthenticationMechanism authMechanism =
          botUser.getAuthenticationMechanism();
      if (authMechanism.getAuthType()
          != org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT) {
        LOG.error(BOT_AUTH_NOT_JWT_ERROR, authMechanism.getAuthType());
        return null;
      }

      org.openmetadata.schema.auth.JWTAuthMechanism jwtAuth =
          (org.openmetadata.schema.auth.JWTAuthMechanism) authMechanism.getConfig();
      return jwtAuth.getJWTToken();

    } catch (Exception e) {
      LOG.error(FAILED_TO_RETRIEVE_BOT_TOKEN_ERROR, e);
      return null;
    }
  }

  private Map<String, String> buildLabels(IngestionPipeline pipeline, String runId) {
    Map<String, String> labels = new HashMap<>();
    labels.put(LABEL_APP, LABEL_VALUE_OPENMETADATA);
    labels.put(LABEL_COMPONENT, LABEL_VALUE_INGESTION);
    labels.put(LABEL_MANAGED_BY, LABEL_VALUE_OPENMETADATA);
    labels.put(LABEL_PIPELINE, sanitizeName(pipeline.getName()));
    labels.put(LABEL_PIPELINE_TYPE, pipeline.getPipelineType().toString().toLowerCase());

    if (runId != null && !SCHEDULED_RUN_ID.equals(runId)) {
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

  private boolean createOrUpdateCronOMJob(CronOMJob cronOMJob) throws ApiException {
    String name = cronOMJob.getMetadata().getName();
    try {
      @SuppressWarnings("unchecked")
      Map<String, Object> existing =
          (Map<String, Object>)
              customObjectsApi
                  .getNamespacedCustomObject(
                      OMJOB_GROUP, OMJOB_VERSION, k8sConfig.getNamespace(), CRONOMJOB_PLURAL, name)
                  .execute();
      @SuppressWarnings("unchecked")
      Map<String, Object> metadata = (Map<String, Object>) existing.get("metadata");
      if (metadata != null && metadata.get("resourceVersion") != null) {
        cronOMJob.getMetadata().setResourceVersion(metadata.get("resourceVersion").toString());
      }
      customObjectsApi
          .replaceNamespacedCustomObject(
              OMJOB_GROUP,
              OMJOB_VERSION,
              k8sConfig.getNamespace(),
              CRONOMJOB_PLURAL,
              name,
              cronOMJob.toMap())
          .execute();
      LOG.debug("Updated CronOMJob: {}", name);
      return false;
    } catch (ApiException e) {
      if (e.getCode() == 404) {
        customObjectsApi
            .createNamespacedCustomObject(
                OMJOB_GROUP,
                OMJOB_VERSION,
                k8sConfig.getNamespace(),
                CRONOMJOB_PLURAL,
                cronOMJob.toMap())
            .execute();
        LOG.debug("Created CronOMJob: {}", name);
        return true;
      }
      throw e;
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
          .propagationPolicy(PROPAGATION_POLICY_BACKGROUND)
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

  private void deleteCronOMJobIfExists(String name) throws ApiException {
    try {
      customObjectsApi
          .deleteNamespacedCustomObject(
              OMJOB_GROUP, OMJOB_VERSION, k8sConfig.getNamespace(), CRONOMJOB_PLURAL, name)
          .execute();
      LOG.debug("Deleted CronOMJob: {}", name);
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
      return DEFAULT_CRON_SCHEDULE;
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

  String sanitizeName(String name) {
    // K8s names must be lowercase, alphanumeric, or '-'
    // Must start with alphanumeric, max 63 chars
    String sanitized =
        name.toLowerCase()
            .replaceAll("[^a-z0-9-]", "-")
            .replaceAll("-+", "-")
            .replaceAll("^-+|-+$", "");

    if (sanitized.length() > 53) { // Leave room for prefixes
      sanitized = sanitized.substring(0, 53).replaceAll("-+$", "");
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
  public void setBatchApi(BatchV1Api batchApi) {
    this.batchApi = batchApi;
  }

  @VisibleForTesting
  public void setCoreApi(CoreV1Api coreApi) {
    this.coreApi = coreApi;
  }
}
