package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.security.SecurityUtil.buildPrincipalClaimsMapping;
import static org.openmetadata.service.security.SecurityUtil.findEmailFromClaims;
import static org.openmetadata.service.security.SecurityUtil.findUserNameFromClaims;
import static org.openmetadata.service.security.SecurityUtil.validateDomainEnforcement;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.Claim;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.auth0.jwt.interfaces.JWTVerifier;
import java.net.URISyntaxException;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.interfaces.RSAPublicKey;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.jwt.JWTTokenConfiguration;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class JWTTokenGeneratorTest {
  protected static final String rsaPrivateKeyPath = resourceFilePath("private_key.der");
  protected static final String rsaPublicKeyPath = resourceFilePath("public_key.der");

  private static String resourceFilePath(String resourceName) {
    try {
      return Path.of(
              Thread.currentThread().getContextClassLoader().getResource(resourceName).toURI())
          .toString();
    } catch (URISyntaxException e) {
      throw new RuntimeException(e);
    }
  }

  protected JWTTokenConfiguration jwtTokenConfiguration;
  protected JWTTokenGenerator jwtTokenGenerator;

  private static final List<String> DEFAULT_CLAIM_ORDER =
      List.of("email", "preferred_username", "sub");
  private static final String PRINCIPAL_DOMAIN = "getcollate.io";

  @BeforeEach
  public void setup() {
    jwtTokenConfiguration = new JWTTokenConfiguration();
    jwtTokenConfiguration.setJwtissuer("open-metadata.org");
    jwtTokenConfiguration.setRsaprivateKeyFilePath(rsaPrivateKeyPath);
    jwtTokenConfiguration.setRsapublicKeyFilePath(rsaPublicKeyPath);
    jwtTokenGenerator = JWTTokenGenerator.getInstance();
    initGenerator(DEFAULT_CLAIM_ORDER, List.of());
  }

  private void initGenerator(List<String> principalClaims, List<String> principalClaimsMapping) {
    jwtTokenGenerator.init(
        new AuthenticationConfiguration()
            .withTokenValidationAlgorithm(
                AuthenticationConfiguration.TokenValidationAlgorithm.RS_256)
            .withJwtPrincipalClaims(principalClaims)
            .withJwtPrincipalClaimsMapping(principalClaimsMapping),
        jwtTokenConfiguration);
  }

  @Test
  void mintedIdentityClaimsMirrorProviderShape() {
    DecodedJWT jwt = mint("mohit", "mohit.yadav@getcollate.io");
    assertEquals("mohit", jwt.getClaim("sub").asString());
    assertEquals("mohit", jwt.getClaim("username").asString());
    assertEquals("mohit.yadav@getcollate.io", jwt.getClaim("email").asString());
    assertEquals("mohit.yadav@getcollate.io", jwt.getClaim("preferred_username").asString());
  }

  /**
   * #29142: the Azure/Okta-style order reads preferred_username first. A bare name there resolved
   * the email to name@principalDomain and the domain to "" - both wrong for our own tokens.
   */
  @Test
  void mintedTokenResolvesLikeProviderTokenUnderPreferredUsernameOrder() {
    List<String> order = List.of("preferred_username", "email", "upn", "sub");
    initGenerator(order, List.of());
    Map<String, Claim> claims = mint("mohit", "mohit@getcollate.io").getClaims();

    assertEquals("mohit", findUserNameFromClaims(Map.of(), order, claims));
    assertEquals(
        "mohit@getcollate.io", findEmailFromClaims(Map.of(), order, claims, "openmetadata.org"));
    assertDoesNotThrow(
        () -> validateDomainEnforcement(Map.of(), order, claims, PRINCIPAL_DOMAIN, Set.of(), true));
  }

  @Test
  void mintedTokenCarriesMappedProviderClaims() {
    List<String> mappingConfig = List.of("username:upn", "email:mail");
    Map<String, String> mapping = buildPrincipalClaimsMapping(mappingConfig);
    initGenerator(DEFAULT_CLAIM_ORDER, mappingConfig);
    Map<String, Claim> claims = mint("mohit", "mohit.yadav@getcollate.io").getClaims();

    assertEquals("mohit", findUserNameFromClaims(mapping, DEFAULT_CLAIM_ORDER, claims));
    assertEquals(
        "mohit.yadav@getcollate.io",
        findEmailFromClaims(mapping, DEFAULT_CLAIM_ORDER, claims, "openmetadata.org"));
    assertDoesNotThrow(
        () ->
            validateDomainEnforcement(
                mapping, DEFAULT_CLAIM_ORDER, claims, PRINCIPAL_DOMAIN, Set.of(), true));
  }

  @Test
  void mintedTokenCarriesFirstConfiguredClaimWhenNotMapped() {
    List<String> order = List.of("unique_name", "sub");
    initGenerator(order, List.of());
    Map<String, Claim> claims = mint("mohit", "mohit@getcollate.io").getClaims();

    assertEquals("mohit@getcollate.io", claims.get("unique_name").asString());
    assertEquals(
        "mohit@getcollate.io", findEmailFromClaims(Map.of(), order, claims, "openmetadata.org"));
  }

  /** No email to mirror: the bare name stands in, and the token still resolves to that user. */
  @Test
  void mintedTokenFallsBackToNameWhenEmailIsMissing() {
    Map<String, Claim> claims = mint("ingestion-bot", null).getClaims();
    assertEquals("ingestion-bot", claims.get("preferred_username").asString());
    assertEquals("ingestion-bot", findUserNameFromClaims(Map.of(), DEFAULT_CLAIM_ORDER, claims));
  }

  /** Both logical names mapped onto one claim: the email wins, as in the provider's own token. */
  @Test
  void mappedUsernameAndEmailOnSameClaimKeepTheEmail() {
    List<String> mappingConfig = List.of("username:email", "email:email");
    Map<String, String> mapping = buildPrincipalClaimsMapping(mappingConfig);
    initGenerator(DEFAULT_CLAIM_ORDER, mappingConfig);
    Map<String, Claim> claims = mint("mohit", "mohit@getcollate.io").getClaims();

    assertEquals("mohit@getcollate.io", claims.get("email").asString());
    assertEquals("mohit", findUserNameFromClaims(mapping, DEFAULT_CLAIM_ORDER, claims));
    assertEquals(
        "mohit@getcollate.io",
        findEmailFromClaims(mapping, DEFAULT_CLAIM_ORDER, claims, "openmetadata.org"));
  }

  /** An order that reads {@code sub} first only works with an IdP whose {@code sub} is the login. */
  @Test
  void firstConfiguredClaimCarriesPrincipalEvenWhenItIsTheSubject() {
    List<String> order = List.of("sub", "email");
    initGenerator(order, List.of());
    Map<String, Claim> claims = mint("mohit", "mohit@getcollate.io").getClaims();

    assertEquals("mohit@getcollate.io", claims.get("sub").asString());
    assertEquals("mohit", claims.get("username").asString());
    assertEquals("mohit", findUserNameFromClaims(Map.of(), order, claims));
    assertEquals(
        "mohit@getcollate.io", findEmailFromClaims(Map.of(), order, claims, "openmetadata.org"));
    assertDoesNotThrow(
        () -> validateDomainEnforcement(Map.of(), order, claims, PRINCIPAL_DOMAIN, Set.of(), true));
  }

  private DecodedJWT mint(String userName, String email) {
    return decodedJWT(
        jwtTokenGenerator
            .generateJWTToken(
                userName, Set.of(), false, email, 3600, false, ServiceTokenType.PERSONAL_ACCESS)
            .getJWTToken());
  }

  @Test
  void testGenerateJWTToken() {
    User user =
        new User()
            .withEmail("ingestion-bot@open-metadata.org")
            .withName("ingestion-bot")
            .withDisplayName("ingestion-bot");
    JWTAuthMechanism jwtAuthMechanism =
        jwtTokenGenerator.generateJWTToken(user, JWTTokenExpiry.Seven);
    DecodedJWT jwt = decodedJWT(jwtAuthMechanism.getJWTToken());
    assertEquals("ingestion-bot", jwt.getClaims().get("sub").asString());
    Date date = jwt.getExpiresAt();
    long daysBetween = ((date.getTime() - jwt.getIssuedAt().getTime()) / (1000 * 60 * 60 * 24));
    assertTrue(daysBetween >= 6);
    jwtAuthMechanism = jwtTokenGenerator.generateJWTToken(user, JWTTokenExpiry.Ninety);
    jwt = decodedJWT(jwtAuthMechanism.getJWTToken());
    date = jwt.getExpiresAt();
    daysBetween = ((date.getTime() - jwt.getIssuedAt().getTime()) / (1000 * 60 * 60 * 24));
    assertTrue(daysBetween >= 89);
    jwtAuthMechanism = jwtTokenGenerator.generateJWTToken(user, JWTTokenExpiry.Unlimited);
    jwt = decodedJWT(jwtAuthMechanism.getJWTToken());
    assertNull(jwt.getExpiresAt());
    assertNull(jwtAuthMechanism.getJWTTokenExpiresAt());
  }

  @Test
  void testECAlgorithmSupport() {
    // Test that the EC algorithms are supported in the enum
    AuthenticationConfiguration.TokenValidationAlgorithm es256 =
        AuthenticationConfiguration.TokenValidationAlgorithm.ES_256;
    AuthenticationConfiguration.TokenValidationAlgorithm es384 =
        AuthenticationConfiguration.TokenValidationAlgorithm.ES_384;
    AuthenticationConfiguration.TokenValidationAlgorithm es512 =
        AuthenticationConfiguration.TokenValidationAlgorithm.ES_512;

    assertEquals("ES256", es256.value());
    assertEquals("ES384", es384.value());
    assertEquals("ES512", es512.value());
  }

  @Test
  void testGetAlgorithmFromPublicKeyWithRSA() {
    RSAPublicKey rsaPublicKey = jwtTokenGenerator.getPublicKey();

    Algorithm algorithm =
        JWTTokenGenerator.getAlgorithmFromPublicKey(
            AuthenticationConfiguration.TokenValidationAlgorithm.RS_256, rsaPublicKey);
    assertNotNull(algorithm);

    // Test that EC algorithms throw exception with RSA key
    assertThrows(
        IllegalArgumentException.class,
        () ->
            JWTTokenGenerator.getAlgorithmFromPublicKey(
                AuthenticationConfiguration.TokenValidationAlgorithm.ES_256, rsaPublicKey));
  }

  @Test
  void testGetAlgorithmFromPublicKeyWithEC() throws Exception {
    // Generate EC key pair for testing
    KeyPairGenerator keyGen = KeyPairGenerator.getInstance("EC");
    keyGen.initialize(256);
    KeyPair keyPair = keyGen.generateKeyPair();
    ECPublicKey ecPublicKey = (ECPublicKey) keyPair.getPublic();

    Algorithm algorithm =
        JWTTokenGenerator.getAlgorithmFromPublicKey(
            AuthenticationConfiguration.TokenValidationAlgorithm.ES_256, ecPublicKey);
    assertNotNull(algorithm);

    // Test that RSA algorithms throw exception with EC key
    assertThrows(
        IllegalArgumentException.class,
        () ->
            JWTTokenGenerator.getAlgorithmFromPublicKey(
                AuthenticationConfiguration.TokenValidationAlgorithm.RS_256, ecPublicKey));
  }

  @Test
  void testECAlgorithmCreation() throws Exception {
    // Test direct EC algorithm creation
    KeyPairGenerator keyGen = KeyPairGenerator.getInstance("EC");
    keyGen.initialize(256);
    KeyPair keyPair = keyGen.generateKeyPair();
    ECPublicKey ecPublicKey = (ECPublicKey) keyPair.getPublic();
    ECPrivateKey ecPrivateKey = (ECPrivateKey) keyPair.getPrivate();

    Algorithm es256 =
        JWTTokenGenerator.getAlgorithm(
            AuthenticationConfiguration.TokenValidationAlgorithm.ES_256, ecPublicKey, ecPrivateKey);
    assertNotNull(es256);

    Algorithm es384 =
        JWTTokenGenerator.getAlgorithm(
            AuthenticationConfiguration.TokenValidationAlgorithm.ES_384, ecPublicKey, ecPrivateKey);
    assertNotNull(es384);

    Algorithm es512 =
        JWTTokenGenerator.getAlgorithm(
            AuthenticationConfiguration.TokenValidationAlgorithm.ES_512, ecPublicKey, ecPrivateKey);
    assertNotNull(es512);
  }

  private DecodedJWT decodedJWT(String token) {
    RSAPublicKey publicKey = jwtTokenGenerator.getPublicKey();
    Algorithm algorithm = Algorithm.RSA256(publicKey, null);
    JWTVerifier verifier =
        JWT.require(algorithm).withIssuer(jwtTokenConfiguration.getJwtissuer()).build();
    return verifier.verify(token);
  }
}
