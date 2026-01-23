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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.kubernetes.client.openapi.models.V1ConfigMapKeySelector;
import io.kubernetes.client.openapi.models.V1EnvVar;
import io.kubernetes.client.openapi.models.V1EnvVarSource;
import io.kubernetes.client.openapi.models.V1SecretKeySelector;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Test environment variable serialization for OMJob to prevent malformed Kubernetes API calls.
 * Ensures OMJob correctly uses K8sJobUtils for consistent serialization.
 */
class OMJobSerializationTest {

  @Test
  void testOMJobToMapWithConfigMapKeyRef() {
    // Test that OMJob properly serializes environment variables with configMapKeyRef
    V1EnvVar configEnvVar =
        new V1EnvVar()
            .name("CONFIG")
            .valueFrom(
                new V1EnvVarSource()
                    .configMapKeyRef(
                        new V1ConfigMapKeySelector()
                            .name("om-config-test-pipeline")
                            .key("config")
                            .optional(false)));

    OMJob.OMJobPodSpec podSpec =
        OMJob.OMJobPodSpec.builder()
            .image("openmetadata/ingestion:test")
            .imagePullPolicy("IfNotPresent")
            .command(List.of("python", "-m", "metadata.ingestion.api.workflow"))
            .env(List.of(configEnvVar))
            .build();

    OMJob omJob =
        OMJob.builder()
            .apiVersion("pipelines.openmetadata.org/v1")
            .kind("OMJob")
            .metadata(
                OMJob.OMJobMetadata.builder()
                    .name("test-omjob")
                    .namespace("test-namespace")
                    .build())
            .spec(
                OMJob.OMJobSpec.builder()
                    .mainPodSpec(podSpec)
                    .exitHandlerSpec(podSpec)
                    .ttlSecondsAfterFinished(3600)
                    .build())
            .build();

    // Convert to Map (what gets sent to Kubernetes API)
    Map<String, Object> omJobMap = omJob.toMap();

    // Verify the structure is correct
    assertNotNull(omJobMap);
    assertEquals("pipelines.openmetadata.org/v1", omJobMap.get("apiVersion"));
    assertEquals("OMJob", omJobMap.get("kind"));

    // Verify metadata
    @SuppressWarnings("unchecked")
    Map<String, Object> metadata = (Map<String, Object>) omJobMap.get("metadata");
    assertEquals("test-omjob", metadata.get("name"));
    assertEquals("test-namespace", metadata.get("namespace"));

    // Verify spec
    @SuppressWarnings("unchecked")
    Map<String, Object> spec = (Map<String, Object>) omJobMap.get("spec");
    assertNotNull(spec);

    // Verify mainPodSpec environment variables
    @SuppressWarnings("unchecked")
    Map<String, Object> mainPodSpecMap = (Map<String, Object>) spec.get("mainPodSpec");
    assertNotNull(mainPodSpecMap);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> envList = (List<Map<String, Object>>) mainPodSpecMap.get("env");
    assertNotNull(envList);
    assertEquals(1, envList.size());

    // Verify environment variable structure
    Map<String, Object> envVar = envList.get(0);
    assertEquals("CONFIG", envVar.get("name"));

    @SuppressWarnings("unchecked")
    Map<String, Object> valueFrom = (Map<String, Object>) envVar.get("valueFrom");
    assertNotNull(valueFrom);

    @SuppressWarnings("unchecked")
    Map<String, Object> configMapKeyRef = (Map<String, Object>) valueFrom.get("configMapKeyRef");
    assertNotNull(configMapKeyRef);
    assertEquals("om-config-test-pipeline", configMapKeyRef.get("name"));
    assertEquals("config", configMapKeyRef.get("key"));
    assertEquals(false, configMapKeyRef.get("optional"));
  }

