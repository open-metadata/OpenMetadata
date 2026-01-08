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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import io.kubernetes.client.openapi.apis.BatchV1Api;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1Container;
import io.kubernetes.client.openapi.models.V1EnvVar;
// Note: V1Event not available in current kubernetes client version
import io.kubernetes.client.openapi.models.V1Job;
import io.kubernetes.client.openapi.models.V1JobSpec;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.openapi.models.V1PodSpec;
import io.kubernetes.client.openapi.models.V1PodTemplateSpec;
import io.kubernetes.client.openapi.models.V1ResourceRequirements;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.Builder;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.StackTraceError;
import org.openmetadata.schema.entity.services.ingestionPipelines.StepSummary;

/**
 * Kubernetes failure diagnostics collector for pipeline jobs.
 *
 * <p>This class implements a pattern similar to Argo's onExit handler. When a main
 * ingestion job fails, a separate diagnostic job is created that runs the exit_handler.py
 * script to gather detailed information about the failure and update the pipeline status
 * in OpenMetadata with comprehensive failure information.
 */
@Slf4j
public class K8sFailureDiagnostics {

  private static final String DIAGNOSTIC_JOB_SUFFIX = "-diagnostics";
  private static final String DIAGNOSTIC_CONTAINER_NAME = "diagnostics";
  private static final int MAX_DIAGNOSTIC_ATTEMPTS = 3;
  private static final int DIAGNOSTIC_TIMEOUT_SECONDS = 300; // 5 minutes

  private final CoreV1Api coreApi;
  private final BatchV1Api batchApi;
  private final K8sPipelineClientConfig config;
  private final String metadataApiEndpoint;

  public K8sFailureDiagnostics(
      CoreV1Api coreApi,
      BatchV1Api batchApi,
      K8sPipelineClientConfig config,
      String metadataApiEndpoint) {
    this.coreApi = coreApi;
    this.batchApi = batchApi;
    this.config = config;
    this.metadataApiEndpoint = metadataApiEndpoint;
  }

  /**
   * Container for diagnostic information gathered from a failed job.
   */
  @Builder
  @Getter
  public static class DiagnosticInfo {
    private final String podLogs;
    private final String podDescription;
    private final String jobEvents;
    private final String failureReason;
    private final int exitCode;

    public boolean hasDiagnostics() {
      return !nullOrEmpty(podLogs) || !nullOrEmpty(podDescription) || !nullOrEmpty(jobEvents);
    }

    public String getSummary() {
      List<String> parts = new ArrayList<>();
      if (!nullOrEmpty(podLogs)) {
        int lines = podLogs.split("\n").length;
        parts.add(String.format("logs (%d lines)", lines));
      }
      if (!nullOrEmpty(podDescription)) {
        parts.add("pod description");
      }
      if (!nullOrEmpty(jobEvents)) {
        parts.add("job events");
      }

      if (parts.isEmpty()) {
        return "No diagnostics available";
      }
      return String.format("Available diagnostics: %s", String.join(", ", parts));
    }
  }

