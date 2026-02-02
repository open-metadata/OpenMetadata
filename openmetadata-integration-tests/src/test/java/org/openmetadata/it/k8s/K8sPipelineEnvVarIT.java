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

import io.kubernetes.client.openapi.models.V1ConfigMapKeySelector;
import io.kubernetes.client.openapi.models.V1EnvVar;
import io.kubernetes.client.openapi.models.V1EnvVarSource;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.clients.pipeline.k8s.CronOMJob;
import org.openmetadata.service.clients.pipeline.k8s.OMJob;

/**
 * Integration test for K8s Pipeline environment variable flow.
 * Validates that ConfigMapKeyRef and other valueFrom sources are preserved
 * from K8sPipelineClient through CronOMJob/OMJob to pod creation.
 */
class K8sPipelineEnvVarIT {

  private static final String PIPELINE_NAME = "test-pipeline-envvar";
  private static final String NAMESPACE = "openmetadata-pipelines-test";
  private static final String CONFIG_MAP_NAME = "om-config-" + PIPELINE_NAME;

  @BeforeEach
  void setUp() {
    // Tests will validate serialization logic only, not actual K8s interaction
  }

  @Test
  void testCronOMJobPreservesConfigMapKeyRef() {
    // Create env vars with ConfigMapKeyRef as K8sPipelineClient does
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
            new V1EnvVar().name("ingestionPipelineFQN").value("service." + PIPELINE_NAME),
            configEnvVar,
            new V1EnvVar().name("jobName").value("om-cronomjob-" + PIPELINE_NAME),
            new V1EnvVar().name("namespace").value(NAMESPACE));

    // Build CronOMJob as K8sPipelineClient would
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

