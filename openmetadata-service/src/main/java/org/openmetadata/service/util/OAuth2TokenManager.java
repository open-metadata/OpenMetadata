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

package org.openmetadata.service.util;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.core.Form;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.authentication.WebhookOAuth2Config;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;

@Slf4j
public class OAuth2TokenManager {
  private static final OAuth2TokenManager INSTANCE = new OAuth2TokenManager();
  private static final long TOKEN_EXPIRY_BUFFER_SECONDS = 30;
  private static final int TOKEN_CONNECT_TIMEOUT_SECONDS = 10;
  private static final int TOKEN_READ_TIMEOUT_SECONDS = 30;
  private static final int MAX_CACHE_SIZE = 100;
  private final ConcurrentHashMap<String, ReentrantLock> keyLocks = new ConcurrentHashMap<>();

  private final Cache<String, CachedToken> tokenCache =
      CacheBuilder.newBuilder()
          .maximumSize(MAX_CACHE_SIZE)
          .expireAfterWrite(1, TimeUnit.HOURS)
          .build();

  private OAuth2TokenManager() {}

  public static OAuth2TokenManager getInstance() {
    return INSTANCE;
  }

  public String getAccessToken(WebhookOAuth2Config oauth2Config) {
    String cacheKey = buildCacheKey(oauth2Config);
    CachedToken cached = tokenCache.getIfPresent(cacheKey);
    if (cached != null && !cached.isExpired()) {
      return cached.accessToken;
    }
    return fetchAndCacheToken(oauth2Config, cacheKey);
  }

  public void invalidateToken(WebhookOAuth2Config oauth2Config) {
    String cacheKey = buildCacheKey(oauth2Config);
    tokenCache.invalidate(cacheKey);
    LOG.debug("Invalidated OAuth2 token cache entry");
  }

  private String fetchAndCacheToken(WebhookOAuth2Config oauth2Config, String cacheKey) {
    ReentrantLock lock = keyLocks.computeIfAbsent(cacheKey, k -> new ReentrantLock());
    lock.lock();
    try {
      CachedToken cached = tokenCache.getIfPresent(cacheKey);
      if (cached != null && !cached.isExpired()) {
        return cached.accessToken;
      }

      String tokenUrl = oauth2Config.getTokenUrl().toString();
      URLValidator.validateURL(tokenUrl);

      String clientId = decryptSecret(oauth2Config.getClientId());
      String clientSecret = decryptSecret(oauth2Config.getClientSecret());

      try (Client client = createTokenClient()) {
        Form form = new Form();
        form.param("grant_type", "client_credentials");
        form.param("client_id", clientId);
        form.param("client_secret", clientSecret);
        if (oauth2Config.getScope() != null && !oauth2Config.getScope().isEmpty()) {
          form.param("scope", oauth2Config.getScope());
        }

        try (Response response =
            client.target(tokenUrl).request(MediaType.APPLICATION_JSON).post(Entity.form(form))) {

          if (response.getStatus() != 200) {
            LOG.error(
                "OAuth2 token request to {} failed with HTTP {}", tokenUrl, response.getStatus());
            throw new OAuth2TokenException(
                String.format(
                    "OAuth2 token request failed with HTTP %d. Check the token URL and credentials.",
                    response.getStatus()));
          }

          String responseBody = response.readEntity(String.class);
          Map<String, Object> tokenResponse = JsonUtils.readValue(responseBody, Map.class);

          String accessToken = (String) tokenResponse.get("access_token");
          if (accessToken == null || accessToken.isEmpty()) {
            throw new OAuth2TokenException("OAuth2 token response missing 'access_token' field");
          }

          long expiresIn = extractExpiresIn(tokenResponse);
          Instant expiresAt =
              Instant.now().plusSeconds(expiresIn).minusSeconds(TOKEN_EXPIRY_BUFFER_SECONDS);

          tokenCache.put(cacheKey, new CachedToken(accessToken, expiresAt));
          LOG.debug("Successfully fetched OAuth2 token, expires in {}s", expiresIn);

          return accessToken;
        }
      }
    } finally {
      lock.unlock();
    }
  }

  private static long extractExpiresIn(Map<String, Object> tokenResponse) {
    Object expiresInObj = tokenResponse.get("expires_in");
    if (expiresInObj instanceof Number number) {
      return number.longValue();
    }
    if (expiresInObj instanceof String str) {
      try {
        return Long.parseLong(str);
      } catch (NumberFormatException e) {
        return 3600;
      }
    }
    return 3600;
  }

  private static String decryptSecret(String encryptedValue) {
    if (Fernet.getInstance().isKeyDefined()) {
      return Fernet.getInstance().decryptIfApplies(encryptedValue);
    }
    return encryptedValue;
  }

  private static String buildCacheKey(WebhookOAuth2Config config) {
    return config.getTokenUrl().toString() + "|" + config.getClientId();
  }

  private static Client createTokenClient() {
    return ClientBuilder.newBuilder()
        .connectTimeout(TOKEN_CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .readTimeout(TOKEN_READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .build();
  }

  private record CachedToken(String accessToken, Instant expiresAt) {
    boolean isExpired() {
      return Instant.now().isAfter(expiresAt);
    }
  }

  public static class OAuth2TokenException extends RuntimeException {
    public OAuth2TokenException(String message) {
      super(message);
    }
  }
}
