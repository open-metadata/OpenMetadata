package org.openmetadata.catalog.security.jwt;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTCreationException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.teams.authn.JWTAuthMechanism;
import org.openmetadata.catalog.teams.authn.JWTTokenExpiry;

@Slf4j
public class JWTTokenGenerator {
  private static volatile JWTTokenGenerator instance;
  private RSAPrivateKey privateKey;
  @Getter private RSAPublicKey publicKey;
  private String issuer;
  private String kid;

  private JWTTokenGenerator() {
    if (instance != null) {
      throw new RuntimeException("Use getInstance() method to get the single instance of this class");
    }
  }

  public static JWTTokenGenerator getInstance() {
    if (instance == null) {
      synchronized (JWTTokenGenerator.class) {
        if (instance == null) {
          instance = new JWTTokenGenerator();
        }
      }
    }
    return instance;
  }

  public void init(JWTTokenConfiguration jwtTokenConfiguration) {
    try {
      if (jwtTokenConfiguration.getRsaprivateKeyFilePath() != null
          && !jwtTokenConfiguration.getRsaprivateKeyFilePath().isEmpty()
          && jwtTokenConfiguration.getRsapublicKeyFilePath() != null
          && !jwtTokenConfiguration.getRsapublicKeyFilePath().isEmpty()) {
        byte[] privateKeyBytes = Files.readAllBytes(Paths.get(jwtTokenConfiguration.getRsaprivateKeyFilePath()));
        PKCS8EncodedKeySpec privateSpec = new PKCS8EncodedKeySpec(privateKeyBytes);
        KeyFactory privateKF = KeyFactory.getInstance("RSA");
        privateKey = (RSAPrivateKey) privateKF.generatePrivate(privateSpec);
        byte[] publicKeyBytes = Files.readAllBytes(Paths.get(jwtTokenConfiguration.getRsapublicKeyFilePath()));
        X509EncodedKeySpec spec = new X509EncodedKeySpec(publicKeyBytes);
        KeyFactory kf = KeyFactory.getInstance("RSA");
        publicKey = (RSAPublicKey) kf.generatePublic(spec);
        issuer = jwtTokenConfiguration.getJwtissuer();
        kid = jwtTokenConfiguration.getKeyId();
      }
    } catch (Exception ex) {
      LOG.error("Failed to initialize JWTTokenGenerator ", ex);
    }
  }

  public JWTAuthMechanism generateJWTToken(User user, JWTTokenExpiry expiry) {
    try {
      JWTAuthMechanism jwtAuthMechanism = new JWTAuthMechanism().withJWTTokenExpiry(expiry);
      Algorithm algorithm = Algorithm.RSA256(null, privateKey);
      Date expires = getExpiryDate(expiry);
      String token =
          JWT.create()
              .withIssuer(issuer)
              .withKeyId(kid)
              .withClaim("sub", user.getName())
              .withClaim("email", user.getEmail())
              .withClaim("isBot", true)
              .withIssuedAt(new Date(System.currentTimeMillis()))
              .withExpiresAt(expires)
              .sign(algorithm);
      jwtAuthMechanism.setJWTToken(token);
      jwtAuthMechanism.setJWTTokenExpiresAt(expires != null ? expires.getTime() : null);
      return jwtAuthMechanism;
    } catch (Exception e) {
      throw new JWTCreationException("Failed to generate JWT Token. Please check your OpenMetadata Configuration.", e);
    }
  }

  public Date getExpiryDate(JWTTokenExpiry jwtTokenExpiry) {
    LocalDateTime expiryDate;
    switch (jwtTokenExpiry) {
      case Seven:
        expiryDate = LocalDateTime.now().plusDays(7);
        break;
      case Thirty:
        expiryDate = LocalDateTime.now().plusDays(30);
        break;
      case Sixty:
        expiryDate = LocalDateTime.now().plusDays(60);
        break;
      case Ninety:
        expiryDate = LocalDateTime.now().plusDays(90);
        break;
      case Unlimited:
      default:
        expiryDate = null;
    }
    return expiryDate != null ? Date.from(expiryDate.atZone(ZoneId.systemDefault()).toInstant()) : null;
  }

  public JWKSResponse getJWKSResponse() {
    JWKSResponse jwksResponse = new JWKSResponse();
    JWKSKey jwksKey = new JWKSKey();
    if (publicKey != null) {
      jwksKey.setKid(kid);
      jwksKey.setKty(publicKey.getAlgorithm());
      jwksKey.setN(Base64.getUrlEncoder().encodeToString(publicKey.getModulus().toByteArray()));
      jwksKey.setE(Base64.getUrlEncoder().encodeToString(publicKey.getPublicExponent().toByteArray()));
    }
    jwksResponse.setJwsKeys(List.of(jwksKey));
    return jwksResponse;
  }
}
