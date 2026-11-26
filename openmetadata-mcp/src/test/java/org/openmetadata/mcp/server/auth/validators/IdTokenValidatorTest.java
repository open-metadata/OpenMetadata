package org.openmetadata.mcp.server.auth.validators;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.nimbusds.jwt.JWTClaimsSet;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.util.Base64;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.mcp.server.auth.validators.IdTokenValidator.IdTokenValidationException;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.security.AuthenticationCodeFlowHandler.McpTokenVerification;

/**
 * Unit tests for IdTokenValidator - JWKS-based ID token signature verification.
 *
 * <p>Tests cover: - Valid token validation - Signature verification - Expiration handling - Issuer
 * validation - Audience validation - Security edge cases (forgery, tampering, replay)
 */
public class IdTokenValidatorTest {

  private static final String TENANT_ID = "8f6bd38f-4e6a-4f8e-9c5b-0d2a5e1c7b11";
  private static final String TENANT_ISSUER =
      "https://login.microsoftonline.com/" + TENANT_ID + "/v2.0";
  private static final String ENTRA_TEMPLATE = "https://login.microsoftonline.com/{tenantid}/v2.0";
  private static final String ENCODED_ENTRA_TEMPLATE =
      "https://login.microsoftonline.com/%7Btenantid%7D/v2.0";
  private volatile String signingKeyIssuer;
  private final AtomicInteger jwksRequests = new AtomicInteger();
  private HttpServer jwksServer;
  private String jwksUrl;
  private IdTokenValidator validator;
  private RSAPublicKey publicKey;
  private RSAPrivateKey privateKey;
  private String keyId;
  private String expectedIssuer;
  private String expectedAudience;

  @BeforeEach
  void setUp() throws Exception {
    KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
    keyPairGenerator.initialize(2048);
    KeyPair keyPair = keyPairGenerator.generateKeyPair();
    publicKey = (RSAPublicKey) keyPair.getPublic();
    privateKey = (RSAPrivateKey) keyPair.getPrivate();

    keyId = "test-key-" + UUID.randomUUID();
    expectedIssuer = "https://accounts.test.com";
    expectedAudience = "test-client-id";

    startJwksServer();
    validator = new IdTokenValidator(List.of(jwksUrl), expectedIssuer, expectedAudience);
  }

  private void startJwksServer() throws IOException {
    jwksServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    publishKeySet("/jwks", keyId);
    jwksServer.start();
    jwksUrl = "http://127.0.0.1:" + jwksServer.getAddress().getPort() + "/jwks";
  }

  private String publishKeySet(String path, String publishedKeyId) {
    jwksServer.createContext(
        path,
        exchange -> {
          jwksRequests.incrementAndGet();
          final byte[] body =
              createJwksResponse(publicKey, publishedKeyId).getBytes(StandardCharsets.UTF_8);
          try (exchange) {
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
          }
        });
    return "http://localhost:" + jwksServer.getAddress().getPort() + path;
  }

  @AfterEach
  void tearDown() {
    if (jwksServer != null) {
      jwksServer.stop(0);
    }
  }

  @Test
  void testValidateAndDecode_ValidToken() throws Exception {
    String idToken = createValidIdToken(expectedIssuer, expectedAudience, "test@example.com");

    JWTClaimsSet claims = validator.validateAndDecode(idToken);

    assertThat(claims).isNotNull();
    assertThat(claims.getIssuer()).isEqualTo(expectedIssuer);
    assertThat(claims.getAudience()).contains(expectedAudience);
    assertThat(claims.getStringClaim("email")).isEqualTo("test@example.com");
  }

  @Test
  void testValidateAndDecode_ExpiredToken() {
    String expiredToken =
        createExpiredIdToken(expectedIssuer, expectedAudience, "test@example.com");

    assertThatThrownBy(() -> validator.validateAndDecode(expiredToken))
        .isInstanceOf(IdTokenValidationException.class)
        .hasMessageContaining("expired");
  }

