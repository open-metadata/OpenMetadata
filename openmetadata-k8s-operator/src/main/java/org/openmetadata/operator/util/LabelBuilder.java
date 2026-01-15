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

package org.openmetadata.operator.util;

import java.util.HashMap;
import java.util.Map;
import org.openmetadata.operator.model.OMJobResource;

/**
 * Utility for building consistent Kubernetes labels and selectors.
 *
 * This ensures all pods and resources created by the operator have
 * consistent labeling for tracking and cleanup.
 */
public class LabelBuilder {

  // Standard Kubernetes labels
  public static final String LABEL_APP_NAME = "app.kubernetes.io/name";
  public static final String LABEL_APP_COMPONENT = "app.kubernetes.io/component";
  public static final String LABEL_APP_MANAGED_BY = "app.kubernetes.io/managed-by";
  public static final String LABEL_APP_PIPELINE = "app.kubernetes.io/pipeline";
  public static final String LABEL_APP_RUN_ID = "app.kubernetes.io/run-id";

  // OMJob-specific labels
  public static final String LABEL_OMJOB_NAME = "omjob.pipelines.openmetadata.org/name";
  public static final String LABEL_POD_TYPE = "omjob.pipelines.openmetadata.org/pod-type";

  // Values
  public static final String APP_NAME = "openmetadata";
  public static final String COMPONENT_INGESTION = "ingestion";
  public static final String MANAGED_BY_OMJOB_OPERATOR = "omjob-operator";
  public static final String POD_TYPE_MAIN = "main";
  public static final String POD_TYPE_EXIT_HANDLER = "exit-handler";

  private LabelBuilder() {
    // Utility class
  }

  /**
   * Build standard labels for OMJob-related resources
   */
  public static Map<String, String> buildBaseLabels(OMJobResource omJob) {
    Map<String, String> labels = new HashMap<>();

    labels.put(LABEL_APP_NAME, APP_NAME);
    labels.put(LABEL_APP_COMPONENT, COMPONENT_INGESTION);
    labels.put(LABEL_APP_MANAGED_BY, MANAGED_BY_OMJOB_OPERATOR);
    labels.put(LABEL_OMJOB_NAME, omJob.getMetadata().getName());

    // Copy pipeline and run-id from OMJob labels
    String pipelineName = omJob.getPipelineName();
    if (pipelineName != null) {
      labels.put(LABEL_APP_PIPELINE, pipelineName);
    }

    String runId = omJob.getRunId();
    if (runId != null) {
      labels.put(LABEL_APP_RUN_ID, runId);
    }

    return labels;
  }

  /**
   * Build labels for main ingestion pod
   */
  public static Map<String, String> buildMainPodLabels(OMJobResource omJob) {
    Map<String, String> labels = buildBaseLabels(omJob);
    labels.put(LABEL_POD_TYPE, POD_TYPE_MAIN);

    // Add any additional labels from OMJob spec
    if (omJob.getSpec() != null && omJob.getSpec().getMainPodSpec() != null) {
      Map<String, String> additionalLabels = omJob.getSpec().getMainPodSpec().getLabels();
      if (additionalLabels != null) {
        labels.putAll(additionalLabels);
      }
    }

    return labels;
  }

  /**
   * Build labels for exit handler pod
   */
  public static Map<String, String> buildExitHandlerLabels(OMJobResource omJob) {
    Map<String, String> labels = buildBaseLabels(omJob);
    labels.put(LABEL_POD_TYPE, POD_TYPE_EXIT_HANDLER);

    // Add any additional labels from OMJob spec
    if (omJob.getSpec() != null && omJob.getSpec().getExitHandlerSpec() != null) {
      Map<String, String> additionalLabels = omJob.getSpec().getExitHandlerSpec().getLabels();
      if (additionalLabels != null) {
        labels.putAll(additionalLabels);
      }
    }

    return labels;
  }

  /**
   * Build selector for finding pods belonging to an OMJob
   */
  public static Map<String, String> buildPodSelector(OMJobResource omJob) {
    Map<String, String> selector = new HashMap<>();
    selector.put(LABEL_OMJOB_NAME, omJob.getMetadata().getName());
    selector.put(LABEL_APP_MANAGED_BY, MANAGED_BY_OMJOB_OPERATOR);
    return selector;
  }

  /**
   * Build selector for finding main pod
   */
  public static Map<String, String> buildMainPodSelector(OMJobResource omJob) {
    Map<String, String> selector = buildPodSelector(omJob);
    selector.put(LABEL_POD_TYPE, POD_TYPE_MAIN);
    return selector;
  }

  /**
   * Build selector for finding exit handler pod
   */
  public static Map<String, String> buildExitHandlerSelector(OMJobResource omJob) {
    Map<String, String> selector = buildPodSelector(omJob);
    selector.put(LABEL_POD_TYPE, POD_TYPE_EXIT_HANDLER);
    return selector;
  }

  /**
   * Sanitize label value to be Kubernetes-compliant
   */
  public static String sanitizeLabelValue(String value) {
    if (value == null || value.isEmpty()) {
      return "";
    }

    // Replace invalid characters with hyphens and truncate to 63 chars
    String sanitized =
        value.replaceAll("[^a-zA-Z0-9\\-_.]", "-").replaceAll("-+", "-").replaceAll("^-|-$", "");

    return sanitized.length() > 63 ? sanitized.substring(0, 63) : sanitized;
  }
}
