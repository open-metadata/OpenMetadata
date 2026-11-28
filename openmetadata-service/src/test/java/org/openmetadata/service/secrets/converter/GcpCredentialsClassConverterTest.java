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

package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.credentials.GCPCredentials;
import org.openmetadata.schema.security.credentials.GCPExternalAccount;
import org.openmetadata.schema.security.credentials.GCPValues;
import org.openmetadata.schema.services.connections.database.datalake.GCSConfig;

/**
 * {@link GcpCredentialsClassConverter} re-types the {@code gcpConfig} {@code oneOf}. The {@code
 * type} discriminator must keep the branch the user chose: an ADC payload used to bind into {@link
 * GCPValues} (violating its {@code const: "service_account"} and injecting four Google endpoint
 * defaults), and the {@code gcp_credential_path} / {@code external_account} branches stayed as
 * untyped {@link LinkedHashMap}s.
 */
class GcpCredentialsClassConverterTest {

  private static final String PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----";

  private final GcpCredentialsClassConverter converter = new GcpCredentialsClassConverter();

  /**
   * The {@code service_account} branch is the one the old converter handled; it must keep typing
   * into {@link GCPValues} so the password masker can mask {@code privateKey}.
   */
  @Test
  void convertServiceAccountTypesIntoGcpValues() {
    Map<String, Object> gcpConfig =
        new LinkedHashMap<>(
            Map.of(
                "type", "service_account",
                "projectId", "my-project",
                "privateKey", PRIVATE_KEY,
                "clientEmail", "sa@my-project.iam.gserviceaccount.com"));

    Object result = converter.convert(Map.of("gcpConfig", gcpConfig));

    GCPCredentials credentials = assertInstanceOf(GCPCredentials.class, result);
    GCPValues values = assertInstanceOf(GCPValues.class, credentials.getGcpConfig());
    assertEquals("service_account", values.getType());
    assertEquals("my-project", values.getProjectId());
    assertEquals(PRIVATE_KEY, values.getPrivateKey());
  }

  /**
   * The reported bug: an ADC payload binds into {@link GCPValues} and has four synthetic Google
   * endpoint defaults injected. After the fix it stays an untyped {@link LinkedHashMap} holding
   * exactly what the user submitted.
   */
  @Test
  void convertAdcLeavesUntypedMapWithoutInjectedDefaults() {
    Map<String, Object> gcpConfig =
        new LinkedHashMap<>(Map.of("type", "gcp_adc", "projectId", "my-project"));

    Object result = converter.convert(Map.of("gcpConfig", gcpConfig));

    GCPCredentials credentials = assertInstanceOf(GCPCredentials.class, result);
    assertFalse(
        credentials.getGcpConfig() instanceof GCPValues, "ADC must not bind into GCPValues");
    Map<?, ?> gcpConfigMap = assertInstanceOf(Map.class, credentials.getGcpConfig());
    // Exactly the user's payload -- no injected Google endpoint defaults.
    assertEquals(Map.of("type", "gcp_adc", "projectId", "my-project"), gcpConfigMap);
    assertFalse(gcpConfigMap.containsKey("authUri"));
    assertFalse(gcpConfigMap.containsKey("tokenUri"));
    assertFalse(gcpConfigMap.containsKey("authProviderX509CertUrl"));
    assertFalse(gcpConfigMap.containsKey("universeDomain"));
  }

  /**
   * The {@code gcp_credential_path} branch has no generated POJO, so it must stay an untyped {@link
   * LinkedHashMap}; the old converter tried {@link GCPValues}, failed on the unknown {@code path}
   * field and swallowed the exception, leaving it untyped -- but only by accident. The fix leaves
   * it untyped by design.
   */
  @Test
  void convertCredentialsPathLeavesUntypedMap() {
    Map<String, Object> gcpConfig =
        new LinkedHashMap<>(
            Map.of("type", "gcp_credential_path", "path", "/tmp/creds.json", "projectId", "p"));

    Object result = converter.convert(Map.of("gcpConfig", gcpConfig));

    GCPCredentials credentials = assertInstanceOf(GCPCredentials.class, result);
    assertFalse(credentials.getGcpConfig() instanceof GCPValues);
    Map<?, ?> gcpConfigMap = assertInstanceOf(Map.class, credentials.getGcpConfig());
    assertEquals(
        Map.of("type", "gcp_credential_path", "path", "/tmp/creds.json", "projectId", "p"),
        gcpConfigMap);
    assertFalse(gcpConfigMap.containsKey("authUri"));
    assertFalse(gcpConfigMap.containsKey("universeDomain"));
  }

  /** The {@code external_account} branch has a generated POJO and must be typed into it. */
  @Test
  void convertExternalAccountTypesIntoGcpExternalAccount() {
    Map<String, Object> gcpConfig =
        new LinkedHashMap<>(
            Map.of(
                "type", "external_account",
                "audience",
                    "//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/p/providers/g",
                "subjectTokenType", "urn:ietf:params:oauth:token-type:jwt",
                "tokenURL", "https://sts.googleapis.com/v1/token",
                "credentialSource", Map.of("file", "/tmp/token")));

    Object result = converter.convert(Map.of("gcpConfig", gcpConfig));

    GCPCredentials credentials = assertInstanceOf(GCPCredentials.class, result);
    GCPExternalAccount external =
        assertInstanceOf(GCPExternalAccount.class, credentials.getGcpConfig());
    assertEquals("external_account", external.getType());
    assertEquals(
        "//iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/p/providers/g",
        external.getAudience());
    assertEquals("urn:ietf:params:oauth:token-type:jwt", external.getSubjectTokenType());
    assertEquals("https://sts.googleapis.com/v1/token", external.getTokenURL());
  }

