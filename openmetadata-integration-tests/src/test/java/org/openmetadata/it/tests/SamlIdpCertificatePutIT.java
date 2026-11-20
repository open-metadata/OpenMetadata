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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * A PUT of the security configuration stores a SAML IdP certificate only after it passed the check
 * a save runs, so an administrator cannot store one that stops the next restart. A certificate the
 * database already holds is not checked again.
 * ADR:2026-11-20-the-stored-saml-idp-certificate-is-standard-pem
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
class SamlIdpCertificatePutIT {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String SECURITY_CONFIG_PATH = "/v1/system/security/config";
  private static final String CERTIFICATE_FIELD = "samlConfiguration.idp.idpX509Certificate";
  private static final String VALID = resource("/saml/mock-idp.crt");
  private static final String OTHER_VALID = resource("/saml/other-idp.crt");
  private static final String EXPIRED = resource("/saml/expired-idp.crt");
  private static final String NOT_A_CERTIFICATE =
      "-----BEGIN CERTIFICATE-----\nnot-a-certificate\n-----END CERTIFICATE-----";

  private static String original;

  @BeforeAll
  static void startFromSaml() throws Exception {
    assumeFalse(OssTestServer.isExternalMode(), "Reconfigures the embedded server's SSO");
    original = get();
    put(withIdpCertificate(VALID));
  }

  @AfterAll
  static void restoreTheOriginalConfiguration() throws Exception {
    if (original != null) {
      put(original);
    }
  }

  @Test
  void putRefusesAnUnusableCertificateAndWritesNothing() {
    JsonNode stored = storedAuthentication();

    for (String unusable : new String[] {NOT_A_CERTIFICATE, EXPIRED}) {
      InvalidRequestException refused =
          assertThrows(InvalidRequestException.class, () -> put(withIdpCertificate(unusable)));

      assertTrue(refused.getMessage().contains(CERTIFICATE_FIELD), refused.getMessage());
      assertEquals(stored, storedAuthentication(), "a refused PUT stores nothing");
    }
  }

  @Test
  void putStoresAUsableCertificate() throws Exception {
    try {
      assertNotNull(put(withIdpCertificate(OTHER_VALID)));

      assertEquals(OTHER_VALID, storedCertificate());
    } finally {
      put(withIdpCertificate(VALID));
    }
  }

  /**
   * A certificate that was stored and has expired since is not checked again. 2.0 still cannot run
   * an IdP whose every certificate has expired, so the reload may refuse it; the check must not.
   */
  @Test
  void putDoesNotRecheckTheStoredExpiredCertificate() throws Exception {
    String expired = withIdpCertificate(EXPIRED);
    storeWithoutChecks(expired);
    try {
      String answer = attempt(expired);

      assertFalse(answer.contains(CERTIFICATE_FIELD), answer);
    } finally {
      put(withIdpCertificate(VALID));
    }
  }

  private static String withIdpCertificate(String idpCertificate) {
    try {
      ObjectNode config = (ObjectNode) MAPPER.readTree(original);
      ObjectNode authentication = (ObjectNode) config.get("authenticationConfiguration");
      authentication.put("provider", "saml");
      authentication.put("providerName", "SAML");
      authentication.put("clientType", "public");
      ObjectNode saml = authentication.putObject("samlConfiguration");
      ObjectNode idp = saml.putObject("idp");
      idp.put("entityId", "https://idp.saml-certificate-it.invalid");
      idp.put("ssoLoginUrl", "https://idp.saml-certificate-it.invalid/sso");
      idp.put("idpX509Certificate", idpCertificate);
      ObjectNode sp = saml.putObject("sp");
      sp.put("entityId", "openmetadata-saml-certificate-it");
      sp.put("acs", "http://localhost:8585/api/v1/saml/acs");
      sp.put("callback", "http://localhost:8585/saml/callback");
      ObjectNode security = saml.putObject("security");
      security.put("strictMode", false);
      security.put("wantMessagesSigned", false);
      security.put("wantAssertionsSigned", false);
      security.put("sendSignedAuthRequest", false);
      return MAPPER.writeValueAsString(config);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  /** What the server answered, success or not. */
  private static String attempt(String body) {
    String answer;
    try {
      answer = put(body);
    } catch (Exception e) {
      answer = String.valueOf(e.getMessage());
    }
    return answer;
  }

  /** Stands for a certificate that was valid when it was saved and has expired since. */
  private static void storeWithoutChecks(String securityConfig) {
    JsonNode authentication = JsonUtils.readTree(securityConfig).get("authenticationConfiguration");
    Entity.getSystemRepository()
        .createOrUpdate(
            new Settings()
                .withConfigType(AUTHENTICATION_CONFIGURATION)
                .withConfigValue(
                    JsonUtils.convertValue(authentication, AuthenticationConfiguration.class)));
  }

  private static JsonNode storedAuthentication() {
    Settings stored =
        Entity.getSystemRepository().getConfigWithKey(AUTHENTICATION_CONFIGURATION.value());
    return JsonUtils.valueToTree(stored.getConfigValue());
  }

  private static String storedCertificate() {
    return storedAuthentication().at("/samlConfiguration/idp/idpX509Certificate").asText();
  }

  private static String get() throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.GET, SECURITY_CONFIG_PATH, null, RequestOptions.builder().build());
  }

  private static String put(String body) throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, SECURITY_CONFIG_PATH, body, RequestOptions.builder().build());
  }

  private static String resource(String path) {
    try (InputStream stream = SamlIdpCertificatePutIT.class.getResourceAsStream(path)) {
      return new String(stream.readAllBytes(), StandardCharsets.US_ASCII);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}
