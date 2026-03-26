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

package org.openmetadata.service.security;

import static java.lang.String.format;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.security.jwt.JWTTokenGenerator.TOKEN_TYPE;

import com.auth0.jwk.Jwk;
import com.auth0.jwk.JwkProvider;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.Claim;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.net.URI;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

class JwtFilterTest {

  private static JwtFilter jwtFilter;
  private static JwkProvider jwkProvider;

  private static Algorithm algorithm;
  private static UriInfo mockRequestURIInfo;

  @BeforeAll
  static void before() throws Exception {
    // Create a RSA256 algorithm wth random public/private key pair
    KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
    keyPairGenerator.initialize(2048);
    KeyPair keyPair = keyPairGenerator.generateKeyPair();
    algorithm =
        Algorithm.RSA256((RSAPublicKey) keyPair.getPublic(), (RSAPrivateKey) keyPair.getPrivate());

    // Mock a JwkProvider that has a single JWK containing the public key from the algorithm above
    // This is used to verify the JWT
    Jwk mockJwk = mock(Jwk.class);
    when(mockJwk.getPublicKey()).thenReturn(keyPair.getPublic());
    jwkProvider = mock(JwkProvider.class);
    when(jwkProvider.get(any())).thenReturn(mockJwk);

    // This is needed by JwtFilter for some metadata, not very important
    URI uri = URI.create("POST:http://localhost:8080/login");
    mockRequestURIInfo = mock(UriInfo.class);
    when(mockRequestURIInfo.getPath()).thenReturn("/login");
    when(mockRequestURIInfo.getRequestUri()).thenReturn(uri);

    List<String> principalClaims = List.of("sub", "email");
    String domain = "openmetadata.org";
    boolean enforcePrincipalDomain = false;
    // Use explicit empty overrides so the shared filter never reads from the
    // SecurityConfigurationManager singleton — keeps these tests independent of
    // any state other classes might leave behind in the singleton.
    jwtFilter =
        new JwtFilter(
            jwkProvider, principalClaims, domain, enforcePrincipalDomain, "", "", null, null);
  }

  @Test
  void testPrincipalDomainEnforcement() {
    List<String> principalClaims = List.of("EMAIL", "sub");
    String domain = "openmetadata.org";
    boolean enforcePrincipalDomain = true;
    jwtFilter = new JwtFilter(jwkProvider, principalClaims, domain, enforcePrincipalDomain);

    // success case
    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("email", "sam@openmetadata.org")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    jwtFilter.filter(context);

    ArgumentCaptor<SecurityContext> securityContextArgument =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context, times(1)).setSecurityContext(securityContextArgument.capture());

    assertEquals("sam", securityContextArgument.getValue().getUserPrincipal().getName());

    // error case
    jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("email", "sam@gmail.com")
            .sign(algorithm);
    ContainerRequestContext newContext = createRequestContextWithJwt(jwt);

