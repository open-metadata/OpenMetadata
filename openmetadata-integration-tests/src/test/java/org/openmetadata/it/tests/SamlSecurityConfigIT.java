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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.catalog.type.ServiceProviderConfig;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.api.security.ResponseType;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for validating SAML security configurations through
 * {@code /v1/system/security/validate} — the endpoint the SSO settings UI calls after a user
 * uploads their IdP's {@code metadata.xml}.
 *
 * <p>These cover the handoff the UI cannot: {@code parseSamlMetadataXml} runs client-side and only
 * fills the form, so every provider-specific rule is enforced here on save. Issue #28619 shipped
 * because no test posted a realistically-shaped provider payload — Okta signs with
 * {@code CN=<org short name>} against an Entity ID of {@code http://www.okta.com/{appId}}, and
 * requiring those to be equal rejected every valid Okta configuration.
 *
 * <p>The validate endpoint is side-effect free, so those tests never mutate the running server's
 * security configuration. Every {@code PUT} test leaves the active provider untouched and restores
 * the configuration it read in a {@code finally}, including on the paths where the assertion itself
 * fails.
 */
@Execution(ExecutionMode.SAME_THREAD)
@Isolated
public class SamlSecurityConfigIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private static final String SECURITY_CONFIG_PATH = "/v1/system/security/config";
  private static final String SECURITY_VALIDATE_PATH = "/v1/system/security/validate";
  private static final String IDP_CERT_FIELD =
      "authenticationConfiguration.samlConfiguration.idp.idpX509Certificate";

  /** Okta's Entity ID is always this shape, so its host is always the literal {@code www.okta.com}. */
  private static final String OKTA_ENTITY_ID = "http://www.okta.com/exk1a2b3c4d5";

  /**
   * SSO login URLs are reached over the network by the validator. {@code .invalid} is reserved by
   * RFC 2606 and never resolves, which keeps these tests hermetic — the validator treats an
   * unreachable IdP as a warning, not an error.
   */
  private static final String OKTA_SSO_URL =
      "https://example-org.okta.invalid/app/openmetadata/exk1a2b3c4d5/sso/saml";

  /** Self-signed, {@code CN=example-org, O=Okta}, valid 2026-09 to 2036-09. */
  private static final String OKTA_ORG_CERT =
      """
      -----BEGIN CERTIFICATE-----
      MIIDyzCCArOgAwIBAgIUIZV2P9D5F0TyWYkhelWTeh0aQEowDQYJKoZIhvcNAQEL
      BQAwdTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExFjAUBgNVBAcM
      DVNhbiBGcmFuY2lzY28xDTALBgNVBAoMBE9rdGExFDASBgNVBAsMC1NTT1Byb3Zp
      ZGVyMRQwEgYDVQQDDAtleGFtcGxlLW9yZzAeFw0yNjA5MTYyMDQ1MjNaFw0zNjA5
      MTMyMDQ1MjNaMHUxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMRYw
      FAYDVQQHDA1TYW4gRnJhbmNpc2NvMQ0wCwYDVQQKDARPa3RhMRQwEgYDVQQLDAtT
      U09Qcm92aWRlcjEUMBIGA1UEAwwLZXhhbXBsZS1vcmcwggEiMA0GCSqGSIb3DQEB
      AQUAA4IBDwAwggEKAoIBAQDVQvEms8hTsAV8LUUx8uTQhxER/Hf3+yx3LPjMD+KY
      +4YpRHhQk3IY6r3DOQvT/PsUUWuqbRyYmGWiXkDyPsQAGUd3HW63fAcX+0TfBYEz
      75pt9U/QYhjJQAvmBmxqrak25bImKEZln7/+65zBS8Ohs9TYFBAT1lfaCBifhh0A
      80FkQXl8/5thnZAaNaFK3YIJfd3PBpMt2uGYOxo6xJbKS9NSGZLc3gRPRqcLhNx9
      01n8CxwFrCwqbY3urJ2rejPIaCZ+iVaJhFzuM1i1sB3H7/9+U6Wns1Is7a+OZLY8
      l41nDougHYvwwQaWA9xZ5lHPIiTdE9UWlHS53pfkp2qdAgMBAAGjUzBRMB0GA1Ud
      DgQWBBT5mtJZvkkmbFeAdkQt1ka2gyfakTAfBgNVHSMEGDAWgBT5mtJZvkkmbFeA
      dkQt1ka2gyfakTAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQCI
      /vPj2Z3lk9lvlnSsoXCpSxGfkxR3XSy/Pkm4CTPLN0XXhVKjyPTb2kdqM8AXjrID
      qehxhNunicS3+w3bwK4XZ4gTxpXnOflkXE+B38/1+rz9QQwiIx8q0B3thspazkm3
      aawU4aQEwSWygI8sXuxkShru5hHcwXWRA5F5s5kpiFK50FLOqWbOukLMSFoVNu1D
      Y8or/But9KUsAfHy294vbQAOj4kI0SYqBvhhlpJxXq1vMFtBiiwKeNIxE0mW240w
      b0/XIHowzxARt4SAZS+0jpaHqBESyanV8iVNqx8heeW+odH2cBkE0ic6t6/s3SrD
      V7z+p03MrlFxMur28rIH
      -----END CERTIFICATE-----
      """;

  /**
   * Self-signed, {@code CN=auth.example.com, O=Auth0}, valid 2026-09 to 2036-09. An Auth0 tenant on
   * a custom domain signs with that domain, while its Entity ID stays on the tenant host
   * ({@code urn:dev-tenant.us.auth0.com}) — so CN and Entity ID host are different namespaces, the
   * same shape as the Okta case.
   */
  private static final String AUTH0_CUSTOM_DOMAIN_CERT =
      """
      -----BEGIN CERTIFICATE-----
      MIIDyzCCArOgAwIBAgIUOT6JVV3WC/4YZo6y/nFgX2MatPYwDQYJKoZIhvcNAQEL
      BQAwdTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCldhc2hpbmd0b24xEDAOBgNVBAcM
      B1NlYXR0bGUxDjAMBgNVBAoMBUF1dGgwMRQwEgYDVQQLDAtTU09Qcm92aWRlcjEZ
      MBcGA1UEAwwQYXV0aC5leGFtcGxlLmNvbTAeFw0yNjA5MTgwOTM3MzFaFw0zNjA5
      MTUwOTM3MzFaMHUxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMRAw
      DgYDVQQHDAdTZWF0dGxlMQ4wDAYDVQQKDAVBdXRoMDEUMBIGA1UECwwLU1NPUHJv
      dmlkZXIxGTAXBgNVBAMMEGF1dGguZXhhbXBsZS5jb20wggEiMA0GCSqGSIb3DQEB
      AQUAA4IBDwAwggEKAoIBAQDM1w9Hl/70gFeFfqywrSi8I+DasQoqXJWHSmqvfBQw
      NLrN4U8L4ud2nmfyY+qzPWHJr1V5wys0TDcmozmUxsDtZH4khcTE1JMv4abBoKcM
      WNwYffXJfYjQ71BjnZsVnxPcq5Ixxtfq60XPy6Qfjw8cxeniHDWjUlTCaTTPK6Qq
      rDpOPekcRE2LZQGUiNsW0UkSEZ6vGdi1WPAWgQKhiQTx/nEtnOCEiPyeWkxK0uOe
      KCP6LMKD2avy+2VArJjiVxjZoH0GykK71rFvBSf4xJcvdLw9APGRcjJVmzV3MUo4
      /2WRCzM8tW2/fH+8xU33i0Ub5KGkUCU1f3m2BitPu5BLAgMBAAGjUzBRMB0GA1Ud
      DgQWBBTUpOXNCEKm3v29sDWddBeC8NTHpDAfBgNVHSMEGDAWgBTUpOXNCEKm3v29
      sDWddBeC8NTHpDAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQAm
      CTeFF7Hgo4DvlmgEZSH2CO8OncEuLKnSwjIusb9MTkrFdcmlR9sZeQzzDy8H5RQ7
      68PUqNWsGt9lVwZhm/A4XzXPyIZLiH20cGaZs6PqXi+ycT74LsUAq6/+zq8WLSua
      Uj4nZnUyYJ7TDNc+lQYbAmEXENFa4OQT6sEYho18xiWafcF4mmE+3NugviSqR54J
      UFa2CtLwbGTs/IrGJzgv0Ti5atSxF/8/gJzRCPp/rEOhmCFG8X0RKYpT2O0clf+7
      nPq7sRFeMMIEX8GsxgvaahcgLZ2QHa075ZDSSxNXVHy3J8niKrAjnHEE4n52yXLC
      NM3Pv29cF9tNA0rqilc7
      -----END CERTIFICATE-----
      """;

  /** Same subject as {@link #OKTA_ORG_CERT}, but expired in 2021. */
  private static final String EXPIRED_CERT =
      """
      -----BEGIN CERTIFICATE-----
      MIIDyzCCArOgAwIBAgIUWp9vJboRFKCPwhcH8zGg2pxfZuEwDQYJKoZIhvcNAQEL
      BQAwdTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExFjAUBgNVBAcM
      DVNhbiBGcmFuY2lzY28xDTALBgNVBAoMBE9rdGExFDASBgNVBAsMC1NTT1Byb3Zp
      ZGVyMRQwEgYDVQQDDAtleGFtcGxlLW9yZzAeFw0yMDAxMDEwMDAwMDBaFw0yMTAx
      MDEwMDAwMDBaMHUxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMRYw
      FAYDVQQHDA1TYW4gRnJhbmNpc2NvMQ0wCwYDVQQKDARPa3RhMRQwEgYDVQQLDAtT
      U09Qcm92aWRlcjEUMBIGA1UEAwwLZXhhbXBsZS1vcmcwggEiMA0GCSqGSIb3DQEB
      AQUAA4IBDwAwggEKAoIBAQC+bJPEDwiBsdu6dkAGwgG9R+VeUM7x7UWKrIwoxenk
      knNlVPedm5nJF7LFuiY/vQ3tIOxfCyF4icgLBWS6NPBnRI0BkX2xpvbFB445j3By
      arePF8d93fGdJ8V8X5YvnLNcrTcrr9U53JRMYJu1x55ta9KvWYL3U4vHjXglRJPR
      rtsA/fko3VzbtAzqHSw4EIlYnIDrGntO4Df+sDa8iD716ZxuSScO6O5cBKjo2+UC
      QPbX72h8/MUSBQI3zOUtOLudg1wAtAIa11FDuxpth8sN3Wi8Sc+SDobL7t5CbVT1
      QbnPGd3p4aVxmMZFA9hsNtGNNP4Uz9LxPLKIeuzkfQvpAgMBAAGjUzBRMB0GA1Ud
      DgQWBBQnxmEpagXDyyiu1UNh8eydPt6JUDAfBgNVHSMEGDAWgBQnxmEpagXDyyiu
      1UNh8eydPt6JUDAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQAR
      tTQCxp6DDu6nA/JcE2ZRrpgHDmKypXl8VIaIhzXog/wS+l4ZLbJSEJxq5Z+EY6gw
      0+63tQqEx3atcVS1REzfrpZtcnLBzl8rEK25YWKNx//U5kav6EnH63s0uRXdJG34
      VCVe13AmOcsPByyfHnQ8U+3/x6qAu6Bhnl9z7A8GbhWP6FJmJ44rnIdEOSJJ6mSX
      cJVPw1lHyx5msihCABQ+LSfzV/F1QJ8B95wJ54cIVFIuapmGZmOjk++wEk1Os6C7
      e3wdc9f/xhF/BzDTTRUPQUGCCkpwe/xozjp5OE9Jr8P8sYXp0/qBxsCPzg2nMLtD
      M+GwtCm/xL8aQHKZkTY3
      -----END CERTIFICATE-----
      """;

  /**
   * Issue #28619: the payload the SSO form produces after a real Okta {@code metadata.xml} upload
   * must validate cleanly.
   */
  @Test
  void validateSecurityConfig_acceptsOktaOrgNameCertificate() throws Exception {
    JsonNode response = validate(samlConfig(OKTA_ENTITY_ID, OKTA_SSO_URL, OKTA_ORG_CERT));

    assertNoErrorOnField(response, IDP_CERT_FIELD);
    assertEquals("success", response.get("status").asText(), "Validation response: " + response);
  }

  @Test
  void validateSecurityConfig_acceptsAuth0CustomDomainCertificate() throws Exception {
    JsonNode response =
        validate(
            samlConfig(
                "urn:dev-tenant.us.auth0.com",
                "https://login.example.invalid/samlp/abcdefgh12345",
                AUTH0_CUSTOM_DOMAIN_CERT));

    assertNoErrorOnField(response, IDP_CERT_FIELD);
    assertEquals("success", response.get("status").asText(), "Validation response: " + response);
  }

  @Test
  void validateSecurityConfig_stillRejectsExpiredCertificate() throws Exception {
    JsonNode response = validate(samlConfig(OKTA_ENTITY_ID, OKTA_SSO_URL, EXPIRED_CERT));

    assertEquals("failed", response.get("status").asText(), "Validation response: " + response);
    assertTrue(
        fieldError(response, IDP_CERT_FIELD).contains("expired"),
        "Expected an expiry error on the IdP certificate but got: " + response);
  }

  @Test
  void validateSecurityConfig_stillRejectsMalformedCertificate() throws Exception {
    JsonNode response =
        validate(
            samlConfig(
                OKTA_ENTITY_ID,
                OKTA_SSO_URL,
                "-----BEGIN CERTIFICATE-----not-a-certificate-----END CERTIFICATE-----"));

    assertEquals("failed", response.get("status").asText(), "Validation response: " + response);
    assertNotNull(fieldError(response, IDP_CERT_FIELD));
  }

  /**
   * The operator escape hatch for a blocked SSO save is to write the configuration through
   * {@code PUT}, which skips provider validation. That only works if the object {@code GET} returns
   * is accepted by {@code PUT} unchanged.
   */
  @Test
  void securityConfig_getPutRoundTripIsAccepted() throws Exception {
    String current = getSecurityConfig();
    assertNotNull(current);

    String result = putSecurityConfig(current);

    assertNotNull(result, "GET /security/config must return a body that PUT accepts unchanged");
  }

  /**
   * An instance that previously touched LDAP keeps a partially-filled {@code ldapConfiguration}
   * block in its stored configuration. That block is irrelevant while another provider is active,
   * but it must not make the configuration unwritable.
   */
  @Test
  void securityConfig_putIgnoresIncompleteBlockOfInactiveProvider() throws Exception {
    String original = getSecurityConfig();

    try {
      ObjectNode config = (ObjectNode) MAPPER.readTree(original);
      ObjectNode authConfig = (ObjectNode) config.get("authenticationConfiguration");
      authConfig.set("ldapConfiguration", partialLdapPreservingSecret(authConfig));

      String result = putSecurityConfig(MAPPER.writeValueAsString(config));

      assertNotNull(
          result,
          "PUT must not reject a configuration over required fields of a provider that is not active");
    } finally {
      putSecurityConfig(original);
    }
  }

  /**
   * The same scoping has to hold for the other two blocks. {@code samlConfiguration} requires
   * {@code idp} and {@code sp}, so a stub block left behind by an earlier SAML setup would otherwise
   * make an LDAP-provider instance unwritable.
   */
  @Test
  void securityConfig_putIgnoresIncompleteSamlBlockOfInactiveProvider() throws Exception {
    String original = getSecurityConfig();

    try {
      ObjectNode config = (ObjectNode) MAPPER.readTree(original);
      ObjectNode authConfig = (ObjectNode) config.get("authenticationConfiguration");
      ObjectNode partialSaml = MAPPER.createObjectNode();
      partialSaml.set("idp", MAPPER.createObjectNode().put("entityId", OKTA_ENTITY_ID));
      authConfig.set("samlConfiguration", partialSaml);

      assertNotNull(
          putSecurityConfig(MAPPER.writeValueAsString(config)),
          "PUT must not reject a configuration over an inactive provider's samlConfiguration");
    } finally {
      putSecurityConfig(original);
    }
  }

  /**
   * {@code oidcConfiguration} is the confidential client's block. A public client never reads it
   * whatever the provider, so its required fields must not gate a public-client save.
   */
  @Test
  void securityConfig_putIgnoresIncompleteOidcBlockOfPublicClient() throws Exception {
    String original = getSecurityConfig();

    try {
      ObjectNode config = (ObjectNode) MAPPER.readTree(original);
      ObjectNode authConfig = (ObjectNode) config.get("authenticationConfiguration");
      authConfig.put("clientType", ClientType.PUBLIC.value());
      authConfig.set("oidcConfiguration", MAPPER.createObjectNode().put("id", "open-metadata"));

      assertNotNull(
          putSecurityConfig(MAPPER.writeValueAsString(config)),
          "PUT must not reject a public-client configuration over oidcConfiguration fields");
    } finally {
      putSecurityConfig(original);
    }
  }

  /** Scoping validation to the active provider must not stop enforcing that provider's own block. */
  @Test
  void securityConfig_putStillRejectsIncompleteBlockOfActiveProvider() throws Exception {
    String original = getSecurityConfig();

    try {
      ObjectNode config = (ObjectNode) MAPPER.readTree(original);
      ObjectNode authConfig = (ObjectNode) config.get("authenticationConfiguration");
      authConfig.put("provider", AuthProvider.LDAP.value());
      ObjectNode partialLdap = MAPPER.createObjectNode();
      partialLdap.put("dnAdminPrincipal", "cn=admin,dc=example,dc=com");
      authConfig.set("ldapConfiguration", partialLdap);

      InvalidRequestException exception =
          assertThrows(
              InvalidRequestException.class,
              () -> putSecurityConfig(MAPPER.writeValueAsString(config)),
              "An incomplete block of the active provider must still be rejected as a client error");

      assertTrue(
          exception.getMessage().contains("ldapConfiguration"),
          "Expected the error to name the offending LDAP fields but got: "
              + exception.getMessage());
    } finally {
      // Restore even when the assertion above fails: the PUT is only rejected before anything is
      // written while the invariant this test guards still holds, and if it ever regresses the
      // instance would otherwise be left on LDAP with an unusable configuration.
      putSecurityConfig(original);
    }
  }

  /**
   * A partial LDAP block that keeps whatever {@code dnAdminPassword} the configuration already
   * carried. {@code GET} returns that field masked and {@code PUT} resolves the mask against the
   * stored configuration, so dropping it would write a null through and destroy a real password
   * before the restoring {@code PUT} could put it back.
   */
  private ObjectNode partialLdapPreservingSecret(ObjectNode authConfig) {
    ObjectNode partialLdap = MAPPER.createObjectNode();
    partialLdap.put("dnAdminPrincipal", "cn=admin,dc=example,dc=com");
    partialLdap.put("userBaseDN", "ou=people,dc=example,dc=com");
    JsonNode storedLdap = authConfig.get("ldapConfiguration");
    if (storedLdap != null && storedLdap.hasNonNull("dnAdminPassword")) {
      partialLdap.set("dnAdminPassword", storedLdap.get("dnAdminPassword"));
    }
    return partialLdap;
  }

  private String getSecurityConfig() throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.GET, SECURITY_CONFIG_PATH, null, RequestOptions.builder().build());
  }

  private String putSecurityConfig(String body) throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT, SECURITY_CONFIG_PATH, body, RequestOptions.builder().build());
  }

  private JsonNode validate(SecurityConfiguration config) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.POST,
                SECURITY_VALIDATE_PATH,
                MAPPER.writeValueAsString(config),
                RequestOptions.builder().build());

    assertNotNull(response);
    return MAPPER.readTree(response);
  }

  private void assertNoErrorOnField(JsonNode response, String field) {
    String error = fieldError(response, field);
    assertNull(error, "Expected no validation error on '" + field + "' but got: " + error);
  }

  private String fieldError(JsonNode response, String field) {
    JsonNode errors = response.get("errors");
    if (errors == null || !errors.isArray()) {
      return null;
    }
    for (JsonNode error : errors) {
      if (field.equals(error.path("field").asText())) {
        return error.path("error").asText();
      }
    }
    return null;
  }

  /**
   * Mirrors what the SSO form submits after {@code parseSamlMetadataXml} fills the IdP fields from
   * an uploaded {@code metadata.xml}.
   */
  private SecurityConfiguration samlConfig(String entityId, String ssoLoginUrl, String idpCert) {
    SamlSSOClientConfig samlConfig =
        new SamlSSOClientConfig()
            .withIdp(
                new IdentityProviderConfig()
                    .withEntityId(entityId)
                    .withSsoLoginUrl(ssoLoginUrl)
                    .withIdpX509Certificate(idpCert)
                    .withNameId("urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress"))
            .withSp(
                new ServiceProviderConfig()
                    .withEntityId("http://localhost:8585/api/v1/saml/metadata")
                    .withAcs("http://localhost:8585/api/v1/saml/acs")
                    .withCallback("http://localhost:8585/saml/callback"));

    return new SecurityConfiguration()
        .withAuthenticationConfiguration(
            new AuthenticationConfiguration()
                .withClientType(ClientType.PUBLIC)
                .withProvider(AuthProvider.SAML)
                .withResponseType(ResponseType.ID_TOKEN)
                .withProviderName("SAML")
                .withPublicKeyUrls(Arrays.asList("http://localhost:8585/api/v1/system/config/jwks"))
                .withTokenValidationAlgorithm(
                    AuthenticationConfiguration.TokenValidationAlgorithm.RS_256)
                .withAuthority("http://localhost:8585")
                .withClientId("open-metadata")
                .withCallbackUrl("http://localhost:8585/callback")
                .withJwtPrincipalClaims(Arrays.asList("email", "preferred_username", "sub"))
                .withJwtPrincipalClaimsMapping(new ArrayList<>())
                .withEnableSelfSignup(true)
                .withSamlConfiguration(samlConfig))
        .withAuthorizerConfiguration(
            new AuthorizerConfiguration()
                .withClassName("org.openmetadata.service.security.DefaultAuthorizer")
                .withContainerRequestFilter("org.openmetadata.service.security.JwtFilter")
                .withAdminPrincipals(Set.of("admin"))
                .withAllowedEmailRegistrationDomains(Set.of("all"))
                .withPrincipalDomain("open-metadata.org")
                .withAllowedDomains(new HashSet<>())
                .withEnforcePrincipalDomain(false)
                .withEnableSecureSocketConnection(false)
                .withUseRolesFromProvider(false));
  }
}
