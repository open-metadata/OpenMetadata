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

import io.kubernetes.client.custom.Quantity;
import io.kubernetes.client.openapi.models.*;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Test suite for K8sJobUtils shared utility functions.
 * Verifies correct handling of environment variable serialization and pod spec building.
 */
class K8sJobUtilsTest {

  @Test
  void testConvertEnvVarsToMapWithNull() {
    assertNull(K8sJobUtils.convertEnvVarsToMap(null));
  }

  @Test
  void testConvertEnvVarsToMapWithEmptyList() {
    List<Map<String, Object>> result = K8sJobUtils.convertEnvVarsToMap(List.of());
    assertNotNull(result);
    assertTrue(result.isEmpty());
  }

  @Test
  void testConvertEnvVarsToMapWithSimpleValue() {
    V1EnvVar envVar = new V1EnvVar().name("SIMPLE_VAR").value("simple_value");

    List<Map<String, Object>> result = K8sJobUtils.convertEnvVarsToMap(List.of(envVar));

    assertEquals(1, result.size());
    Map<String, Object> converted = result.get(0);
    assertEquals("SIMPLE_VAR", converted.get("name"));
    assertEquals("simple_value", converted.get("value"));
    assertFalse(converted.containsKey("valueFrom"));
  }

  @Test
  void testConvertEnvVarsToMapWithConfigMapKeyRef() {
    V1EnvVar envVar =
        new V1EnvVar()
            .name("CONFIG_VAR")
            .valueFrom(
                new V1EnvVarSource()
                    .configMapKeyRef(
                        new V1ConfigMapKeySelector()
                            .name("my-config")
                            .key("config-key")
                            .optional(false)));

    List<Map<String, Object>> result = K8sJobUtils.convertEnvVarsToMap(List.of(envVar));

    assertEquals(1, result.size());
    Map<String, Object> converted = result.get(0);
    assertEquals("CONFIG_VAR", converted.get("name"));
    assertFalse(converted.containsKey("value"));

    @SuppressWarnings("unchecked")
    Map<String, Object> valueFrom = (Map<String, Object>) converted.get("valueFrom");
    assertNotNull(valueFrom);

    @SuppressWarnings("unchecked")
    Map<String, Object> configMapKeyRef = (Map<String, Object>) valueFrom.get("configMapKeyRef");
    assertNotNull(configMapKeyRef);
    assertEquals("my-config", configMapKeyRef.get("name"));
    assertEquals("config-key", configMapKeyRef.get("key"));
    assertEquals(false, configMapKeyRef.get("optional"));
  }

  @Test
  void testConvertEnvVarsToMapWithSecretKeyRef() {
    V1EnvVar envVar =
        new V1EnvVar()
            .name("SECRET_VAR")
            .valueFrom(
                new V1EnvVarSource()
                    .secretKeyRef(
                        new V1SecretKeySelector()
                            .name("my-secret")
                            .key("password")
                            .optional(true)));

    List<Map<String, Object>> result = K8sJobUtils.convertEnvVarsToMap(List.of(envVar));

    Map<String, Object> converted = result.get(0);
    @SuppressWarnings("unchecked")
    Map<String, Object> valueFrom = (Map<String, Object>) converted.get("valueFrom");
    @SuppressWarnings("unchecked")
    Map<String, Object> secretKeyRef = (Map<String, Object>) valueFrom.get("secretKeyRef");

    assertEquals("my-secret", secretKeyRef.get("name"));
    assertEquals("password", secretKeyRef.get("key"));
    assertEquals(true, secretKeyRef.get("optional"));
  }

  @Test
  void testConvertEnvVarsToMapWithFieldRef() {
    V1EnvVar envVar =
        new V1EnvVar()
            .name("FIELD_VAR")
            .valueFrom(
                new V1EnvVarSource()
                    .fieldRef(
                        new V1ObjectFieldSelector().fieldPath("metadata.name").apiVersion("v1")));

    List<Map<String, Object>> result = K8sJobUtils.convertEnvVarsToMap(List.of(envVar));

    Map<String, Object> converted = result.get(0);
    @SuppressWarnings("unchecked")
    Map<String, Object> valueFrom = (Map<String, Object>) converted.get("valueFrom");
    @SuppressWarnings("unchecked")
    Map<String, Object> fieldRef = (Map<String, Object>) valueFrom.get("fieldRef");

    assertEquals("metadata.name", fieldRef.get("fieldPath"));
    assertEquals("v1", fieldRef.get("apiVersion"));
  }

  @Test
  void testConvertEnvVarsToMapWithResourceFieldRef() {
    V1EnvVar envVar =
        new V1EnvVar()
            .name("RESOURCE_VAR")
            .valueFrom(
                new V1EnvVarSource()
                    .resourceFieldRef(
                        new V1ResourceFieldSelector()
                            .resource("limits.memory")
                            .containerName("main")
                            .divisor(new Quantity("1Mi"))));

    List<Map<String, Object>> result = K8sJobUtils.convertEnvVarsToMap(List.of(envVar));

    Map<String, Object> converted = result.get(0);
    @SuppressWarnings("unchecked")
    Map<String, Object> valueFrom = (Map<String, Object>) converted.get("valueFrom");
    @SuppressWarnings("unchecked")
    Map<String, Object> resourceFieldRef = (Map<String, Object>) valueFrom.get("resourceFieldRef");

    assertEquals("limits.memory", resourceFieldRef.get("resource"));
    assertEquals("main", resourceFieldRef.get("containerName"));
    assertNotNull(resourceFieldRef.get("divisor"));
  }