    Exception exception =
        assertThrows(AuthenticationException.class, () -> jwtFilter.filter(newContext));
    assertTrue(
        exception
            .getMessage()
            .toLowerCase(Locale.ROOT)
            .contains("email does not match the principal domain"));
  }

  @Test
  void testSuccessfulFilter() {
    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    jwtFilter.filter(context);

    ArgumentCaptor<SecurityContext> securityContextArgument =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context, times(1)).setSecurityContext(securityContextArgument.capture());

    assertEquals("sam", securityContextArgument.getValue().getUserPrincipal().getName());
  }

  @Test
  void testFilterWithEmailClaim() {
    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("email", "sam@gmail.com")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    jwtFilter.filter(context);

    ArgumentCaptor<SecurityContext> securityContextArgument =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context, times(1)).setSecurityContext(securityContextArgument.capture());

    assertEquals("sam", securityContextArgument.getValue().getUserPrincipal().getName());
  }

  @Test
  void testMissingToken() {
    MultivaluedHashMap<String, String> headers = new MultivaluedHashMap<>();
    ContainerRequestContext context = mock(ContainerRequestContext.class);
    when(context.getUriInfo()).thenReturn(mockRequestURIInfo);
    when(context.getHeaders()).thenReturn(headers);

    Exception exception =
        assertThrows(AuthenticationException.class, () -> jwtFilter.filter(context));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("token not present"));
  }

  @Test
  void testInvalidToken() {
    ContainerRequestContext context = createRequestContextWithJwt("invalid-token");

    Exception exception =
        assertThrows(AuthenticationException.class, () -> jwtFilter.filter(context));
    assertTrue(
        exception.getMessage().toLowerCase(Locale.ROOT).contains("Invalid token.".toLowerCase()));
  }

  @Test
  void testExpiredToken() {
    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().minus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    Exception exception =
        assertThrows(AuthenticationException.class, () -> jwtFilter.filter(context));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("expired"));
  }

  @Test
  void testNoClaimsInToken() {
    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("emailAddress", "sam@gmail.com")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    Exception exception =
        assertThrows(AuthenticationException.class, () -> jwtFilter.filter(context));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("claim"));
  }

  @Test
  void testInvalidSignatureJwt() throws NoSuchAlgorithmException {
    KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
    keyPairGenerator.initialize(2048);
    KeyPair keyPair = keyPairGenerator.generateKeyPair();
    Algorithm secondaryAlgorithm =
        Algorithm.RSA256((RSAPublicKey) keyPair.getPublic(), (RSAPrivateKey) keyPair.getPrivate());

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam")
            .sign(secondaryAlgorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    Exception exception =
        assertThrows(AuthenticationException.class, () -> jwtFilter.filter(context));
    assertTrue(
        exception.getMessage().toLowerCase(Locale.ROOT).contains("token verification failed"));
  }

  @Test
  void testPersonalAccessTokenClaimIsValidated() {
    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam")
            .withClaim(TOKEN_TYPE, ServiceTokenType.PERSONAL_ACCESS.value())
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    Exception exception =
        assertThrows(AuthenticationException.class, () -> jwtFilter.filter(context));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("personal access token"));
  }

  @Test
  void testAudienceValidationSuccess() {
    JwtFilter filter =
        new JwtFilter(jwkProvider, List.of("sub"), "openmetadata.org", false, "my-client-id", null);

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withAudience("my-client-id")
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    filter.filter(context);

    ArgumentCaptor<SecurityContext> securityContextArgument =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context, times(1)).setSecurityContext(securityContextArgument.capture());
    assertEquals("sam", securityContextArgument.getValue().getUserPrincipal().getName());
  }

  @Test
  void testAudienceValidationWithMultipleAudiences() {
    JwtFilter filter =
        new JwtFilter(jwkProvider, List.of("sub"), "openmetadata.org", false, "my-client-id", null);

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withAudience("other-client", "my-client-id")
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    filter.filter(context);

    ArgumentCaptor<SecurityContext> securityContextArgument =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context, times(1)).setSecurityContext(securityContextArgument.capture());
    assertEquals("sam", securityContextArgument.getValue().getUserPrincipal().getName());
  }

  @Test
  void testAudienceValidationRejectsWrongAudience() {
    JwtFilter filter =
        new JwtFilter(jwkProvider, List.of("sub"), "openmetadata.org", false, "my-client-id", null);

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withAudience("different-client-id")
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    Exception exception = assertThrows(AuthenticationException.class, () -> filter.filter(context));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("audience mismatch"));
  }

  @Test
  void testAudienceValidationRejectsMissingAudience() {
    JwtFilter filter =
        new JwtFilter(jwkProvider, List.of("sub"), "openmetadata.org", false, "my-client-id", null);

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    Exception exception = assertThrows(AuthenticationException.class, () -> filter.filter(context));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("audience mismatch"));
  }

  @Test
  void testAudienceValidationRejectsMultipleNonMatchingAudiences() {
    JwtFilter filter =
        new JwtFilter(jwkProvider, List.of("sub"), "openmetadata.org", false, "my-client-id", null);

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withAudience("client-a", "client-b", "client-c")
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    Exception exception = assertThrows(AuthenticationException.class, () -> filter.filter(context));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("audience mismatch"));
  }

  @Test
  void testIssuerValidationSuccess() {
    JwtFilter filter =
        new JwtFilter(
            jwkProvider,
            List.of("sub"),
            "openmetadata.org",
            false,
            null,
            "https://auth.example.com");

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withIssuer("https://auth.example.com")
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    filter.filter(context);

    ArgumentCaptor<SecurityContext> securityContextArgument =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context, times(1)).setSecurityContext(securityContextArgument.capture());
    assertEquals("sam", securityContextArgument.getValue().getUserPrincipal().getName());
  }

  @Test
  void testIssuerValidationRejectsWrongIssuer() {
    JwtFilter filter =
        new JwtFilter(
            jwkProvider,
            List.of("sub"),
            "openmetadata.org",
            false,
            null,
            "https://auth.example.com");

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withIssuer("https://evil.example.com")
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    Exception exception = assertThrows(AuthenticationException.class, () -> filter.filter(context));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("issuer mismatch"));
  }

  @Test
  void testIssuerValidationRejectsMissingIssuer() {
    JwtFilter filter =
        new JwtFilter(
            jwkProvider,
            List.of("sub"),
            "openmetadata.org",
            false,
            null,
            "https://auth.example.com");

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    Exception exception = assertThrows(AuthenticationException.class, () -> filter.filter(context));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("issuer mismatch"));
  }

  @Test
  void testCombinedAudienceAndIssuerValidation() {
    JwtFilter filter =
        new JwtFilter(
            jwkProvider,
            List.of("sub"),
            "openmetadata.org",
            false,
            "my-client-id",
            "https://auth.example.com");

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withAudience("my-client-id")
            .withIssuer("https://auth.example.com")
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    filter.filter(context);

    ArgumentCaptor<SecurityContext> securityContextArgument =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context, times(1)).setSecurityContext(securityContextArgument.capture());
    assertEquals("sam", securityContextArgument.getValue().getUserPrincipal().getName());
  }

  @Test
  void testCombinedValidationRejectsWrongIssuerWithCorrectAudience() {
    JwtFilter filter =
        new JwtFilter(
            jwkProvider,
            List.of("sub"),
            "openmetadata.org",
            false,
            "my-client-id",
            "https://auth.example.com");

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withAudience("my-client-id")
            .withIssuer("https://evil.example.com")
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    Exception exception = assertThrows(AuthenticationException.class, () -> filter.filter(context));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("issuer mismatch"));
  }

  @Test
  void testCombinedValidationRejectsWrongAudienceWithCorrectIssuer() {
    JwtFilter filter =
        new JwtFilter(
            jwkProvider,
            List.of("sub"),
            "openmetadata.org",
            false,
            "my-client-id",
            "https://auth.example.com");

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withAudience("wrong-client-id")
            .withIssuer("https://auth.example.com")
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    Exception exception = assertThrows(AuthenticationException.class, () -> filter.filter(context));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("audience mismatch"));
  }

  @Test
  void testValidationSkippedWhenNotConfigured() {
    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withAudience("any-client-id")
            .withIssuer("https://any-issuer.com")
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    jwtFilter.filter(context);

    ArgumentCaptor<SecurityContext> securityContextArgument =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context, times(1)).setSecurityContext(securityContextArgument.capture());
    assertEquals("sam", securityContextArgument.getValue().getUserPrincipal().getName());
  }

  @Test
  void testIssuerValidationWithTrailingSlash() {
    JwtFilter filter =
        new JwtFilter(
            jwkProvider,
            List.of("sub"),
            "openmetadata.org",
            false,
            null,
            "https://auth.example.com/");

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withIssuer("https://auth.example.com")
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    filter.filter(context);

    ArgumentCaptor<SecurityContext> securityContextArgument =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context, times(1)).setSecurityContext(securityContextArgument.capture());
    assertEquals("sam", securityContextArgument.getValue().getUserPrincipal().getName());
  }

  @Test
  void testIssuerValidationHostCaseInsensitive() {
    JwtFilter filter =
        new JwtFilter(
            jwkProvider,
            List.of("sub"),
            "openmetadata.org",
            false,
            null,
            "https://Auth.Example.COM");

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withIssuer("https://auth.example.com")
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    filter.filter(context);

    ArgumentCaptor<SecurityContext> securityContextArgument =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context, times(1)).setSecurityContext(securityContextArgument.capture());
    assertEquals("sam", securityContextArgument.getValue().getUserPrincipal().getName());
  }

  @Test
  void testNormalizeIssuerTrailingSlash() {
    assertEquals(
        "https://auth.example.com", JwtFilter.normalizeIssuer("https://auth.example.com/"));
    assertEquals("https://auth.example.com", JwtFilter.normalizeIssuer("https://auth.example.com"));
    assertEquals(
        "https://auth.example.com/v2.0",
        JwtFilter.normalizeIssuer("https://auth.example.com/v2.0/"));
    assertNull(JwtFilter.normalizeIssuer(null));
  }

  @Test
  void testNormalizeIssuerHostCaseOnlyPathPreserved() {
    assertEquals("https://auth.example.com", JwtFilter.normalizeIssuer("https://Auth.Example.COM"));
    assertEquals(
        "https://auth.example.com/realms/MyRealm",
        JwtFilter.normalizeIssuer("https://Auth.Example.COM/realms/MyRealm"));
    assertEquals(
        "https://idp.example.com/tenant-id/v2.0",
        JwtFilter.normalizeIssuer("https://IDP.Example.COM/tenant-id/v2.0/"));
  }

  @Test
  void testInternalBotTokenBypassesIssuerValidation() {
    JwtFilter filter =
        new JwtFilter(
            jwkProvider,
            List.of("sub"),
            "openmetadata.org",
            false,
            "my-client-id",
            "https://auth.example.com",
            "open-metadata.org",
            "internal-kid");

    String jwt =
        JWT.create()
            .withKeyId("internal-kid")
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withIssuer("open-metadata.org")
            .withClaim("sub", "ingestion-bot")
            .withClaim("isBot", true)
            .sign(algorithm);

    Map<String, Claim> claims = filter.validateJwtAndGetClaims(jwt);
    assertEquals("ingestion-bot", claims.get("sub").asString());
  }

  @Test
  void testInternalTokenTypeBypassesIssuerAndAudienceValidation() {
    JwtFilter filter =
        new JwtFilter(
            jwkProvider,
            List.of("sub"),
            "openmetadata.org",
            false,
            "my-client-id",
            "https://auth.example.com",
            "open-metadata.org",
            "internal-kid");

    String jwt =
        JWT.create()
            .withKeyId("internal-kid")
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withIssuer("open-metadata.org")
            .withAudience("not-my-client")
            .withClaim("sub", "sam")
            .withClaim("tokenType", "PERSONAL_ACCESS")
            .sign(algorithm);

    Map<String, Claim> claims = filter.validateJwtAndGetClaims(jwt);
    assertEquals("sam", claims.get("sub").asString());
  }

  @Test
  void testExternalTokenForgingInternalIssuerWithoutKid_RejectedByAudienceCheck() {
    JwtFilter filter =
        new JwtFilter(
            jwkProvider,
            List.of("sub"),
            "openmetadata.org",
            false,
            "my-client-id",
            "https://auth.example.com",
            "open-metadata.org",
            "internal-kid");

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withIssuer("open-metadata.org")
            .withAudience("attacker-client")
            .withClaim("sub", "attacker")
            .withClaim("tokenType", "PERSONAL_ACCESS")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    Exception exception = assertThrows(AuthenticationException.class, () -> filter.filter(context));
    assertTrue(
        exception.getMessage().toLowerCase(Locale.ROOT).contains("issuer mismatch")
            || exception.getMessage().toLowerCase(Locale.ROOT).contains("audience mismatch"));
  }

  @Test
  void testExternalTokenWithoutInternalClaimsStillValidated() {
    JwtFilter filter =
        new JwtFilter(
            jwkProvider,
            List.of("sub"),
            "openmetadata.org",
            false,
            "my-client-id",
            "https://auth.example.com");

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withIssuer("https://evil.example.com")
            .withAudience("my-client-id")
            .withClaim("sub", "sam")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    Exception exception = assertThrows(AuthenticationException.class, () -> filter.filter(context));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("issuer mismatch"));
  }

  @Test
  void testIssuerValidation_FallbackRetryRecoversAfterStartupFailure_AllowsToken() {
    JwtFilter filter =
        new JwtFilter(jwkProvider, List.of("sub"), "openmetadata.org", false, null, null);

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withIssuer("https://auth.example.com/v2.0")
            .withClaim("sub", "sam")
            .sign(algorithm);

    SecurityConfigurationManager mockManager = mock(SecurityConfigurationManager.class);
    when(mockManager.getResolvedOidcIssuer())
        .thenReturn("https://auth.example.com")
        .thenReturn("https://auth.example.com/v2.0");
    when(mockManager.refreshResolvedOidcIssuerIfStale()).thenReturn(true);

    try (MockedStatic<SecurityConfigurationManager> mgrMock =
        mockStatic(SecurityConfigurationManager.class)) {
      mgrMock.when(SecurityConfigurationManager::getInstance).thenReturn(mockManager);
      mgrMock.when(SecurityConfigurationManager::getCurrentAuthConfig).thenReturn(null);

      ContainerRequestContext context = createRequestContextWithJwt(jwt);
      filter.filter(context);

      ArgumentCaptor<SecurityContext> securityContextArgument =
          ArgumentCaptor.forClass(SecurityContext.class);
      verify(context, times(1)).setSecurityContext(securityContextArgument.capture());
      assertEquals("sam", securityContextArgument.getValue().getUserPrincipal().getName());
    }
  }

  @Test
  void testIssuerValidation_FallbackRetryStillMismatch_Rejects() {
    JwtFilter filter =
        new JwtFilter(jwkProvider, List.of("sub"), "openmetadata.org", false, null, null);

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withIssuer("https://evil.example.com")
            .withClaim("sub", "sam")
            .sign(algorithm);

    SecurityConfigurationManager mockManager = mock(SecurityConfigurationManager.class);
    when(mockManager.getResolvedOidcIssuer()).thenReturn("https://auth.example.com");
    when(mockManager.refreshResolvedOidcIssuerIfStale()).thenReturn(true);

    try (MockedStatic<SecurityConfigurationManager> mgrMock =
        mockStatic(SecurityConfigurationManager.class)) {
      mgrMock.when(SecurityConfigurationManager::getInstance).thenReturn(mockManager);
      mgrMock.when(SecurityConfigurationManager::getCurrentAuthConfig).thenReturn(null);

      ContainerRequestContext context = createRequestContextWithJwt(jwt);
      Exception exception =
          assertThrows(AuthenticationException.class, () -> filter.filter(context));
      assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("issuer mismatch"));
    }
  }

  /**
   * Creates the ContainerRequestsContext that is passed to the filter. This object can be quite complex, but the
   * JwtFilter cares only about the Authorization header and request URI.
   */
  private static ContainerRequestContext createRequestContextWithJwt(String jwt) {
    MultivaluedHashMap<String, String> headers =
        new MultivaluedHashMap<>(
            Map.of(JwtFilter.AUTHORIZATION_HEADER, format("%s %s", JwtFilter.TOKEN_PREFIX, jwt)));

    ContainerRequestContext context = mock(ContainerRequestContext.class);
    when(context.getUriInfo()).thenReturn(mockRequestURIInfo);
    when(context.getHeaders()).thenReturn(headers);

    return context;
  }
}