  @Test
  void testOMJobToMapWithSecretKeyRef() {
    // Test that OMJob properly serializes environment variables with secretKeyRef
    V1EnvVar secretEnvVar =
        new V1EnvVar()
            .name("DATABASE_PASSWORD")
            .valueFrom(
                new V1EnvVarSource()
                    .secretKeyRef(
                        new V1SecretKeySelector()
                            .name("postgres-secrets")
                            .key("password")
                            .optional(true)));

    OMJob.OMJobPodSpec podSpec =
        OMJob.OMJobPodSpec.builder()
            .image("openmetadata/ingestion:test")
            .env(List.of(secretEnvVar))
            .build();

    OMJob omJob =
        OMJob.builder()
            .apiVersion("pipelines.openmetadata.org/v1")
            .kind("OMJob")
            .metadata(
                OMJob.OMJobMetadata.builder()
                    .name("test-omjob")
                    .namespace("test-namespace")
                    .build())
            .spec(OMJob.OMJobSpec.builder().mainPodSpec(podSpec).exitHandlerSpec(podSpec).build())
            .build();

    Map<String, Object> omJobMap = omJob.toMap();

    // Navigate to environment variables
    @SuppressWarnings("unchecked")
    Map<String, Object> spec = (Map<String, Object>) omJobMap.get("spec");
    @SuppressWarnings("unchecked")
    Map<String, Object> mainPodSpecMap = (Map<String, Object>) spec.get("mainPodSpec");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> envList = (List<Map<String, Object>>) mainPodSpecMap.get("env");

    Map<String, Object> envVar = envList.get(0);
    assertEquals("DATABASE_PASSWORD", envVar.get("name"));

    @SuppressWarnings("unchecked")
    Map<String, Object> valueFrom = (Map<String, Object>) envVar.get("valueFrom");
    @SuppressWarnings("unchecked")
    Map<String, Object> secretKeyRef = (Map<String, Object>) valueFrom.get("secretKeyRef");

    assertEquals("postgres-secrets", secretKeyRef.get("name"));
    assertEquals("password", secretKeyRef.get("key"));
    assertEquals(true, secretKeyRef.get("optional"));
  }

  @Test
  void testOMJobToMapWithExitHandlerEnvironmentVariables() {
    // Test that both main and exit handler pod specs properly serialize environment variables
    V1EnvVar mainEnvVar =
        new V1EnvVar()
            .name("MAIN_CONFIG")
            .valueFrom(
                new V1EnvVarSource()
                    .configMapKeyRef(
                        new V1ConfigMapKeySelector().name("main-config").key("config")));

    V1EnvVar exitEnvVar =
        new V1EnvVar()
            .name("EXIT_CONFIG")
            .valueFrom(
                new V1EnvVarSource()
                    .configMapKeyRef(
                        new V1ConfigMapKeySelector().name("exit-config").key("config")));

    OMJob.OMJobPodSpec mainPodSpec =
        OMJob.OMJobPodSpec.builder()
            .image("openmetadata/ingestion:test")
            .env(List.of(mainEnvVar))
            .build();

    OMJob.OMJobPodSpec exitPodSpec =
        OMJob.OMJobPodSpec.builder()
            .image("openmetadata/ingestion:test")
            .env(List.of(exitEnvVar))
            .build();

    OMJob omJob =
        OMJob.builder()
            .apiVersion("pipelines.openmetadata.org/v1")
            .kind("OMJob")
            .metadata(
                OMJob.OMJobMetadata.builder()
                    .name("dual-spec-test")
                    .namespace("test-namespace")
                    .build())
            .spec(
                OMJob.OMJobSpec.builder()
                    .mainPodSpec(mainPodSpec)
                    .exitHandlerSpec(exitPodSpec)
                    .build())
            .build();

    Map<String, Object> omJobMap = omJob.toMap();

    @SuppressWarnings("unchecked")
    Map<String, Object> spec = (Map<String, Object>) omJobMap.get("spec");

    // Verify main pod spec environment variables
    @SuppressWarnings("unchecked")
    Map<String, Object> mainPodSpecMap = (Map<String, Object>) spec.get("mainPodSpec");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> mainEnvList = (List<Map<String, Object>>) mainPodSpecMap.get("env");

    Map<String, Object> mainEnvVarMap = mainEnvList.get(0);
    assertEquals("MAIN_CONFIG", mainEnvVarMap.get("name"));
    @SuppressWarnings("unchecked")
    Map<String, Object> mainValueFrom = (Map<String, Object>) mainEnvVarMap.get("valueFrom");
    @SuppressWarnings("unchecked")
    Map<String, Object> mainConfigMapRef =
        (Map<String, Object>) mainValueFrom.get("configMapKeyRef");
    assertEquals("main-config", mainConfigMapRef.get("name"));

    // Verify exit handler spec environment variables
    @SuppressWarnings("unchecked")
    Map<String, Object> exitPodSpecMap = (Map<String, Object>) spec.get("exitHandlerSpec");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> exitEnvList = (List<Map<String, Object>>) exitPodSpecMap.get("env");

    Map<String, Object> exitEnvVarMap = exitEnvList.get(0);
    assertEquals("EXIT_CONFIG", exitEnvVarMap.get("name"));
    @SuppressWarnings("unchecked")
    Map<String, Object> exitValueFrom = (Map<String, Object>) exitEnvVarMap.get("valueFrom");
    @SuppressWarnings("unchecked")
    Map<String, Object> exitConfigMapRef =
        (Map<String, Object>) exitValueFrom.get("configMapKeyRef");
    assertEquals("exit-config", exitConfigMapRef.get("name"));
  }