  @Test
  void testConvertEnvVarsToMapWithEmptyValueFrom() {
    // Edge case: env var with empty valueFrom should not fail
    V1EnvVar envVar = new V1EnvVar().name("EMPTY_VALUE_FROM").valueFrom(new V1EnvVarSource());

    List<Map<String, Object>> result = K8sJobUtils.convertEnvVarsToMap(List.of(envVar));

    assertEquals(1, result.size());
    Map<String, Object> converted = result.get(0);
    assertEquals("EMPTY_VALUE_FROM", converted.get("name"));

    // valueFrom should be present but empty
    @SuppressWarnings("unchecked")
    Map<String, Object> valueFrom = (Map<String, Object>) converted.get("valueFrom");
    assertNotNull(valueFrom);
    assertTrue(valueFrom.isEmpty());
  }

  @Test
  void testBuildPodSpecMapMinimal() {
    OMJob.OMJobPodSpec podSpec =
        OMJob.OMJobPodSpec.builder()
            .image("test-image:latest")
            .imagePullPolicy("IfNotPresent")
            .command(List.of("python", "main.py"))
            .build();

    Map<String, Object> result = K8sJobUtils.buildPodSpecMap(podSpec);

    assertEquals("test-image:latest", result.get("image"));
    assertEquals("IfNotPresent", result.get("imagePullPolicy"));
    assertEquals(List.of("python", "main.py"), result.get("command"));
    assertNull(result.get("env"));
  }

  @Test
  void testBuildPodSpecMapComplete() {
    V1EnvVar envVar = new V1EnvVar().name("TEST").value("value");
    V1ResourceRequirements resources =
        new V1ResourceRequirements()
            .requests(Map.of("cpu", new Quantity("100m")))
            .limits(Map.of("cpu", new Quantity("500m")));
    V1LocalObjectReference pullSecret = new V1LocalObjectReference().name("regcred");
    V1PodSecurityContext securityContext = new V1PodSecurityContext().runAsUser(1000L);

    OMJob.OMJobPodSpec podSpec =
        OMJob.OMJobPodSpec.builder()
            .image("test-image:latest")
            .imagePullPolicy("Always")
            .command(List.of("sh", "-c", "echo hello"))
            .env(List.of(envVar))
            .serviceAccountName("my-sa")
            .resources(resources)
            .imagePullSecrets(List.of(pullSecret))
            .nodeSelector(Map.of("node-type", "compute"))
            .securityContext(securityContext)
            .labels(Map.of("app", "test"))
            .annotations(Map.of("annotation", "value"))
            .build();

    Map<String, Object> result = K8sJobUtils.buildPodSpecMap(podSpec);

    assertEquals("test-image:latest", result.get("image"));
    assertEquals("Always", result.get("imagePullPolicy"));
    assertEquals(List.of("sh", "-c", "echo hello"), result.get("command"));
    assertNotNull(result.get("env"));
    assertEquals("my-sa", result.get("serviceAccountName"));
    assertEquals(resources, result.get("resources"));
    assertEquals(List.of(pullSecret), result.get("imagePullSecrets"));
    assertEquals(Map.of("node-type", "compute"), result.get("nodeSelector"));
    assertEquals(securityContext, result.get("securityContext"));
    assertEquals(Map.of("app", "test"), result.get("labels"));
    assertEquals(Map.of("annotation", "value"), result.get("annotations"));
  }

  @Test
  void testBuildPodSpecMapWithComplexEnvVars() {
    List<V1EnvVar> envVars =
        List.of(
            new V1EnvVar().name("SIMPLE").value("simple_value"),
            new V1EnvVar()
                .name("CONFIG_REF")
                .valueFrom(
                    new V1EnvVarSource()
                        .configMapKeyRef(new V1ConfigMapKeySelector().name("config").key("key"))),
            new V1EnvVar()
                .name("SECRET_REF")
                .valueFrom(
                    new V1EnvVarSource()
                        .secretKeyRef(new V1SecretKeySelector().name("secret").key("password"))));

    OMJob.OMJobPodSpec podSpec =
        OMJob.OMJobPodSpec.builder()
            .image("test-image")
            .imagePullPolicy("Never")
            .command(List.of("python"))
            .env(envVars)
            .build();

    Map<String, Object> result = K8sJobUtils.buildPodSpecMap(podSpec);

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> convertedEnvs = (List<Map<String, Object>>) result.get("env");
    assertNotNull(convertedEnvs);
    assertEquals(3, convertedEnvs.size());

    // Verify simple env var
    Map<String, Object> simpleEnv = convertedEnvs.get(0);
    assertEquals("SIMPLE", simpleEnv.get("name"));
    assertEquals("simple_value", simpleEnv.get("value"));

    // Verify configmap env var
    Map<String, Object> configEnv = convertedEnvs.get(1);
    assertEquals("CONFIG_REF", configEnv.get("name"));
    assertNotNull(configEnv.get("valueFrom"));

    // Verify secret env var
    Map<String, Object> secretEnv = convertedEnvs.get(2);
    assertEquals("SECRET_REF", secretEnv.get("name"));
    assertNotNull(secretEnv.get("valueFrom"));
  }
}
