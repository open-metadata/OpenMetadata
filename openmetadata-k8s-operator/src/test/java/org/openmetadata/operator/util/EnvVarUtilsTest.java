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

import static org.junit.jupiter.api.Assertions.*;

import io.fabric8.kubernetes.api.model.ConfigMapKeySelectorBuilder;
import io.fabric8.kubernetes.api.model.EnvVar;
import io.fabric8.kubernetes.api.model.EnvVarBuilder;
import io.fabric8.kubernetes.api.model.EnvVarSource;
import io.fabric8.kubernetes.api.model.EnvVarSourceBuilder;
import io.fabric8.kubernetes.api.model.SecretKeySelectorBuilder;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Test suite for EnvVarUtils.
 * Ensures proper handling of empty valueFrom fields that cause pod creation failures.
 */
class EnvVarUtilsTest {

  @Test
  void testSanitizeEnvVarsWithNull() {
    assertNull(EnvVarUtils.sanitizeEnvVars(null));
  }

  @Test
  void testSanitizeEnvVarsWithEmptyList() {
    List<EnvVar> result = EnvVarUtils.sanitizeEnvVars(List.of());
    assertNotNull(result);
    assertTrue(result.isEmpty());
  }

  @Test
  void testSanitizeEnvVarsWithSimpleValue() {
    EnvVar envVar = new EnvVarBuilder().withName("SIMPLE_VAR").withValue("simple_value").build();

    List<EnvVar> result = EnvVarUtils.sanitizeEnvVars(List.of(envVar));

    assertEquals(1, result.size());
    assertEquals("SIMPLE_VAR", result.get(0).getName());
    assertEquals("simple_value", result.get(0).getValue());
    assertNull(result.get(0).getValueFrom());
  }

  @Test
  void testSanitizeEnvVarsWithEmptyValueFrom() {
    // This is the critical test case that causes the pod creation failure
    EnvVar envVar =
        new EnvVarBuilder()
            .withName("CONFIG")
            .withValueFrom(new EnvVarSource()) // Empty valueFrom - causes K8s API error
            .build();

    List<EnvVar> result = EnvVarUtils.sanitizeEnvVars(List.of(envVar));

    assertEquals(1, result.size());
    assertEquals("CONFIG", result.get(0).getName());
    assertNull(result.get(0).getValueFrom(), "Empty valueFrom should be removed");
    assertNull(result.get(0).getValue());
  }

  @Test
  void testSanitizeEnvVarsWithValidConfigMapKeyRef() {
    EnvVar envVar =
        new EnvVarBuilder()
            .withName("CONFIG")
            .withValueFrom(
                new EnvVarSourceBuilder()
                    .withConfigMapKeyRef(
                        new ConfigMapKeySelectorBuilder()
                            .withName("om-config-test")
                            .withKey("config")
                            .build())
                    .build())
            .build();

    List<EnvVar> result = EnvVarUtils.sanitizeEnvVars(List.of(envVar));

    assertEquals(1, result.size());
    assertEquals("CONFIG", result.get(0).getName());
    assertNotNull(result.get(0).getValueFrom());
    assertNotNull(result.get(0).getValueFrom().getConfigMapKeyRef());
    assertEquals("om-config-test", result.get(0).getValueFrom().getConfigMapKeyRef().getName());
  }

  @Test
  void testSanitizeEnvVarsWithValidSecretKeyRef() {
    EnvVar envVar =
        new EnvVarBuilder()
            .withName("PASSWORD")
            .withValueFrom(
                new EnvVarSourceBuilder()
                    .withSecretKeyRef(
                        new SecretKeySelectorBuilder()
                            .withName("db-secret")
                            .withKey("password")
                            .build())
                    .build())
            .build();

    List<EnvVar> result = EnvVarUtils.sanitizeEnvVars(List.of(envVar));

    assertEquals(1, result.size());
    assertEquals("PASSWORD", result.get(0).getName());
    assertNotNull(result.get(0).getValueFrom());
    assertNotNull(result.get(0).getValueFrom().getSecretKeyRef());
    assertEquals("db-secret", result.get(0).getValueFrom().getSecretKeyRef().getName());
  }

