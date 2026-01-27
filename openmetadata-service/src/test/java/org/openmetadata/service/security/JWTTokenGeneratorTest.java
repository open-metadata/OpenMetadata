package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.auth0.jwt.interfaces.JWTVerifier;
import io.dropwizard.testing.ResourceHelpers;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.interfaces.RSAPublicKey;
import java.util.Date;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.jwt.JWTTokenConfiguration;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class JWTTokenGeneratorTest {
  protected static final String rsaPrivateKeyPath =
      ResourceHelpers.resourceFilePath("private_key.der");
  protected static final String rsaPublicKeyPath =
      ResourceHelpers.resourceFilePath("public_key.der");
  protected JWTTokenConfiguration jwtTokenConfiguration;
  protected JWTTokenGenerator jwtTokenGenerator;

  @BeforeAll
  public void setup() {
    jwtTokenConfiguration = new JWTTokenConfiguration();
    jwtTokenConfiguration.setJwtissuer("open-metadata.org");
    jwtTokenConfiguration.setRsaprivateKeyFilePath(rsaPrivateKeyPath);
    jwtTokenConfiguration.setRsapublicKeyFilePath(rsaPublicKeyPath);
    jwtTokenGenerator = JWTTokenGenerator.getInstance();
    jwtTokenGenerator.init(
        AuthenticationConfiguration.TokenValidationAlgorithm.RS_256, jwtTokenConfiguration);
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
  void testECAlgorithmSupport() throws Exception {
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
  void testGetAlgorithmFromPublicKeyWithRSA() throws Exception {
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