  @Test
  void googleIssuerWithoutASchemeIsAccepted() throws Exception {
    IdTokenValidator google =
        new IdTokenValidator(List.of(jwksUrl), "https://accounts.google.com", expectedAudience);
    String idToken = createValidIdToken("accounts.google.com", expectedAudience, "a@example.com");

    assertThat(google.validateAndDecode(idToken).getIssuer()).isEqualTo("accounts.google.com");
  }

  @Test
  void googleIssuerWithoutASchemeIsRefusedForAnotherProvider() {
    String idToken = createValidIdToken("accounts.google.com", expectedAudience, "a@example.com");

    assertThatThrownBy(() -> validator.validateAndDecode(idToken))
        .hasMessageContaining("issuer mismatch");
  }

  @ParameterizedTest
  @ValueSource(strings = {ENTRA_TEMPLATE, TENANT_ISSUER})
  void acceptsSignedTokenForTenantAndSigningKeyIssuer(String keyIssuer) throws Exception {
    signingKeyIssuer = keyIssuer;
    final IdTokenValidator entra =
        new IdTokenValidator(List.of(jwksUrl), ENCODED_ENTRA_TEMPLATE, expectedAudience);

    assertThat(entra.validateAndDecode(tenantToken(TENANT_ISSUER, TENANT_ID)).getIssuer())
        .isEqualTo(TENANT_ISSUER);
  }

  @ParameterizedTest
  @NullSource
  @ValueSource(
      strings = {"https://login.microsoftonline.com/00000000-0000-0000-0000-000000000001/v2.0"})
  void refusesSigningKeyOutsideItsIssuerScope(String keyIssuer) {
    signingKeyIssuer = keyIssuer;
    final IdTokenValidator entra =
        new IdTokenValidator(List.of(jwksUrl), ENCODED_ENTRA_TEMPLATE, expectedAudience);

    assertThatThrownBy(() -> entra.validateAndDecode(tenantToken(TENANT_ISSUER, TENANT_ID)))
        .isInstanceOf(IdTokenValidationException.class)
        .hasMessageContaining("Signing key issuer");
  }

  @ParameterizedTest
  @NullSource
  @ValueSource(strings = {"other", "00000000-0000-0000-0000-000000000001"})
  void refusesTokenWhenTenantCannotResolveItsIssuer(String tenant) {
    signingKeyIssuer = ENTRA_TEMPLATE;
    final IdTokenValidator entra =
        new IdTokenValidator(List.of(jwksUrl), ENCODED_ENTRA_TEMPLATE, expectedAudience);

    assertThatThrownBy(() -> entra.validateAndDecode(tenantToken(TENANT_ISSUER, tenant)))
        .isInstanceOf(IdTokenValidationException.class)
        .hasMessageContaining("issuer mismatch");
  }

