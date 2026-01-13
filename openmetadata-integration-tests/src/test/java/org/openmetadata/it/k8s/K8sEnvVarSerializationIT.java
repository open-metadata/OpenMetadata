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

package org.openmetadata.it.k8s;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import io.fabric8.kubernetes.api.model.*;
import io.kubernetes.client.openapi.models.V1ConfigMapKeySelector;
import io.kubernetes.client.openapi.models.V1EnvVar;
import io.kubernetes.client.openapi.models.V1EnvVarSource;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.clients.pipeline.k8s.CronOMJob;
import org.openmetadata.service.clients.pipeline.k8s.K8sJobUtils;
import org.openmetadata.service.clients.pipeline.k8s.OMJob;

/**
 * Integration test for K8s environment variable serialization.
 * Validates that ConfigMapKeyRef and other valueFrom sources are preserved
 * through the full serialization/deserialization cycle.
 */
class K8sEnvVarSerializationIT {

  private static final String PIPELINE_NAME = "test-pipeline";
  private static final String NAMESPACE = "openmetadata-pipelines-test";
  private static final String CONFIG_MAP_NAME = "om-config-" + PIPELINE_NAME;

  private final ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
  private final ObjectMapper jsonMapper = new ObjectMapper();

  @Test
  void testOMJobSerializationPreservesConfigMapKeyRef() {
    // Create env vars with ConfigMapKeyRef
    V1EnvVar configEnvVar =
        new V1EnvVar()
            .name("config")
            .valueFrom(
                new V1EnvVarSource()
                    .configMapKeyRef(
                        new V1ConfigMapKeySelector().name(CONFIG_MAP_NAME).key("config")));

    List<V1EnvVar> envVars =
        List.of(new V1EnvVar().name("pipelineType").value("metadata"), configEnvVar);

    OMJob.OMJobPodSpec podSpec =
        OMJob.OMJobPodSpec.builder()
            .image("openmetadata/ingestion:latest")
            .command(List.of("python", "main.py"))
            .env(envVars)
            .build();

    OMJob omJob =
        OMJob.builder()
            .apiVersion("pipelines.openmetadata.org/v1")
            .kind("OMJob")
            .metadata(OMJob.OMJobMetadata.builder().name("test-omjob").namespace(NAMESPACE).build())
            .spec(OMJob.OMJobSpec.builder().mainPodSpec(podSpec).exitHandlerSpec(podSpec).build())
            .build();

    // Convert to Map
    Map<String, Object> omJobMap = omJob.toMap();

    // Verify ConfigMapKeyRef is preserved
    verifyConfigMapKeyRefInMap(omJobMap, "spec.mainPodSpec");
    verifyConfigMapKeyRefInMap(omJobMap, "spec.exitHandlerSpec");
  }

  @Test
  void testCronOMJobSerializationPreservesConfigMapKeyRef() {
    // Create env vars with ConfigMapKeyRef
    V1EnvVar configEnvVar =
        new V1EnvVar()
            .name("config")
            .valueFrom(
                new V1EnvVarSource()
                    .configMapKeyRef(
                        new V1ConfigMapKeySelector().name(CONFIG_MAP_NAME).key("config")));

    List<V1EnvVar> envVars =
        List.of(
            new V1EnvVar().name("pipelineType").value("metadata"),
            new V1EnvVar().name("pipelineRunId").value("scheduled"),
            configEnvVar);

    OMJob.OMJobPodSpec podSpec =
        OMJob.OMJobPodSpec.builder()
            .image("openmetadata/ingestion:latest")
            .command(List.of("python", "main.py"))
            .env(envVars)
            .build();

    CronOMJob cronOMJob =
        CronOMJob.builder()
            .apiVersion("pipelines.openmetadata.org/v1")
            .kind("CronOMJob")
            .metadata(
                CronOMJob.CronOMJobMetadata.builder()
                    .name("om-cronomjob-" + PIPELINE_NAME)
                    .namespace(NAMESPACE)
                    .build())
            .spec(
                CronOMJob.CronOMJobSpec.builder()
                    .schedule("0 * * * *")
                    .omJobSpec(
                        OMJob.OMJobSpec.builder()
                            .mainPodSpec(podSpec)
                            .exitHandlerSpec(podSpec)
                            .build())
                    .build())
            .build();

    // Convert to Map
    Map<String, Object> cronOMJobMap = cronOMJob.toMap();

    // Verify ConfigMapKeyRef is preserved
    verifyConfigMapKeyRefInMap(cronOMJobMap, "spec.omJobSpec.mainPodSpec");
    verifyConfigMapKeyRefInMap(cronOMJobMap, "spec.omJobSpec.exitHandlerSpec");
  }

