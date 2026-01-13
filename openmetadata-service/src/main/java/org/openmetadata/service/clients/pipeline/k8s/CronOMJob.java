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

import java.util.HashMap;
import java.util.Map;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CronOMJob {

  private String apiVersion;
  private String kind;
  private CronOMJobMetadata metadata;
  private CronOMJobSpec spec;

  @Data
  @Builder
  public static class CronOMJobMetadata {
    private String name;
    private String namespace;
    private Map<String, String> labels;
    private Map<String, String> annotations;
    private String resourceVersion;
  }

  @Data
  @Builder
  public static class CronOMJobSpec {
    private String schedule;
    private String timeZone;
    private Boolean suspend;
    private Integer startingDeadlineSeconds;
    private Integer successfulJobsHistoryLimit;
    private Integer failedJobsHistoryLimit;
    private OMJob.OMJobSpec omJobSpec;
  }

  public Map<String, Object> toMap() {
    return Map.of(
        "apiVersion",
        apiVersion,
        "kind",
        kind,
        "metadata",
        buildMetadataMap(),
        "spec",
        buildSpecMap());
  }

  private Map<String, Object> buildMetadataMap() {
    Map<String, Object> metadataMap = new HashMap<>();
    metadataMap.put("name", metadata.getName());
    metadataMap.put("namespace", metadata.getNamespace());
    metadataMap.put("labels", metadata.getLabels() != null ? metadata.getLabels() : Map.of());
    metadataMap.put(
        "annotations", metadata.getAnnotations() != null ? metadata.getAnnotations() : Map.of());
    if (metadata.getResourceVersion() != null) {
      metadataMap.put("resourceVersion", metadata.getResourceVersion());
    }
    return metadataMap;
  }

  private Map<String, Object> buildSpecMap() {
    Map<String, Object> specMap = new HashMap<>();
    specMap.put("schedule", spec.getSchedule());
    if (spec.getTimeZone() != null) {
      specMap.put("timeZone", spec.getTimeZone());
    }
    if (spec.getSuspend() != null) {
      specMap.put("suspend", spec.getSuspend());
    }
    if (spec.getStartingDeadlineSeconds() != null) {
      specMap.put("startingDeadlineSeconds", spec.getStartingDeadlineSeconds());
    }
    if (spec.getSuccessfulJobsHistoryLimit() != null) {
      specMap.put("successfulJobsHistoryLimit", spec.getSuccessfulJobsHistoryLimit());
    }
    if (spec.getFailedJobsHistoryLimit() != null) {
      specMap.put("failedJobsHistoryLimit", spec.getFailedJobsHistoryLimit());
    }
    specMap.put("omJobSpec", buildOMJobSpecMap(spec.getOmJobSpec()));
    return specMap;
  }

  private Map<String, Object> buildOMJobSpecMap(OMJob.OMJobSpec omJobSpec) {
    Map<String, Object> omJobSpecMap = new HashMap<>();
    omJobSpecMap.put("mainPodSpec", K8sJobUtils.buildPodSpecMap(omJobSpec.getMainPodSpec()));
    omJobSpecMap.put(
        "exitHandlerSpec", K8sJobUtils.buildPodSpecMap(omJobSpec.getExitHandlerSpec()));
    omJobSpecMap.put("ttlSecondsAfterFinished", omJobSpec.getTtlSecondsAfterFinished());
    return omJobSpecMap;
  }
}