  @Test
  void refusesNonGuidTenantEvenWhenTheIssuerMatchesTheClaim() {
    signingKeyIssuer = ENTRA_TEMPLATE;
    final IdTokenValidator entra =
        new IdTokenValidator(List.of(jwksUrl), ENCODED_ENTRA_TEMPLATE, expectedAudience);
    final String token = tenantToken("https://login.microsoftonline.com/common/v2.0", "common");

    assertThatThrownBy(() -> entra.validateAndDecode(token))
        .isInstanceOf(IdTokenValidationException.class)
        .hasMessageContaining("issuer mismatch");
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void concreteEntraAuthorityAcceptsLegacyKeysWithoutAnIssuer(boolean publicClient)
      throws Exception {
    final String legacyKeys = publishKeySet("/common/discovery/keys", keyId);
    final IdTokenValidator entra =
        new IdTokenValidator(
            new McpTokenVerification(
                List.of(legacyKeys),
                TENANT_ISSUER,
                expectedAudience,
                publicClient,
                AuthProvider.AZURE));

    assertThat(entra.validateAndDecode(tenantToken(TENANT_ISSUER, TENANT_ID)).getIssuer())
        .isEqualTo(TENANT_ISSUER);
    final String otherTenant = "00000000-0000-0000-0000-000000000001";
    assertThatThrownBy(
            () ->
                entra.validateAndDecode(
                    tenantToken(
                        "https://login.microsoftonline.com/" + otherTenant + "/v2.0", otherTenant)))
        .isInstanceOf(IdTokenValidationException.class)
        .hasMessageContaining("issuer mismatch");
  }

  @ParameterizedTest
  @ValueSource(strings = {"/common/discovery/v2.0/keys", "/organizations/discovery/v2.0/keys"})
  void concreteEntraAuthorityChecksTheSetThatSuppliedTheKey(String sharedPath) throws Exception {
    final String tenantKeys = publishKeySet("/" + TENANT_ID + "/discovery/v2.0/keys", "tenant-key");
    final String sharedKeys = publishKeySet(sharedPath, "shared-key");
    final IdTokenValidator entra =
        new IdTokenValidator(
            new McpTokenVerification(
                List.of(sharedKeys, tenantKeys),
                TENANT_ISSUER,
                expectedAudience,
                true,
                AuthProvider.AZURE));

    assertThat(
            entra
                .validateAndDecode(tenantToken(TENANT_ISSUER, TENANT_ID, "tenant-key"))
                .getIssuer())
        .isEqualTo(TENANT_ISSUER);
    assertThatThrownBy(
            () -> entra.validateAndDecode(tenantToken(TENANT_ISSUER, TENANT_ID, "shared-key")))
        .isInstanceOf(IdTokenValidationException.class)
        .hasMessageContaining("Signing key issuer");
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "/common/discovery/keys",
        "/common/discovery/v2.0/keys",
        "/tenant/discovery/v2.0/keys"
      })
  void concreteEntraAuthorityHonorsAnExplicitKeyScope(String keySetPath) {
    signingKeyIssuer =
        "https://login.microsoftonline.com/00000000-0000-0000-0000-000000000001/v2.0";
    final String keys = publishKeySet(keySetPath, keyId);
    final IdTokenValidator entra =
        new IdTokenValidator(
            new McpTokenVerification(
                List.of(keys), TENANT_ISSUER, expectedAudience, true, AuthProvider.AZURE));

    assertThatThrownBy(() -> entra.validateAndDecode(tenantToken(TENANT_ISSUER, TENANT_ID)))
        .isInstanceOf(IdTokenValidationException.class)
        .hasMessageContaining("Signing key issuer");
  }

  @ParameterizedTest
  @ValueSource(strings = {ENTRA_TEMPLATE, TENANT_ISSUER})
  void concreteEntraAuthorityAcceptsAMatchingSharedKey(String scope) throws Exception {
    signingKeyIssuer = scope;
    final String shared = publishKeySet("/common/discovery/v2.0/keys", keyId);
    final IdTokenValidator entra =
        new IdTokenValidator(
            new McpTokenVerification(
                List.of(shared), TENANT_ISSUER, expectedAudience, true, AuthProvider.AZURE));
    assertThat(entra.validateAndDecode(tenantToken(TENANT_ISSUER, TENANT_ID)).getIssuer())
        .isEqualTo(TENANT_ISSUER);
  }

  @Test
  void customProviderCanUseItsOwnKeyAttributes() throws Exception {
    signingKeyIssuer = "provider-specific key attribute";
    final String keys = publishKeySet("/common/discovery/keys", keyId);
    final IdTokenValidator custom =
        new IdTokenValidator(
            new McpTokenVerification(
                List.of(keys), expectedIssuer, expectedAudience, true, AuthProvider.CUSTOM_OIDC));

    assertThat(
            custom
                .validateAndDecode(
                    createValidIdToken(expectedIssuer, expectedAudience, "a@example.com"))
                .getIssuer())
        .isEqualTo(expectedIssuer);
  }

