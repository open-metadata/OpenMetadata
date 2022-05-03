package org.openmetadata.catalog.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.auth0.jwt.interfaces.JWTVerifier;
import io.dropwizard.testing.ResourceHelpers;
import java.io.IOException;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
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
import org.openmetadata.catalog.security.jwt.JWTUtils;
import org.openmetadata.catalog.teams.authn.JWTTokenExpiry;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class JWTUtilsTest {
  protected static final String rsaPrivateKeyPath = ResourceHelpers.resourceFilePath("private_key.der");
  protected static final String rsaPublicKeyPath = ResourceHelpers.resourceFilePath("public_key.der");
  protected JWTTokenConfiguration jwtTokenConfiguration;

  @BeforeAll
  public void setup(TestInfo test) {
    jwtTokenConfiguration = new JWTTokenConfiguration();
    jwtTokenConfiguration.setJWTIssuer("open-metadata.org");
    jwtTokenConfiguration.setRSAPrivateKey(rsaPrivateKeyPath);
    jwtTokenConfiguration.setRSAPublicKey(rsaPublicKeyPath);
  }

  @Test
  void testGetPrivateKey() throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
    RSAPrivateKey privateKey = JWTUtils.getRSAPrivateKey(jwtTokenConfiguration);
    assertNotNull(privateKey);
  }

  @Test
  void testGetPublicKey() throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
    RSAPublicKey publicKey = JWTUtils.getRSAPublicKey(jwtTokenConfiguration);
    assertNotNull(publicKey);
  }

  @Test
  void testGenerateJWTToken() throws NoSuchAlgorithmException, InvalidKeySpecException, IOException {
    User user =
        new User()
            .withEmail("ingestion-bot@open-metadata.org")
            .withName("ingestion-bot")
            .withDisplayName("ingestion-bot");
    String token = JWTUtils.generateJWTToken(jwtTokenConfiguration, user, JWTTokenExpiry.Seven);
    DecodedJWT jwt = decodedJWT(token);
    assertEquals(jwt.getClaims().get("email").asString(), "ingestion-bot@open-metadata.org");
    Date date = jwt.getExpiresAt();
    long daysBetween = ((date.getTime() - jwt.getIssuedAt().getTime()) / (1000 * 60 * 60 * 24));
    assertTrue(daysBetween >= 6);
    token = JWTUtils.generateJWTToken(jwtTokenConfiguration, user, JWTTokenExpiry.Ninety);
    jwt = decodedJWT(token);
    date = jwt.getExpiresAt();
    daysBetween = ((date.getTime() - jwt.getIssuedAt().getTime()) / (1000 * 60 * 60 * 24));
    assertTrue(daysBetween >= 89);
    token = JWTUtils.generateJWTToken(jwtTokenConfiguration, user, JWTTokenExpiry.Unlimited);
    jwt = decodedJWT(token);
    assertNull(jwt.getExpiresAt());
  }

  private DecodedJWT decodedJWT(String token) throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
    RSAPublicKey publicKey = JWTUtils.getRSAPublicKey(jwtTokenConfiguration);
    Algorithm algorithm = Algorithm.RSA256(publicKey, null);
    JWTVerifier verifier = JWT.require(algorithm).withIssuer(jwtTokenConfiguration.getJWTIssuer()).build();
    return verifier.verify(token);
  }
}
