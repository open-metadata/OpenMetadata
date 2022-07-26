package org.openmetadata.catalog.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.auth0.jwt.interfaces.JWTVerifier;
import io.dropwizard.testing.ResourceHelpers;
import java.io.IOException;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.InvalidKeySpecException;
import java.util.Date;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.security.jwt.JWTTokenConfiguration;
import org.openmetadata.catalog.security.jwt.JWTTokenGenerator;
import org.openmetadata.catalog.teams.authn.JWTAuthMechanism;
import org.openmetadata.catalog.teams.authn.JWTTokenExpiry;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class JWTTokenGeneratorTest {
  protected static final String rsaPrivateKeyPath = ResourceHelpers.resourceFilePath("private_key.der");
  protected static final String rsaPublicKeyPath = ResourceHelpers.resourceFilePath("public_key.der");
  protected JWTTokenConfiguration jwtTokenConfiguration;
  protected JWTTokenGenerator jwtTokenGenerator;

  @BeforeAll
  public void setup(TestInfo test) throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
    jwtTokenConfiguration = new JWTTokenConfiguration();
    jwtTokenConfiguration.setJwtissuer("open-metadata.org");
    jwtTokenConfiguration.setRsaprivateKeyFilePath(rsaPrivateKeyPath);
    jwtTokenConfiguration.setRsapublicKeyFilePath(rsaPublicKeyPath);
    jwtTokenGenerator = JWTTokenGenerator.getInstance();
    jwtTokenGenerator.init(jwtTokenConfiguration);
  }

  @Test
  void testGenerateJWTToken() {
    User user =
        new User()
            .withEmail("ingestion-bot@open-metadata.org")
            .withName("ingestion-bot")
            .withDisplayName("ingestion-bot");
    JWTAuthMechanism jwtAuthMechanism = jwtTokenGenerator.generateJWTToken(user, JWTTokenExpiry.Seven);
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

  private DecodedJWT decodedJWT(String token) {
    RSAPublicKey publicKey = jwtTokenGenerator.getPublicKey();
    Algorithm algorithm = Algorithm.RSA256(publicKey, null);
    JWTVerifier verifier = JWT.require(algorithm).withIssuer(jwtTokenConfiguration.getJwtissuer()).build();
    return verifier.verify(token);
  }
}
