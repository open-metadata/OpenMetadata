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

package org.openmetadata.operator.service;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import io.fabric8.kubernetes.api.model.CapabilitiesBuilder;
import io.fabric8.kubernetes.api.model.Container;
import io.fabric8.kubernetes.api.model.ContainerBuilder;
import io.fabric8.kubernetes.api.model.EnvVar;
import io.fabric8.kubernetes.api.model.EnvVarBuilder;
import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import io.fabric8.kubernetes.api.model.OwnerReference;
import io.fabric8.kubernetes.api.model.OwnerReferenceBuilder;
import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.api.model.PodBuilder;
import io.fabric8.kubernetes.api.model.PodSecurityContext;
import io.fabric8.kubernetes.api.model.PodSpecBuilder;
import io.fabric8.kubernetes.api.model.PodStatus;
import io.fabric8.kubernetes.api.model.SecurityContext;
import io.fabric8.kubernetes.api.model.SecurityContextBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;
import org.openmetadata.operator.model.OMJobResource;
import org.openmetadata.operator.model.OMJobSpec;
import org.openmetadata.operator.model.OMJobStatus;
import org.openmetadata.operator.util.EnvVarUtils;
import org.openmetadata.operator.util.KubernetesNameBuilder;
import org.openmetadata.operator.util.LabelBuilder;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Service for managing pod lifecycle within OMJob execution.
 *
 * This handles creation, monitoring, and cleanup of both main and exit handler pods.
 */
public class PodManager {

  private static final Logger LOG = LoggerFactory.getLogger(PodManager.class);
  private static final String PIPELINE_STATUS = "pipelineStatus";
  private static final int MAX_POD_NAME_LENGTH = 253;

  private final KubernetesClient client;

  public PodManager(KubernetesClient client) {
    this.client = client;
  }

  /**
   * Create main ingestion pod from OMJob specification.
   * This method is idempotent - it will return the existing pod if it already exists
   * with the expected name, preventing race conditions.
   */
  public Pod createMainPod(OMJobResource omJob) {
    LOG.info("Creating main pod for OMJob: {}", omJob.getMetadata().getName());

    String podName = generateMainPodName(omJob);
    String namespace = omJob.getMetadata().getNamespace();

    // First check if pod already exists with the expected name (idempotent operation)
    try {
      Pod existingPod = client.pods().inNamespace(namespace).withName(podName).get();
      if (existingPod != null) {
        LOG.info(
            "Main pod already exists: {} in namespace: {}, returning existing pod",
            podName,
            namespace);
        return existingPod;
      }
    } catch (Exception e) {
      LOG.debug("Pod {} does not exist yet, proceeding with creation", podName);
    }

    // Build the pod specification
    OMJobSpec.OMJobPodSpec podSpec = omJob.getSpec().getMainPodSpec();
    Pod pod = buildPod(omJob, podName, podSpec, LabelBuilder.buildMainPodLabels(omJob), null);

    try {
      Pod createdPod = client.pods().inNamespace(namespace).resource(pod).create();

      LOG.info(
          "Created main pod: {} in namespace: {}",
          createdPod.getMetadata().getName(),
          createdPod.getMetadata().getNamespace());

      return createdPod;

    } catch (Exception e) {
      // If creation fails due to "already exists", try to fetch the existing pod
      if (e.getMessage() != null && e.getMessage().toLowerCase().contains("already exists")) {
        LOG.info("Pod {} already exists (race condition), fetching existing pod", podName);
        try {
          Pod existingPod = client.pods().inNamespace(namespace).withName(podName).get();
          if (existingPod != null) {
            return existingPod;
          }
        } catch (Exception fetchException) {
          LOG.warn("Failed to fetch existing pod after creation conflict", fetchException);
        }
      }
      LOG.error("Failed to create main pod for OMJob: {}", omJob.getMetadata().getName(), e);
      throw new RuntimeException("Failed to create main pod", e);
    }
  }

