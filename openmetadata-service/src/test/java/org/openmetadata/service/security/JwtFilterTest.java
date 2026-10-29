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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.security.jwt.JWTTokenGenerator.TOKEN_TYPE;

import com.auth0.jwk.Jwk;
import com.auth0.jwk.JwkProvider;
import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.Claim;
import com.github.benmanes.caffeine.cache.Ticker;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.PathSegment;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.lang.reflect.Field;
import java.net.URI;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CredentialUnavailableExceptionMapper;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.OAuthDAOs;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.OAuthAccessTokenRecord;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.credentials.CredentialUnavailableException;
import org.openmetadata.service.security.credentials.CredentialVerificationConfig;
import org.openmetadata.service.security.credentials.CredentialVerifier;
import org.openmetadata.service.security.credentials.CredentialVerifierFixture;
import org.openmetadata.service.security.jwt.JWKSKey;
import org.openmetadata.service.security.jwt.JWKSResponse;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.security.session.SessionService;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.UserSession;

class JwtFilterTest {

  private static JwtFilter jwtFilter;
  private static JwkProvider jwkProvider;

  private static Algorithm algorithm;
  private static RSAPublicKey publicKey;
  private static UriInfo mockRequestURIInfo;

  private static final String OM_ISSUER = "open-metadata.org";
  private static final String OM_KEY_ID = "om-signing-key";
  private static final String BOT = "ingestion-bot";
  private static final String USER = "sam";
  private static final String BOT_MISMATCH =
      "Not Authorized! The given token does not match the current bot's token!";
  private static final String INVALID_PAT = "Not Authorized! Invalid personal access token!";
  private static final String UNRECOGNIZED = "Not Authorized! Unrecognized token type!";

  /** A real verifier over an in-memory source, replaced for every test. */
  private static CredentialVerifierFixture credentials;

  private static final Supplier<CredentialVerifier> VERIFIER = () -> credentials.verifier();
  private static JWTTokenGenerator generator;

  /** Verifies tokens signed with OpenMetadata's own key, as the server's key lookup does. */
  private static JwtFilter omFilter;

  @BeforeAll
  static void before() throws Exception {
    generator = OpenMetadataSigningKey.install();
    omFilter =
        new JwtFilter(
            OpenMetadataSigningKey.keyLookup(),
            List.of("sub", "email"),
            "openmetadata.org",
            false,
            VERIFIER);

    // Create a RSA256 algorithm wth random public/private key pair
    KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
    keyPairGenerator.initialize(2048);
    KeyPair keyPair = keyPairGenerator.generateKeyPair();
    publicKey = (RSAPublicKey) keyPair.getPublic();
    algorithm = Algorithm.RSA256(publicKey, (RSAPrivateKey) keyPair.getPrivate());

    // Mock a JwkProvider that has a single JWK containing the public key from the algorithm above
    // This is used to verify the JWT
    Jwk mockJwk = mock(Jwk.class);
    when(mockJwk.getPublicKey()).thenReturn(keyPair.getPublic());
    jwkProvider = mock(JwkProvider.class);
    when(jwkProvider.get(algorithm.getSigningKeyId())).thenReturn(mockJwk);

    // This is needed by JwtFilter for some metadata, not very important
    URI uri = URI.create("POST:http://localhost:8080/login");
    mockRequestURIInfo = mock(UriInfo.class);
    when(mockRequestURIInfo.getPath()).thenReturn("/login");
    when(mockRequestURIInfo.getRequestUri()).thenReturn(uri);

    List<String> principalClaims = List.of("sub", "email");
    String domain = "openmetadata.org";
    boolean enforcePrincipalDomain = false;
    jwtFilter =
        new JwtFilter(jwkProvider, principalClaims, domain, enforcePrincipalDomain, VERIFIER);
  }

  @BeforeEach
  void newVerifier() {
    credentials =
        new CredentialVerifierFixture(
            new SimpleMeterRegistry(),
            Ticker.systemTicker(),
            CredentialVerificationConfig.defaults());
  }

  // Every test resolves accounts through this per-test mock. Left to the real SubjectCache, the
  // filter would read the global Entity registry, which other test classes in the same JVM fill
  // with
  // their own mock repositories. A name nobody stubs has no account yet, as on a first login.
  private MockedStatic<SubjectCache> subjectCache;

  @BeforeEach
  void isolateUserLookups() {
    subjectCache = mockStatic(SubjectCache.class);
    subjectCache
        .when(() -> SubjectCache.getUserContext(anyString()))
        .thenThrow(EntityNotFoundException.byMessage("no account holds this name yet"));
  }

  @AfterEach
  void clearRequestContext() {
    subjectCache.close();
    ActivePersonaContext.clear();
    ActiveDomainContext.clear();
    credentials.close();
  }