  /**
   * Creates and executes a diagnostic job to gather failure information from a failed main job.
   * The diagnostic job runs exit_handler.py which handles the entire diagnostic process.
   *
   * @param failedJob The main job that failed
   * @param pipeline The ingestion pipeline associated with the job
   * @param runId The pipeline run ID
   * @return Optional diagnostic information, empty if gathering failed
   */
  public Optional<DiagnosticInfo> gatherFailureDiagnostics(
      V1Job failedJob, IngestionPipeline pipeline, String runId) {

    if (failedJob == null || failedJob.getMetadata() == null) {
      LOG.warn("Invalid failed job provided for diagnostics gathering");
      return Optional.empty();
    }

    String jobName = failedJob.getMetadata().getName();
    LOG.info("Gathering failure diagnostics for job: {}", jobName);

    try {
      // Create diagnostic job that runs exit_handler.py
      V1Job diagnosticJob = buildDiagnosticJob(failedJob, pipeline, runId);
      String diagnosticJobName = diagnosticJob.getMetadata().getName();

      // Execute diagnostic job - it will handle updating OpenMetadata status directly
      batchApi.createNamespacedJob(config.getNamespace(), diagnosticJob).execute();
      LOG.info("Created diagnostic job: {}", diagnosticJobName);

      // Return simple diagnostic info indicating job was created
      DiagnosticInfo diagnosticInfo =
          DiagnosticInfo.builder()
              .jobEvents(
                  String.format(
                      "Diagnostic job %s created to process failure of %s",
                      diagnosticJobName, jobName))
              .build();

      return Optional.of(diagnosticInfo);

    } catch (Exception e) {
      LOG.error("Failed to create diagnostic job for {}: {}", jobName, e.getMessage(), e);
      return Optional.empty();
    }
  }

  /**
   * Updates pipeline status with diagnostic information from a failed job.
   */
  public void updatePipelineStatusWithDiagnostics(
      PipelineStatus pipelineStatus, DiagnosticInfo diagnostics) {

    if (!diagnostics.hasDiagnostics()) {
      LOG.info("No diagnostics available to add to pipeline status");
      return;
    }

    try {
      StepSummary diagnosticStep = createDiagnosticStepSummary(diagnostics);

      List<StepSummary> steps = new ArrayList<>();
      if (pipelineStatus.getStatus() != null) {
        steps.addAll(pipelineStatus.getStatus());
      }
      steps.add(diagnosticStep);

      pipelineStatus.setStatus(steps);

      LOG.info("Successfully added diagnostics to pipeline status - {}", diagnostics.getSummary());

    } catch (Exception e) {
      LOG.error("Failed to update pipeline status with diagnostics: {}", e.getMessage(), e);
    }
  }

  /**
   * Builds a Kubernetes job that will gather diagnostic information from a failed job.
   */
  private V1Job buildDiagnosticJob(V1Job failedJob, IngestionPipeline pipeline, String runId) {
    String baseJobName = failedJob.getMetadata().getName();
    String diagnosticJobName = baseJobName + DIAGNOSTIC_JOB_SUFFIX;

    // Build environment variables for the diagnostic container
    List<V1EnvVar> envVars = buildDiagnosticEnvVars(failedJob, pipeline, runId);

    V1Job job =
        new V1Job()
            .metadata(
                new V1ObjectMeta()
                    .name(diagnosticJobName)
                    .namespace(config.getNamespace())
                    .labels(buildDiagnosticLabels(pipeline, runId, baseJobName)))
            .spec(
                new V1JobSpec()
                    .backoffLimit(MAX_DIAGNOSTIC_ATTEMPTS)
                    .activeDeadlineSeconds((long) DIAGNOSTIC_TIMEOUT_SECONDS)
                    .ttlSecondsAfterFinished(config.getTtlSecondsAfterFinished())
                    .template(
                        new V1PodTemplateSpec()
                            .metadata(
                                new V1ObjectMeta()
                                    .labels(buildDiagnosticLabels(pipeline, runId, baseJobName)))
                            .spec(
                                new V1PodSpec()
                                    .serviceAccountName(config.getServiceAccountName())
                                    .restartPolicy("Never")
                                    .imagePullSecrets(config.getImagePullSecrets())
                                    .containers(
                                        List.of(
                                            new V1Container()
                                                .name(DIAGNOSTIC_CONTAINER_NAME)
                                                .image(config.getIngestionImage())
                                                .imagePullPolicy(config.getImagePullPolicy())
                                                .command(
                                                    List.of(
                                                        "python",
                                                        "/opt/airflow/ingestion/operators/docker/exit_handler.py"))
                                                .env(envVars)
                                                .resources(
                                                    new V1ResourceRequirements()
                                                        // Use minimal resources for diagnostic
                                                        // collection
                                                        .requests(
                                                            Map.of(
                                                                "cpu",
                                                                    config
                                                                        .getResourceRequests()
                                                                        .get("cpu"),
                                                                "memory",
                                                                    config
                                                                        .getResourceRequests()
                                                                        .get("memory")))
                                                        .limits(
                                                            Map.of(
                                                                "cpu",
                                                                    config
                                                                        .getResourceLimits()
                                                                        .get("cpu"),
                                                                "memory",
                                                                    config
                                                                        .getResourceLimits()
                                                                        .get("memory")))))))));

    return job;
  }