  /**
   * Create exit handler pod from OMJob specification.
   * This method is idempotent - it will return the existing pod if it already exists
   * with the expected name, preventing race conditions.
   */
  public Pod createExitHandlerPod(OMJobResource omJob) {
    LOG.info("Creating exit handler pod for OMJob: {}", omJob.getMetadata().getName());

    String podName = generateExitHandlerPodName(omJob);
    String namespace = omJob.getMetadata().getNamespace();

    // First check if pod already exists with the expected name (idempotent operation)
    try {
      Pod existingPod = client.pods().inNamespace(namespace).withName(podName).get();
      if (existingPod != null) {
        LOG.info(
            "Exit handler pod already exists: {} in namespace: {}, returning existing pod",
            podName,
            namespace);
        return existingPod;
      }
    } catch (Exception e) {
      LOG.debug("Pod {} does not exist yet, proceeding with creation", podName);
    }

    // Build the pod specification
    OMJobSpec.OMJobPodSpec podSpec = omJob.getSpec().getExitHandlerSpec();

    List<EnvVar> envVars = new ArrayList<>();
    if (podSpec.getEnv() != null) {
      podSpec.getEnv().stream()
          .filter(env -> !PIPELINE_STATUS.equals(env.getName()))
          .forEach(envVars::add);
    }
    envVars.add(
        new EnvVarBuilder()
            .withName(PIPELINE_STATUS)
            .withValue(determinePipelineStatus(omJob))
            .build());

    Pod pod =
        buildPod(omJob, podName, podSpec, LabelBuilder.buildExitHandlerLabels(omJob), envVars);

    try {
      Pod createdPod = client.pods().inNamespace(namespace).resource(pod).create();

      LOG.info(
          "Created exit handler pod: {} in namespace: {}",
          createdPod.getMetadata().getName(),
          createdPod.getMetadata().getNamespace());

      return createdPod;

    } catch (Exception e) {
      // If creation fails due to "already exists", try to fetch the existing pod
      if (e.getMessage() != null && e.getMessage().toLowerCase().contains("already exists")) {
        LOG.info("Pod {} already exists (race condition), fetching existing pod", podName);
        try {
          Pod existingPod = client.pods().inNamespace(namespace).withName(podName).get();
          if (existingPod != null) {
            return existingPod;
          }
        } catch (Exception fetchException) {
          LOG.warn("Failed to fetch existing pod after creation conflict", fetchException);
        }
      }
      LOG.error(
          "Failed to create exit handler pod for OMJob: {}", omJob.getMetadata().getName(), e);
      throw new RuntimeException("Failed to create exit handler pod", e);
    }
  }

  /**
   * Find main pod for an OMJob
   */
  public Optional<Pod> findMainPod(OMJobResource omJob) {
    Optional<Pod> pod = findPod(omJob, LabelBuilder.buildMainPodSelector(omJob));
    if (pod.isPresent()) {
      return pod;
    }
    String recordedPodName = omJob.getStatus() != null ? omJob.getStatus().getMainPodName() : null;
    return findRecordedPod(omJob, recordedPodName, "main pod");
  }

  /**
   * Find exit handler pod for an OMJob
   */
  public Optional<Pod> findExitHandlerPod(OMJobResource omJob) {
    Optional<Pod> pod = findPod(omJob, LabelBuilder.buildExitHandlerSelector(omJob));
    if (pod.isPresent()) {
      return pod;
    }
    String recordedPodName =
        omJob.getStatus() != null ? omJob.getStatus().getExitHandlerPodName() : null;
    return findRecordedPod(omJob, recordedPodName, "exit handler pod");
  }

  /**
   * Fallback for when the label lookup misses: the pod name recorded in the OMJob status.
   */
  private Optional<Pod> findRecordedPod(
      OMJobResource omJob, String recordedPodName, String podDescription) {
    if (nullOrEmpty(recordedPodName)) {
      return Optional.empty();
    }
    try {
      Optional<Pod> pod =
          Optional.ofNullable(
              client
                  .pods()
                  .inNamespace(omJob.getMetadata().getNamespace())
                  .withName(recordedPodName)
                  .get());
      pod.ifPresent(
          found ->
              LOG.info(
                  "Found {} by name for OMJob: {}", podDescription, omJob.getMetadata().getName()));
      return pod;
    } catch (KubernetesClientException e) {
      LOG.debug("Could not find pod by name {}: {}", recordedPodName, e.getMessage());
      return Optional.empty();
    }
  }

  /**
   * Get pod status information
   */
  public PodStatus getPodStatus(Pod pod) {
    if (pod == null || pod.getStatus() == null) {
      return null;
    }
    return pod.getStatus();
  }

  /**
   * Check if pod has completed (succeeded or failed)
   */
  public boolean isPodCompleted(Pod pod) {
    PodStatus status = getPodStatus(pod);
    if (status == null) {
      return false;
    }

    String phase = status.getPhase();
    return "Succeeded".equals(phase) || "Failed".equals(phase);
  }

  /**
   * Get exit code from completed pod
   */
  public Optional<Integer> getPodExitCode(Pod pod) {
    PodStatus status = getPodStatus(pod);
    if (status == null || status.getContainerStatuses() == null) {
      return Optional.empty();
    }

    return status.getContainerStatuses().stream()
        .filter(cs -> cs.getState() != null && cs.getState().getTerminated() != null)
        .map(cs -> cs.getState().getTerminated().getExitCode())
        .findFirst();
  }

