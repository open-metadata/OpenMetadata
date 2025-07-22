/*
 *  Copyright 2025 Collate
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
package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.kubernetes.client.openapi.ApiException;
import io.kubernetes.client.openapi.apis.CoreV1Api;
import io.kubernetes.client.openapi.models.V1ObjectMeta;
import io.kubernetes.client.openapi.models.V1Secret;
import io.kubernetes.client.openapi.models.V1Status;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.security.secrets.Parameters;

@ExtendWith(MockitoExtension.class)
class KubernetesSecretsManagerTest {
  private static final String CLUSTER_NAME = "openmetadata";
  private static final String NAMESPACE = "default";
  private static final String SECRET_NAME = "/openmetadata/database/password";
  private static final String SECRET_VALUE = "test-password";
  private static final String K8S_SECRET_NAME = "openmetadata-database-password";

  private KubernetesSecretsManager secretsManager;

  @Mock private CoreV1Api mockApiClient;

  @Mock private CoreV1Api.APIcreateNamespacedSecretRequest createRequest;

  @Mock private CoreV1Api.APIreadNamespacedSecretRequest readRequest;

  @Mock private CoreV1Api.APIreplaceNamespacedSecretRequest replaceRequest;

  @Mock private CoreV1Api.APIdeleteNamespacedSecretRequest deleteRequest;

  @BeforeEach
  void setUp() throws Exception {
    java.lang.reflect.Field instanceField =
        KubernetesSecretsManager.class.getDeclaredField("instance");
    instanceField.setAccessible(true);
    instanceField.set(null, null);

    Parameters parameters = new Parameters();
    parameters.setAdditionalProperty("namespace", NAMESPACE);
    parameters.setAdditionalProperty("inCluster", "false");
    parameters.setAdditionalProperty("skipInit", "true");

    SecretsManager.SecretsConfig secretsConfig =
        new SecretsManager.SecretsConfig(CLUSTER_NAME, "", new ArrayList<>(), parameters);

    secretsManager = KubernetesSecretsManager.getInstance(secretsConfig);
    secretsManager.setApiClient(mockApiClient);
    secretsManager.setNamespace(NAMESPACE);
  }

  @Test
  void testStoreSecret() throws ApiException {
    ArgumentCaptor<V1Secret> secretCaptor = ArgumentCaptor.forClass(V1Secret.class);
    when(mockApiClient.readNamespacedSecret(anyString(), eq(NAMESPACE))).thenReturn(readRequest);
    when(readRequest.execute()).thenThrow(new ApiException(404, "Not Found"));

    when(mockApiClient.createNamespacedSecret(eq(NAMESPACE), any(V1Secret.class)))
        .thenReturn(createRequest);
    when(createRequest.execute()).thenReturn(new V1Secret());
    secretsManager.storeValue("password", SECRET_VALUE, SECRET_NAME, true);

    verify(mockApiClient).createNamespacedSecret(eq(NAMESPACE), secretCaptor.capture());
    verify(createRequest).execute();

    V1Secret createdSecret = secretCaptor.getValue();
    assertNotNull(createdSecret);
    String expectedName = "openmetadata-database-password-password";
    assertEquals(expectedName, Objects.requireNonNull(createdSecret.getMetadata()).getName());
    assertEquals(NAMESPACE, createdSecret.getMetadata().getNamespace());

    Map<String, String> labels = createdSecret.getMetadata().getLabels();
    assertNotNull(labels);
    assertEquals("openmetadata", labels.get("app"));
    assertEquals("openmetadata-secrets-manager", labels.get("managed-by"));

    Map<String, byte[]> data = createdSecret.getData();
    assertNotNull(data);
    assertEquals(SECRET_VALUE, new String(data.get("value"), StandardCharsets.UTF_8));
  }

  @Test
  void testGetSecret() throws ApiException {
    V1Secret mockSecret = createMockSecret(SECRET_VALUE);

    when(mockApiClient.readNamespacedSecret(K8S_SECRET_NAME, NAMESPACE)).thenReturn(readRequest);
    when(readRequest.execute()).thenReturn(mockSecret);

    String retrievedValue = secretsManager.getSecret(SECRET_NAME);

    assertEquals(SECRET_VALUE, retrievedValue);
    verify(mockApiClient).readNamespacedSecret(K8S_SECRET_NAME, NAMESPACE);
    verify(readRequest).execute();
  }

  @Test
  void testGetSecretNotFound() throws ApiException {
    when(mockApiClient.readNamespacedSecret(K8S_SECRET_NAME, NAMESPACE)).thenReturn(readRequest);
    when(readRequest.execute()).thenThrow(new ApiException(404, "Not Found"));

    String retrievedValue = secretsManager.getSecret(SECRET_NAME);

    assertNull(retrievedValue);
    verify(mockApiClient).readNamespacedSecret(K8S_SECRET_NAME, NAMESPACE);
    verify(readRequest).execute();
  }

  @Test
  void testUpdateSecret() throws ApiException {
    V1Secret existingSecret = createMockSecret("old-value");
    ArgumentCaptor<V1Secret> secretCaptor = ArgumentCaptor.forClass(V1Secret.class);

    when(mockApiClient.readNamespacedSecret(K8S_SECRET_NAME, NAMESPACE)).thenReturn(readRequest);
    when(readRequest.execute()).thenReturn(existingSecret);

    when(mockApiClient.replaceNamespacedSecret(
            eq(K8S_SECRET_NAME), eq(NAMESPACE), any(V1Secret.class)))
        .thenReturn(replaceRequest);
    when(replaceRequest.execute()).thenReturn(new V1Secret());

    secretsManager.updateSecret(SECRET_NAME, SECRET_VALUE);

    verify(mockApiClient)
        .replaceNamespacedSecret(eq(K8S_SECRET_NAME), eq(NAMESPACE), secretCaptor.capture());
    verify(replaceRequest).execute();

    V1Secret updatedSecret = secretCaptor.getValue();
    Map<String, byte[]> data = updatedSecret.getData();
    assert data != null;
    assertEquals(SECRET_VALUE, new String(data.get("value"), StandardCharsets.UTF_8));
  }

  @Test
  void testUpdateSecretNotFoundCreatesNew() throws ApiException {
    when(mockApiClient.readNamespacedSecret(K8S_SECRET_NAME, NAMESPACE)).thenReturn(readRequest);
    when(readRequest.execute()).thenThrow(new ApiException(404, "Not Found"));

    when(mockApiClient.createNamespacedSecret(eq(NAMESPACE), any(V1Secret.class)))
        .thenReturn(createRequest);
    when(createRequest.execute()).thenReturn(new V1Secret());

    secretsManager.updateSecret(SECRET_NAME, SECRET_VALUE);

    verify(mockApiClient).createNamespacedSecret(eq(NAMESPACE), any(V1Secret.class));
    verify(createRequest).execute();
  }

  @Test
  void testExistSecret() throws ApiException {
    V1Secret mockSecret = createMockSecret(SECRET_VALUE);

    when(mockApiClient.readNamespacedSecret(K8S_SECRET_NAME, NAMESPACE)).thenReturn(readRequest);
    when(readRequest.execute()).thenReturn(mockSecret);

    boolean exists = secretsManager.existSecret(SECRET_NAME);

    assertTrue(exists);
    verify(mockApiClient).readNamespacedSecret(K8S_SECRET_NAME, NAMESPACE);
    verify(readRequest).execute();
  }

  @Test
  void testExistSecretNotFound() throws ApiException {
    when(mockApiClient.readNamespacedSecret(K8S_SECRET_NAME, NAMESPACE)).thenReturn(readRequest);
    when(readRequest.execute()).thenThrow(new ApiException(404, "Not Found"));

    boolean exists = secretsManager.existSecret(SECRET_NAME);

    assertFalse(exists);
    verify(mockApiClient).readNamespacedSecret(K8S_SECRET_NAME, NAMESPACE);
    verify(readRequest).execute();
  }

  @Test
  void testDeleteSecret() throws Exception {
    // Use reflection to test protected method
    when(mockApiClient.deleteNamespacedSecret(K8S_SECRET_NAME, NAMESPACE))
        .thenReturn(deleteRequest);
    when(deleteRequest.execute()).thenReturn(new V1Status());

    // Call deleteSecretInternal via reflection
    java.lang.reflect.Method deleteMethod =
        KubernetesSecretsManager.class.getDeclaredMethod("deleteSecretInternal", String.class);
    deleteMethod.setAccessible(true);
    deleteMethod.invoke(secretsManager, K8S_SECRET_NAME);

    verify(mockApiClient).deleteNamespacedSecret(K8S_SECRET_NAME, NAMESPACE);
    verify(deleteRequest).execute();
  }

  @Test
  void testDeleteSecretNotFound() throws Exception {
    when(mockApiClient.deleteNamespacedSecret(K8S_SECRET_NAME, NAMESPACE))
        .thenReturn(deleteRequest);
    when(deleteRequest.execute()).thenThrow(new ApiException(404, "Not Found"));

    // Call deleteSecretInternal via reflection
    java.lang.reflect.Method deleteMethod =
        KubernetesSecretsManager.class.getDeclaredMethod("deleteSecretInternal", String.class);
    deleteMethod.setAccessible(true);

    // Should not throw exception
    deleteMethod.invoke(secretsManager, K8S_SECRET_NAME);

    verify(mockApiClient).deleteNamespacedSecret(K8S_SECRET_NAME, NAMESPACE);
    verify(deleteRequest).execute();
  }

  @Test
  void testSanitizeSecretName() throws ApiException {
    // Test various secret name patterns
    // The storeValue returns "secret:" + original secretId + "/" + fieldName
    testSanitizedName(
        "/prefix/cluster/service/password",
        "prefix-cluster-service-password-field",
        "secret:/prefix/cluster/service/password/field");
    testSanitizedName(
        "///leading-slashes", "leading-slashes-field", "secret:///leading-slashes/field");
    testSanitizedName("UPPERCASE-NAME", "uppercase-name-field", "secret:uppercase-name/field");
    testSanitizedName(
        "special@#$%characters", "special-characters-field", "secret:special____characters/field");
    testSanitizedName(
        "consecutive---hyphens", "consecutive-hyphens-field", "secret:consecutive---hyphens/field");
    testSanitizedName("-leading-hyphen", "leading-hyphen-field", "secret:-leading-hyphen/field");
    testSanitizedName("trailing-hyphen-", "trailing-hyphen-field", "secret:trailing-hyphen-/field");
  }

  @Test
  void testNullSecretHandling() throws ApiException {
    ArgumentCaptor<V1Secret> secretCaptor = ArgumentCaptor.forClass(V1Secret.class);
    when(mockApiClient.readNamespacedSecret(anyString(), eq(NAMESPACE))).thenReturn(readRequest);
    when(readRequest.execute()).thenThrow(new ApiException(404, "Not Found"));

    when(mockApiClient.createNamespacedSecret(eq(NAMESPACE), any(V1Secret.class)))
        .thenReturn(createRequest);
    when(createRequest.execute()).thenReturn(new V1Secret());

    secretsManager.storeValue("field", "", SECRET_NAME, true);

    verify(mockApiClient).createNamespacedSecret(eq(NAMESPACE), secretCaptor.capture());
    verify(createRequest).execute();

    V1Secret createdSecret = secretCaptor.getValue();
    Map<String, byte[]> data = createdSecret.getData();
    assert data != null;
    assertEquals("", new String(data.get("value"), StandardCharsets.UTF_8));
  }

  private V1Secret createMockSecret(String value) {
    V1Secret secret = new V1Secret();
    V1ObjectMeta metadata = new V1ObjectMeta();
    metadata.setName(K8S_SECRET_NAME);
    metadata.setNamespace(NAMESPACE);
    secret.setMetadata(metadata);

    Map<String, byte[]> data = new HashMap<>();
    data.put("value", value.getBytes(StandardCharsets.UTF_8));
    secret.setData(data);

    return secret;
  }

  private void testSanitizedName(String input, String expectedSanitizedName, String expectedResult)
      throws ApiException {
    reset(mockApiClient, readRequest, createRequest);
    when(mockApiClient.readNamespacedSecret(anyString(), eq(NAMESPACE))).thenReturn(readRequest);
    when(readRequest.execute()).thenThrow(new ApiException(404, "Not Found"));
    ArgumentCaptor<V1Secret> secretCaptor = ArgumentCaptor.forClass(V1Secret.class);
    when(mockApiClient.createNamespacedSecret(eq(NAMESPACE), any(V1Secret.class)))
        .thenReturn(createRequest);
    when(createRequest.execute()).thenReturn(new V1Secret());
    String result = secretsManager.storeValue("field", "value", input, true);
    verify(mockApiClient).createNamespacedSecret(eq(NAMESPACE), secretCaptor.capture());
    V1Secret createdSecret = secretCaptor.getValue();
    String actualName = Objects.requireNonNull(createdSecret.getMetadata()).getName();
    assertEquals(expectedSanitizedName, actualName);
    assertEquals(expectedResult, result);
  }

  @AfterEach
  void tearDown() throws Exception {
    // Reset singleton instance after each test
    java.lang.reflect.Field instanceField =
        KubernetesSecretsManager.class.getDeclaredField("instance");
    instanceField.setAccessible(true);
    instanceField.set(null, null);
  }
}
