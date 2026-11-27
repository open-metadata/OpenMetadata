/*
 *  Copyright 2026 Collate
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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.sso.config.SecurityConfigSwap;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

/**
 * The stored secrets of the security configuration stay where they are: a patch works on the
 * configuration as an admin reads it, masked, and a secret is never restored for a new destination
 * (ADR:2026-11-03-security-config-writes-never-move-a-stored-secret).
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
class SecurityConfigSecretsIT {
  private static final String PATH = "/v1/system/security/config";
  private static final String SECRET = "stored-client-secret-value";
  private static final String DISCOVERY_URI =
      "https://idp.secrets-it.invalid/.well-known/openid-configuration";

  private static SecurityConfigSwap securityConfig;

  @BeforeAll
  static void storeAClientSecret() {
    assumeFalse(OssTestServer.isExternalMode(), "Reconfigures the embedded server");
    securityConfig = SecurityConfigSwap.snapshotLiveConfig();
    SecurityConfiguration withSecret = securityConfig.originalCopy();
    withSecret
        .getAuthenticationConfiguration()
        .withOidcConfiguration(
            new OidcClientConfig()
                .withId("secrets-it-client")
                .withSecret(SECRET)
                .withDiscoveryUri(DISCOVERY_URI));
    securityConfig.applyBaseline(withSecret);
  }

  @AfterAll
  static void restoreTheLiveConfiguration() {
    if (securityConfig != null) {
      securityConfig.close();
    }
  }

  @Test
  void theStoredSecretIsNeverReadBack() {
    assertEquals(SECRET, liveClient().getSecret());
    // An admin only ever reads the secret masked.
    assertNotEquals(
        SECRET, read().getAuthenticationConfiguration().getOidcConfiguration().getSecret());
  }

  @Test
  void aMaskedSecretIsNotRestoredForAnotherProvider() {
    SecurityConfiguration masked = read();
    masked
        .getAuthenticationConfiguration()
        .getOidcConfiguration()
        .setDiscoveryUri("https://idp.elsewhere-it.invalid/.well-known/openid-configuration");

    OpenMetadataException refused =
        assertThrows(
            OpenMetadataException.class,
            () ->
                SdkClients.adminClient()
                    .getHttpClient()
                    .executeForString(HttpMethod.PUT, PATH, JsonUtils.pojoToJson(masked)));

    assertEquals(400, refused.getStatusCode(), refused.getMessage());
    assertEquals(DISCOVERY_URI, liveClient().getDiscoveryUri());
  }

  private static SecurityConfiguration read() {
    return JsonUtils.readValue(
        SdkClients.adminClient().getHttpClient().executeForString(HttpMethod.GET, PATH, null),
        SecurityConfiguration.class);
  }

  private static OidcClientConfig liveClient() {
    return SecurityConfigurationManager.getInstance()
        .getCurrentSecurityConfig()
        .getAuthenticationConfiguration()
        .getOidcConfiguration();
  }
}
