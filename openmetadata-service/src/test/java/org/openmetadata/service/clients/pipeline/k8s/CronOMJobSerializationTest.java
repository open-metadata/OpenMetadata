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
 * Test environment variable serialization for CronOMJob.
 * Ensures CronOMJob correctly uses K8sJobUtils for consistent serialization.
 */
class CronOMJobSerializationTest {

  @Test
  void testCronOMJobToMapWithConfigMapKeyRef() {
    // Test that CronOMJob properly serializes environment variables with configMapKeyRef
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

    OMJob.OMJobSpec omJobSpec =
        OMJob.OMJobSpec.builder()
            .mainPodSpec(podSpec)
            .exitHandlerSpec(podSpec)
            .ttlSecondsAfterFinished(3600)
            .build();

    CronOMJob cronOMJob =
        CronOMJob.builder()
            .apiVersion("pipelines.openmetadata.org/v1")
            .kind("CronOMJob")
            .metadata(
                CronOMJob.CronOMJobMetadata.builder()
                    .name("test-cronomjob")
                    .namespace("test-namespace")
                    .build())
            .spec(
                CronOMJob.CronOMJobSpec.builder()
                    .schedule("0 * * * *")
                    .omJobSpec(omJobSpec)
                    .build())
            .build();

    // Convert to Map (what gets sent to Kubernetes API)
    Map<String, Object> cronOMJobMap = cronOMJob.toMap();

    // Verify the structure is correct
    assertNotNull(cronOMJobMap);
    assertEquals("pipelines.openmetadata.org/v1", cronOMJobMap.get("apiVersion"));
    assertEquals("CronOMJob", cronOMJobMap.get("kind"));

    // Verify metadata
    @SuppressWarnings("unchecked")
    Map<String, Object> metadata = (Map<String, Object>) cronOMJobMap.get("metadata");
    assertEquals("test-cronomjob", metadata.get("name"));
    assertEquals("test-namespace", metadata.get("namespace"));

    // Verify spec
    @SuppressWarnings("unchecked")
    Map<String, Object> spec = (Map<String, Object>) cronOMJobMap.get("spec");
    assertEquals("0 * * * *", spec.get("schedule"));

    // Verify omJobSpec
    @SuppressWarnings("unchecked")
    Map<String, Object> omJobSpecMap = (Map<String, Object>) spec.get("omJobSpec");
    assertNotNull(omJobSpecMap);

    // Verify mainPodSpec environment variables
    @SuppressWarnings("unchecked")
    Map<String, Object> mainPodSpecMap = (Map<String, Object>) omJobSpecMap.get("mainPodSpec");
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
  void testCronOMJobToMapWithSecretKeyRef() {
    // Test that CronOMJob properly serializes environment variables with secretKeyRef
    V1EnvVar secretEnvVar =
        new V1EnvVar()
            .name("DATABASE_PASSWORD")
            .valueFrom(
                new V1EnvVarSource()
                    .secretKeyRef(
                        new V1SecretKeySelector()
                            .name("postgres-secrets")
                            .key("password")
                            .optional(false)));

    OMJob.OMJobPodSpec podSpec =
        OMJob.OMJobPodSpec.builder()
            .image("openmetadata/ingestion:test")
            .env(List.of(secretEnvVar))
            .build();

    OMJob.OMJobSpec omJobSpec =
        OMJob.OMJobSpec.builder().mainPodSpec(podSpec).exitHandlerSpec(podSpec).build();

    CronOMJob cronOMJob =
        CronOMJob.builder()
            .apiVersion("pipelines.openmetadata.org/v1")
            .kind("CronOMJob")
            .metadata(
                CronOMJob.CronOMJobMetadata.builder()
                    .name("test-cronomjob")
                    .namespace("test-namespace")
                    .build())
            .spec(
                CronOMJob.CronOMJobSpec.builder()
                    .schedule("0 2 * * *")
                    .omJobSpec(omJobSpec)
                    .build())
            .build();

    Map<String, Object> cronOMJobMap = cronOMJob.toMap();

    // Navigate to environment variables
    @SuppressWarnings("unchecked")
    Map<String, Object> spec = (Map<String, Object>) cronOMJobMap.get("spec");
    @SuppressWarnings("unchecked")
    Map<String, Object> omJobSpecMap = (Map<String, Object>) spec.get("omJobSpec");
    @SuppressWarnings("unchecked")
    Map<String, Object> mainPodSpecMap = (Map<String, Object>) omJobSpecMap.get("mainPodSpec");
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
    assertEquals(false, secretKeyRef.get("optional"));
  }

  @Test
  void testCronOMJobToMapWithMixedEnvironmentVariables() {
    // Test that CronOMJob handles multiple environment variable types correctly
    V1EnvVar directValue = new V1EnvVar().name("LOG_LEVEL").value("INFO");

    V1EnvVar configMapRef =
        new V1EnvVar()
            .name("CONFIG")
            .valueFrom(
                new V1EnvVarSource()
                    .configMapKeyRef(
                        new V1ConfigMapKeySelector().name("om-config-test").key("config")));

    V1EnvVar secretRef =
        new V1EnvVar()
            .name("API_KEY")
            .valueFrom(
                new V1EnvVarSource()
                    .secretKeyRef(new V1SecretKeySelector().name("api-secrets").key("key")));

    List<V1EnvVar> envVars = List.of(directValue, configMapRef, secretRef);

    OMJob.OMJobPodSpec podSpec =
        OMJob.OMJobPodSpec.builder().image("openmetadata/ingestion:test").env(envVars).build();

    OMJob.OMJobSpec omJobSpec =
        OMJob.OMJobSpec.builder().mainPodSpec(podSpec).exitHandlerSpec(podSpec).build();

    CronOMJob cronOMJob =
        CronOMJob.builder()
            .apiVersion("pipelines.openmetadata.org/v1")
            .kind("CronOMJob")
            .metadata(
                CronOMJob.CronOMJobMetadata.builder()
                    .name("mixed-env-test")
                    .namespace("test-namespace")
                    .build())
            .spec(
                CronOMJob.CronOMJobSpec.builder()
                    .schedule("*/5 * * * *")
                    .omJobSpec(omJobSpec)
                    .build())
            .build();

    Map<String, Object> cronOMJobMap = cronOMJob.toMap();

    // Navigate to environment variables
    @SuppressWarnings("unchecked")
    Map<String, Object> spec = (Map<String, Object>) cronOMJobMap.get("spec");
    @SuppressWarnings("unchecked")
    Map<String, Object> omJobSpecMap = (Map<String, Object>) spec.get("omJobSpec");
    @SuppressWarnings("unchecked")
    Map<String, Object> mainPodSpecMap = (Map<String, Object>) omJobSpecMap.get("mainPodSpec");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> envList = (List<Map<String, Object>>) mainPodSpecMap.get("env");

    assertEquals(3, envList.size());

    // Verify direct value environment variable
    Map<String, Object> directEnvVar =
        envList.stream()
            .filter(env -> "LOG_LEVEL".equals(env.get("name")))
            .findFirst()
            .orElseThrow();
    assertEquals("INFO", directEnvVar.get("value"));
    // Should not have valueFrom when using direct value
    assertTrue(!directEnvVar.containsKey("valueFrom") || directEnvVar.get("valueFrom") == null);

    // Verify configMapKeyRef environment variable
    Map<String, Object> configEnvVar =
        envList.stream().filter(env -> "CONFIG".equals(env.get("name"))).findFirst().orElseThrow();
    @SuppressWarnings("unchecked")
    Map<String, Object> configValueFrom = (Map<String, Object>) configEnvVar.get("valueFrom");
    assertNotNull(configValueFrom);
    assertTrue(configValueFrom.containsKey("configMapKeyRef"));

    // Verify secretKeyRef environment variable
    Map<String, Object> secretEnvVar =
        envList.stream().filter(env -> "API_KEY".equals(env.get("name"))).findFirst().orElseThrow();
    @SuppressWarnings("unchecked")
    Map<String, Object> secretValueFrom = (Map<String, Object>) secretEnvVar.get("valueFrom");
    assertNotNull(secretValueFrom);
    assertTrue(secretValueFrom.containsKey("secretKeyRef"));
  }

  @Test
  void testCronOMJobToMapWithNullEnvironmentVariables() {
    // Test that CronOMJob handles null environment variables gracefully
    OMJob.OMJobPodSpec podSpec =
        OMJob.OMJobPodSpec.builder()
            .image("openmetadata/ingestion:test")
            .env(null) // Explicitly test null environment variables
            .build();

    OMJob.OMJobSpec omJobSpec =
        OMJob.OMJobSpec.builder().mainPodSpec(podSpec).exitHandlerSpec(podSpec).build();

    CronOMJob cronOMJob =
        CronOMJob.builder()
            .apiVersion("pipelines.openmetadata.org/v1")
            .kind("CronOMJob")
            .metadata(
                CronOMJob.CronOMJobMetadata.builder()
                    .name("null-env-test")
                    .namespace("test-namespace")
                    .build())
            .spec(
                CronOMJob.CronOMJobSpec.builder()
                    .schedule("0 4 * * *")
                    .omJobSpec(omJobSpec)
                    .build())
            .build();

    Map<String, Object> cronOMJobMap = cronOMJob.toMap();

    // Verify that null environment variables don't cause exceptions
    assertNotNull(cronOMJobMap);

    // Navigate to environment variables
    @SuppressWarnings("unchecked")
    Map<String, Object> spec = (Map<String, Object>) cronOMJobMap.get("spec");
    @SuppressWarnings("unchecked")
    Map<String, Object> omJobSpecMap = (Map<String, Object>) spec.get("omJobSpec");
    @SuppressWarnings("unchecked")
    Map<String, Object> mainPodSpecMap = (Map<String, Object>) omJobSpecMap.get("mainPodSpec");

    // Environment variables should be null when input is null
    assertEquals(null, mainPodSpecMap.get("env"));
  }
}
