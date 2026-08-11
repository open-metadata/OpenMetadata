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
    assertEquals(2, podSelector.size());

    Map<String, String> mainSelector = LabelBuilder.buildMainPodSelector(omJob);
    assertTrue(mainSelector.entrySet().containsAll(podSelector.entrySet()));
    assertEquals("main", mainSelector.get("omjob.pipelines.openmetadata.org/pod-type"));

    Map<String, String> exitSelector = LabelBuilder.buildExitHandlerSelector(omJob);
    assertTrue(exitSelector.entrySet().containsAll(podSelector.entrySet()));
    assertEquals("exit-handler", exitSelector.get("omjob.pipelines.openmetadata.org/pod-type"));
  }

  @Test
  void testBuildBaseLabelsSanitizesLongOMJobName() {
    OMJobResource omJob = createTestOMJobWithName("a".repeat(70));

    Map<String, String> labels = LabelBuilder.buildBaseLabels(omJob);
    Map<String, String> selector = LabelBuilder.buildPodSelector(omJob);

    assertEquals(63, labels.get("omjob.pipelines.openmetadata.org/name").length());
    assertEquals(
        labels.get("omjob.pipelines.openmetadata.org/name"),
        selector.get("omjob.pipelines.openmetadata.org/name"));
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
    assertEquals(63, sanitized.length());
    assertTrue(sanitized.matches("^[a-zA-Z0-9].*[a-zA-Z0-9]$"));

    String truncatedWithTrailingDash =
        LabelBuilder.sanitizeLabelValue("a".repeat(62) + "-invalid-suffix");
    assertFalse(truncatedWithTrailingDash.endsWith("-"));
  }

  @Test
  void testSanitizeLabelValueUsesFallbackForSeparatorOnlyInputs() {
    String dashed = LabelBuilder.sanitizeLabelValue("----");
    String dotted = LabelBuilder.sanitizeLabelValue("...");
    String underscored = LabelBuilder.sanitizeLabelValue("__");

    assertAll(
        () -> assertFalse(dashed.isEmpty()),
        () -> assertTrue(dashed.length() <= 63),
        () -> assertTrue(dashed.matches("^[a-zA-Z0-9].*[a-zA-Z0-9]$")),
        () -> assertFalse(dotted.isEmpty()),
        () -> assertTrue(dotted.length() <= 63),
        () -> assertTrue(dotted.matches("^[a-zA-Z0-9].*[a-zA-Z0-9]$")),
        () -> assertFalse(underscored.isEmpty()),
        () -> assertTrue(underscored.length() <= 63),
        () -> assertTrue(underscored.matches("^[a-zA-Z0-9].*[a-zA-Z0-9]$")));
  }

  @Test
  void testLabelUniqueness() {
    String sharedPrefix = "job-run-" + "1234567890".repeat(6);
    String v1 = sharedPrefix + "-abcdef";
    String v2 = sharedPrefix + "-ghijkl";

    String l1 = LabelBuilder.sanitizeLabelValue(v1);
    String l2 = LabelBuilder.sanitizeLabelValue(v2);

    assertEquals(63, l1.length());
    assertEquals(63, l2.length());
    assertTrue(l1.matches("^[a-zA-Z0-9].*[a-zA-Z0-9]$"));
    assertTrue(l2.matches("^[a-zA-Z0-9].*[a-zA-Z0-9]$"));
    assertNotEquals(l1, l2);
  }

  private OMJobResource createTestOMJob() {
    return createTestOMJobWithName("test-omjob");
  }

  private OMJobResource createTestOMJobWithName(String name) {
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
}