  /**
   * Builds environment variables for the diagnostic job container.
   * Sets up variables expected by exit_handler.py adapted from Argo workflow environment.
   */
  private List<V1EnvVar> buildDiagnosticEnvVars(
      V1Job failedJob, IngestionPipeline pipeline, String runId) {

    List<V1EnvVar> envVars = new ArrayList<>();

    // Environment variables expected by exit_handler.py (adapted for K8s Jobs)
    envVars.add(new V1EnvVar().name("jobName").value(failedJob.getMetadata().getName()));
    envVars.add(new V1EnvVar().name("namespace").value(config.getNamespace()));
    envVars.add(new V1EnvVar().name("pipelineRunId").value(runId));
    envVars.add(new V1EnvVar().name("pipelineStatus").value("Failed"));

    // Add the pipeline configuration (this would typically come from ConfigMap in real scenario)
    // For now, we'll add a basic config structure
    envVars.add(new V1EnvVar().name("config").value(buildBasicConfig(pipeline)));

    // Add extra environment variables from configuration
    if (config.getExtraEnvVars() != null && !config.getExtraEnvVars().isEmpty()) {
      config
          .getExtraEnvVars()
          .forEach((key, value) -> envVars.add(new V1EnvVar().name(key).value(value)));
    }

    return envVars;
  }

  /**
   * Builds a basic configuration for the exit handler.
   * In a real implementation, this would come from the ConfigMap used by the main job.
   */
  private String buildBasicConfig(IngestionPipeline pipeline) {
    // This is a simplified config structure - in practice, you'd get this from the main job's
    // ConfigMap
    return String.format(
        """
        workflowConfig:
          openMetadataServerConfig:
            hostPort: "%s"
        ingestionPipelineFQN: "%s"
        """,
        metadataApiEndpoint, pipeline.getFullyQualifiedName());
  }

  /**
   * Builds labels for diagnostic jobs to enable proper tracking and cleanup.
   */
  private Map<String, String> buildDiagnosticLabels(
      IngestionPipeline pipeline, String runId, String originalJobName) {

    Map<String, String> labels = new HashMap<>();
    labels.put("app.kubernetes.io/name", "openmetadata");
    labels.put("app.kubernetes.io/component", "diagnostics");
    labels.put("app.kubernetes.io/pipeline", pipeline.getName());
    labels.put("app.kubernetes.io/run-id", runId);
    labels.put("app.kubernetes.io/original-job", originalJobName);

    return labels;
  }

  /**
   * Creates a StepSummary with diagnostic information for the pipeline status.
   */
  private StepSummary createDiagnosticStepSummary(DiagnosticInfo diagnostics) {
    StringBuilder stackTrace = new StringBuilder();

    if (!nullOrEmpty(diagnostics.getJobEvents())) {
      stackTrace.append(diagnostics.getJobEvents());
    }

    StepSummary stepSummary = new StepSummary();
    stepSummary.setName("Failure Diagnostics");
    stepSummary.setRecords(0);
    stepSummary.setErrors(1);

    StackTraceError error = new StackTraceError();
    error.setName("Diagnostic Job Created");
    error.setError("Diagnostic job created to gather detailed failure information");
    error.setStackTrace(stackTrace.toString());

    stepSummary.setFailures(List.of(error));

    return stepSummary;
  }
}
