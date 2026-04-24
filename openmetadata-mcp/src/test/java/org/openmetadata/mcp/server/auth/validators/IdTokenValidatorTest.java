package org.openmetadata.mcp.server.auth.validators;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.nimbusds.jwt.JWTClaimsSet;
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
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.mcp.server.auth.validators.IdTokenValidator.IdTokenValidationException;

/**
 * Unit tests for IdTokenValidator - JWKS-based ID token signature verification.
 *
 * <p>Tests cover: - Valid token validation - Signature verification - Expiration handling - Issuer
 * validation - Audience validation - Security edge cases (forgery, tampering, replay)
 */
public class IdTokenValidatorTest {

  private MockWebServer jwksServer;
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

    jwksServer = new MockWebServer();
    jwksServer.start();

    String jwksJson = createJwksResponse(publicKey, keyId);
    jwksServer.enqueue(
        new MockResponse().setBody(jwksJson).setHeader("Content-Type", "application/json"));

    String jwksUrl = jwksServer.url("/jwks").toString();
    validator = new IdTokenValidator(List.of(jwksUrl), expectedIssuer, expectedAudience);
  }

  @AfterEach
  void tearDown() throws Exception {
    if (jwksServer != null) {
      jwksServer.shutdown();
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
        new IdTokenValidator(List.of(jwksServer.url("/jwks").toString()), expectedIssuer, null);

    jwksServer.enqueue(
        new MockResponse()
            .setBody(createJwksResponse(publicKey, keyId))
            .setHeader("Content-Type", "application/json"));

    String tokenWithDifferentAudience =
        createValidIdToken(expectedIssuer, "any-audience", "test@example.com");

    JWTClaimsSet claims = validatorNoAudience.validateAndDecode(tokenWithDifferentAudience);
    assertThat(claims).isNotNull();
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
            "e": "%s"
          }]
        }
        """,
        kid, n, e);
  }
}
