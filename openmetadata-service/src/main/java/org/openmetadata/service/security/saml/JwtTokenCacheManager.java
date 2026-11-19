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

package org.openmetadata.service.security.saml;

import com.auth0.jwt.JWT;
import com.auth0.jwt.exceptions.JWTDecodeException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Date;
import java.util.HexFormat;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import net.jodah.expiringmap.ExpiringMap;
import org.openmetadata.schema.auth.LogoutRequest;

/**
 * Tokens logged out before they expire. An entry holds the token's digest, the user and the logout
 * time, and lives until the token would have expired
 * (ADR:2026-11-03-logout-retires-the-token-that-signed-the-request).
 */
@Slf4j
public class JwtTokenCacheManager {
  static final int MAX_ENTRIES = 100_000;
  private static final JwtTokenCacheManager INSTANCE = new JwtTokenCacheManager(MAX_ENTRIES);

  // A full map drops the entry that expires first.
  private final ExpiringMap<String, LogoutRequest> tokenEventMap;

  JwtTokenCacheManager(int maxEntries) {
    tokenEventMap = ExpiringMap.builder().variableExpiration().maxSize(maxEntries).build();
  }

  public static JwtTokenCacheManager getInstance() {
    return INSTANCE;
  }

  public void markLogoutEventForToken(LogoutRequest logoutRequest) {
    String token = logoutRequest.getToken();
    Date tokenExpiryDate = expiryOf(token);
    if (tokenExpiryDate == null) {
      LOG.debug(
          "Logout token for user [{}] has no expiry and is not cached",
          logoutRequest.getUsername());
      return;
    }
    String key = denylistKey(token);
    if (tokenEventMap.containsKey(key)) {
      LOG.info(
          "Log out token for user [{}] is already present in the cache",
          logoutRequest.getUsername());
    } else {
      long ttlForToken = getTTLForToken(tokenExpiryDate);
      LOG.info(
          "Logout token cache set for [{}] with a TTL of [{}] seconds. Token is due expiry at [{}]",
          logoutRequest.getUsername(),
          ttlForToken,
          tokenExpiryDate);
      tokenEventMap.put(
          key,
          new LogoutRequest()
              .withUsername(logoutRequest.getUsername())
              .withLogoutTime(logoutRequest.getLogoutTime()),
          ttlForToken,
          TimeUnit.SECONDS);
    }
  }

  public LogoutRequest getLogoutEventForToken(String token) {
    return tokenEventMap.get(denylistKey(token));
  }

  /**
   * The signed part of a JWT (header.payload), which identifies a token by what was signed. The
   * signature's base64url text is not a canonical encoding, so it is left out of the key.
   */
  static String denylistKey(String token) {
    int signatureStart = token.lastIndexOf('.');
    String signedPart = signatureStart > 0 ? token.substring(0, signatureStart) : token;
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256")
                  .digest(signedPart.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 is not available", e);
    }
  }

  private static Date expiryOf(String token) {
    try {
      return JWT.decode(token).getExpiresAt();
    } catch (JWTDecodeException e) {
      return null;
    }
  }

  private long getTTLForToken(Date date) {
    long secondAtExpiry = date.toInstant().getEpochSecond();
    long secondAtLogout = Instant.now().getEpochSecond();
    return Math.max(0, secondAtExpiry - secondAtLogout);
  }
}
