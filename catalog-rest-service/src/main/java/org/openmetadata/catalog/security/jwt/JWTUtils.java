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

public final class JWTUtils {

  public static RSAPrivateKey getRSAPrivateKey(JWTTokenConfiguration jwtTokenConfiguration)
      throws NoSuchAlgorithmException, InvalidKeySpecException, IOException {
    byte[] keyBytes = Files.readAllBytes(Paths.get(jwtTokenConfiguration.getRSAPrivateKey()));

    PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(keyBytes);
    KeyFactory kf = KeyFactory.getInstance("RSA");
    return (RSAPrivateKey) kf.generatePrivate(spec);
  }

  public static RSAPublicKey getRSAPublicKey(JWTTokenConfiguration jwtTokenConfiguration)
      throws IOException, NoSuchAlgorithmException, InvalidKeySpecException {
    byte[] keyBytes = Files.readAllBytes(Paths.get(jwtTokenConfiguration.getRSAPublicKey()));

    X509EncodedKeySpec spec = new X509EncodedKeySpec(keyBytes);
    KeyFactory kf = KeyFactory.getInstance("RSA");
    return (RSAPublicKey) kf.generatePublic(spec);
  }

  public static String generateJWTToken(JWTTokenConfiguration jwtTokenConfiguration, User user, JWTTokenExpiry expiry)
      throws NoSuchAlgorithmException, InvalidKeySpecException, IOException {
    RSAPrivateKey privateKey = getRSAPrivateKey(jwtTokenConfiguration);
    Algorithm algorithm = Algorithm.RSA256(null, privateKey);
    Date expires = getExpiryDate(expiry);
    return JWT.create()
        .withIssuer(jwtTokenConfiguration.getJWTIssuer())
        .withClaim("email", user.getEmail())
        .withClaim("isBot", true)
        .withIssuedAt(new Date(System.currentTimeMillis()))
        .withExpiresAt(expires)
        .sign(algorithm);
  }

  public static Date getExpiryDate(JWTTokenExpiry jwtTokenExpiry) {
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