  /**
   * Delete the pods of an OMJob and return the names of the pods deleted. Pods are found by label,
   * plus any pod recorded in the OMJob status that the label lookup missed.
   */
  public List<String> deletePods(OMJobResource omJob) {
    LOG.info("Deleting pods for OMJob: {}", omJob.getMetadata().getName());
    List<String> labelledPodNames = findPodNames(omJob, LabelBuilder.buildPodSelector(omJob));
    List<String> deletedPodNames = new ArrayList<>(deletePodsByName(omJob, labelledPodNames));
    deletedPodNames.addAll(deleteRecordedPodsMissedByLabels(omJob, labelledPodNames));
    if (deletedPodNames.isEmpty()) {
      LOG.debug("No pods left to delete for OMJob: {}", omJob.getMetadata().getName());
    }
    return List.copyOf(deletedPodNames);
  }

  /**
   * Safety net for pods whose labels stopped matching the selector, which once left every
   * finished pod behind. Deleting anything here means the labels have drifted again.
   */
  private List<String> deleteRecordedPodsMissedByLabels(
      OMJobResource omJob, List<String> labelledPodNames) {
    List<String> missedPodNames =
        recordedPodNames(omJob).stream().filter(name -> !labelledPodNames.contains(name)).toList();
    List<String> deletedPodNames = deletePodsByName(omJob, missedPodNames);
    if (!deletedPodNames.isEmpty()) {
      LOG.warn(
          "Deleted pods {} of OMJob {} by their recorded names: their labels do not match {}",
          deletedPodNames,
          omJob.getMetadata().getName(),
          LabelBuilder.buildPodSelector(omJob));
    }
    return deletedPodNames;
  }

  private List<String> recordedPodNames(OMJobResource omJob) {
    OMJobStatus status = omJob.getStatus();
    if (status == null) {
      return List.of();
    }
    return Stream.of(status.getMainPodName(), status.getExitHandlerPodName())
        .filter(podName -> !nullOrEmpty(podName))
        .toList();
  }

  private List<String> findPodNames(OMJobResource omJob, Map<String, String> selector) {
    try {
      return client
          .pods()
          .inNamespace(omJob.getMetadata().getNamespace())
          .withLabels(selector)
          .list()
          .getItems()
          .stream()
          .map(pod -> pod.getMetadata().getName())
          .toList();
    } catch (KubernetesClientException e) {
      LOG.warn("Failed to list pods for OMJob: {}", omJob.getMetadata().getName(), e);
      return List.of();
    }
  }

  private List<String> deletePodsByName(OMJobResource omJob, List<String> podNames) {
    return podNames.stream().filter(podName -> deletePod(omJob, podName)).toList();
  }

  private boolean deletePod(OMJobResource omJob, String podName) {
    try {
      boolean deleted =
          !client
              .pods()
              .inNamespace(omJob.getMetadata().getNamespace())
              .withName(podName)
              .delete()
              .isEmpty();
      if (deleted) {
        LOG.info("Deleted pod: {}", podName);
      }
      return deleted;
    } catch (KubernetesClientException e) {
      LOG.warn("Failed to delete pod {} of OMJob {}", podName, omJob.getMetadata().getName(), e);
      return false;
    }
  }

  // Private helper methods

  private Pod buildPod(
      OMJobResource omJob,
      String podName,
      OMJobSpec.OMJobPodSpec podSpec,
      Map<String, String> labels,
      List<EnvVar> envOverride) {
    return new PodBuilder()
        .withMetadata(
            new ObjectMetaBuilder()
                .withName(podName)
                .withNamespace(omJob.getMetadata().getNamespace())
                .withLabels(labels)
                .withAnnotations(podSpec.getAnnotations())
                .withOwnerReferences(buildOwnerReference(omJob))
                .build())
        .withSpec(
            new PodSpecBuilder()
                .withRestartPolicy("Never")
                .withServiceAccountName(podSpec.getServiceAccountName())
                .withImagePullSecrets(podSpec.getImagePullSecrets())
                .withNodeSelector(podSpec.getNodeSelector())
                .withTolerations(podSpec.getTolerations())
                .withSecurityContext(podSpec.getSecurityContext())
                .withContainers(buildContainer(omJob, podSpec, envOverride))
                .build())
        .build();
  }

