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

import java.time.Instant;
import java.util.Date;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import net.jodah.expiringmap.ExpiringMap;
import org.openmetadata.schema.auth.LogoutRequest;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

@Slf4j
public class JwtTokenCacheManager {
  private static final JwtTokenCacheManager INSTANCE = new JwtTokenCacheManager();
  private final ExpiringMap<String, LogoutRequest> tokenEventMap;

  private JwtTokenCacheManager() {
    this.tokenEventMap = ExpiringMap.builder().variableExpiration().maxSize(1000).build();
  }

  public static JwtTokenCacheManager getInstance() {
    return INSTANCE;
  }

  public void markLogoutEventForToken(LogoutRequest logoutRequest) {
    String token = logoutRequest.getToken();
    if (tokenEventMap.containsKey(token)) {
      LOG.info(
          String.format("Log out token for user [%s] is already present in the cache", logoutRequest.getUsername()));

    } else {
      Date tokenExpiryDate = JWTTokenGenerator.getInstance().getTokenExpiryFromJWT(token);
      long ttlForToken = getTTLForToken(tokenExpiryDate);
      LOG.info(
          String.format(
              "Logout token cache set for [%s] with a TTL of [%s] seconds. Token is due expiry at [%s]",
              logoutRequest.getUsername(), ttlForToken, tokenExpiryDate));
      tokenEventMap.put(token, logoutRequest, ttlForToken, TimeUnit.SECONDS);
    }
  }

  public LogoutRequest getLogoutEventForToken(String token) {
    return tokenEventMap.get(token);
  }

  private long getTTLForToken(Date date) {
    long secondAtExpiry = date.toInstant().getEpochSecond();
    long secondAtLogout = Instant.now().getEpochSecond();
    return Math.max(0, secondAtExpiry - secondAtLogout);
  }
}