  @Test
  void testOMJobToMapWithEmptyValueFromEnvironmentVariable() {
    // Test edge case: environment variable with empty valueFrom
    V1EnvVar emptyValueFromEnvVar =
        new V1EnvVar().name("EMPTY_VALUE_FROM").valueFrom(new V1EnvVarSource());

    V1EnvVar normalEnvVar = new V1EnvVar().name("NORMAL_VAR").value("normal_value");

    OMJob.OMJobPodSpec podSpec =
        OMJob.OMJobPodSpec.builder()
            .image("openmetadata/ingestion:test")
            .env(List.of(emptyValueFromEnvVar, normalEnvVar))
            .build();

    OMJob omJob =
        OMJob.builder()
            .apiVersion("pipelines.openmetadata.org/v1")
            .kind("OMJob")
            .metadata(
                OMJob.OMJobMetadata.builder()
                    .name("empty-valueFrom-test")
                    .namespace("test-namespace")
                    .build())
            .spec(OMJob.OMJobSpec.builder().mainPodSpec(podSpec).exitHandlerSpec(podSpec).build())
            .build();

    Map<String, Object> omJobMap = omJob.toMap();

    // Navigate to environment variables
    @SuppressWarnings("unchecked")
    Map<String, Object> spec = (Map<String, Object>) omJobMap.get("spec");
    @SuppressWarnings("unchecked")
    Map<String, Object> mainPodSpecMap = (Map<String, Object>) spec.get("mainPodSpec");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> envList = (List<Map<String, Object>>) mainPodSpecMap.get("env");

    assertEquals(2, envList.size());

    // The environment variable with empty valueFrom should still be serialized properly
    Map<String, Object> emptyValueFromEnv =
        envList.stream()
            .filter(env -> "EMPTY_VALUE_FROM".equals(env.get("name")))
            .findFirst()
            .orElseThrow();

    assertEquals("EMPTY_VALUE_FROM", emptyValueFromEnv.get("name"));

    // Should have valueFrom map even if it's empty
    @SuppressWarnings("unchecked")
    Map<String, Object> valueFrom = (Map<String, Object>) emptyValueFromEnv.get("valueFrom");
    assertNotNull(valueFrom);
    assertTrue(valueFrom.isEmpty());

    // Normal environment variable should work fine
    Map<String, Object> normalEnv =
        envList.stream()
            .filter(env -> "NORMAL_VAR".equals(env.get("name")))
            .findFirst()
            .orElseThrow();
    assertEquals("normal_value", normalEnv.get("value"));
  }
}
