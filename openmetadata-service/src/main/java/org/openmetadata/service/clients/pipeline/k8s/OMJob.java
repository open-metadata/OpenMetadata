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

import io.kubernetes.client.openapi.models.V1EnvVar;
import io.kubernetes.client.openapi.models.V1LocalObjectReference;
import io.kubernetes.client.openapi.models.V1PodSecurityContext;
import io.kubernetes.client.openapi.models.V1ResourceRequirements;
import java.util.List;
import java.util.Map;
import lombok.Builder;
import lombok.Data;

/**
 * OMJob Custom Resource model for OpenMetadata pipeline jobs.
 * This resource ensures guaranteed exit handler execution for all termination scenarios.
 */
@Data
@Builder
public class OMJob {

  // Standard Kubernetes metadata
  private String apiVersion;
  private String kind;
  private OMJobMetadata metadata;
  private OMJobSpec spec;
  private OMJobStatus status;

  @Data
  @Builder
  public static class OMJobMetadata {
    private String name;
    private String namespace;
    private Map<String, String> labels;
    private Map<String, String> annotations;
  }

  @Data
  @Builder
  public static class OMJobSpec {
    private OMJobPodSpec mainPodSpec;
    private OMJobPodSpec exitHandlerSpec;
    private Integer ttlSecondsAfterFinished;
  }

  @Data
  @Builder
  public static class OMJobPodSpec {
    private String image;
    private String imagePullPolicy;
    private List<V1LocalObjectReference> imagePullSecrets;
    private String serviceAccountName;
    private List<String> command;
    private List<V1EnvVar> env;
    private V1ResourceRequirements resources;
    private Map<String, String> nodeSelector;
    private V1PodSecurityContext securityContext;
    private Map<String, String> labels;
    private Map<String, String> annotations;
  }

  @Data
  @Builder
  public static class OMJobStatus {
    private String phase; // Pending, Running, ExitHandlerRunning, Succeeded, Failed
    private String mainPodName;
    private String exitHandlerPodName;
    private String startTime;
    private String completionTime;
    private String message;
    private Integer mainPodExitCode;
  }

  /**
   * Create a default OMJob instance
   */
  public static OMJob createDefault() {
    return OMJob.builder().apiVersion("pipelines.openmetadata.org/v1").kind("OMJob").build();
  }

  /**
   * Convert OMJob to a Map for Kubernetes API
   */
  public Map<String, Object> toMap() {
    return Map.of(
        "apiVersion",
        apiVersion,
        "kind",
        kind,
        "metadata",
        Map.of(
            "name",
            metadata.getName(),
            "namespace",
            metadata.getNamespace(),
            "labels",
            metadata.getLabels() != null ? metadata.getLabels() : Map.of(),
            "annotations",
            metadata.getAnnotations() != null ? metadata.getAnnotations() : Map.of()),
        "spec",
        buildSpecMap());
  }

  private Map<String, Object> buildSpecMap() {
    var specMap = new java.util.HashMap<String, Object>();

    // Main pod spec
    specMap.put("mainPodSpec", buildPodSpecMap(spec.getMainPodSpec()));

    // Exit handler spec
    specMap.put("exitHandlerSpec", buildPodSpecMap(spec.getExitHandlerSpec()));

    // TTL
    specMap.put("ttlSecondsAfterFinished", spec.getTtlSecondsAfterFinished());

    return specMap;
  }

  private Map<String, Object> buildPodSpecMap(OMJobPodSpec podSpec) {
    var podSpecMap = new java.util.HashMap<String, Object>();

    podSpecMap.put("image", podSpec.getImage());
    podSpecMap.put("imagePullPolicy", podSpec.getImagePullPolicy());
    podSpecMap.put("command", podSpec.getCommand());
    podSpecMap.put("env", podSpec.getEnv());

    if (podSpec.getServiceAccountName() != null) {
      podSpecMap.put("serviceAccountName", podSpec.getServiceAccountName());
    }
    if (podSpec.getResources() != null) {
      podSpecMap.put("resources", podSpec.getResources());
    }
    if (podSpec.getImagePullSecrets() != null && !podSpec.getImagePullSecrets().isEmpty()) {
      podSpecMap.put("imagePullSecrets", podSpec.getImagePullSecrets());
    }
    if (podSpec.getNodeSelector() != null && !podSpec.getNodeSelector().isEmpty()) {
      podSpecMap.put("nodeSelector", podSpec.getNodeSelector());
    }
    if (podSpec.getSecurityContext() != null) {
      podSpecMap.put("securityContext", podSpec.getSecurityContext());
    }
    if (podSpec.getLabels() != null && !podSpec.getLabels().isEmpty()) {
      podSpecMap.put("labels", podSpec.getLabels());
    }
    if (podSpec.getAnnotations() != null && !podSpec.getAnnotations().isEmpty()) {
      podSpecMap.put("annotations", podSpec.getAnnotations());
    }

    return podSpecMap;
  }
}
