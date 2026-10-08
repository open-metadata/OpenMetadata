/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTCreator;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ProviderTokenValidatorTest {
  private static final String CLIENT_ID = "openmetadata-client";
  private static final String ISSUER = "https://idp.example.com/oauth2/default";
  private static final String ENTRA_COMMON_ISSUER =
      "https://login.microsoftonline.com/{tenantid}/v2.0";

  private static final ProviderTokenValidator VALIDATOR =
      new ProviderTokenValidator(Set.of(CLIENT_ID), () -> Optional.of(ISSUER));

  @Test
  void acceptsTokenIssuedToConfiguredClientByConfiguredProvider() {
    assertDoesNotThrow(() -> validate(VALIDATOR, token(ISSUER).withAudience(CLIENT_ID)));
  }

  @Test
  void acceptsTokenWhoseAudiencesIncludeConfiguredClient() {
    assertDoesNotThrow(
        () -> validate(VALIDATOR, token(ISSUER).withAudience("another-client", CLIENT_ID)));
  }

  /** Google and Entra ID sign every application's tokens with the same keys. */
  @Test
  void rejectsTokenIssuedToAnotherApplication() {
    AuthenticationException failure =
        assertThrows(
            AuthenticationException.class,
            () -> validate(VALIDATOR, token(ISSUER).withAudience("another-application")));
    assertTrue(failure.getMessage().contains("another-application"));
  }

  @Test
  void rejectsTokenWithoutAudience() {
    assertThrows(AuthenticationException.class, () -> validate(VALIDATOR, token(ISSUER)));
  }

  @Test
  void rejectsTokenFromAnotherProvider() {
    AuthenticationException failure =
        assertThrows(
            AuthenticationException.class,
            () ->
                validate(
                    VALIDATOR, token("https://other-idp.example.com").withAudience(CLIENT_ID)));
    assertTrue(failure.getMessage().contains("https://other-idp.example.com"));
  }

  /** Public clients have no server-side discovery document, so only the audience is known. */
  @Test
  void checksOnlyAudienceWhenProviderIssuerIsUnknown() {
    ProviderTokenValidator audienceOnly =
        new ProviderTokenValidator(Set.of(CLIENT_ID), Optional::empty);

    assertDoesNotThrow(
        () -> validate(audienceOnly, token("https://any-issuer").withAudience(CLIENT_ID)));
    assertThrows(
        AuthenticationException.class,
        () -> validate(audienceOnly, token("https://any-issuer").withAudience("another-client")));
  }

  /** Deployments without an OIDC client (basic, LDAP, SAML) have nothing to compare against. */
  @Test
  void acceptsAnyAudienceWhenNoClientIsConfigured() {
    assertDoesNotThrow(
        () ->
            validate(
                ProviderTokenValidator.acceptingAnyProviderToken(),
                token("https://any-issuer").withAudience("any-client")));
  }

  /** Multi-tenant Entra ID discovery names its issuer as a template for each token's tenant. */
  @Test
  void resolvesEntraTenantTemplateFromTheTokensTenant() {
    ProviderTokenValidator entra =
        new ProviderTokenValidator(Set.of(CLIENT_ID), () -> Optional.of(ENTRA_COMMON_ISSUER));

    assertDoesNotThrow(
        () ->
            validate(
                entra,
                token("https://login.microsoftonline.com/tenant-a/v2.0")
                    .withAudience(CLIENT_ID)
                    .withClaim("tid", "tenant-a")));
    assertThrows(
        AuthenticationException.class,
        () ->
            validate(
                entra,
                token("https://login.microsoftonline.com/tenant-a/v2.0")
                    .withAudience(CLIENT_ID)
                    .withClaim("tid", "tenant-b")));
  }

  /** Google documents both forms as the issuer of its ID tokens. */
  @Test
  void acceptsGooglesSchemelessIssuer() {
    ProviderTokenValidator google =
        new ProviderTokenValidator(
            Set.of(CLIENT_ID), () -> Optional.of("https://accounts.google.com"));

    assertDoesNotThrow(
        () -> validate(google, token("accounts.google.com").withAudience(CLIENT_ID)));
  }

  private static JWTCreator.Builder token(String issuer) {
    return JWT.create().withIssuer(issuer);
  }

  private static void validate(ProviderTokenValidator validator, JWTCreator.Builder token) {
    validator.validate(decode(token));
  }

  private static DecodedJWT decode(JWTCreator.Builder token) {
    return JWT.decode(token.sign(Algorithm.HMAC256("test-only-signing-secret")));
  }
}
