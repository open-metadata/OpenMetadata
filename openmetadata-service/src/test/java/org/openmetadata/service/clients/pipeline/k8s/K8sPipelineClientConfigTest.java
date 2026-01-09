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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.sdk.exception.PipelineServiceClientException;

class K8sPipelineClientConfigTest {

  @Test
  void testDefaultConfiguration() {
    // Test with empty parameters
    K8sPipelineClientConfig config = new K8sPipelineClientConfig(null);

    assertEquals("openmetadata-pipelines", config.getNamespace());
    assertEquals("docker.getcollate.io/openmetadata/ingestion:latest", config.getIngestionImage());
    assertEquals("IfNotPresent", config.getImagePullPolicy());
    assertEquals("openmetadata-ingestion", config.getServiceAccountName());
    assertEquals(604800, config.getTtlSecondsAfterFinished()); // 1 week
    assertEquals(7200L, config.getActiveDeadlineSeconds());
    assertEquals(3, config.getBackoffLimit());
    assertEquals(3, config.getSuccessfulJobsHistoryLimit());
    assertEquals(3, config.getFailedJobsHistoryLimit());
    assertEquals(Long.valueOf(1000), config.getRunAsUser());
    assertEquals(Long.valueOf(1000), config.getRunAsGroup());
    assertEquals(Long.valueOf(1000), config.getFsGroup());
    assertTrue(config.isRunAsNonRoot());
    assertTrue(config.getImagePullSecrets().isEmpty());
    assertTrue(config.getNodeSelector().isEmpty());
    assertTrue(config.getExtraEnvVars().isEmpty());
    assertTrue(config.getPodAnnotations().isEmpty());

    // Test default resources
    assertEquals("500m", config.getResources().requests().cpu());
    assertEquals("1Gi", config.getResources().requests().memory());
    assertEquals("2", config.getResources().limits().cpu());
    assertEquals("4Gi", config.getResources().limits().memory());
  }

  @Test
  void testCustomConfiguration() {
    Map<String, Object> params = new HashMap<>();
    params.put("namespace", "custom-namespace");
    params.put("ingestionImage", "custom-image:latest");
    params.put("imagePullPolicy", "Always");
    params.put("serviceAccountName", "custom-sa");
    params.put("ttlSecondsAfterFinished", "3600");
    params.put("activeDeadlineSeconds", "1800");
    params.put("backoffLimit", "5");
    params.put("successfulJobsHistoryLimit", "5");
    params.put("failedJobsHistoryLimit", "5");
    params.put("runAsUser", "2000");
    params.put("runAsGroup", "2000");
    params.put("fsGroup", "2000");
    params.put("runAsNonRoot", "false");

    K8sPipelineClientConfig config = new K8sPipelineClientConfig(params);

    assertEquals("custom-namespace", config.getNamespace());
    assertEquals("custom-image:latest", config.getIngestionImage());
    assertEquals("Always", config.getImagePullPolicy());
    assertEquals("custom-sa", config.getServiceAccountName());
    assertEquals(3600, config.getTtlSecondsAfterFinished());
    assertEquals(1800L, config.getActiveDeadlineSeconds());
    assertEquals(5, config.getBackoffLimit());
    assertEquals(5, config.getSuccessfulJobsHistoryLimit());
    assertEquals(5, config.getFailedJobsHistoryLimit());
    assertEquals(Long.valueOf(2000), config.getRunAsUser());
    assertEquals(Long.valueOf(2000), config.getRunAsGroup());
    assertEquals(Long.valueOf(2000), config.getFsGroup());
    assertFalse(config.isRunAsNonRoot());
  }

  @Test
  void testResourceConfiguration() {
    Map<String, Object> params = new HashMap<>();
    Map<String, Map<String, String>> resources = new HashMap<>();
    Map<String, String> requests = new HashMap<>();
    requests.put("cpu", "1");
    requests.put("memory", "2Gi");
    Map<String, String> limits = new HashMap<>();
    limits.put("cpu", "4");
    limits.put("memory", "8Gi");
    resources.put("requests", requests);
    resources.put("limits", limits);
    params.put("resources", resources);

    K8sPipelineClientConfig config = new K8sPipelineClientConfig(params);

    assertEquals("1", config.getResourceRequests().get("cpu").toSuffixedString());
    assertEquals("2Gi", config.getResourceRequests().get("memory").toSuffixedString());
    assertEquals("4", config.getResourceLimits().get("cpu").toSuffixedString());
    assertEquals("8Gi", config.getResourceLimits().get("memory").toSuffixedString());

    // Test the resources object directly
    assertEquals("1", config.getResources().requests().cpu());
    assertEquals("2Gi", config.getResources().requests().memory());
    assertEquals("4", config.getResources().limits().cpu());
    assertEquals("8Gi", config.getResources().limits().memory());
  }