  /**
   * A payload that omits {@code type} defaults to {@code service_account} (the {@code
   * gcpValues.json} schema default), preserving the legacy binding for service-account configs.
   */
  @Test
  void convertMissingTypeDefaultsToServiceAccount() {
    Map<String, Object> gcpConfig =
        new LinkedHashMap<>(Map.of("projectId", "my-project", "privateKey", PRIVATE_KEY));

    Object result = converter.convert(Map.of("gcpConfig", gcpConfig));

    GCPCredentials credentials = assertInstanceOf(GCPCredentials.class, result);
    GCPValues values = assertInstanceOf(GCPValues.class, credentials.getGcpConfig());
    assertEquals("service_account", values.getType());
    assertEquals("my-project", values.getProjectId());
  }

  /**
   * An unrecognised {@code type} is neither {@code gcp_adc} nor {@code gcp_credential_path}, so it
   * falls back to {@link GCPValues} -- the {@code gcpValues.json} default. This keeps a {@code
   * service_account} payload's {@code privateKey} reachable by the password masker even when the
   * discriminator is absent or non-standard, and matches the legacy binding.
   */
  @Test
  void convertUnrecognisedTypeFallsBackToGcpValues() {
    Map<String, Object> gcpConfig =
        new LinkedHashMap<>(
            Map.of("type", "not_a_real_branch", "projectId", "p", "privateKey", PRIVATE_KEY));

    Object result = converter.convert(Map.of("gcpConfig", gcpConfig));

    GCPCredentials credentials = assertInstanceOf(GCPCredentials.class, result);
    GCPValues values = assertInstanceOf(GCPValues.class, credentials.getGcpConfig());
    assertEquals("not_a_real_branch", values.getType());
    assertEquals("p", values.getProjectId());
    assertEquals(PRIVATE_KEY, values.getPrivateKey());
  }

  /** A {@code null} {@code gcpConfig} is a no-op (no {@code NullPointerException}). */
  @Test
  void convertNullGcpConfigIsNoOp() {
    Object result = converter.convert(Map.of());

    GCPCredentials credentials = assertInstanceOf(GCPCredentials.class, result);
    assertNull(credentials.getGcpConfig());
  }

  /**
   * The datalake GCS storage path -- {@link GCPConfigClassConverter} typing {@code
   * GCSConfig.securityConfig} -- must also keep an ADC {@code gcpConfig} untyped instead of
   * rewriting it into {@link GCPValues}. This reproduces the wrapper from the bug report.
   */
  @Test
  void datalakeGcsConfigKeepsAdcUntyped() {
    Map<String, Object> gcpConfig =
        new LinkedHashMap<>(Map.of("type", "gcp_adc", "projectId", "my-project"));
    Map<String, Object> securityConfig = Map.of("gcpConfig", gcpConfig);

    Object result =
        ClassConverterFactory.getConverter(GCSConfig.class)
            .convert(Map.of("securityConfig", securityConfig));

    GCSConfig gcs = assertInstanceOf(GCSConfig.class, result);
    GCPCredentials credentials = assertInstanceOf(GCPCredentials.class, gcs.getSecurityConfig());
    assertFalse(
        credentials.getGcpConfig() instanceof GCPValues, "ADC must not bind into GCPValues");
    Map<?, ?> gcpConfigMap = assertInstanceOf(Map.class, credentials.getGcpConfig());
    assertEquals(Map.of("type", "gcp_adc", "projectId", "my-project"), gcpConfigMap);
    assertFalse(gcpConfigMap.containsKey("authUri"));
    assertFalse(gcpConfigMap.containsKey("tokenUri"));
    assertFalse(gcpConfigMap.containsKey("authProviderX509CertUrl"));
    assertFalse(gcpConfigMap.containsKey("universeDomain"));
  }

  /**
   * The datalake GCS storage path keeps the {@code service_account} branch typed into {@link
   * GCPValues}, guarding against a regression in the wrapper converter.
   */
  @Test
  void datalakeGcsConfigTypesServiceAccount() {
    Map<String, Object> gcpConfig =
        new LinkedHashMap<>(
            Map.of(
                "type", "service_account", "projectId", "my-project", "privateKey", PRIVATE_KEY));
    Map<String, Object> securityConfig = Map.of("gcpConfig", gcpConfig);

    Object result =
        ClassConverterFactory.getConverter(GCSConfig.class)
            .convert(Map.of("securityConfig", securityConfig));

    GCSConfig gcs = assertInstanceOf(GCSConfig.class, result);
    GCPCredentials credentials = assertInstanceOf(GCPCredentials.class, gcs.getSecurityConfig());
    GCPValues values = assertInstanceOf(GCPValues.class, credentials.getGcpConfig());
    assertEquals(PRIVATE_KEY, values.getPrivateKey());
  }
}