  @Test
  void testK8sJobUtilsPreservesAllValueFromTypes() {
    // Test all types of valueFrom sources
    List<V1EnvVar> envVars =
        List.of(
            new V1EnvVar().name("SIMPLE").value("simple_value"),
            new V1EnvVar()
                .name("CONFIG_MAP")
                .valueFrom(
                    new V1EnvVarSource()
                        .configMapKeyRef(new V1ConfigMapKeySelector().name("config").key("data"))),
            new V1EnvVar()
                .name("SECRET")
                .valueFrom(
                    new V1EnvVarSource()
                        .secretKeyRef(
                            new io.kubernetes.client.openapi.models.V1SecretKeySelector()
                                .name("secret")
                                .key("password"))),
            new V1EnvVar()
                .name("FIELD")
                .valueFrom(
                    new V1EnvVarSource()
                        .fieldRef(
                            new io.kubernetes.client.openapi.models.V1ObjectFieldSelector()
                                .fieldPath("metadata.name"))));

    List<Map<String, Object>> envMapList = K8sJobUtils.convertEnvVarsToMap(envVars);

    assertEquals(4, envMapList.size());

    // Simple value
    Map<String, Object> simpleEnv = envMapList.get(0);
    assertEquals("SIMPLE", simpleEnv.get("name"));
    assertEquals("simple_value", simpleEnv.get("value"));
    assertFalse(simpleEnv.containsKey("valueFrom"));

    // ConfigMapKeyRef
    Map<String, Object> configMapEnv = envMapList.get(1);
    assertEquals("CONFIG_MAP", configMapEnv.get("name"));
    @SuppressWarnings("unchecked")
    Map<String, Object> configMapValueFrom = (Map<String, Object>) configMapEnv.get("valueFrom");
    assertNotNull(configMapValueFrom);
    @SuppressWarnings("unchecked")
    Map<String, Object> configMapRef =
        (Map<String, Object>) configMapValueFrom.get("configMapKeyRef");
    assertNotNull(configMapRef);
    assertEquals("config", configMapRef.get("name"));
    assertEquals("data", configMapRef.get("key"));

    // SecretKeyRef
    Map<String, Object> secretEnv = envMapList.get(2);
    @SuppressWarnings("unchecked")
    Map<String, Object> secretValueFrom = (Map<String, Object>) secretEnv.get("valueFrom");
    @SuppressWarnings("unchecked")
    Map<String, Object> secretRef = (Map<String, Object>) secretValueFrom.get("secretKeyRef");
    assertNotNull(secretRef);
    assertEquals("secret", secretRef.get("name"));
    assertEquals("password", secretRef.get("key"));

    // FieldRef
    Map<String, Object> fieldEnv = envMapList.get(3);
    @SuppressWarnings("unchecked")
    Map<String, Object> fieldValueFrom = (Map<String, Object>) fieldEnv.get("valueFrom");
    @SuppressWarnings("unchecked")
    Map<String, Object> fieldRef = (Map<String, Object>) fieldValueFrom.get("fieldRef");
    assertNotNull(fieldRef);
    assertEquals("metadata.name", fieldRef.get("fieldPath"));
  }

  @Test
  void testEmptyValueFromHandling() {
    // Test that we can detect empty valueFrom fields that would cause K8s API errors
    List<EnvVar> envVars =
        Arrays.asList(
            new EnvVarBuilder().withName("GOOD").withValue("value").build(),
            new EnvVarBuilder()
                .withName("EMPTY_VALUE_FROM")
                .withValueFrom(new EnvVarSource()) // Empty - would cause K8s API error
                .build(),
            new EnvVarBuilder()
                .withName("CONFIG_REF")
                .withValueFrom(
                    new EnvVarSourceBuilder()
                        .withConfigMapKeyRef(
                            new ConfigMapKeySelectorBuilder()
                                .withName(CONFIG_MAP_NAME)
                                .withKey("config")
                                .build())
                        .build())
                .build());

    // Check which env vars have empty valueFrom
    for (EnvVar env : envVars) {
      if ("EMPTY_VALUE_FROM".equals(env.getName())) {
        assertNotNull(env.getValueFrom());
        // This valueFrom is empty (no valid references)
        assertNull(env.getValueFrom().getConfigMapKeyRef());
        assertNull(env.getValueFrom().getSecretKeyRef());
        assertNull(env.getValueFrom().getFieldRef());
        assertNull(env.getValueFrom().getResourceFieldRef());
      } else if ("CONFIG_REF".equals(env.getName())) {
        assertNotNull(env.getValueFrom());
        assertNotNull(env.getValueFrom().getConfigMapKeyRef());
      }
    }
  }

  @Test
  void testYamlSerializationRoundTrip() throws Exception {
    // Test YAML serialization/deserialization preserves ConfigMapKeyRef
    CronOMJob cronOMJob = buildCronOMJobWithConfigMapRef();
    Map<String, Object> cronOMJobMap = cronOMJob.toMap();

    // Serialize to YAML
    String yaml = yamlMapper.writeValueAsString(cronOMJobMap);
    assertNotNull(yaml);
    assertTrue(yaml.contains("configMapKeyRef"));
    assertTrue(yaml.contains(CONFIG_MAP_NAME));

    // Parse back from YAML
    @SuppressWarnings("unchecked")
    Map<String, Object> parsedMap = yamlMapper.readValue(yaml, Map.class);

    // Verify ConfigMapKeyRef survived round trip
    verifyConfigMapKeyRefInMap(parsedMap, "spec.omJobSpec.mainPodSpec");
  }