  @Test
  void testImagePullSecretsParser() {
    Map<String, Object> params = new HashMap<>();
    params.put("imagePullSecrets", "secret1,secret2,secret3");

    K8sPipelineClientConfig config = new K8sPipelineClientConfig(params);

    assertEquals(3, config.getImagePullSecrets().size());
    assertEquals("secret1", config.getImagePullSecrets().get(0).getName());
    assertEquals("secret2", config.getImagePullSecrets().get(1).getName());
    assertEquals("secret3", config.getImagePullSecrets().get(2).getName());
  }

  @Test
  void testEmptyImagePullSecrets() {
    Map<String, Object> params = new HashMap<>();
    params.put("imagePullSecrets", "");

    K8sPipelineClientConfig config = new K8sPipelineClientConfig(params);

    assertTrue(config.getImagePullSecrets().isEmpty());
  }

  @Test
  void testNodeSelectorParser() {
    Map<String, Object> params = new HashMap<>();
    params.put("nodeSelector", "disktype=ssd,zone=us-west1");

    K8sPipelineClientConfig config = new K8sPipelineClientConfig(params);

    assertEquals(2, config.getNodeSelector().size());
    assertEquals("ssd", config.getNodeSelector().get("disktype"));
    assertEquals("us-west1", config.getNodeSelector().get("zone"));
  }

  @Test
  void testExtraEnvVarsParser() {
    Map<String, Object> params = new HashMap<>();
    List<String> extraEnvs = List.of("ENV1:value1", "ENV2:value2");
    params.put("extraEnvVars", extraEnvs);

    K8sPipelineClientConfig config = new K8sPipelineClientConfig(params);

    assertEquals(2, config.getExtraEnvVars().size());
    assertEquals("value1", config.getExtraEnvVars().get("ENV1"));
    assertEquals("value2", config.getExtraEnvVars().get("ENV2"));
  }

  @Test
  void testEmptyExtraEnvVars() {
    Map<String, Object> params = new HashMap<>();
    params.put("extraEnvVars", new ArrayList<>());

    K8sPipelineClientConfig config = new K8sPipelineClientConfig(params);

    assertTrue(config.getExtraEnvVars().isEmpty());
  }

  @Test
  void testExtraEnvVarsWithInvalidFormat() {
    Map<String, Object> params = new HashMap<>();
    List<String> extraEnvs = List.of("VALID:value1", "invalid-format", "ANOTHER:value2");
    params.put("extraEnvVars", extraEnvs);

    K8sPipelineClientConfig config = new K8sPipelineClientConfig(params);

    // Should only parse valid entries and skip invalid ones
    assertEquals(2, config.getExtraEnvVars().size());
    assertEquals("value1", config.getExtraEnvVars().get("VALID"));
    assertEquals("value2", config.getExtraEnvVars().get("ANOTHER"));
  }

  @Test
  void testPodAnnotationsParser() {
    Map<String, Object> params = new HashMap<>();
    params.put("podAnnotations", "annotation1=value1,annotation2=value2");

    K8sPipelineClientConfig config = new K8sPipelineClientConfig(params);

    assertEquals(2, config.getPodAnnotations().size());
    assertEquals("value1", config.getPodAnnotations().get("annotation1"));
    assertEquals("value2", config.getPodAnnotations().get("annotation2"));
  }

  @Test
  void testValidationWithInvalidNamespace() {
    Map<String, Object> params = new HashMap<>();
    params.put("namespace", "INVALID-NAMESPACE");

    Exception exception =
        assertThrows(
            PipelineServiceClientException.class, () -> new K8sPipelineClientConfig(params));

    assertTrue(exception.getMessage().contains("namespace 'INVALID-NAMESPACE' is invalid"));
  }

  @Test
  void testValidationWithBlankNamespace() {
    Map<String, Object> params = new HashMap<>();
    params.put("namespace", "");

    Exception exception =
        assertThrows(
            PipelineServiceClientException.class, () -> new K8sPipelineClientConfig(params));

    assertTrue(exception.getMessage().contains("namespace cannot be blank"));
  }

  @Test
  void testValidationWithBlankImage() {
    Map<String, Object> params = new HashMap<>();
    params.put("ingestionImage", "");

    Exception exception =
        assertThrows(
            PipelineServiceClientException.class, () -> new K8sPipelineClientConfig(params));

    assertTrue(exception.getMessage().contains("ingestionImage cannot be blank"));
  }