  @Test
  void testSanitizeEnvVarsWithMixedTypes() {
    List<EnvVar> envVars =
        Arrays.asList(
            new EnvVarBuilder().withName("SIMPLE").withValue("value").build(),
            new EnvVarBuilder()
                .withName("EMPTY_VALUE_FROM")
                .withValueFrom(new EnvVarSource()) // Empty - should be removed
                .build(),
            new EnvVarBuilder()
                .withName("CONFIG_REF")
                .withValueFrom(
                    new EnvVarSourceBuilder()
                        .withConfigMapKeyRef(
                            new ConfigMapKeySelectorBuilder()
                                .withName("config")
                                .withKey("key")
                                .build())
                        .build())
                .build());

    List<EnvVar> result = EnvVarUtils.sanitizeEnvVars(envVars);

    assertEquals(3, result.size());

    // Simple value unchanged
    assertEquals("SIMPLE", result.get(0).getName());
    assertEquals("value", result.get(0).getValue());

    // Empty valueFrom removed
    assertEquals("EMPTY_VALUE_FROM", result.get(1).getName());
    assertNull(result.get(1).getValueFrom());

    // Valid configMapKeyRef unchanged
    assertEquals("CONFIG_REF", result.get(2).getName());
    assertNotNull(result.get(2).getValueFrom());
    assertNotNull(result.get(2).getValueFrom().getConfigMapKeyRef());
  }

  @Test
  void testValidateEnvVarsWithValidVars() {
    List<EnvVar> envVars =
        Arrays.asList(
            new EnvVarBuilder().withName("VAR1").withValue("value1").build(),
            new EnvVarBuilder()
                .withName("VAR2")
                .withValueFrom(
                    new EnvVarSourceBuilder()
                        .withConfigMapKeyRef(
                            new ConfigMapKeySelectorBuilder()
                                .withName("config")
                                .withKey("key")
                                .build())
                        .build())
                .build());

    assertTrue(EnvVarUtils.validateEnvVars(envVars));
  }

  @Test
  void testValidateEnvVarsWithEmptyValueFrom() {
    List<EnvVar> envVars =
        List.of(
            new EnvVarBuilder()
                .withName("INVALID")
                .withValueFrom(new EnvVarSource()) // Empty valueFrom is invalid
                .build());

    assertFalse(EnvVarUtils.validateEnvVars(envVars));
  }

  @Test
  void testValidateEnvVarsWithBothValueAndValueFrom() {
    List<EnvVar> envVars =
        List.of(
            new EnvVarBuilder()
                .withName("INVALID")
                .withValue("value")
                .withValueFrom(
                    new EnvVarSourceBuilder()
                        .withConfigMapKeyRef(
                            new ConfigMapKeySelectorBuilder()
                                .withName("config")
                                .withKey("key")
                                .build())
                        .build())
                .build());

    assertFalse(EnvVarUtils.validateEnvVars(envVars));
  }

  @Test
  void testValidateEnvVarsWithMissingName() {
    List<EnvVar> envVars = List.of(new EnvVarBuilder().withValue("value").build());

    assertFalse(EnvVarUtils.validateEnvVars(envVars));
  }

  @Test
  void testRealWorldScenarioFromFailedCronOMJob() {
    // This recreates the exact scenario from the failed CronOMJob
    List<EnvVar> envVars =
        Arrays.asList(
            new EnvVarBuilder().withName("pipelineType").withValue("metadata").build(),
            new EnvVarBuilder().withName("pipelineRunId").withValue("scheduled").build(),
            new EnvVarBuilder()
                .withName("ingestionPipelineFQN")
                .withValue("pg1.f755d344-03e8-4fef-a168-a9c8bdff52ce")
                .build(),
            new EnvVarBuilder()
                .withName("config")
                .withValueFrom(new EnvVarSource()) // Empty valueFrom that caused the failure
                .build(),
            new EnvVarBuilder()
                .withName("jobName")
                .withValue("om-cronomjob-f755d344-03e8-4fef-a168-a9c8bdff52ce")
                .build(),
            new EnvVarBuilder()
                .withName("namespace")
                .withValue("openmetadata-pipelines-test")
                .build());

    // Before sanitization - validation should fail
    assertFalse(EnvVarUtils.validateEnvVars(envVars), "Original env vars should be invalid");

    // After sanitization
    List<EnvVar> sanitized = EnvVarUtils.sanitizeEnvVars(envVars);

    // Should pass validation now
    assertTrue(EnvVarUtils.validateEnvVars(sanitized), "Sanitized env vars should be valid");

    // Check that all vars are present
    assertEquals(6, sanitized.size());

    // Check that the problematic config var has been fixed
    EnvVar configVar =
        sanitized.stream().filter(e -> "config".equals(e.getName())).findFirst().orElseThrow();

    assertEquals("config", configVar.getName());
    assertNull(configVar.getValueFrom(), "Empty valueFrom should be removed");
    assertNull(configVar.getValue());
  }
}