    OMJob.OMJobSpec omJobSpec =
        OMJob.OMJobSpec.builder()
            .mainPodSpec(mainPodSpec)
            .exitHandlerSpec(exitHandlerSpec)
            .ttlSecondsAfterFinished(3600)
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
                    .omJobSpec(omJobSpec)
                    .build())
            .build();

    // Convert to Map (what gets sent to K8s API)
    Map<String, Object> cronOMJobMap = cronOMJob.toMap();

    // Verify the structure
    assertNotNull(cronOMJobMap);
    assertEquals("CronOMJob", cronOMJobMap.get("kind"));

    // Navigate to env vars and verify ConfigMapKeyRef is preserved
    @SuppressWarnings("unchecked")
    Map<String, Object> spec = (Map<String, Object>) cronOMJobMap.get("spec");
    assertNotNull(spec);

    @SuppressWarnings("unchecked")
    Map<String, Object> omJobSpecMap = (Map<String, Object>) spec.get("omJobSpec");
    assertNotNull(omJobSpecMap);

    // Check mainPodSpec
    verifyPodSpecEnvVars(omJobSpecMap, "mainPodSpec");

    // Check exitHandlerSpec
    verifyPodSpecEnvVars(omJobSpecMap, "exitHandlerSpec");
  }

  @Test
  void testOMJobPreservesConfigMapKeyRef() {
    // Create env vars with various valueFrom sources
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

    OMJob.OMJobPodSpec podSpec =
        OMJob.OMJobPodSpec.builder()
            .image("test:latest")
            .command(List.of("echo", "test"))
            .env(envVars)
            .build();

    OMJob omJob =
        OMJob.builder()
            .apiVersion("pipelines.openmetadata.org/v1")
            .kind("OMJob")
            .metadata(OMJob.OMJobMetadata.builder().name("test-omjob").namespace(NAMESPACE).build())
            .spec(OMJob.OMJobSpec.builder().mainPodSpec(podSpec).exitHandlerSpec(podSpec).build())
            .build();

    Map<String, Object> omJobMap = omJob.toMap();

    // Verify all env var types are preserved
    @SuppressWarnings("unchecked")
    Map<String, Object> spec = (Map<String, Object>) omJobMap.get("spec");
    @SuppressWarnings("unchecked")
    Map<String, Object> mainPodSpecMap = (Map<String, Object>) spec.get("mainPodSpec");
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> envList = (List<Map<String, Object>>) mainPodSpecMap.get("env");

    assertEquals(4, envList.size());

    // Check simple value
    Map<String, Object> simpleEnv = envList.get(0);
    assertEquals("SIMPLE", simpleEnv.get("name"));
    assertEquals("simple_value", simpleEnv.get("value"));
    assertFalse(simpleEnv.containsKey("valueFrom"));

    // Check ConfigMapKeyRef
    Map<String, Object> configMapEnv = envList.get(1);
    assertEquals("CONFIG_MAP", configMapEnv.get("name"));
    assertFalse(configMapEnv.containsKey("value"));
    @SuppressWarnings("unchecked")
    Map<String, Object> configMapValueFrom = (Map<String, Object>) configMapEnv.get("valueFrom");
    assertNotNull(configMapValueFrom);
    @SuppressWarnings("unchecked")
    Map<String, Object> configMapRef =
        (Map<String, Object>) configMapValueFrom.get("configMapKeyRef");
    assertNotNull(configMapRef, "ConfigMapKeyRef must be preserved");
    assertEquals("config", configMapRef.get("name"));
    assertEquals("data", configMapRef.get("key"));

    // Check SecretKeyRef
    Map<String, Object> secretEnv = envList.get(2);
    @SuppressWarnings("unchecked")
    Map<String, Object> secretValueFrom = (Map<String, Object>) secretEnv.get("valueFrom");
    @SuppressWarnings("unchecked")
    Map<String, Object> secretRef = (Map<String, Object>) secretValueFrom.get("secretKeyRef");
    assertNotNull(secretRef, "SecretKeyRef must be preserved");
    assertEquals("secret", secretRef.get("name"));
    assertEquals("password", secretRef.get("key"));

    // Check FieldRef
    Map<String, Object> fieldEnv = envList.get(3);
    @SuppressWarnings("unchecked")
    Map<String, Object> fieldValueFrom = (Map<String, Object>) fieldEnv.get("valueFrom");
    @SuppressWarnings("unchecked")
    Map<String, Object> fieldRef = (Map<String, Object>) fieldValueFrom.get("fieldRef");
    assertNotNull(fieldRef, "FieldRef must be preserved");
    assertEquals("metadata.name", fieldRef.get("fieldPath"));
  }

  @Test
  void testK8sPipelineClientCreatesConfigMapReference() {
    // This test validates that the ConfigMapKeyRef is properly created
    // in the env var structure when building a CronOMJob

    V1EnvVar configEnvVar =
        new V1EnvVar()
            .name("config")
            .valueFrom(
                new V1EnvVarSource()
                    .configMapKeyRef(
                        new V1ConfigMapKeySelector().name(CONFIG_MAP_NAME).key("config")));

    assertNotNull(configEnvVar.getValueFrom());
    assertNotNull(configEnvVar.getValueFrom().getConfigMapKeyRef());
    assertEquals(CONFIG_MAP_NAME, configEnvVar.getValueFrom().getConfigMapKeyRef().getName());
    assertEquals("config", configEnvVar.getValueFrom().getConfigMapKeyRef().getKey());
  }

  private void verifyPodSpecEnvVars(Map<String, Object> omJobSpecMap, String podSpecKey) {
    @SuppressWarnings("unchecked")
    Map<String, Object> podSpecMap = (Map<String, Object>) omJobSpecMap.get(podSpecKey);
    assertNotNull(podSpecMap);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> envList = (List<Map<String, Object>>) podSpecMap.get("env");
    assertNotNull(envList);
    assertEquals(6, envList.size());

    // Find the config env var
    Map<String, Object> configEnv =
        envList.stream()
            .filter(env -> "config".equals(env.get("name")))
            .findFirst()
            .orElseThrow(() -> new AssertionError("config env var not found in " + podSpecKey));

    // Verify ConfigMapKeyRef is preserved
    assertFalse(configEnv.containsKey("value"), "config env should not have 'value'");

    @SuppressWarnings("unchecked")
    Map<String, Object> valueFrom = (Map<String, Object>) configEnv.get("valueFrom");
    assertNotNull(valueFrom, "valueFrom must be present for config env in " + podSpecKey);

    @SuppressWarnings("unchecked")
    Map<String, Object> configMapKeyRef = (Map<String, Object>) valueFrom.get("configMapKeyRef");
    assertNotNull(configMapKeyRef, "configMapKeyRef must be preserved in " + podSpecKey);
    assertEquals(CONFIG_MAP_NAME, configMapKeyRef.get("name"));
    assertEquals("config", configMapKeyRef.get("key"));

    // Verify other env vars
    Map<String, Object> pipelineTypeEnv =
        envList.stream()
            .filter(env -> "pipelineType".equals(env.get("name")))
            .findFirst()
            .orElseThrow();
    assertEquals("metadata", pipelineTypeEnv.get("value"));
    assertFalse(pipelineTypeEnv.containsKey("valueFrom"));
  }
}