  private Container buildContainer(
      OMJobResource omJob, OMJobSpec.OMJobPodSpec podSpec, List<EnvVar> envOverride) {
    List<EnvVar> envVars = envOverride != null ? envOverride : podSpec.getEnv();

    // Sanitize environment variables to remove empty valueFrom fields
    List<EnvVar> sanitizedEnvVars = EnvVarUtils.sanitizeEnvVars(envVars);

    return new ContainerBuilder()
        .withName("main")
        .withImage(podSpec.getImage())
        .withImagePullPolicy(podSpec.getImagePullPolicy())
        .withCommand(podSpec.getCommand())
        .withEnv(sanitizedEnvVars)
        .withResources(podSpec.getResources())
        .withSecurityContext(buildContainerSecurityContext(podSpec))
        .build();
  }

  /**
   * Build container security context from pod spec.
   * Uses settings from the CR's pod security context, with secure defaults for
   * container-specific settings not specified at the pod level.
   */
  private SecurityContext buildContainerSecurityContext(OMJobSpec.OMJobPodSpec podSpec) {
    SecurityContextBuilder builder = new SecurityContextBuilder();

    // Use runAsNonRoot and runAsUser from pod security context if available
    if (podSpec.getSecurityContext() != null) {
      PodSecurityContext podSecurity = podSpec.getSecurityContext();
      if (podSecurity.getRunAsNonRoot() != null) {
        builder.withRunAsNonRoot(podSecurity.getRunAsNonRoot());
      }
      if (podSecurity.getRunAsUser() != null) {
        builder.withRunAsUser(podSecurity.getRunAsUser());
      }
      if (podSecurity.getRunAsGroup() != null) {
        builder.withRunAsGroup(podSecurity.getRunAsGroup());
      }
    }

    // Always apply secure container-specific defaults
    builder
        .withAllowPrivilegeEscalation(false)
        .withReadOnlyRootFilesystem(false) // Ingestion may need to write temp files
        .withCapabilities(new CapabilitiesBuilder().withDrop("ALL").build());

    return builder.build();
  }

  private List<OwnerReference> buildOwnerReference(OMJobResource omJob) {
    return List.of(
        new OwnerReferenceBuilder()
            .withApiVersion(omJob.getApiVersion())
            .withKind(omJob.getKind())
            .withName(omJob.getMetadata().getName())
            .withUid(omJob.getMetadata().getUid())
            .withController(true)
            .withBlockOwnerDeletion(true)
            .build());
  }

  private Optional<Pod> findPod(OMJobResource omJob, Map<String, String> selector) {
    try {
      List<Pod> pods =
          client
              .pods()
              .inNamespace(omJob.getMetadata().getNamespace())
              .withLabels(selector)
              .list()
              .getItems();

      return pods.stream().findFirst();

    } catch (Exception e) {
      LOG.warn(
          "Failed to find pod for OMJob: {} with selector: {}",
          omJob.getMetadata().getName(),
          selector,
          e);
      return Optional.empty();
    }
  }

  private String generateMainPodName(OMJobResource omJob) {
    return buildPodName(omJob, "-main");
  }

  private String generateExitHandlerPodName(OMJobResource omJob) {
    return buildPodName(omJob, "-exit");
  }

  private String buildPodName(OMJobResource omJob, String suffix) {
    // Kubernetes pod names can be up to 253 characters (DNS subdomain limit).
    // The OMJob name label is derived from omJob.getMetadata().getName()
    // and sanitized by LabelBuilder to satisfy the separate 63-character label limit.
    // It is not derived from the generated pod name.
    String baseName = omJob.getMetadata().getName();

    // Account for suffix length when calculating max base name length.
    int maxBaseLength = MAX_POD_NAME_LENGTH - suffix.length();
    String podName =
        KubernetesNameBuilder.fitNameWithHash(baseName, maxBaseLength, "omjob") + suffix;

    // Log a warning if the original name was truncated to fit the DNS subdomain limit.
    if (!podName.equals(omJob.getMetadata().getName() + suffix)) {
      LOG.warn(
          "Pod name for OMJob {} was truncated from {} to {} to comply with Kubernetes DNS name length limits",
          omJob.getMetadata().getName(),
          omJob.getMetadata().getName() + suffix,
          podName);
    }

    return podName;
  }

  private String determinePipelineStatus(OMJobResource omJob) {
    OMJobStatus status = omJob.getStatus();
    if (status == null || status.getMainPodExitCode() == null) {
      return PipelineStatusType.FAILED.value();
    }
    return status.getMainPodExitCode() == 0
        ? PipelineStatusType.SUCCESS.value()
        : PipelineStatusType.FAILED.value();
  }
}
