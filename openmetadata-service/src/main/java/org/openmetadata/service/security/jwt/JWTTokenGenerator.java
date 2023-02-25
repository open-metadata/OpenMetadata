package org.openmetadata.service.security.jwt;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTCreationException;
import com.auth0.jwt.exceptions.JWTDecodeException;
import com.auth0.jwt.interfaces.DecodedJWT;
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
import org.openmetadata.schema.api.security.jwt.JWTTokenConfiguration;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.security.AuthenticationException;

@Slf4j
public class JWTTokenGenerator {
  private static final String SUBJECT_CLAIM = "sub";
  private static final String EMAIL_CLAIM = "email";
  private static final String IS_BOT_CLAIM = "isBot";
  private static final JWTTokenGenerator INSTANCE = new JWTTokenGenerator();
  private RSAPrivateKey privateKey;
  @Getter private RSAPublicKey publicKey;
  private String issuer;
  private String kid;

  private JWTTokenGenerator() {}

  public static JWTTokenGenerator getInstance() {
    return INSTANCE;
  }

  /** Expected to be initialized only once during application start */
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
              .withClaim(SUBJECT_CLAIM, user.getName())
              .withClaim(EMAIL_CLAIM, user.getEmail())
              .withClaim(IS_BOT_CLAIM, true)
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

  public JWTAuthMechanism generateJWTToken(String userName, String email, long expiryInSeconds, boolean isBot) {
    try {
      JWTAuthMechanism jwtAuthMechanism = new JWTAuthMechanism();
      Algorithm algorithm = Algorithm.RSA256(null, privateKey);
      Date expires = getCustomExpiryDate(expiryInSeconds);
      String token =
          JWT.create()
              .withIssuer(issuer)
              .withKeyId(kid)
              .withClaim(SUBJECT_CLAIM, userName)
              .withClaim(EMAIL_CLAIM, email)
              .withClaim(IS_BOT_CLAIM, isBot)
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
      case OneHour:
        expiryDate = LocalDateTime.now().plusHours(1);
        break;
      case One:
        expiryDate = LocalDateTime.now().plusDays(1);
        break;
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

  public Date getCustomExpiryDate(long seconds) {
    LocalDateTime expiryDate = LocalDateTime.now().plusSeconds(seconds);
    return Date.from(expiryDate.atZone(ZoneId.systemDefault()).toInstant());
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

  public Date getTokenExpiryFromJWT(String token) {
    DecodedJWT jwt;
    try {
      jwt = JWT.decode(token);
    } catch (JWTDecodeException e) {
      throw new AuthenticationException("Invalid token", e);
    }

    // Check if expired
    // If expiresAt is set to null, treat it as never expiring token
    if (jwt.getExpiresAt() == null) {
      throw new AuthenticationException("Invalid Token, Expiry not present!");
    }

    return jwt.getExpiresAt();
  }
}
