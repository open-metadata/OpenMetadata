/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.security.jwt;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_ROLE;
import static org.openmetadata.service.util.UserUtil.getRoleListFromUser;

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
import java.util.Set;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.jwt.JWTTokenConfiguration;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.security.AuthenticationException;

@Slf4j
public class JWTTokenGenerator {
  public static final String ROLES_CLAIM = "roles";
  public static final String SUBJECT_CLAIM = "sub";
  private static final String EMAIL_CLAIM = "email";
  private static final String IS_BOT_CLAIM = "isBot";
  public static final String TOKEN_TYPE = "tokenType";
  private static final JWTTokenGenerator INSTANCE = new JWTTokenGenerator();
  private RSAPrivateKey privateKey;
  @Getter private RSAPublicKey publicKey;
  private String issuer;
  private String kid;
  private AuthenticationConfiguration.TokenValidationAlgorithm tokenValidationAlgorithm;

  private JWTTokenGenerator() {
    /* Private constructor for singleton */
  }

  public static JWTTokenGenerator getInstance() {
    return INSTANCE;
  }

  /** Expected to be initialized only once during application start */
  public void init(
      AuthenticationConfiguration.TokenValidationAlgorithm algorithm,
      JWTTokenConfiguration jwtTokenConfiguration) {
    try {
      if (jwtTokenConfiguration.getRsaprivateKeyFilePath() != null
          && !jwtTokenConfiguration.getRsaprivateKeyFilePath().isEmpty()
          && jwtTokenConfiguration.getRsapublicKeyFilePath() != null
          && !jwtTokenConfiguration.getRsapublicKeyFilePath().isEmpty()) {
        byte[] privateKeyBytes =
            Files.readAllBytes(Paths.get(jwtTokenConfiguration.getRsaprivateKeyFilePath()));
        PKCS8EncodedKeySpec privateSpec = new PKCS8EncodedKeySpec(privateKeyBytes);
        KeyFactory privateKF = KeyFactory.getInstance("RSA");
        privateKey = (RSAPrivateKey) privateKF.generatePrivate(privateSpec);
        byte[] publicKeyBytes =
            Files.readAllBytes(Paths.get(jwtTokenConfiguration.getRsapublicKeyFilePath()));
        X509EncodedKeySpec spec = new X509EncodedKeySpec(publicKeyBytes);
        KeyFactory kf = KeyFactory.getInstance("RSA");
        publicKey = (RSAPublicKey) kf.generatePublic(spec);
        issuer = jwtTokenConfiguration.getJwtissuer();
        kid = jwtTokenConfiguration.getKeyId();
        tokenValidationAlgorithm = algorithm;
      }
    } catch (Exception ex) {
      LOG.error("Failed to initialize JWTTokenGenerator ", ex);
    }
  }

  public JWTAuthMechanism generateJWTToken(User user, JWTTokenExpiry expiry) {
    return getJwtAuthMechanism(
        user.getName(),
        getRoleListFromUser(user),
        user.getIsAdmin(),
        user.getEmail(),
        true,
        ServiceTokenType.BOT,
        getExpiryDate(expiry),
        expiry);
  }

  public JWTAuthMechanism generateJWTToken(
      String userName,
      Set<String> roles,
      boolean isAdmin,
      String email,
      long expiryInSeconds,
      boolean isBot,
      ServiceTokenType tokenType) {
    return getJwtAuthMechanism(
        userName,
        roles,
        isAdmin,
        email,
        isBot,
        tokenType,
        getCustomExpiryDate(expiryInSeconds),
        null);
  }

  public JWTAuthMechanism getJwtAuthMechanism(
      String userName,
      Set<String> roles,
      boolean isAdmin,
      String email,
      boolean isBot,
      ServiceTokenType tokenType,
      Date expires,
      JWTTokenExpiry expiry) {
    try {
      // Handle the Admin Role Here Since there is no Admin Role as such , just a isAdmin flag in
      // User Schema
      if (isAdmin) {
        if (nullOrEmpty(roles)) {
          roles = Set.of(ADMIN_ROLE);
        } else {
          roles.add(ADMIN_ROLE);
        }
      }
      JWTAuthMechanism jwtAuthMechanism = new JWTAuthMechanism().withJWTTokenExpiry(expiry);
      Algorithm algorithm = getAlgorithm(tokenValidationAlgorithm, null, privateKey);
      String token =
          JWT.create()
              .withIssuer(issuer)
              .withKeyId(kid)
              .withClaim(SUBJECT_CLAIM, userName)
              .withClaim(ROLES_CLAIM, roles.stream().toList())
              .withClaim(EMAIL_CLAIM, email)
              .withClaim(IS_BOT_CLAIM, isBot)
              .withClaim(TOKEN_TYPE, tokenType.value())
              .withIssuedAt(new Date(System.currentTimeMillis()))
              .withExpiresAt(expires)
              .sign(algorithm);
      jwtAuthMechanism.setJWTToken(token);
      jwtAuthMechanism.setJWTTokenExpiresAt(expires != null ? expires.getTime() : null);
      return jwtAuthMechanism;
    } catch (Exception e) {
      throw new JWTCreationException(
          "Failed to generate JWT Token. Please check your OpenMetadata Configuration.", e);
    }
  }

  public static Date getExpiryDate(JWTTokenExpiry jwtTokenExpiry) {
    LocalDateTime expiryDate =
        switch (jwtTokenExpiry) {
          case OneHour -> LocalDateTime.now().plusHours(1);
          case One -> LocalDateTime.now().plusDays(1);
          case Seven -> LocalDateTime.now().plusDays(7);
          case Thirty -> LocalDateTime.now().plusDays(30);
          case Sixty -> LocalDateTime.now().plusDays(60);
          case Ninety -> LocalDateTime.now().plusDays(90);
          case Unlimited -> null;
        };
    return expiryDate != null
        ? Date.from(expiryDate.atZone(ZoneId.systemDefault()).toInstant())
        : null;
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
      jwksKey.setE(
          Base64.getUrlEncoder().encodeToString(publicKey.getPublicExponent().toByteArray()));
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

  public static Algorithm getAlgorithm(
      AuthenticationConfiguration.TokenValidationAlgorithm algorithm,
      RSAPublicKey publicKey,
      RSAPrivateKey privateKey) {
    return switch (algorithm) {
      case RS_256 -> Algorithm.RSA256(publicKey, privateKey);
      case RS_384 -> Algorithm.RSA384(publicKey, privateKey);
      case RS_512 -> Algorithm.RSA512(publicKey, privateKey);
    };
  }
}
