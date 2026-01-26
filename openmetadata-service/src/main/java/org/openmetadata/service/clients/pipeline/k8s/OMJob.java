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
import java.util.HashMap;
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
    Map<String, Object> metadataMap = new HashMap<>();
    metadataMap.put("name", metadata.getName());
    metadataMap.put("namespace", metadata.getNamespace());
    metadataMap.put("labels", metadata.getLabels() != null ? metadata.getLabels() : Map.of());
    metadataMap.put(
        "annotations", metadata.getAnnotations() != null ? metadata.getAnnotations() : Map.of());

    return Map.of(
        "apiVersion", apiVersion,
        "kind", kind,
        "metadata", metadataMap,
        "spec", buildSpecMap());
  }

  private Map<String, Object> buildSpecMap() {
    Map<String, Object> specMap = new HashMap<>();
    specMap.put("mainPodSpec", K8sJobUtils.buildPodSpecMap(spec.getMainPodSpec()));
    specMap.put("exitHandlerSpec", K8sJobUtils.buildPodSpecMap(spec.getExitHandlerSpec()));
    specMap.put("ttlSecondsAfterFinished", spec.getTtlSecondsAfterFinished());
    return specMap;
  }
}
