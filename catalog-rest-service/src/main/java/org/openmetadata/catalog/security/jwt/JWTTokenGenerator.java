package org.openmetadata.catalog.security.jwt;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.InvalidKeySpecException;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.teams.authn.JWTTokenExpiry;

public class JWTTokenGenerator {
  private static volatile JWTTokenGenerator instance;
  private RSAPrivateKey privateKey;
  private RSAPublicKey publicKey;
  private String issuer;

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

  public void init(JWTTokenConfiguration jwtTokenConfiguration)
      throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
    byte[] privateKeyBytes = Files.readAllBytes(Paths.get(jwtTokenConfiguration.getRSAPrivateKey()));
    PKCS8EncodedKeySpec privateSpec = new PKCS8EncodedKeySpec(privateKeyBytes);
    KeyFactory privateKF = KeyFactory.getInstance("RSA");
    privateKey = (RSAPrivateKey) privateKF.generatePrivate(privateSpec);
    byte[] publicKeyBytes = Files.readAllBytes(Paths.get(jwtTokenConfiguration.getRSAPublicKey()));
    X509EncodedKeySpec spec = new X509EncodedKeySpec(publicKeyBytes);
    KeyFactory kf = KeyFactory.getInstance("RSA");
    publicKey = (RSAPublicKey) kf.generatePublic(spec);
    issuer = jwtTokenConfiguration.getJWTIssuer();
  }

  public String generateJWTToken(User user, JWTTokenExpiry expiry) {
    Algorithm algorithm = Algorithm.RSA256(null, privateKey);
    Date expires = getExpiryDate(expiry);
    return JWT.create()
        .withIssuer(issuer)
        .withClaim("email", user.getEmail())
        .withClaim("isBot", true)
        .withIssuedAt(new Date(System.currentTimeMillis()))
        .withExpiresAt(expires)
        .sign(algorithm);
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
}
