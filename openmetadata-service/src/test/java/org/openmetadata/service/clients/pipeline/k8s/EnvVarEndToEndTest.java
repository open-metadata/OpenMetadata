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

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import io.kubernetes.client.openapi.models.V1ConfigMapKeySelector;
import io.kubernetes.client.openapi.models.V1EnvVar;
import io.kubernetes.client.openapi.models.V1EnvVarSource;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * End-to-end test for environment variable flow from K8sPipelineClient to Kubernetes.
 * Ensures ConfigMapKeyRef and other valueFrom sources are preserved through serialization.
 */
class EnvVarEndToEndTest {

  private final ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());

  @Test
  void testCronOMJobEnvVarWithConfigMapKeyRef() {
    // Create the env var as K8sPipelineClient does for CronOMJob
    String configMapName = "om-config-test-pipeline";
    V1EnvVar configEnvVar =
        new V1EnvVar()
            .name("config")
            .valueFrom(
                new V1EnvVarSource()
                    .configMapKeyRef(
                        new V1ConfigMapKeySelector().name(configMapName).key("config")));

    // Create OMJob.OMJobPodSpec with this env var
    OMJob.OMJobPodSpec podSpec =
        OMJob.OMJobPodSpec.builder()
            .image("openmetadata/ingestion:test")
            .imagePullPolicy("IfNotPresent")
            .command(List.of("python", "main.py"))
            .env(List.of(configEnvVar))
            .build();

    // Convert to Map (as done when sending to K8s API)
    Map<String, Object> podSpecMap = K8sJobUtils.buildPodSpecMap(podSpec);

    // Verify the env var is properly serialized
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> envList = (List<Map<String, Object>>) podSpecMap.get("env");
    assertNotNull(envList);
    assertEquals(1, envList.size());

    Map<String, Object> envMap = envList.get(0);
    assertEquals("config", envMap.get("name"));

    @SuppressWarnings("unchecked")
    Map<String, Object> valueFrom = (Map<String, Object>) envMap.get("valueFrom");
    assertNotNull(valueFrom, "valueFrom should be present");

    @SuppressWarnings("unchecked")
    Map<String, Object> configMapKeyRef = (Map<String, Object>) valueFrom.get("configMapKeyRef");
    assertNotNull(configMapKeyRef, "configMapKeyRef should be present");
    assertEquals(configMapName, configMapKeyRef.get("name"));
    assertEquals("config", configMapKeyRef.get("key"));
  }

  @Test
  void testCronOMJobFullEnvVarFlow() {
    // Simulate the full CronOMJob creation with all standard env vars
    String pipelineName = "test-pipeline";
    String configMapName = "om-config-" + pipelineName;

    List<V1EnvVar> envVars =
        List.of(
            new V1EnvVar().name("pipelineType").value("metadata"),
            new V1EnvVar().name("pipelineRunId").value("scheduled"),
            new V1EnvVar().name("ingestionPipelineFQN").value("service." + pipelineName),
            new V1EnvVar()
                .name("config")
                .valueFrom(
                    new V1EnvVarSource()
                        .configMapKeyRef(
                            new V1ConfigMapKeySelector().name(configMapName).key("config"))),
            new V1EnvVar().name("jobName").value("om-cronomjob-" + pipelineName),
            new V1EnvVar().name("namespace").value("openmetadata-pipelines"));

    // Build pod specs
    OMJob.OMJobPodSpec mainPodSpec =
        OMJob.OMJobPodSpec.builder()
            .image("openmetadata/ingestion:latest")
            .imagePullPolicy("IfNotPresent")
            .command(List.of("python", "main.py"))
            .env(envVars)
            .serviceAccountName("openmetadata-ingestion")
            .build();

    OMJob.OMJobPodSpec exitHandlerSpec =
        OMJob.OMJobPodSpec.builder()
            .image("openmetadata/ingestion:latest")
            .imagePullPolicy("IfNotPresent")
            .command(List.of("python", "exit_handler.py"))
            .env(envVars)
            .serviceAccountName("openmetadata-ingestion")
            .build();

    // Create OMJobSpec
    OMJob.OMJobSpec omJobSpec =
        OMJob.OMJobSpec.builder()
            .mainPodSpec(mainPodSpec)
            .exitHandlerSpec(exitHandlerSpec)
            .ttlSecondsAfterFinished(3600)
            .build();

    // Create CronOMJob
    CronOMJob cronOMJob =
        CronOMJob.builder()
            .apiVersion("pipelines.openmetadata.org/v1")
            .kind("CronOMJob")
            .metadata(
                CronOMJob.CronOMJobMetadata.builder()
                    .name("om-cronomjob-" + pipelineName)
                    .namespace("openmetadata-pipelines")
                    .build())
            .spec(
                CronOMJob.CronOMJobSpec.builder()
                    .schedule("0 * * * *")
                    .omJobSpec(omJobSpec)
                    .build())
            .build();

    // Convert to Map (what gets sent to K8s API)
    Map<String, Object> cronOMJobMap = cronOMJob.toMap();

    // Navigate to the env vars in the serialized structure
    @SuppressWarnings("unchecked")
    Map<String, Object> spec = (Map<String, Object>) cronOMJobMap.get("spec");
    @SuppressWarnings("unchecked")
    Map<String, Object> omJobSpecMap = (Map<String, Object>) spec.get("omJobSpec");
    @SuppressWarnings("unchecked")
    Map<String, Object> mainPodSpecMap = (Map<String, Object>) omJobSpecMap.get("mainPodSpec");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> envList = (List<Map<String, Object>>) mainPodSpecMap.get("env");

    // Find the config env var
    Map<String, Object> configEnv =
        envList.stream()
            .filter(env -> "config".equals(env.get("name")))
            .findFirst()
            .orElseThrow(() -> new AssertionError("config env var not found"));

    // Verify ConfigMapKeyRef is preserved
    @SuppressWarnings("unchecked")
    Map<String, Object> valueFrom = (Map<String, Object>) configEnv.get("valueFrom");
    assertNotNull(valueFrom, "valueFrom should not be null");

    @SuppressWarnings("unchecked")
    Map<String, Object> configMapKeyRef = (Map<String, Object>) valueFrom.get("configMapKeyRef");
    assertNotNull(configMapKeyRef, "configMapKeyRef should be preserved");
    assertEquals(configMapName, configMapKeyRef.get("name"));
    assertEquals("config", configMapKeyRef.get("key"));

    // Verify other env vars are intact
    assertEquals(6, envList.size());

    // Check simple value env vars
    Map<String, Object> pipelineTypeEnv =
        envList.stream()
            .filter(env -> "pipelineType".equals(env.get("name")))
            .findFirst()
            .orElseThrow();
    assertEquals("metadata", pipelineTypeEnv.get("value"));
    assertFalse(pipelineTypeEnv.containsKey("valueFrom"));
  }

  @Test
  void testOMJobEnvVarSerialization() {
    // Test that OMJob properly preserves all env var types
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
                                .key("password"))));

    OMJob.OMJobPodSpec podSpec =
        OMJob.OMJobPodSpec.builder().image("test:latest").env(envVars).build();

    OMJob omJob =
        OMJob.builder()
            .apiVersion("pipelines.openmetadata.org/v1")
            .kind("OMJob")
            .metadata(OMJob.OMJobMetadata.builder().name("test-job").namespace("default").build())
            .spec(OMJob.OMJobSpec.builder().mainPodSpec(podSpec).exitHandlerSpec(podSpec).build())
            .build();

    Map<String, Object> omJobMap = omJob.toMap();

    // Verify all env vars are properly serialized
    @SuppressWarnings("unchecked")
    Map<String, Object> spec = (Map<String, Object>) omJobMap.get("spec");
    @SuppressWarnings("unchecked")
    Map<String, Object> mainPodSpecMap = (Map<String, Object>) spec.get("mainPodSpec");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> envList = (List<Map<String, Object>>) mainPodSpecMap.get("env");

    assertEquals(3, envList.size());

    // Check simple value
    Map<String, Object> simpleEnv = envList.get(0);
    assertEquals("SIMPLE", simpleEnv.get("name"));
    assertEquals("simple_value", simpleEnv.get("value"));

    // Check ConfigMapKeyRef
    Map<String, Object> configMapEnv = envList.get(1);
    @SuppressWarnings("unchecked")
    Map<String, Object> configMapValueFrom = (Map<String, Object>) configMapEnv.get("valueFrom");
    @SuppressWarnings("unchecked")
    Map<String, Object> configMapRef =
        (Map<String, Object>) configMapValueFrom.get("configMapKeyRef");
    assertEquals("config", configMapRef.get("name"));
    assertEquals("data", configMapRef.get("key"));

    // Check SecretKeyRef
    Map<String, Object> secretEnv = envList.get(2);
    @SuppressWarnings("unchecked")
    Map<String, Object> secretValueFrom = (Map<String, Object>) secretEnv.get("valueFrom");
    @SuppressWarnings("unchecked")
    Map<String, Object> secretRef = (Map<String, Object>) secretValueFrom.get("secretKeyRef");
    assertEquals("secret", secretRef.get("name"));
    assertEquals("password", secretRef.get("key"));
  }

  @Test
  void testYamlSerializationPreservesConfigMapKeyRef() throws Exception {
    // Test that YAML serialization/deserialization preserves ConfigMapKeyRef
    CronOMJob cronOMJob = buildCronOMJobWithConfigMapRef();

    Map<String, Object> cronOMJobMap = cronOMJob.toMap();

    // Serialize to YAML (simulating what K8s API does)
    String yaml = yamlMapper.writeValueAsString(cronOMJobMap);
    assertNotNull(yaml);
    assertTrue(yaml.contains("configMapKeyRef"));
    assertTrue(yaml.contains("om-config-"));

    // Parse back from YAML
    @SuppressWarnings("unchecked")
    Map<String, Object> parsedMap = yamlMapper.readValue(yaml, Map.class);

    // Navigate to env vars
    @SuppressWarnings("unchecked")
    Map<String, Object> spec = (Map<String, Object>) parsedMap.get("spec");
    @SuppressWarnings("unchecked")
    Map<String, Object> omJobSpec = (Map<String, Object>) spec.get("omJobSpec");
    @SuppressWarnings("unchecked")
    Map<String, Object> mainPodSpec = (Map<String, Object>) omJobSpec.get("mainPodSpec");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> envList = (List<Map<String, Object>>) mainPodSpec.get("env");

    // Find config env var
    Map<String, Object> configEnv =
        envList.stream().filter(env -> "config".equals(env.get("name"))).findFirst().orElseThrow();

    // Verify ConfigMapKeyRef survived serialization
    @SuppressWarnings("unchecked")
    Map<String, Object> valueFrom = (Map<String, Object>) configEnv.get("valueFrom");
    assertNotNull(valueFrom);

    @SuppressWarnings("unchecked")
    Map<String, Object> configMapKeyRef = (Map<String, Object>) valueFrom.get("configMapKeyRef");
    assertNotNull(configMapKeyRef);
    assertTrue(configMapKeyRef.get("name").toString().startsWith("om-config-"));
    assertEquals("config", configMapKeyRef.get("key"));
  }

  private CronOMJob buildCronOMJobWithConfigMapRef() {
    String pipelineName = "yaml-test-pipeline";
    String configMapName = "om-config-" + pipelineName;

    V1EnvVar configEnvVar =
        new V1EnvVar()
            .name("config")
            .valueFrom(
                new V1EnvVarSource()
                    .configMapKeyRef(
                        new V1ConfigMapKeySelector().name(configMapName).key("config")));

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
                .name("om-cronomjob-" + pipelineName)
                .namespace("default")
                .build())
        .spec(
            CronOMJob.CronOMJobSpec.builder()
                .schedule("0 * * * *")
                .omJobSpec(
                    OMJob.OMJobSpec.builder().mainPodSpec(podSpec).exitHandlerSpec(podSpec).build())
                .build())
        .build();
  }
}
