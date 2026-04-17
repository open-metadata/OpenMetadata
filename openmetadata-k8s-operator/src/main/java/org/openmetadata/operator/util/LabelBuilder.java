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

  private static final int MAX_LABEL_VALUE_LENGTH = 63;

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
    labels.put(LABEL_OMJOB_NAME, buildOMJobNameLabelValue(omJob));

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
    selector.put(LABEL_OMJOB_NAME, buildOMJobNameLabelValue(omJob));
    selector.put(LABEL_APP_MANAGED_BY, MANAGED_BY_OMJOB_OPERATOR);
    return selector;
  }

  /**
   * Build the OMJob name label value used by operator-managed pods.
   */
  public static String buildOMJobNameLabelValue(OMJobResource omJob) {
    return sanitizeLabelValue(omJob.getMetadata().getName());
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

    // Replace invalid characters with hyphens and collapse repeated hyphens.
    // We intentionally keep dots and underscores, as they are allowed in label values.
    String sanitized = value.replaceAll("[^a-zA-Z0-9\\-_.]", "-").replaceAll("-+", "-");

    if (sanitized.length() <= MAX_LABEL_VALUE_LENGTH) {
      // Even for short values, ensure we respect the Kubernetes rule that
      // label values must start and end with an alphanumeric character.
      return ensureValidLabelValue(sanitized, value);
    }

    // For long values, preserve uniqueness by appending a short hash while
    // keeping the overall value within the 63-character limit.
    String hash = HashUtils.hash(value);
    int maxPrefixLength = MAX_LABEL_VALUE_LENGTH - hash.length() - 1;
    String prefix = sanitized.substring(0, maxPrefixLength);

    String candidate = prefix + "-" + hash;
    return ensureValidLabelValue(candidate, value);
  }

  /**
   * Ensure the label value starts and ends with an alphanumeric character.
   * If trimming non-alphanumeric characters from the edges results in an
   * empty string, fall back to a hash-based value derived from the original
   * input so that the label remains valid and stable.
   */
  private static String ensureValidLabelValue(String candidate, String original) {
    String result = candidate.replaceAll("^[^a-zA-Z0-9]+", "").replaceAll("[^a-zA-Z0-9]+$", "");

    if (!result.isEmpty() && result.length() <= MAX_LABEL_VALUE_LENGTH) {
      return result;
    }

    // Fallback: build a short, deterministic value based on a hash of the
    // original input. This guarantees the output is non-empty, starts/ends
    // with an alphanumeric character, and fits within the label limit.
    int maxHashLength = Math.max(1, MAX_LABEL_VALUE_LENGTH - 3); // Reserve for "om-"
    String fullHash = HashUtils.hash(original);
    String hash = fullHash.substring(0, Math.min(maxHashLength, fullHash.length()));
    String fallback = "om-" + hash;

    if (fallback.length() > MAX_LABEL_VALUE_LENGTH) {
      fallback = fallback.substring(0, MAX_LABEL_VALUE_LENGTH);
    }

    return fallback;
  }
}