  private String tenantToken(String issuer, String tenant) {
    return tenantToken(issuer, tenant, keyId);
  }

  private String tenantToken(String issuer, String tenant, String signingKeyId) {
    return JWT.create()
        .withIssuer(issuer)
        .withAudience(expectedAudience)
        .withClaim("tid", tenant)
        .withExpiresAt(new Date(System.currentTimeMillis() + 3600000))
        .withKeyId(signingKeyId)
        .sign(Algorithm.RSA256(null, privateKey));
  }

  @Test
  void testValidateAndDecode_WrongIssuer() {
    String wrongIssuerToken =
        createValidIdToken("https://wrong-issuer.com", expectedAudience, "test@example.com");

    assertThatThrownBy(() -> validator.validateAndDecode(wrongIssuerToken))
        .isInstanceOf(IdTokenValidationException.class)
        .hasMessageContaining("issuer mismatch");
  }

  @Test
  void testValidateAndDecode_WrongAudience() {
    String wrongAudienceToken =
        createValidIdToken(expectedIssuer, "wrong-audience", "test@example.com");

    assertThatThrownBy(() -> validator.validateAndDecode(wrongAudienceToken))
        .isInstanceOf(IdTokenValidationException.class)
        .hasMessageContaining("audience mismatch");
  }

  @Test
  void testValidateAndDecode_ForgedSignature() throws Exception {
    KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
    keyPairGenerator.initialize(2048);
    KeyPair wrongKeyPair = keyPairGenerator.generateKeyPair();
    RSAPrivateKey wrongPrivateKey = (RSAPrivateKey) wrongKeyPair.getPrivate();

    String forgedToken =
        createIdTokenWithKey(
            expectedIssuer,
            expectedAudience,
            "attacker@example.com",
            System.currentTimeMillis() + 3600000,
            wrongPrivateKey);

    assertThatThrownBy(() -> validator.validateAndDecode(forgedToken))
        .isInstanceOf(IdTokenValidationException.class)
        .hasMessageContaining("signature verification failed");
  }

  @Test
  void testValidateAndDecode_MissingKeyId() {
    String tokenWithoutKid =
        createIdTokenWithoutKid(expectedIssuer, expectedAudience, "test@example.com");

    assertThatThrownBy(() -> validator.validateAndDecode(tokenWithoutKid))
        .isInstanceOf(IdTokenValidationException.class)
        .hasMessageContaining("missing 'kid' header");
  }

  @Test
  void testValidateAndDecode_EmptyToken() {
    assertThatThrownBy(() -> validator.validateAndDecode(""))
        .isInstanceOf(IdTokenValidationException.class)
        .hasMessageContaining("cannot be null or empty");

    assertThatThrownBy(() -> validator.validateAndDecode(null))
        .isInstanceOf(IdTokenValidationException.class)
        .hasMessageContaining("cannot be null or empty");
  }

  @Test
  void testValidateAndDecode_MalformedToken() {
    assertThatThrownBy(() -> validator.validateAndDecode("not.a.valid.jwt"))
        .isInstanceOf(IdTokenValidationException.class)
        .hasMessageContaining("Unable to decode");
  }

  @Test
  void testValidateAndDecode_ClockSkewTolerance() throws Exception {
    Calendar now = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
    now.add(Calendar.SECOND, -30);
    Date expiresAt = now.getTime();

    String tokenExpiredRecently =
        createIdTokenWithExpiry(
            expectedIssuer, expectedAudience, "test@example.com", expiresAt.getTime());

    JWTClaimsSet claims = validator.validateAndDecode(tokenExpiredRecently);
    assertThat(claims).isNotNull();
  }

