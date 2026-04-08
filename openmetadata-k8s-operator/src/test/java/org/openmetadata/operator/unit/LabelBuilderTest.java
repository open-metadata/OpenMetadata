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

package org.openmetadata.operator.unit;

import static org.junit.jupiter.api.Assertions.*;

import io.fabric8.kubernetes.api.model.ObjectMeta;
import io.fabric8.kubernetes.api.model.ObjectMetaBuilder;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.operator.model.OMJobResource;
import org.openmetadata.operator.util.LabelBuilder;

/**
 * Unit tests for LabelBuilder utility.
 */
class LabelBuilderTest {

  @Test
  void testBuildBaseLabels() {
    OMJobResource omJob = createTestOMJob();
    Map<String, String> labels = LabelBuilder.buildBaseLabels(omJob);

    assertEquals("openmetadata", labels.get("app.kubernetes.io/name"));
    assertEquals("ingestion", labels.get("app.kubernetes.io/component"));
    assertEquals("omjob-operator", labels.get("app.kubernetes.io/managed-by"));
    assertEquals("test-omjob", labels.get("omjob.pipelines.openmetadata.org/name"));
    assertEquals("mysql-pipeline", labels.get("app.kubernetes.io/pipeline"));
    assertEquals("run-12345", labels.get("app.kubernetes.io/run-id"));
  }

  @Test
  void testBuildMainPodLabels() {
    OMJobResource omJob = createTestOMJob();
    Map<String, String> labels = LabelBuilder.buildMainPodLabels(omJob);

    assertTrue(labels.containsKey("app.kubernetes.io/name"));
    assertEquals("main", labels.get("omjob.pipelines.openmetadata.org/pod-type"));
  }

  @Test
  void testBuildExitHandlerLabels() {
    OMJobResource omJob = createTestOMJob();
    Map<String, String> labels = LabelBuilder.buildExitHandlerLabels(omJob);

    assertTrue(labels.containsKey("app.kubernetes.io/name"));
    assertEquals("exit-handler", labels.get("omjob.pipelines.openmetadata.org/pod-type"));
  }

  @Test
  void testBuildSelectors() {
    OMJobResource omJob = createTestOMJob();

    Map<String, String> podSelector = LabelBuilder.buildPodSelector(omJob);
    assertEquals("test-omjob", podSelector.get("omjob.pipelines.openmetadata.org/name"));
    assertEquals("omjob-operator", podSelector.get("app.kubernetes.io/managed-by"));

    Map<String, String> mainSelector = LabelBuilder.buildMainPodSelector(omJob);
    assertTrue(mainSelector.entrySet().containsAll(podSelector.entrySet()));
    assertEquals("main", mainSelector.get("omjob.pipelines.openmetadata.org/pod-type"));

    Map<String, String> exitSelector = LabelBuilder.buildExitHandlerSelector(omJob);
    assertTrue(exitSelector.entrySet().containsAll(podSelector.entrySet()));
    assertEquals("exit-handler", exitSelector.get("omjob.pipelines.openmetadata.org/pod-type"));
  }

  @Test
  void testSanitizeLabelValue() {
    assertEquals("", LabelBuilder.sanitizeLabelValue(null));
    assertEquals("", LabelBuilder.sanitizeLabelValue(""));
    assertEquals("simple-value", LabelBuilder.sanitizeLabelValue("simple-value"));
    assertEquals("special-chars", LabelBuilder.sanitizeLabelValue("special@#$%chars"));
    assertEquals("multiple-dashes", LabelBuilder.sanitizeLabelValue("multiple---dashes"));
    assertEquals("no-leading-trailing", LabelBuilder.sanitizeLabelValue("-no-leading-trailing-"));

    // Test truncation (> 63 chars)
    String longValue = "a".repeat(70);
    String sanitized = LabelBuilder.sanitizeLabelValue(longValue);
    assertTrue(sanitized.length() <= 63,
        "Sanitized value must be <= 63 chars, got: " + sanitized.length());
  }

  private OMJobResource createTestOMJob() {
    OMJobResource omJob = new OMJobResource();

    ObjectMeta metadata =
        new ObjectMetaBuilder()
            .withName("test-omjob")
            .withNamespace("test-namespace")
            .withLabels(
                Map.of(
                    "app.kubernetes.io/pipeline", "mysql-pipeline",
                    "app.kubernetes.io/run-id", "run-12345"))
            .build();

    omJob.setMetadata(metadata);
    return omJob;
  }

  private OMJobResource createTestOMJob(String name) {
    OMJobResource omJob = new OMJobResource();

    ObjectMeta metadata =
        new ObjectMetaBuilder()
            .withName(name)
            .withNamespace("test-namespace")
            .withLabels(
                Map.of(
                    "app.kubernetes.io/pipeline", "mysql-pipeline",
                    "app.kubernetes.io/run-id", "run-12345"))
            .build();

    omJob.setMetadata(metadata);
    return omJob;
  }