  @Test
  void testPrincipalDomainEnforcement() {
    List<String> principalClaims = List.of("EMAIL", "sub");
    String domain = "openmetadata.org";
    boolean enforcePrincipalDomain = true;
    JwtFilter domainEnforcingFilter =
        new JwtFilter(jwkProvider, principalClaims, domain, enforcePrincipalDomain, VERIFIER);

    // success case
    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("email", "sam@openmetadata.org")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    UserRepository users =
        repositoryWith(new User().withName("sam").withEmail("sam@openmetadata.org"));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getUserRepository).thenReturn(users);
      domainEnforcingFilter.filter(context);
    }

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
        assertThrows(AuthenticationException.class, () -> domainEnforcingFilter.filter(newContext));
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
  void testCatalogSecurityContextDefaultsToNoActivePersona() {
    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam")
            .sign(algorithm);

    CatalogSecurityContext securityContext = jwtFilter.getCatalogSecurityContext(jwt);

    assertEquals("sam", securityContext.getUserPrincipal().getName());
    assertNull(securityContext.activePersona());
  }

  @Test
  void testActivePersonaHeaderPropagatesWithoutEntityLookup() {
    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam")
            .sign(algorithm);
    String activePersona = "9fb7e857-df45-42e9-b341-12d28c7b49aa";
    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    when(context.getHeaderString(JwtFilter.ACTIVE_PERSONA_HEADER)).thenReturn(activePersona);

    subjectCache
        .when(() -> SubjectCache.getUserContext("sam"))
        .thenReturn(new User().withName("sam"));
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      jwtFilter.filter(context);
      entity.verifyNoInteractions();
    }

    ArgumentCaptor<SecurityContext> securityContextArgument =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context).setSecurityContext(securityContextArgument.capture());
    CatalogSecurityContext catalogSecurityContext =
        (CatalogSecurityContext) securityContextArgument.getValue();
    assertEquals(activePersona, catalogSecurityContext.activePersona());
    assertEquals(activePersona, ActivePersonaContext.getActivePersona());
  }

  @Test
  void testActiveDomainIsResolvedFromTheCachedUser() {
    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam")
            .sign(algorithm);
    EntityReference selected =
        new EntityReference().withId(UUID.randomUUID()).withType("domain").withName("Sales");
    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    subjectCache
        .when(() -> SubjectCache.getUserContext("sam"))
        .thenReturn(new User().withName("sam").withDefaultDomain(selected));
    jwtFilter.filter(context);

    ArgumentCaptor<SecurityContext> securityContextArgument =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context).setSecurityContext(securityContextArgument.capture());
    CatalogSecurityContext catalogSecurityContext =
        (CatalogSecurityContext) securityContextArgument.getValue();
    assertEquals(selected, catalogSecurityContext.activeDomain());
    assertEquals(selected, ActiveDomainContext.getActiveDomain());
  }

  @Test
  void testPersonalAccessTokensCarryNoActiveDomain() {
    // The navbar selection is a UI preference: scripts and SDK calls using a personal access token
    // list without it.
    String pat = personalAccessToken(USER);
    credentials.withPats(Map.of(USER, List.of(pat)));
    ContainerRequestContext context = createRequestContextWithJwt(pat);

    subjectCache
        .when(() -> SubjectCache.getUserContext(USER))
        .thenReturn(
            new User()
                .withName(USER)
                .withDefaultDomain(
                    new EntityReference().withId(UUID.randomUUID()).withType("domain")));
    omFilter.filter(context);

    ArgumentCaptor<SecurityContext> securityContextArgument =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context).setSecurityContext(securityContextArgument.capture());
    assertNull(((CatalogSecurityContext) securityContextArgument.getValue()).activeDomain());
    assertNull(ActiveDomainContext.getActiveDomain());
  }

  @Test
  void testBotsCarryNoActiveDomain() {
    String jwt = botToken(BOT);
    credentials.withJwtMechanisms(Map.of(BOT, jwt));

    CatalogSecurityContext securityContext = omFilter.getCatalogSecurityContext(jwt);

    assertNull(securityContext.activeDomain());
    subjectCache.verifyNoInteractions();
  }

  @Test
  void testFilterWithEmailClaim() {
    ContainerRequestContext context =
        createRequestContextWithJwt(legacyProviderJwt("sam@gmail.com"));
    UserRepository users = repositoryWith(new User().withName("sam").withEmail("sam@gmail.com"));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getUserRepository).thenReturn(users);
      jwtFilter.filter(context);
    }

    ArgumentCaptor<SecurityContext> securityContextArgument =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context, times(1)).setSecurityContext(securityContextArgument.capture());

    assertEquals("sam", securityContextArgument.getValue().getUserPrincipal().getName());
  }

  /**
   * The legacy flow resolves the account by the claim's local part. A stored email that differs from
   * the token's - set by an admin, by CSV import or SCIM, or after an IdP domain change - must still
   * sign in, not be logged out on every request.
   */
  @Test
  void aLegacyProviderTokenSignsInWhenTheStoredEmailDiffers() {
    ContainerRequestContext context =
        createRequestContextWithJwt(legacyProviderJwt("sam@other.example"));

    subjectCache
        .when(() -> SubjectCache.getUserContext("sam"))
        .thenReturn(new User().withName("sam").withEmail("sam@gmail.com"));
    jwtFilter.filter(context);

    verify(context, times(1)).setSecurityContext(any());
  }

  @Test
  void aProviderTokenNeverSignsInToABotAccount() {
    ContainerRequestContext context =
        createRequestContextWithJwt(legacyProviderJwt("ingestion-bot@openmetadata.org"));
    subjectCache
        .when(() -> SubjectCache.getUserContext("ingestion-bot"))
        .thenReturn(botAccount("ingestion-bot"));

    assertThrows(AuthenticationException.class, () -> jwtFilter.filter(context));
    verify(context, never()).setSecurityContext(any());
  }

  /** A bare principal claim names the account just as an email's local part does. */
  @Test
  void aBareProviderPrincipalNeverSignsInToABotAccount() {
    String bareBotPrincipal =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "ingestion-bot")
            .sign(algorithm);
    ContainerRequestContext context = createRequestContextWithJwt(bareBotPrincipal);
    subjectCache
        .when(() -> SubjectCache.getUserContext("ingestion-bot"))
        .thenReturn(botAccount("ingestion-bot"));

    assertThrows(AuthenticationException.class, () -> jwtFilter.filter(context));
    verify(context, never()).setSecurityContext(any());
  }

  /** A name no account holds yet makes the user lookup throw; that is a first login, not a bot. */
  @Test
  void aProviderTokenForANameNoAccountHoldsIsAFirstLogin() {
    ContainerRequestContext context =
        createRequestContextWithJwt(legacyProviderJwt("new@gmail.com"));
    subjectCache
        .when(() -> SubjectCache.getUserContext("new"))
        .thenThrow(EntityNotFoundException.byMessage("user instance for new not found"));

    jwtFilter.filter(context);

    verify(context, times(1)).setSecurityContext(any());
  }

  @Test
  void allowedEmailDomainsApplyToLegacyProviderTokens() {
    JwtFilter legacyWithAllowList =
        new JwtFilter(
            jwkProvider,
            List.of("sub", "email"),
            "openmetadata.org",
            false,
            null,
            null,
            List.of("openmetadata.org"));

    // A token that carries an email outside the allowed domains is rejected.
    ContainerRequestContext outsider =
        createRequestContextWithJwt(legacyProviderJwt("sam@gmail.com"));
    assertThrows(AuthenticationException.class, () -> legacyWithAllowList.filter(outsider));

    // A token with no email runs as sam@openmetadata.org, an allowed domain, so a deployment whose
    // first principal claim is a bare username keeps working instead of being locked out on
    // upgrade.
    String subjectOnly =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam")
            .sign(algorithm);
    ContainerRequestContext noEmail = createRequestContextWithJwt(subjectOnly);
    legacyWithAllowList.filter(noEmail);
    verify(noEmail, times(1)).setSecurityContext(any());
  }

  /** With no email, the address the legacy flow builds must still be in an allowed domain. */
  @Test
  void aBareClaimOutsideTheAllowedDomainsIsRejected() {
    JwtFilter principalDomainOutsideAllowList =
        new JwtFilter(
            jwkProvider,
            List.of("sub", "email"),
            "contractor.example",
            false,
            null,
            null,
            List.of("openmetadata.org"));
    String subjectOnly =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam")
            .sign(algorithm);
    ContainerRequestContext context = createRequestContextWithJwt(subjectOnly);

    assertThrows(
        AuthenticationException.class, () -> principalDomainOutsideAllowList.filter(context));
    verify(context, never()).setSecurityContext(any());
  }

  @Test
  void aPublicEntraClientIsRestrictedToTheTenantItsAuthorityNames() {
    String tenant = "11111111-2222-3333-4444-555555555555";

    assertEquals(
        tenant,
        JwtFilter.publicClientEntraTenant(
            entraSignIn(ClientType.PUBLIC, "https://login.microsoftonline.com/" + tenant)));
    assertEquals(
        tenant,
        JwtFilter.publicClientEntraTenant(
            entraSignIn(
                ClientType.PUBLIC, "https://login.microsoftonline.com/" + tenant + "/v2.0/")));
  }

  @Test
  void onlyAPublicEntraClientNamingATenantIdIsRestricted() {
    assertNull(
        JwtFilter.publicClientEntraTenant(
            entraSignIn(ClientType.PUBLIC, "https://login.microsoftonline.com/common")));
    assertNull(
        JwtFilter.publicClientEntraTenant(
            entraSignIn(ClientType.PUBLIC, "https://login.microsoftonline.com/contoso.com")));
    assertNull(
        JwtFilter.publicClientEntraTenant(
            entraSignIn(
                ClientType.CONFIDENTIAL,
                "https://login.microsoftonline.com/11111111-2222-3333-4444-555555555555")));
    assertNull(
        JwtFilter.publicClientEntraTenant(
            new AuthenticationConfiguration()
                .withProvider(AuthProvider.GOOGLE)
                .withClientType(ClientType.PUBLIC)
                .withAuthority("https://accounts.google.com")));
  }

  private static AuthenticationConfiguration entraSignIn(ClientType clientType, String authority) {
    return new AuthenticationConfiguration()
        .withProvider(AuthProvider.AZURE)
        .withClientType(clientType)
        .withAuthority(authority);
  }

  @Test
  void excludedEndpointsAreMatchedExactlyAndIgnoreMatrixParameters() {
    // A genuine excluded endpoint, and the same path with a matrix parameter, both match.
    assertTrue(JwtFilter.isExcludedEndpoint(pathSegments(List.of("v1", "users", "login"))));
    assertTrue(
        JwtFilter.isExcludedEndpoint(pathSegments(List.of("v1", "users", "login;jsessionid=x"))));
    // A write to an entity whose name merely embeds an excluded endpoint is not excluded.
    assertFalse(
        JwtFilter.isExcludedEndpoint(
            pathSegments(List.of("v1", "tables", "name", "v1/users/login"))));
    assertFalse(JwtFilter.isExcludedEndpoint(pathSegments(List.of("v1", "tables", "name", "foo"))));
  }

  private static UriInfo pathSegments(List<String> segments) {
    List<PathSegment> pathSegments =
        segments.stream()
            .map(
                segment -> {
                  PathSegment pathSegment = mock(PathSegment.class);
                  when(pathSegment.getPath())
                      .thenReturn(segment.contains(";") ? segment.split(";")[0] : segment);
                  return pathSegment;
                })
            .collect(Collectors.toList());
    UriInfo uriInfo = mock(UriInfo.class);
    when(uriInfo.getPathSegments()).thenReturn(pathSegments);
    return uriInfo;
  }

  private static String legacyProviderJwt(String email) {
    return JWT.create()
        .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
        .withClaim("email", email)
        .sign(algorithm);
  }

  private static User botAccount(String name) {
    return new User().withName(name).withEmail(name + "@openmetadata.org").withIsBot(true);
  }

  private static UserRepository repositoryWith(User account) {
    UserRepository userRepository = mock(UserRepository.class);
    when(userRepository.findByNameOrNull(account.getName(), Include.NON_DELETED))
        .thenReturn(account);
    return userRepository;
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
  void personalAccessTokenIsAcceptedWhileItIsStored() {
    String pat = personalAccessToken(USER);
    credentials.withPats(Map.of(USER, List.of(pat)));

    assertEquals(USER, principalOf(omFilter, pat));
    assertEquals(1, credentials.fullReadsOf(USER));
  }

  @Test
  void revokedPersonalAccessTokenIsRejectedWithThePersonalAccessTokenMessage() {
    String pat = personalAccessToken(USER);
    credentials.withPats(Map.of(USER, List.of(pat)));
    assertEquals(USER, principalOf(omFilter, pat));

    credentials.revoke(USER);

    assertRejectedBy(omFilter, pat, INVALID_PAT);
  }

  @Test
  void botTokenIsAcceptedWhileItIsTheCurrentOne() {
    String jwt = botToken(BOT);
    credentials.withJwtMechanisms(Map.of(BOT, jwt));

    assertEquals(BOT, principalOf(omFilter, jwt));
  }

  @Test
  void revokedBotTokenIsRejectedWithTheBotMessage() {
    String jwt = botToken(BOT);
    credentials.withJwtMechanisms(Map.of(BOT, jwt));
    assertEquals(BOT, principalOf(omFilter, jwt));

    credentials.revoke(BOT);

    assertRejectedBy(omFilter, jwt, BOT_MISMATCH);
  }

  @Test
  void rotatedBotTokenIsRejectedWithTheBotMessage() {
    String rotatedAway = botToken(BOT);
    credentials.withJwtMechanisms(Map.of(BOT, botToken(BOT)));

    assertRejectedBy(omFilter, rotatedAway, BOT_MISMATCH);
  }

  @Test
  void impersonatedRequestIsCheckedAgainstTheBotsOwnToken() {
    String jwt = botToken(BOT);
    credentials.withJwtMechanisms(Map.of(BOT, jwt));
    assertEquals(BOT, principalOf(omFilter, jwt));
    credentials.revoke(BOT);
    ContainerRequestContext impersonating = createRequestContextWithJwt(jwt);
    when(impersonating.getHeaderString(JwtFilter.IMPERSONATE_USER_HEADER)).thenReturn(USER);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      AuthenticationException rejected =
          assertThrows(AuthenticationException.class, () -> omFilter.filter(impersonating));

      assertEquals(BOT_MISMATCH, rejected.getMessage());
      entity.verifyNoInteractions();
    }
    verify(impersonating, never()).setSecurityContext(any());
  }

  @ParameterizedTest
  @EnumSource(EntryPoint.class)
  void everyEntryPointRejectsARevokedPersonalAccessToken(EntryPoint entryPoint) {
    String pat = personalAccessToken(USER);
    credentials.withPats(Map.of(USER, List.of(pat)));
    entryPoint.authenticate(omFilter, pat);

    credentials.revoke(USER);

    AuthenticationException rejected =
        assertThrows(AuthenticationException.class, () -> entryPoint.authenticate(omFilter, pat));
    assertEquals(INVALID_PAT, rejected.getMessage());
  }

  /** OpenMetadata never issues these: each one is rejected even when its token is stored. */
  @ParameterizedTest
  @CsvSource({"false, BOT", "true, PERSONAL_ACCESS", "true, OM_USER"})
  void openMetadataSignedTokenOfNoIssuedKindIsRejected(boolean isBot, ServiceTokenType type) {
    String jwt =
        generator
            .getJwtAuthMechanism(
                USER, new HashSet<>(), false, emailOf(USER), isBot, type, inOneDay(), null)
            .getJWTToken();
    credentials.withPats(Map.of(USER, List.of(jwt))).withJwtMechanisms(Map.of(USER, jwt));

    assertRejectedBy(omFilter, jwt, UNRECOGNIZED);
    assertEquals(0, credentials.fullReads());
  }

  /** OpenMetadata writes tokenType as text, so a value of any other JSON type is no issued kind. */
  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void openMetadataSignedTokenWithANonTextTokenTypeIsRejected(boolean isBot) {
    String jwt =
        JWT.create()
            .withKeyId(OpenMetadataSigningKey.KEY_ID)
            .withIssuer(OpenMetadataSigningKey.ISSUER)
            .withExpiresAt(inOneDay())
            .withClaim("sub", USER)
            .withClaim("email", emailOf(USER))
            .withClaim(JwtFilter.BOT_CLAIM, isBot)
            .withClaim(TOKEN_TYPE, 7)
            .sign(OpenMetadataSigningKey.signingAlgorithm());

    assertRejectedBy(omFilter, jwt, UNRECOGNIZED);
    assertEquals(0, credentials.fullReads());
  }

  @Test
  void providerTokenClaimingToBeABotIsRejected() {
    String jwt =
        JWT.create()
            .withExpiresAt(inOneDay())
            .withClaim("sub", BOT)
            .withClaim(JwtFilter.BOT_CLAIM, true)
            .withClaim(TOKEN_TYPE, ServiceTokenType.BOT.value())
            .sign(algorithm);

    assertRejectedBy(jwtFilter, jwt, UNRECOGNIZED);
  }

  @Test
  void providerTokenClaimingToBeAPersonalAccessTokenIsRejected() {
    String jwt =
        JWT.create()
            .withExpiresAt(inOneDay())
            .withClaim("sub", USER)
            .withClaim(TOKEN_TYPE, ServiceTokenType.PERSONAL_ACCESS.value())
            .sign(algorithm);

    assertRejectedBy(jwtFilter, jwt, UNRECOGNIZED);
    assertEquals(0, credentials.fullReads());
  }

  @Test
  void providerTokenReachesNoStoredCredentialRead() {
    String jwt = JWT.create().withExpiresAt(inOneDay()).withClaim("sub", USER).sign(algorithm);

    assertEquals(USER, principalOf(jwtFilter, jwt));
    assertEquals(0, credentials.fullReads());
    assertEquals(0, credentials.fingerprintReads());
  }

  @Test
  void storedCredentialThatCannotBeConfirmedIsUnavailableNotRejected() {
    String jwt = botToken(BOT);
    credentials.withJwtMechanisms(Map.of(BOT, jwt));
    credentials.failReads();
    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    CredentialUnavailableException unavailable =
        assertThrows(CredentialUnavailableException.class, () -> omFilter.filter(context));

    Response response = new CredentialUnavailableExceptionMapper().toResponse(unavailable);
    assertEquals(503, response.getStatus());
    assertEquals("2", response.getHeaderString("Retry-After"));
    verify(context, never()).setSecurityContext(any());
  }

  /** Other distributions' tests build the filter this way, over provider-signed tokens. */
  @Test
  void fourArgumentConstructorAcceptsAProviderTokenWithNoVerifierInstalled() {
    JwtFilter filter =
        new JwtFilter(jwkProvider, List.of("sub", "email"), "openmetadata.org", false);
    String jwt = JWT.create().withExpiresAt(inOneDay()).withClaim("sub", USER).sign(algorithm);

    assertEquals(USER, principalOf(filter, jwt));
  }

  /** Other distributions map the principal themselves once this has returned the claims. */
  @Test
  void claimsOfAProviderTokenWithNoConfiguredPrincipalClaimAreReturned() {
    String jwt =
        JWT.create().withExpiresAt(inOneDay()).withClaim("oid", "opaque-guid").sign(algorithm);

    assertEquals("opaque-guid", jwtFilter.validateJwtAndGetClaims(jwt).get("oid").asString());
    ContainerRequestContext request = createRequestContextWithJwt(jwt);
    assertThrows(AuthenticationException.class, () -> jwtFilter.filter(request));
  }

  @Test
  void fourArgumentConstructorCannotConfirmAStoredTokenWithNoVerifierInstalled() {
    JwtFilter filter =
        new JwtFilter(
            OpenMetadataSigningKey.keyLookup(), List.of("sub", "email"), "openmetadata.org", false);
    String jwt = botToken(BOT);

    assertThrows(CredentialUnavailableException.class, () -> filter.validateJwtAndGetClaims(jwt));
  }

  @Test
  void checkValidationsForTokenChecksTheTokenItIsGivenWhateverClaimsAccompanyIt() {
    String pat = personalAccessToken(USER);
    credentials.withPats(Map.of(USER, List.of(pat)));
    Map<String, Claim> providerClaims =
        JWT.decode(JWT.create().withExpiresAt(inOneDay()).withClaim("sub", USER).sign(algorithm))
            .getClaims();
    omFilter.checkValidationsForToken(providerClaims, pat, USER, null);

    credentials.revoke(USER);

    AuthenticationException rejected =
        assertThrows(
            AuthenticationException.class,
            () -> omFilter.checkValidationsForToken(providerClaims, pat, USER, null));
    assertEquals(INVALID_PAT, rejected.getMessage());
    assertEquals(2, credentials.fullReadsOf(USER), "the first check's read and the revoke's");
  }

  @Test
  void verifySignatureOnlySkipsTheStoredCredentialCheck() {
    String neverStored = botToken(BOT);

    Map<String, Claim> claims = omFilter.verifySignatureOnly(neverStored);

    assertEquals(BOT, claims.get("sub").asString());
    assertEquals(0, credentials.fullReads());
    assertRejectedBy(omFilter, neverStored, BOT_MISMATCH);
  }

  /** The public ways a caller authenticates a token; each must run the stored-credential check. */
  private enum EntryPoint {
    REQUEST_FILTER {
      @Override
      void authenticate(JwtFilter filter, String token) {
        filter.filter(createRequestContextWithJwt(token));
      }
    },
    CLAIMS {
      @Override
      void authenticate(JwtFilter filter, String token) {
        filter.validateJwtAndGetClaims(token);
      }
    },
    SECURITY_CONTEXT {
      @Override
      void authenticate(JwtFilter filter, String token) {
        filter.getCatalogSecurityContext(token);
      }
    },
    /** A caller that obtains the claims some other way and then runs the follow-up checks. */
    CHECKS_AFTER_SIGNATURE_ONLY {
      @Override
      void authenticate(JwtFilter filter, String token) {
        Map<String, Claim> claims = filter.verifySignatureOnly(token);
        filter.checkValidationsForToken(claims, token, claims.get("sub").asString(), null);
      }
    };

    abstract void authenticate(JwtFilter filter, String token);
  }

  /** A bot token as bot creation and token regeneration mint it. */
  private static String botToken(String botName) {
    User bot =
        new User().withName(botName).withEmail(emailOf(botName)).withIsBot(true).withIsAdmin(false);
    return generator.generateJWTToken(bot, JWTTokenExpiry.Unlimited).getJWTToken();
  }

  /** A personal access token as {@code UserResource.createPersonalAccessToken} mints it. */
  private static String personalAccessToken(String userName) {
    return generator
        .getJwtAuthMechanism(
            userName,
            new HashSet<>(),
            false,
            emailOf(userName),
            false,
            ServiceTokenType.PERSONAL_ACCESS,
            JWTTokenGenerator.getExpiryDate(JWTTokenExpiry.Seven),
            null)
        .getJWTToken();
  }

  private static String emailOf(String name) {
    return name + "@openmetadata.org";
  }

  private static Date inOneDay() {
    return Date.from(Instant.now().plus(1, ChronoUnit.DAYS));
  }

  private static String principalOf(JwtFilter filter, String token) {
    ContainerRequestContext context = createRequestContextWithJwt(token);
    filter.filter(context);
    ArgumentCaptor<SecurityContext> securityContext =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context).setSecurityContext(securityContext.capture());
    return securityContext.getValue().getUserPrincipal().getName();
  }

  private static void assertRejectedBy(JwtFilter filter, String token, String message) {
    ContainerRequestContext context = createRequestContextWithJwt(token);
    AuthenticationException rejected =
        assertThrows(AuthenticationException.class, () -> filter.filter(context));
    assertEquals(message, rejected.getMessage());
    verify(context, never()).setSecurityContext(any());
  }

  @ParameterizedTest
  @EnumSource(
      value = SessionStatus.class,
      names = {"ACTIVE", "REFRESHING"})
  void sessionBoundUserTokenAcceptsAuthenticatedSessionDuringRefresh(final SessionStatus status) {
    final UserSession session =
        activeSession("session-1", "sam", "basic").toBuilder()
            .status(status)
            .refreshLeaseUntil(System.currentTimeMillis() + 30_000)
            .build();
    AuthServeletHandlerRegistry.setSessionService(null, sessionServiceReturning(session));
    try {
      final ContainerRequestContext context =
          createRequestContextWithJwt(sessionBoundJwt("sam", "session-1"));
      jwtFilter.filter(context);
      final ArgumentCaptor<SecurityContext> securityContext =
          ArgumentCaptor.forClass(SecurityContext.class);
      verify(context).setSecurityContext(securityContext.capture());
      assertEquals("sam", securityContext.getValue().getUserPrincipal().getName());
    } finally {
      AuthServeletHandlerRegistry.setSessionService(null, null);
    }
  }

  @ParameterizedTest
  @EnumSource(
      value = SessionStatus.class,
      names = {"PENDING", "REVOKED", "EXPIRED"})
  void sessionBoundUserTokenRejectsUnauthenticatedSession(final SessionStatus status) {
    final UserSession session =
        activeSession("session-1", "sam", "basic").toBuilder().status(status).build();
    AuthServeletHandlerRegistry.setSessionService(null, sessionServiceReturning(session));
    try {
      final ContainerRequestContext context =
          createRequestContextWithJwt(sessionBoundJwt("sam", "session-1"));
      final Exception exception =
          assertThrows(AuthenticationException.class, () -> jwtFilter.filter(context));
      assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("invalid session"));
    } finally {
      AuthServeletHandlerRegistry.setSessionService(null, null);
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void refreshingSessionCannotBypassSessionExpiry(final boolean idleExpiry) {
    final UserSession session = activeSession("session-1", "sam", "basic");
    final UserSession expired =
        session.toBuilder()
            .status(SessionStatus.REFRESHING)
            .refreshLeaseUntil(System.currentTimeMillis() + 30_000)
            .expiresAt(idleExpiry ? session.getExpiresAt() : 0L)
            .idleExpiresAt(idleExpiry ? 0L : session.getIdleExpiresAt())
            .build();
    AuthServeletHandlerRegistry.setSessionService(null, sessionServiceReturning(expired));
    try {
      final ContainerRequestContext context =
          createRequestContextWithJwt(sessionBoundJwt("sam", "session-1"));
      assertThrows(AuthenticationException.class, () -> jwtFilter.filter(context));
    } finally {
      AuthServeletHandlerRegistry.setSessionService(null, null);
    }
  }

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = "another-user")
  void refreshingSessionMustMatchTokenUser(final String username) {
    final UserSession session =
        activeSession("session-1", username, "basic").toBuilder()
            .status(SessionStatus.REFRESHING)
            .refreshLeaseUntil(System.currentTimeMillis() + 30_000)
            .build();
    AuthServeletHandlerRegistry.setSessionService(null, sessionServiceReturning(session));
    try {
      final ContainerRequestContext context =
          createRequestContextWithJwt(sessionBoundJwt("sam", "session-1"));
      assertThrows(AuthenticationException.class, () -> jwtFilter.filter(context));
    } finally {
      AuthServeletHandlerRegistry.setSessionService(null, null);
    }
  }

  @Test
  void openMetadataIssuedTokenBypassesDomainEnforcement() throws Exception {
    JwtFilter enforcingFilter = newEnforcingFilterForKeyId(OM_KEY_ID);
    String jwt =
        JWT.create()
            .withKeyId(OM_KEY_ID)
            .withIssuer(OM_ISSUER)
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "asmith")
            .withClaim("email", "asmith@intermedia.com")
            .withClaim(TOKEN_TYPE, ServiceTokenType.OM_USER.value())
            .sign(algorithm);
    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    try (MockedStatic<JWTTokenGenerator> generator =
        org.mockito.Mockito.mockStatic(
            JWTTokenGenerator.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
      JWTTokenGenerator instance = mock(JWTTokenGenerator.class);
      when(instance.getIssuer()).thenReturn(OM_ISSUER);
      when(instance.getKid()).thenReturn(OM_KEY_ID);
      generator.when(JWTTokenGenerator::getInstance).thenReturn(instance);

      enforcingFilter.filter(context);
    }

    verify(context, times(1))
        .setSecurityContext(org.mockito.ArgumentMatchers.any(SecurityContext.class));
  }

  @Test
  void mcpAccessTokenNoLongerStoredIsRejected() throws Exception {
    String token = mcpAccessToken();

    Exception exception =
        assertThrows(AuthenticationException.class, () -> filterMcpAccessToken(token, null));
    assertTrue(exception.getMessage().contains("revoked"));
  }

  /** Signed with our key under an issuer the server has since changed: still looked up. */
  @Test
  void mcpAccessTokenFromAnEarlierIssuerIsStillLookedUp() throws Exception {
    String token =
        JWT.create()
            .withKeyId(OM_KEY_ID)
            .withIssuer("an-earlier-issuer")
            .withExpiresAt(Date.from(Instant.now().plus(10, ChronoUnit.MINUTES)))
            .withClaim("sub", "sam")
            .withClaim(TOKEN_TYPE, ServiceTokenType.OM_USER.value())
            .withClaim(JWTTokenGenerator.CLIENT_ID_CLAIM, "mcp-client")
            .sign(algorithm);

    Exception exception =
        assertThrows(AuthenticationException.class, () -> filterMcpAccessToken(token, null));
    assertTrue(exception.getMessage().contains("revoked"));
  }

  @Test
  void mcpAccessTokenStillStoredIsAccepted() throws Exception {
    String token = mcpAccessToken();
    OAuthAccessTokenRecord stored =
        new OAuthAccessTokenRecord(
            UUID.randomUUID(),
            OAuthDAOs.hashToken(token),
            "encrypted",
            "mcp-client",
            "sam",
            List.of(),
            Long.MAX_VALUE);

    ContainerRequestContext context = filterMcpAccessToken(token, stored);

    verify(context).setSecurityContext(any(SecurityContext.class));
  }

  /** A provider's own token may carry client_id too; only a token OpenMetadata signed is looked up. */
  @Test
  void providerTokenWithAClientIdIsNotLookedUp() {
    String token =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam")
            .withAudience("openmetadata-client")
            .withClaim(JWTTokenGenerator.CLIENT_ID_CLAIM, "openmetadata-client")
            .sign(algorithm);
    ContainerRequestContext context = createRequestContextWithJwt(token);

    try (MockedStatic<Entity> entity =
        mockStatic(Entity.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
      filterExpectingClient("openmetadata-client").filter(context);
      entity.verify(Entity::getCollectionDAO, never());
    }

    verify(context).setSecurityContext(any(SecurityContext.class));
  }

  private static String mcpAccessToken() {
    return JWT.create()
        .withKeyId(OM_KEY_ID)
        .withIssuer(OM_ISSUER)
        .withExpiresAt(Date.from(Instant.now().plus(10, ChronoUnit.MINUTES)))
        .withClaim("sub", "sam")
        .withClaim(TOKEN_TYPE, ServiceTokenType.OM_USER.value())
        .withClaim(JWTTokenGenerator.CLIENT_ID_CLAIM, "mcp-client")
        .sign(algorithm);
  }

  /** Runs an OpenMetadata-signed MCP access token through the filter with the given stored row. */
  private static ContainerRequestContext filterMcpAccessToken(
      String token, OAuthAccessTokenRecord storedRow) throws Exception {
    JwtFilter filter =
        new JwtFilter(jwkProviderForKeyId(OM_KEY_ID), List.of("sub", "email"), OM_ISSUER, false);
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.OAuthAccessTokenDAO accessTokens = mock(CollectionDAO.OAuthAccessTokenDAO.class);
    when(dao.oauthAccessTokenDAO()).thenReturn(accessTokens);
    when(accessTokens.findByTokenHash(OAuthDAOs.hashToken(token))).thenReturn(storedRow);
    ContainerRequestContext context = createRequestContextWithJwt(token);

    try (MockedStatic<JWTTokenGenerator> generator =
            mockStatic(JWTTokenGenerator.class, org.mockito.Mockito.CALLS_REAL_METHODS);
        MockedStatic<Entity> entity =
            mockStatic(Entity.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
      JWTTokenGenerator instance = mock(JWTTokenGenerator.class);
      when(instance.getIssuer()).thenReturn(OM_ISSUER);
      when(instance.getKid()).thenReturn(OM_KEY_ID);
      generator.when(JWTTokenGenerator::getInstance).thenReturn(instance);
      entity.when(Entity::getCollectionDAO).thenReturn(dao);

      filter.filter(context);
    }
    return context;
  }

  @Test
  void externalTokenStillEnforcedWhenServerHasNoSigningIdentity() throws Exception {
    JwtFilter enforcingFilter = newEnforcingFilterForKeyId(OM_KEY_ID);
    String jwt =
        JWT.create()
            .withKeyId(OM_KEY_ID)
            .withIssuer(OM_ISSUER)
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("email", "asmith@intermedia.com")
            .sign(algorithm);
    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    try (MockedStatic<JWTTokenGenerator> generator =
        org.mockito.Mockito.mockStatic(
            JWTTokenGenerator.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
      JWTTokenGenerator instance = mock(JWTTokenGenerator.class);
      when(instance.getIssuer()).thenReturn(null);
      when(instance.getKid()).thenReturn(null);
      generator.when(JWTTokenGenerator::getInstance).thenReturn(instance);

      Exception exception =
          assertThrows(AuthenticationException.class, () -> enforcingFilter.filter(context));
      assertTrue(
          exception
              .getMessage()
              .toLowerCase(Locale.ROOT)
              .contains("email does not match the principal domain"));
    }
  }

  @Test
  void spoofedOpenMetadataKeyIdWithoutMatchingSignatureIsRejected() throws Exception {
    KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
    keyPairGenerator.initialize(2048);
    KeyPair attackerKeyPair = keyPairGenerator.generateKeyPair();
    Algorithm attackerAlgorithm =
        Algorithm.RSA256(
            (RSAPublicKey) attackerKeyPair.getPublic(),
            (RSAPrivateKey) attackerKeyPair.getPrivate());

    String jwt =
        JWT.create()
            .withKeyId(OM_KEY_ID)
            .withIssuer(OM_ISSUER)
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "asmith")
            .withClaim("email", "asmith@intermedia.com")
            .withClaim(TOKEN_TYPE, ServiceTokenType.OM_USER.value())
            .sign(attackerAlgorithm);
    JwtFilter enforcingFilter = newEnforcingFilterForKeyId(OM_KEY_ID);
    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    Exception exception =
        assertThrows(AuthenticationException.class, () -> enforcingFilter.filter(context));
    assertTrue(
        exception.getMessage().toLowerCase(Locale.ROOT).contains("token verification failed"));
  }

  private static JwtFilter newEnforcingFilterForKeyId(String keyId) throws Exception {
    return new JwtFilter(
        jwkProviderForKeyId(keyId), List.of("sub", "email"), OM_ISSUER, true, VERIFIER);
  }

  private static JwkProvider jwkProviderForKeyId(String keyId) throws Exception {
    Jwk jwk = mock(Jwk.class);
    when(jwk.getPublicKey()).thenReturn(publicKey);
    JwkProvider keyIdAwareProvider = mock(JwkProvider.class);
    when(keyIdAwareProvider.get(keyId)).thenReturn(jwk);
    return keyIdAwareProvider;
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

  private static SessionService sessionServiceReturning(UserSession session) {
    SessionService sessionService = mock(SessionService.class);
    when(sessionService.getFreshSessionById(session.getId())).thenReturn(Optional.of(session));
    return sessionService;
  }

  private static UserSession activeSession(String id, String username, String provider) {
    return UserSession.builder()
        .id(id)
        .username(username)
        .provider(provider)
        .status(SessionStatus.ACTIVE)
        .expiresAt(System.currentTimeMillis() + 60_000)
        .idleExpiresAt(System.currentTimeMillis() + 60_000)
        .build();
  }

  private static String sessionBoundJwt(String userName, String sessionId) {
    return JWT.create()
        .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
        .withClaim("sub", userName)
        .withClaim(TOKEN_TYPE, ServiceTokenType.OM_USER.value())
        .withClaim(JWTTokenGenerator.SESSION_ID_CLAIM, sessionId)
        .sign(algorithm);
  }

  @Test
  void sessionIssuedUnderTheOtherNativePasswordProviderNameIsAccepted() {
    // basic and openmetadata are two names for the same native-password authenticator. Renaming one
    // to the other is not a provider swap, so it must not invalidate every live session.
    UserSession openMetadataSession = activeSession("session-1", "sam", "openmetadata");
    AuthServeletHandlerRegistry.setSessionService(
        null, sessionServiceReturning(openMetadataSession));
    JwtFilter basicProviderFilter =
        new JwtFilter(
            jwkProvider,
            List.of("sub", "email"),
            "openmetadata.org",
            false,
            AuthProvider.BASIC,
            VERIFIER);

    try {
      ContainerRequestContext context =
          createRequestContextWithJwt(sessionBoundJwt("sam", "session-1"));
      basicProviderFilter.filter(context);
      verify(context, times(1))
          .setSecurityContext(org.mockito.ArgumentMatchers.any(SecurityContext.class));
    } finally {
      AuthServeletHandlerRegistry.setSessionService(null, null);
    }
  }

  @ParameterizedTest
  @EnumSource(
      value = SessionStatus.class,
      names = {"ACTIVE", "REFRESHING"})
  void sessionIssuedByDecommissionedProviderIsRejected(final SessionStatus status) {
    UserSession googleSession =
        activeSession("session-1", "sam", "google").toBuilder().status(status).build();
    AuthServeletHandlerRegistry.setSessionService(null, sessionServiceReturning(googleSession));
    JwtFilter basicProviderFilter =
        new JwtFilter(
            jwkProvider,
            List.of("sub", "email"),
            "openmetadata.org",
            false,
            AuthProvider.BASIC,
            VERIFIER);

    try {
      ContainerRequestContext context =
          createRequestContextWithJwt(sessionBoundJwt("sam", "session-1"));
      Exception exception =
          assertThrows(AuthenticationException.class, () -> basicProviderFilter.filter(context));
      assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("no longer configured"));
    } finally {
      AuthServeletHandlerRegistry.setSessionService(null, null);
    }
  }

  @Test
  void testEmailFirstFlowSuccess() {
    JwtFilter emailFirstFilter = new JwtFilter(jwkProvider, "email", "name", List.of(), VERIFIER);

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("email", "john.success@company.com")
            .withClaim("name", "John Doe")
            .sign(algorithm);

    try (MockedStatic<Entity> entityMock = mockUnknownUserRepository()) {
      ContainerRequestContext context = createRequestContextWithJwt(jwt);
      emailFirstFilter.filter(context);

      ArgumentCaptor<SecurityContext> securityContextArgument =
          ArgumentCaptor.forClass(SecurityContext.class);
      verify(context, times(1)).setSecurityContext(securityContextArgument.capture());

      assertEquals("john.success", securityContextArgument.getValue().getUserPrincipal().getName());
    }
  }

  @Test
  void testEmailFirstFlowWithDomainValidation() {
    JwtFilter emailFirstFilter =
        new JwtFilter(jwkProvider, "email", "name", List.of("company.com", "corp.com"), VERIFIER);

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("email", "john.domain@company.com")
            .sign(algorithm);

    try (MockedStatic<Entity> entityMock = mockUnknownUserRepository()) {
      ContainerRequestContext context = createRequestContextWithJwt(jwt);
      emailFirstFilter.filter(context);

      ArgumentCaptor<SecurityContext> securityContextArgument =
          ArgumentCaptor.forClass(SecurityContext.class);
      verify(context, times(1)).setSecurityContext(securityContextArgument.capture());

      assertEquals("john.domain", securityContextArgument.getValue().getUserPrincipal().getName());
    }
  }

  @Test
  void testEmailFirstFlowWithInvalidDomain() {
    JwtFilter emailFirstFilter =
        new JwtFilter(jwkProvider, "email", "name", List.of("company.com"), VERIFIER);

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("email", "john.other@gmail.com")
            .sign(algorithm);

    try (MockedStatic<Entity> entityMock = mockUnknownUserRepository()) {
      ContainerRequestContext context = createRequestContextWithJwt(jwt);

      Exception exception =
          assertThrows(AuthenticationException.class, () -> emailFirstFilter.filter(context));
      assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("domain"));
      assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("not in allowed list"));
    }
  }

  @Test
  void testEmailFirstFlowRejectsUnknownEmailWhenUsernameIsTaken() {
    JwtFilter emailFirstFilter = new JwtFilter(jwkProvider, "email", "name", List.of(), VERIFIER);
    UserRepository userRepository = mock(UserRepository.class);
    when(userRepository.getActiveUserByEmailForAuth(any(), any()))
        .thenThrow(EntityNotFoundException.byMessage("user not found"));
    when(userRepository.checkUserNameExists("victim")).thenReturn(true);

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("email", "victim@attacker.org")
            .sign(algorithm);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getUserRepository).thenReturn(userRepository);

      ContainerRequestContext context = createRequestContextWithJwt(jwt);
      Exception exception =
          assertThrows(AuthenticationException.class, () -> emailFirstFilter.filter(context));
      assertTrue(exception.getMessage().contains("not registered"));
    }
  }

  @Test
  void testEmailFirstFlowRejectsDeactivatedUser() {
    JwtFilter emailFirstFilter = new JwtFilter(jwkProvider, "email", "name", List.of(), VERIFIER);
    UserRepository userRepository = mock(UserRepository.class);
    when(userRepository.getActiveUserByEmailForAuth(any(), any()))
        .thenThrow(new AuthenticationException("Your account has been deactivated"));

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("email", "gone@company.com")
            .sign(algorithm);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getUserRepository).thenReturn(userRepository);

      ContainerRequestContext context = createRequestContextWithJwt(jwt);
      Exception exception =
          assertThrows(AuthenticationException.class, () -> emailFirstFilter.filter(context));
      assertTrue(exception.getMessage().contains("deactivated"));
    }
  }

  @Test
  void testEmailFirstFlowMissingEmailClaim() {
    JwtFilter emailFirstFilter = new JwtFilter(jwkProvider, "email", "name", List.of(), VERIFIER);

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "john")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    Exception exception =
        assertThrows(AuthenticationException.class, () -> emailFirstFilter.filter(context));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("email claim"));
    assertTrue(exception.getMessage().toLowerCase(Locale.ROOT).contains("not found"));
  }

  @Test
  void testEmailFirstFlowFallsBackToLegacyClaimsWhenEmailMissing() {
    JwtFilter fallbackFilter =
        new JwtFilter(
            jwkProvider,
            List.of("sub", "email"),
            "openmetadata.org",
            false,
            "email",
            "name",
            List.of(),
            VERIFIER);

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "john")
            .sign(algorithm);

    ContainerRequestContext context = createRequestContextWithJwt(jwt);
    fallbackFilter.filter(context);

    ArgumentCaptor<SecurityContext> securityContextArgument =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context, times(1)).setSecurityContext(securityContextArgument.capture());

    assertEquals("john", securityContextArgument.getValue().getUserPrincipal().getName());
  }

  @Test
  void testEmailFirstFlowUsesStoredUsernameForExistingUser() {
    JwtFilter emailFirstFilter = new JwtFilter(jwkProvider, "email", "name", List.of(), VERIFIER);
    UserRepository userRepository = mock(UserRepository.class);
    User existingUser = new User().withName("john.doe_x7k2");

    when(userRepository.getActiveUserByEmailForAuth(eq("john.doe@company.com"), any()))
        .thenReturn(existingUser);

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("email", "john.doe@company.com")
            .sign(algorithm);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getUserRepository).thenReturn(userRepository);

      ContainerRequestContext context = createRequestContextWithJwt(jwt);
      emailFirstFilter.filter(context);

      ArgumentCaptor<SecurityContext> securityContextArgument =
          ArgumentCaptor.forClass(SecurityContext.class);
      verify(context, times(1)).setSecurityContext(securityContextArgument.capture());

      assertEquals(
          "john.doe_x7k2", securityContextArgument.getValue().getUserPrincipal().getName());
    }
  }

  @Test
  void testEmailFirstFlowUsesExactEmailLookupForSameLocalPartUsers() {
    JwtFilter emailFirstFilter = new JwtFilter(jwkProvider, "email", "name", List.of(), VERIFIER);
    UserRepository userRepository = mock(UserRepository.class);
    User johnAtX = new User().withName("john");
    User johnAtY = new User().withName("john_a1b2");

    when(userRepository.getActiveUserByEmailForAuth(eq("john@x.com"), any())).thenReturn(johnAtX);
    when(userRepository.getActiveUserByEmailForAuth(eq("john@y.com"), any())).thenReturn(johnAtY);

    String xJwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("email", "john@x.com")
            .sign(algorithm);
    String yJwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("email", "john@y.com")
            .sign(algorithm);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getUserRepository).thenReturn(userRepository);

      ContainerRequestContext xContext = createRequestContextWithJwt(xJwt);
      emailFirstFilter.filter(xContext);

      ArgumentCaptor<SecurityContext> xSecurityContextArgument =
          ArgumentCaptor.forClass(SecurityContext.class);
      verify(xContext, times(1)).setSecurityContext(xSecurityContextArgument.capture());
      assertEquals("john", xSecurityContextArgument.getValue().getUserPrincipal().getName());

      ContainerRequestContext yContext = createRequestContextWithJwt(yJwt);
      emailFirstFilter.filter(yContext);

      ArgumentCaptor<SecurityContext> ySecurityContextArgument =
          ArgumentCaptor.forClass(SecurityContext.class);
      verify(yContext, times(1)).setSecurityContext(ySecurityContextArgument.capture());
      assertEquals("john_a1b2", ySecurityContextArgument.getValue().getUserPrincipal().getName());
    }
  }

  @Test
  void testEmailFirstFlowWithCustomEmailClaim() {
    JwtFilter emailFirstFilter =
        new JwtFilter(jwkProvider, "userEmail", "displayName", List.of(), VERIFIER);

    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("userEmail", "jane@example.org")
            .withClaim("displayName", "Jane Smith")
            .sign(algorithm);

    try (MockedStatic<Entity> entityMock = mockUnknownUserRepository()) {
      ContainerRequestContext context = createRequestContextWithJwt(jwt);
      emailFirstFilter.filter(context);

      ArgumentCaptor<SecurityContext> securityContextArgument =
          ArgumentCaptor.forClass(SecurityContext.class);
      verify(context, times(1)).setSecurityContext(securityContextArgument.capture());

      assertEquals("jane", securityContextArgument.getValue().getUserPrincipal().getName());
    }
  }

  private MockedStatic<Entity> mockUnknownUserRepository() {
    UserRepository userRepository = mock(UserRepository.class);
    when(userRepository.getActiveUserByEmailForAuth(any(), any()))
        .thenThrow(EntityNotFoundException.byMessage("user not found"));
    when(userRepository.checkUserNameExists(any())).thenReturn(false);
    MockedStatic<Entity> entityMock = mockStatic(Entity.class);
    entityMock.when(Entity::getUserRepository).thenReturn(userRepository);
    return entityMock;
  }

  @Test
  void providerTokenWithoutARolesClaimGrantsNoRoles() throws Exception {
    // Entra ID omits the roles claim once a user has no app roles left. Reading that as "unknown"
    // left every revoked role in place.
    JwtFilter filter = filterWithRolesFromProvider(true);

    CatalogSecurityContext context = filter.getCatalogSecurityContext(rolesClaimJwt(null));

    assertEquals(Set.of(), context.userRoles());
  }

  @Test
  void openMetadataIssuedTokenRolesNeverReachTheRoleSync() throws Exception {
    // A session token or PAT carries the roles the user had when it was minted. Treating them as
    // the provider's would let a tab left open restore roles the provider has since revoked.
    JwtFilter filter = filterWithRolesFromProvider(jwkProviderForKeyId(OM_KEY_ID), true);
    String jwt =
        JWT.create()
            .withKeyId(OM_KEY_ID)
            .withIssuer(OM_ISSUER)
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam")
            .withClaim(TOKEN_TYPE, ServiceTokenType.OM_USER.value())
            .withClaim("roles", List.of("Admin", "DataSteward"))
            .sign(algorithm);
    ContainerRequestContext context = createRequestContextWithJwt(jwt);

    try (MockedStatic<JWTTokenGenerator> generator =
        org.mockito.Mockito.mockStatic(
            JWTTokenGenerator.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
      JWTTokenGenerator instance = mock(JWTTokenGenerator.class);
      when(instance.getIssuer()).thenReturn(OM_ISSUER);
      when(instance.getKid()).thenReturn(OM_KEY_ID);
      generator.when(JWTTokenGenerator::getInstance).thenReturn(instance);

      filter.filter(context);
    }

    ArgumentCaptor<SecurityContext> securityContext =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context).setSecurityContext(securityContext.capture());
    assertNull(((CatalogSecurityContext) securityContext.getValue()).userRoles());
  }

  @Test
  void emptyRolesClaimYieldsEmptySetSoRevocationIsVisible() throws Exception {
    JwtFilter filter = filterWithRolesFromProvider(true);

    CatalogSecurityContext context = filter.getCatalogSecurityContext(rolesClaimJwt(List.of()));

    assertEquals(Set.of(), context.userRoles());
  }

  @Test
  void populatedRolesClaimIsCarriedIntoTheSecurityContext() throws Exception {
    JwtFilter filter = filterWithRolesFromProvider(true);

    CatalogSecurityContext context =
        filter.getCatalogSecurityContext(rolesClaimJwt(List.of("DataSteward", "DataConsumer")));

    assertEquals(Set.of("DataSteward", "DataConsumer"), context.userRoles());
  }

  @Test
  void scalarRolesClaimIsReadAsASingleRole() throws Exception {
    // Providers that emit a lone role as a string rather than a one-element array used to be read
    // as "no roles" because Claim.asList returns null for a scalar.
    JwtFilter filter = filterWithRolesFromProvider(true);
    String jwt =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam")
            .withClaim("roles", "DataSteward")
            .sign(algorithm);

    CatalogSecurityContext context = filter.getCatalogSecurityContext(jwt);

    assertEquals(Set.of("DataSteward"), context.userRoles());
  }

  @Test
  void rolesClaimIsIgnoredWhenUseRolesFromProviderIsOff() throws Exception {
    JwtFilter filter = filterWithRolesFromProvider(false);

    CatalogSecurityContext context =
        filter.getCatalogSecurityContext(rolesClaimJwt(List.of("DataSteward")));

    assertNull(context.userRoles());
  }

  @Test
  void botTokensNeverCarryProviderRoles() throws Exception {
    JwtFilter filter = filterWithRolesFromProvider(OpenMetadataSigningKey.keyLookup(), true);
    User bot =
        new User()
            .withName(BOT)
            .withEmail(emailOf(BOT))
            .withIsBot(true)
            .withIsAdmin(false)
            .withRoles(List.of(new EntityReference().withName("DataSteward").withType("role")));
    String jwt = generator.generateJWTToken(bot, JWTTokenExpiry.Unlimited).getJWTToken();
    credentials.withJwtMechanisms(Map.of(BOT, jwt));

    CatalogSecurityContext context = filter.getCatalogSecurityContext(jwt);

    assertNull(context.userRoles());
  }

  private static String rolesClaimJwt(List<String> roles) {
    var builder =
        JWT.create()
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam");
    if (roles != null) {
      builder = builder.withClaim("roles", roles);
    }
    return builder.sign(algorithm);
  }

  private static JwtFilter filterWithRolesFromProvider(boolean useRolesFromProvider)
      throws Exception {
    return filterWithRolesFromProvider(jwkProvider, useRolesFromProvider);
  }

  private static JwtFilter filterWithRolesFromProvider(
      JwkProvider provider, boolean useRolesFromProvider) throws Exception {
    JwtFilter filter =
        new JwtFilter(provider, List.of("sub", "email"), "openmetadata.org", false, VERIFIER);
    Field field = JwtFilter.class.getDeclaredField("useRolesFromProvider");
    field.setAccessible(true);
    field.setBoolean(filter, useRolesFromProvider);
    return filter;
  }

  /** Google and Entra ID sign other applications' tokens with the keys this filter trusts. */
  @Test
  void providerTokenIssuedToAnotherApplicationIsRejected() {
    String token = providerToken("another-application");

    assertThrows(
        AuthenticationException.class,
        () ->
            filterExpectingClient("openmetadata-client")
                .filter(createRequestContextWithJwt(token)));
  }

  @Test
  void providerTokenIssuedToThisDeploymentIsAccepted() {
    ContainerRequestContext context =
        createRequestContextWithJwt(providerToken("openmetadata-client"));

    filterExpectingClient("openmetadata-client").filter(context);

    ArgumentCaptor<SecurityContext> securityContext =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context).setSecurityContext(securityContext.capture());
    assertEquals("sam", securityContext.getValue().getUserPrincipal().getName());
  }

  /**
   * Bot tokens and personal access tokens carry no audience. They are signed with our own key, even
   * when the issuer has since been reconfigured, and skip the provider checks.
   */
  @Test
  void tokenSignedWithOpenMetadataKeySkipsProviderChecks() throws Exception {
    Jwk jwk = mock(Jwk.class);
    when(jwk.getPublicKey()).thenReturn(publicKey);
    JwkProvider keyIdAwareProvider = mock(JwkProvider.class);
    when(keyIdAwareProvider.get(OM_KEY_ID)).thenReturn(jwk);
    JwtFilter filter =
        new JwtFilter(
            keyIdAwareProvider,
            List.of("sub", "email"),
            "openmetadata.org",
            new ProviderTokenValidator(Set.of("openmetadata-client"), Optional::empty),
            VERIFIER);
    String botToken =
        JWT.create()
            .withKeyId(OM_KEY_ID)
            .withIssuer("an-earlier-issuer")
            .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
            .withClaim("sub", "sam")
            .sign(algorithm);
    ContainerRequestContext context = createRequestContextWithJwt(botToken);
    JWTTokenGenerator openMetadataKey = mock(JWTTokenGenerator.class);
    when(openMetadataKey.getKid()).thenReturn(OM_KEY_ID);

    try (MockedStatic<JWTTokenGenerator> generator =
        mockStatic(JWTTokenGenerator.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
      generator.when(JWTTokenGenerator::getInstance).thenReturn(openMetadataKey);
      filter.filter(context);
    }

    ArgumentCaptor<SecurityContext> securityContext =
        ArgumentCaptor.forClass(SecurityContext.class);
    verify(context).setSecurityContext(securityContext.capture());
    assertEquals("sam", securityContext.getValue().getUserPrincipal().getName());
  }

  @Test
  void clientIdsComeFromTheBrowserAndServerSideClients() {
    AuthenticationConfiguration configuration =
        new AuthenticationConfiguration()
            .withClientId("browser-client")
            .withOidcConfiguration(new OidcClientConfig().withId("server-client"));

    assertEquals(Set.of("browser-client", "server-client"), JwtFilter.clientIdsOf(configuration));
    assertEquals(
        Set.of(), JwtFilter.clientIdsOf(new AuthenticationConfiguration().withClientId(" ")));
  }

  private static JwtFilter filterExpectingClient(String clientId) {
    return new JwtFilter(
        jwkProvider,
        List.of("sub", "email"),
        "openmetadata.org",
        new ProviderTokenValidator(Set.of(clientId), Optional::empty),
        VERIFIER);
  }

  private static String providerToken(String audience) {
    return JWT.create()
        .withExpiresAt(Date.from(Instant.now().plus(1, ChronoUnit.DAYS)))
        .withClaim("sub", "sam")
        .withAudience(audience)
        .sign(algorithm);
  }

  /** Issuer and key set come from the server-side sign-in handler, and only for its own client. */
  @Test
  void providerIssuerAndKeySetComeFromTheHandlerServingTheSameClient(@TempDir Path directory)
      throws Exception {
    Path discoveryDocument =
        Files.writeString(
            directory.resolve("openid-configuration"),
            """
            {"issuer": "https://idp.test", "authorization_endpoint": "https://idp.test/authorize",
             "token_endpoint": "https://idp.test/token", "jwks_uri": "https://idp.test/keys",
             "response_types_supported": ["code"], "subject_types_supported": ["public"],
             "id_token_signing_alg_values_supported": ["RS256"],
             "token_endpoint_auth_methods_supported": ["client_secret_post"]}
            """);
    OidcClientConfig serverSideClient =
        new OidcClientConfig()
            .withId("om-client")
            .withSecret("om-secret")
            .withDiscoveryUri("file:" + discoveryDocument.toAbsolutePath())
            .withServerUrl("http://localhost:8585")
            .withCallbackUrl("http://localhost:8585/callback");
    AuthorizerConfiguration authorizer =
        new AuthorizerConfiguration().withUseRolesFromProvider(false);
    AuthServeletHandlerRegistry.setHandler(
        new AuthenticationCodeFlowHandler(
            signInConfiguration(ClientType.CONFIDENTIAL, serverSideClient),
            authorizer,
            mock(SessionService.class)));
    JWTTokenGenerator localGenerator = generatorWithLocalKey();
    try (MockedStatic<JWTTokenGenerator> generator =
        mockStatic(JWTTokenGenerator.class, org.mockito.Mockito.CALLS_REAL_METHODS)) {
      generator.when(JWTTokenGenerator::getInstance).thenReturn(localGenerator);
      JwtFilter confidential =
          new JwtFilter(signInConfiguration(ClientType.CONFIDENTIAL, serverSideClient), authorizer);
      JwtFilter publicClient =
          new JwtFilter(signInConfiguration(ClientType.PUBLIC, serverSideClient), authorizer);

      assertEquals(Optional.of("https://idp.test"), confidential.providerIssuer());
      assertEquals(
          List.of("https://idp.test/keys"),
          confidential.providerKeySetUrls().stream().map(URL::toExternalForm).toList());
      assertEquals(Optional.empty(), publicClient.providerIssuer());
      assertEquals(List.of(), publicClient.providerKeySetUrls());
    } finally {
      AuthServeletHandlerRegistry.setHandler(null);
    }
  }

  private static AuthenticationConfiguration signInConfiguration(
      ClientType clientType, OidcClientConfig serverSideClient) {
    return new AuthenticationConfiguration()
        .withProvider(AuthProvider.CUSTOM_OIDC)
        .withClientType(clientType)
        .withClientId("om-client")
        .withPublicKeyUrls(List.of())
        .withOidcConfiguration(serverSideClient);
  }

  private static JWTTokenGenerator generatorWithLocalKey() {
    JWKSKey localKey = mock(JWKSKey.class);
    when(localKey.getKid()).thenReturn(OM_KEY_ID);
    when(localKey.getKty()).thenReturn("RSA");
    when(localKey.getN()).thenReturn("test-n");
    when(localKey.getE()).thenReturn("AQAB");
    JWKSResponse localKeySet = mock(JWKSResponse.class);
    when(localKeySet.getJwsKeys()).thenReturn(List.of(localKey));
    JWTTokenGenerator localGenerator = mock(JWTTokenGenerator.class);
    when(localGenerator.getJWKSResponse()).thenReturn(localKeySet);
    return localGenerator;
  }
}