  @Test
  void testValidationWithNegativeTtl() {
    Map<String, Object> params = new HashMap<>();
    params.put("ttlSecondsAfterFinished", "-100");

    Exception exception =
        assertThrows(
            PipelineServiceClientException.class, () -> new K8sPipelineClientConfig(params));

    assertTrue(exception.getMessage().contains("ttlSecondsAfterFinished must be non-negative"));
  }

  @Test
  void testValidationWithZeroActiveDeadline() {
    Map<String, Object> params = new HashMap<>();
    params.put("activeDeadlineSeconds", "0");

    Exception exception =
        assertThrows(
            PipelineServiceClientException.class, () -> new K8sPipelineClientConfig(params));

    assertTrue(exception.getMessage().contains("activeDeadlineSeconds must be positive"));
  }

  @Test
  void testValidationWithNegativeBackoffLimit() {
    Map<String, Object> params = new HashMap<>();
    params.put("backoffLimit", "-1");

    Exception exception =
        assertThrows(
            PipelineServiceClientException.class, () -> new K8sPipelineClientConfig(params));

    assertTrue(exception.getMessage().contains("backoffLimit must be non-negative"));
  }

  @Test
  void testGetIntParamWithInvalidValue() {
    Map<String, Object> params = new HashMap<>();
    params.put("ttlSecondsAfterFinished", "invalid");

    // Should use default value when parsing fails
    K8sPipelineClientConfig config = new K8sPipelineClientConfig(params);
    assertEquals(604800, config.getTtlSecondsAfterFinished()); // 1 week
  }

  @Test
  void testGetLongParamWithInvalidValue() {
    Map<String, Object> params = new HashMap<>();
    params.put("runAsUser", "invalid");

    // Should use default value when parsing fails
    K8sPipelineClientConfig config = new K8sPipelineClientConfig(params);
    assertEquals(Long.valueOf(1000), config.getRunAsUser());
  }

  @Test
  void testKeyValuePairsWithInvalidFormat() {
    Map<String, Object> params = new HashMap<>();
    params.put("nodeSelector", "invalidformat");

    K8sPipelineClientConfig config = new K8sPipelineClientConfig(params);

    assertTrue(config.getNodeSelector().isEmpty());
  }

  @Test
  void testExtraEnvVarsWithNonListValue() {
    Map<String, Object> params = new HashMap<>();
    params.put("extraEnvVars", "not-a-list");

    K8sPipelineClientConfig config = new K8sPipelineClientConfig(params);

    // Should handle gracefully and return empty map
    assertTrue(config.getExtraEnvVars().isEmpty());
  }

  @Test
  void testConfigurationGetters() {
    Map<String, Object> params = new HashMap<>();
    params.put("namespace", "test-namespace");

    K8sPipelineClientConfig config = new K8sPipelineClientConfig(params);

    // Test all getters return non-null values
    assertNotNull(config.getNamespace());
    assertNotNull(config.getIngestionImage());
    assertNotNull(config.getImagePullPolicy());
    assertNotNull(config.getImagePullSecrets());
    assertNotNull(config.getServiceAccountName());
    assertNotNull(config.getResourceRequests());
    assertNotNull(config.getResourceLimits());
    assertNotNull(config.getResources());
    assertNotNull(config.getNodeSelector());
    assertNotNull(config.getExtraEnvVars());
    assertNotNull(config.getPodAnnotations());
  }

  @Test
  void testFailureDiagnosticsConfiguration() {
    // Test default value (disabled)
    K8sPipelineClientConfig config = new K8sPipelineClientConfig(null);
    assertFalse(config.isFailureDiagnosticsEnabled());

    // Test explicit enable
    Map<String, Object> params = new HashMap<>();
    params.put("enableFailureDiagnostics", "true");

    K8sPipelineClientConfig enabledConfig = new K8sPipelineClientConfig(params);
    assertTrue(enabledConfig.isFailureDiagnosticsEnabled());

    // Test explicit disable
    params.put("enableFailureDiagnostics", "false");
    K8sPipelineClientConfig disabledConfig = new K8sPipelineClientConfig(params);
    assertFalse(disabledConfig.isFailureDiagnosticsEnabled());
  }

  @Test
  void testFailureDiagnosticsInvalidValue() {
    Map<String, Object> params = new HashMap<>();
    params.put("enableFailureDiagnostics", "invalid-value");

    // Should default to false for invalid values
    K8sPipelineClientConfig config = new K8sPipelineClientConfig(params);
    assertFalse(config.isFailureDiagnosticsEnabled());
  }
}