  // --- New tests for hash-preserving truncation (issue #27004) ---

  @Test
  void testSanitizeLabelValue_shortName_unchanged() {
    String input = "my-pipeline-name";
    String result = LabelBuilder.sanitizeLabelValue(input);
    assertEquals(input, result);
  }

  @Test
  void testSanitizeLabelValue_exactly63Chars_unchanged() {
    String input = "a".repeat(63);
    String result = LabelBuilder.sanitizeLabelValue(input);
    assertEquals(63, result.length());
    assertEquals(input, result);
  }

  @Test
  void testSanitizeLabelValue_longName_truncatedTo63() {
    String input = "om-job-data-mart-warehouse-production-metadata-jwef2ikn-ada040a6";
    String result = LabelBuilder.sanitizeLabelValue(input);
    assertTrue(
        result.length() <= 63,
        "Label value must be <= 63 chars, got: " + result.length());
  }

  @Test
  void testSanitizeLabelValue_longName_endsWithAlphanumeric() {
    String input = "om-job-data-mart-warehouse-production-metadata-jwef2ikn-ada040a6";
    String result = LabelBuilder.sanitizeLabelValue(input);
    assertTrue(
        result.matches(".*[a-zA-Z0-9]$"),
        "Label value must end with alphanumeric, got: " + result);
  }

  @Test
  void testSanitizeLabelValue_deterministic() {
    String input = "om-job-data-mart-warehouse-production-metadata-jwef2ikn-ada040a6";
    String result1 = LabelBuilder.sanitizeLabelValue(input);
    String result2 = LabelBuilder.sanitizeLabelValue(input);
    assertEquals(result1, result2, "Same input must always produce same output");
  }

  @Test
  void testSanitizeLabelValue_differentLongNames_differentOutputs() {
    String input1 = "om-job-data-mart-warehouse-production-metadata-pipeline-alpha-01";
    String input2 = "om-job-data-mart-warehouse-production-metadata-pipeline-beta-02";
    String result1 = LabelBuilder.sanitizeLabelValue(input1);
    String result2 = LabelBuilder.sanitizeLabelValue(input2);
    assertNotEquals(
        result1, result2, "Different long names must not collide after truncation");
  }

  @Test
  void testBuildBaseLabels_longName_labelsAreValid() {
    String longName =
        "om-job-data-mart-warehouse-production-metadata-jwef2ikn-ada040a6";
    OMJobResource omJob = createTestOMJob(longName);

    Map<String, String> labels = LabelBuilder.buildBaseLabels(omJob);

    String nameLabel = labels.get(LabelBuilder.LABEL_OMJOB_NAME);
    assertNotNull(nameLabel);
    assertTrue(
        nameLabel.length() <= 63,
        "LABEL_OMJOB_NAME must be <= 63 chars, got: " + nameLabel.length());
    assertTrue(
        nameLabel.matches("[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?"),
        "LABEL_OMJOB_NAME must match K8s label value regex");
  }

  @Test
  void testBuildPodSelector_longName_matchesBuildBaseLabels() {
    String longName =
        "om-job-data-mart-warehouse-production-metadata-jwef2ikn-ada040a6";
    OMJobResource omJob = createTestOMJob(longName);

    Map<String, String> labels = LabelBuilder.buildBaseLabels(omJob);
    Map<String, String> selector = LabelBuilder.buildPodSelector(omJob);

    assertEquals(
        labels.get(LabelBuilder.LABEL_OMJOB_NAME),
        selector.get(LabelBuilder.LABEL_OMJOB_NAME),
        "Label value and selector value MUST match for pod lookup to work");
  }

  @Test
  void testSanitizeLabelValue_nullInput_returnsEmpty() {
    assertEquals("", LabelBuilder.sanitizeLabelValue(null));
  }

  @Test
  void testSanitizeLabelValue_emptyInput_returnsEmpty() {
    assertEquals("", LabelBuilder.sanitizeLabelValue(""));
  }

  @Test
  void testSanitizeLabelValue_startsWithDot_strippedToAlphanumeric() {
    String input = ".starts-with-dot";
    String result = LabelBuilder.sanitizeLabelValue(input);
    assertTrue(
        result.matches("[a-zA-Z0-9].*"),
        "Result must start with alphanumeric, got: " + result);
    assertFalse(result.isEmpty(), "Result must not be empty");
  }

  @Test
  void testSanitizeLabelValue_startsWithUnderscore_strippedToAlphanumeric() {
    String input = "_starts-with-underscore";
    String result = LabelBuilder.sanitizeLabelValue(input);
    assertTrue(
        result.matches("[a-zA-Z0-9].*"),
        "Result must start with alphanumeric, got: " + result);
    assertFalse(result.isEmpty(), "Result must not be empty");
  }
}