  @Test
  void testValidateAndDecode_NoAudienceValidationWhenNull() throws Exception {
    IdTokenValidator validatorNoAudience =
        new IdTokenValidator(List.of(jwksUrl), expectedIssuer, null);

    String tokenWithDifferentAudience =
        createValidIdToken(expectedIssuer, "any-audience", "test@example.com");

    JWTClaimsSet claims = validatorNoAudience.validateAndDecode(tokenWithDifferentAudience);
    assertThat(claims).isNotNull();
  }

  @Test
  void madeUpKeyIdsCannotFetchTheKeySetBeyondItsBudget() {
    long started = System.nanoTime();

    for (int attempt = 0; attempt < 15; attempt++) {
      String token = createIdTokenNamingKey("made-up-" + attempt);
      assertThatThrownBy(() -> validator.validateAndDecode(token))
          .isInstanceOf(IdTokenValidationException.class)
          .hasMessageContaining("Failed to fetch public key");
    }

    // The default budget: a burst of 10 fetches, then one every 6 seconds.
    long refills = TimeUnit.NANOSECONDS.toSeconds(System.nanoTime() - started) / 6;
    assertThat(jwksRequests.get()).isLessThanOrEqualTo(10 + (int) refills);
  }

  private String createValidIdToken(String issuer, String audience, String email) {
    long now = System.currentTimeMillis();
    long expiresAt = now + 3600000;
    return createIdTokenWithExpiry(issuer, audience, email, expiresAt);
  }

  private String createExpiredIdToken(String issuer, String audience, String email) {
    long now = System.currentTimeMillis();
    long expiresAt = now - 120000;
    return createIdTokenWithExpiry(issuer, audience, email, expiresAt);
  }

  private String createIdTokenWithExpiry(
      String issuer, String audience, String email, long expiresAt) {
    return createIdTokenWithKey(issuer, audience, email, expiresAt, privateKey);
  }

  private String createIdTokenWithKey(
      String issuer, String audience, String email, long expiresAt, RSAPrivateKey signingKey) {
    Algorithm algorithm = Algorithm.RSA256(null, signingKey);

    return JWT.create()
        .withIssuer(issuer)
        .withAudience(audience)
        .withSubject("test-user-123")
        .withClaim("email", email)
        .withClaim("email_verified", true)
        .withIssuedAt(new Date(System.currentTimeMillis()))
        .withExpiresAt(new Date(expiresAt))
        .withKeyId(keyId)
        .sign(algorithm);
  }

  private String createIdTokenNamingKey(String namedKeyId) {
    return JWT.create()
        .withIssuer(expectedIssuer)
        .withAudience(expectedAudience)
        .withSubject("test-user-123")
        .withClaim("email", "test@example.com")
        .withIssuedAt(new Date(System.currentTimeMillis()))
        .withExpiresAt(new Date(System.currentTimeMillis() + 3600000))
        .withKeyId(namedKeyId)
        .sign(Algorithm.RSA256(null, privateKey));
  }

  private String createIdTokenWithoutKid(String issuer, String audience, String email) {
    Algorithm algorithm = Algorithm.RSA256(null, privateKey);

    return JWT.create()
        .withIssuer(issuer)
        .withAudience(audience)
        .withSubject("test-user-123")
        .withClaim("email", email)
        .withIssuedAt(new Date(System.currentTimeMillis()))
        .withExpiresAt(new Date(System.currentTimeMillis() + 3600000))
        .sign(algorithm);
  }

  private String createJwksResponse(RSAPublicKey publicKey, String kid) {
    String n =
        Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString(publicKey.getModulus().toByteArray());
    String e =
        Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString(publicKey.getPublicExponent().toByteArray());

    return String.format(
        """
        {
          "keys": [{
            "kty": "RSA",
            "kid": "%s",
            "use": "sig",
            "alg": "RS256",
            "n": "%s",
            "e": "%s"%s
          }]
        }
        """,
        kid, n, e, signingKeyIssuer == null ? "" : ", \"issuer\": \"" + signingKeyIssuer + "\"");
  }
}