  @Test
  void testJsonSerializationRoundTrip() throws Exception {
    // Test JSON serialization/deserialization preserves ConfigMapKeyRef
    OMJob omJob = buildOMJobWithConfigMapRef();
    Map<String, Object> omJobMap = omJob.toMap();

    // Serialize to JSON
    String json = jsonMapper.writeValueAsString(omJobMap);
    assertNotNull(json);
    assertTrue(json.contains("configMapKeyRef"));
    assertTrue(json.contains(CONFIG_MAP_NAME));

    // Parse back from JSON
    @SuppressWarnings("unchecked")
    Map<String, Object> parsedMap = jsonMapper.readValue(json, Map.class);

    // Verify ConfigMapKeyRef survived round trip
    verifyConfigMapKeyRefInMap(parsedMap, "spec.mainPodSpec");
  }

  private void verifyConfigMapKeyRefInMap(Map<String, Object> map, String path) {
    String[] pathParts = path.split("\\.");
    Map<String, Object> current = map;

    for (String part : pathParts) {
      @SuppressWarnings("unchecked")
      Map<String, Object> next = (Map<String, Object>) current.get(part);
      assertNotNull(next, "Path " + part + " should exist in " + path);
      current = next;
    }

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> envList = (List<Map<String, Object>>) current.get("env");
    assertNotNull(envList, "env should exist at " + path);

    // Find config env var
    Map<String, Object> configEnv =
        envList.stream()
            .filter(env -> "config".equals(env.get("name")))
            .findFirst()
            .orElseThrow(() -> new AssertionError("config env var not found at " + path));

    @SuppressWarnings("unchecked")
    Map<String, Object> valueFrom = (Map<String, Object>) configEnv.get("valueFrom");
    assertNotNull(valueFrom, "valueFrom should exist for config env at " + path);

    @SuppressWarnings("unchecked")
    Map<String, Object> configMapKeyRef = (Map<String, Object>) valueFrom.get("configMapKeyRef");
    assertNotNull(configMapKeyRef, "configMapKeyRef must be preserved at " + path);
    assertEquals(CONFIG_MAP_NAME, configMapKeyRef.get("name"));
    assertEquals("config", configMapKeyRef.get("key"));
  }

  private CronOMJob buildCronOMJobWithConfigMapRef() {
    V1EnvVar configEnvVar =
        new V1EnvVar()
            .name("config")
            .valueFrom(
                new V1EnvVarSource()
                    .configMapKeyRef(
                        new V1ConfigMapKeySelector().name(CONFIG_MAP_NAME).key("config")));

    OMJob.OMJobPodSpec podSpec =
        OMJob.OMJobPodSpec.builder()
            .image("openmetadata/ingestion:latest")
            .command(List.of("python", "main.py"))
            .env(List.of(new V1EnvVar().name("pipelineType").value("metadata"), configEnvVar))
            .build();

    return CronOMJob.builder()
        .apiVersion("pipelines.openmetadata.org/v1")
        .kind("CronOMJob")
        .metadata(
            CronOMJob.CronOMJobMetadata.builder()
                .name("om-cronomjob-" + PIPELINE_NAME)
                .namespace(NAMESPACE)
                .build())
        .spec(
            CronOMJob.CronOMJobSpec.builder()
                .schedule("0 * * * *")
                .omJobSpec(
                    OMJob.OMJobSpec.builder().mainPodSpec(podSpec).exitHandlerSpec(podSpec).build())
                .build())
        .build();
  }

  private OMJob buildOMJobWithConfigMapRef() {
    V1EnvVar configEnvVar =
        new V1EnvVar()
            .name("config")
            .valueFrom(
                new V1EnvVarSource()
                    .configMapKeyRef(
                        new V1ConfigMapKeySelector().name(CONFIG_MAP_NAME).key("config")));

    OMJob.OMJobPodSpec podSpec =
        OMJob.OMJobPodSpec.builder()
            .image("openmetadata/ingestion:latest")
            .command(List.of("python", "main.py"))
            .env(List.of(new V1EnvVar().name("pipelineType").value("metadata"), configEnvVar))
            .build();

    return OMJob.builder()
        .apiVersion("pipelines.openmetadata.org/v1")
        .kind("OMJob")
        .metadata(OMJob.OMJobMetadata.builder().name("test-omjob").namespace(NAMESPACE).build())
        .spec(OMJob.OMJobSpec.builder().mainPodSpec(podSpec).exitHandlerSpec(podSpec).build())
        .build();
  }
}
