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

import io.fabric8.kubernetes.api.model.*;
import io.fabric8.kubernetes.client.KubernetesClient;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.openmetadata.operator.model.OMJobResource;
import org.openmetadata.operator.model.OMJobSpec;
import org.openmetadata.operator.model.OMJobStatus;
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

  private final KubernetesClient client;

  public PodManager(KubernetesClient client) {
    this.client = client;
  }

  /**
   * Create main ingestion pod from OMJob specification
   */
  public Pod createMainPod(OMJobResource omJob) {
    LOG.info("Creating main pod for OMJob: {}", omJob.getMetadata().getName());

    OMJobSpec.OMJobPodSpec podSpec = omJob.getSpec().getMainPodSpec();
    String podName = generateMainPodName(omJob);

    Pod pod = buildPod(omJob, podName, podSpec, LabelBuilder.buildMainPodLabels(omJob), null);

    try {
      Pod createdPod =
          client.pods().inNamespace(omJob.getMetadata().getNamespace()).resource(pod).create();

      LOG.info(
          "Created main pod: {} in namespace: {}",
          createdPod.getMetadata().getName(),
          createdPod.getMetadata().getNamespace());

      return createdPod;

    } catch (Exception e) {
      LOG.error("Failed to create main pod for OMJob: {}", omJob.getMetadata().getName(), e);
      throw new RuntimeException("Failed to create main pod", e);
    }
  }

  /**
   * Create exit handler pod from OMJob specification
   */
  public Pod createExitHandlerPod(OMJobResource omJob) {
    LOG.info("Creating exit handler pod for OMJob: {}", omJob.getMetadata().getName());

    OMJobSpec.OMJobPodSpec podSpec = omJob.getSpec().getExitHandlerSpec();
    String podName = generateExitHandlerPodName(omJob);

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
      Pod createdPod =
          client.pods().inNamespace(omJob.getMetadata().getNamespace()).resource(pod).create();

      LOG.info(
          "Created exit handler pod: {} in namespace: {}",
          createdPod.getMetadata().getName(),
          createdPod.getMetadata().getNamespace());

      return createdPod;

    } catch (Exception e) {
      LOG.error(
          "Failed to create exit handler pod for OMJob: {}", omJob.getMetadata().getName(), e);
      throw new RuntimeException("Failed to create exit handler pod", e);
    }
  }

  /**
   * Find main pod for an OMJob
   */
  public Optional<Pod> findMainPod(OMJobResource omJob) {
    // First try with operator-created pod selector
    Optional<Pod> pod = findPod(omJob, LabelBuilder.buildMainPodSelector(omJob));

    if (pod.isPresent()) {
      return pod;
    }

    // If not found, try with server-created pod selector (fallback for compatibility)
    Map<String, String> serverSelector = new HashMap<>();
    serverSelector.put(LabelBuilder.LABEL_OMJOB_NAME, omJob.getMetadata().getName());
    serverSelector.put(LabelBuilder.LABEL_POD_TYPE, LabelBuilder.POD_TYPE_MAIN);
    // Note: server-created pods have app.kubernetes.io/managed-by = openmetadata

    Optional<Pod> serverPod = findPod(omJob, serverSelector);

    if (serverPod.isPresent()) {
      LOG.info("Found server-created main pod for OMJob: {}", omJob.getMetadata().getName());
      return serverPod;
    }

    // Last resort: try to find by pod name if it was recorded in status
    String recordedPodName = omJob.getStatus() != null ? omJob.getStatus().getMainPodName() : null;
    if (recordedPodName != null && !recordedPodName.isEmpty()) {
      try {
        Pod namedPod =
            client
                .pods()
                .inNamespace(omJob.getMetadata().getNamespace())
                .withName(recordedPodName)
                .get();
        if (namedPod != null) {
          LOG.info("Found main pod by name for OMJob: {}", omJob.getMetadata().getName());
          return Optional.of(namedPod);
        }
      } catch (Exception e) {
        LOG.debug("Could not find pod by name {}: {}", recordedPodName, e.getMessage());
      }
    }

    return Optional.empty();
  }

  /**
   * Find exit handler pod for an OMJob
   */
  public Optional<Pod> findExitHandlerPod(OMJobResource omJob) {
    return findPod(omJob, LabelBuilder.buildExitHandlerSelector(omJob));
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
   * Delete pods associated with an OMJob
   */
  public void deletePods(OMJobResource omJob) {
    LOG.info("Deleting pods for OMJob: {}", omJob.getMetadata().getName());

    Map<String, String> selector = LabelBuilder.buildPodSelector(omJob);

    try {
      client.pods().inNamespace(omJob.getMetadata().getNamespace()).withLabels(selector).delete();

      LOG.info("Deleted pods for OMJob: {}", omJob.getMetadata().getName());

    } catch (Exception e) {
      LOG.warn("Failed to delete pods for OMJob: {}", omJob.getMetadata().getName(), e);
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
                .withSecurityContext(podSpec.getSecurityContext())
                .withContainers(buildContainer(podSpec, envOverride))
                .build())
        .build();
  }

  private Container buildContainer(OMJobSpec.OMJobPodSpec podSpec, List<EnvVar> envOverride) {
    return new ContainerBuilder()
        .withName("main")
        .withImage(podSpec.getImage())
        .withImagePullPolicy(podSpec.getImagePullPolicy())
        .withCommand(podSpec.getCommand())
        .withEnv(envOverride != null ? envOverride : podSpec.getEnv())
        .withResources(podSpec.getResources())
        .withSecurityContext(
            new SecurityContextBuilder()
                .withRunAsNonRoot(false) // Allow root user for ingestion image
                .withAllowPrivilegeEscalation(false)
                .withReadOnlyRootFilesystem(false)
                .withCapabilities(new CapabilitiesBuilder().withDrop("ALL").build())
                .build())
        .build();
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
    return omJob.getMetadata().getName() + "-main";
  }

  private String generateExitHandlerPodName(OMJobResource omJob) {
    return omJob.getMetadata().getName() + "-exit";
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
