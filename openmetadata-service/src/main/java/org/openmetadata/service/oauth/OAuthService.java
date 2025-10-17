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

package org.openmetadata.service.oauth;

import com.fasterxml.jackson.core.type.TypeReference;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.Credentials;
import org.openmetadata.schema.entity.OAuthToken;
import org.openmetadata.schema.entity.OAuthToken.TokenStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CredentialsRepository;
import org.openmetadata.service.jdbi3.OAuthTokenRepository;

@Slf4j
public class OAuthService {

  private final CredentialsRepository credentialsRepository;
  private final OAuthTokenRepository oAuthTokenRepository;
  private final OpenMetadataApplicationConfig config;
  private final HttpClient httpClient;
  private final SecretKey stateSecretKey;

  public OAuthService(OpenMetadataApplicationConfig config) {
    this.credentialsRepository =
        (CredentialsRepository) Entity.getEntityRepository(Entity.CREDENTIALS);
    this.oAuthTokenRepository = new OAuthTokenRepository();
    this.config = config;
    this.httpClient = HttpClient.newBuilder().build();

    // Use JWT secret for state signing
    String jwtSecret = config.getJwtTokenConfiguration().getRsapublicKeyFilePath();
    this.stateSecretKey = Key.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
  }

  /**
   * Generate OAuth authorization URL with signed state parameter
   */
  public String generateAuthorizationUrl(UUID credentialsId, UUID userId, String returnUrl)
      throws EntityNotFoundException {

    Credentials credentials =
        credentialsRepository.get(
            null, credentialsId, credentialsRepository.getFields("credentialConfig"));

    if (!credentials.getIsOAuth() || !credentials.getRequiresUserAuthentication()) {
      throw new IllegalArgumentException("Credentials do not support OAuth user authentication");
    }

    // Extract OAuth config from credential config
    Map<String, Object> credentialConfig =
        JsonUtils.readValue(
            JsonUtils.pojoToJson(credentials.getCredentialConfig()),
            new TypeReference<Map<String, Object>>() {});

    String authorizationUrl = (String) credentialConfig.get("authorizationUrl");
    String clientId = (String) credentialConfig.get("clientId");
    String redirectUri = (String) credentialConfig.get("redirectUri");
    List<String> scopes = (List<String>) credentialConfig.get("scopes");

    // Generate signed state parameter
    String state = generateSignedState(userId, credentialsId, returnUrl);

    // Build authorization URL
    StringBuilder urlBuilder = new StringBuilder(authorizationUrl);
    urlBuilder.append("?response_type=code");
    urlBuilder.append("&client_id=").append(clientId);
    urlBuilder.append("&redirect_uri=").append(redirectUri);
    urlBuilder.append("&state=").append(state);

    if (scopes != null && !scopes.isEmpty()) {
      urlBuilder.append("&scope=").append(String.join(" ", scopes));
    }

    LOG.info(
        "Generated OAuth authorization URL for credentials {} and user {}", credentialsId, userId);
    return urlBuilder.toString();
  }

  /**
   * Handle OAuth callback and exchange authorization code for tokens
   */
  public OAuthToken handleCallback(String code, String state, String error) {
    if (error != null) {
      LOG.error("OAuth authorization error: {}", error);
      throw new RuntimeException("OAuth authorization failed: " + error);
    }

    // Verify and parse state
    OAuthState oauthState = verifyAndParseState(state);
    UUID userId = oauthState.getUserId();
    UUID credentialsId = oauthState.getCredentialsId();

    try {
      Credentials credentials =
          credentialsRepository.get(
              null, credentialsId, credentialsRepository.getFields("credentialConfig"));

      // Extract OAuth config
      Map<String, Object> credentialConfig =
          JsonUtils.readValue(
              JsonUtils.pojoToJson(credentials.getCredentialConfig()),
              new TypeReference<Map<String, Object>>() {});

      String tokenUrl = (String) credentialConfig.get("tokenUrl");
      String clientId = (String) credentialConfig.get("clientId");
      String clientSecret = (String) credentialConfig.get("clientSecret");
      String redirectUri = (String) credentialConfig.get("redirectUri");

      // Exchange code for tokens
      Map<String, Object> tokenResponse =
          exchangeCodeForTokens(code, tokenUrl, clientId, clientSecret, redirectUri);

      // Create or update OAuth token
      OAuthToken oauthToken = new OAuthToken();
      oauthToken.setUserId(userId);
      oauthToken.setCredentialsId(credentialsId);
      oauthToken.setAccessToken((String) tokenResponse.get("access_token"));
      oauthToken.setRefreshToken((String) tokenResponse.get("refresh_token"));
      oauthToken.setTokenType((String) tokenResponse.getOrDefault("token_type", "Bearer"));

      // Calculate expiration time
      Object expiresIn = tokenResponse.get("expires_in");
      if (expiresIn != null) {
        long expirationSeconds =
            expiresIn instanceof Number
                ? ((Number) expiresIn).longValue()
                : Long.parseLong(expiresIn.toString());
        oauthToken.setExpiresAt(Instant.now().plusSeconds(expirationSeconds).toEpochMilli());
      }

      // Set scopes if provided
      Object scope = tokenResponse.get("scope");
      if (scope != null) {
        String scopeStr = scope.toString();
        oauthToken.setScopes(List.of(scopeStr.split(" ")));
      }

      oauthToken.setStatus(TokenStatus.Active);

      OAuthToken savedToken = oAuthTokenRepository.createOrUpdate(oauthToken);
      LOG.info(
          "Successfully created/updated OAuth token for user {} and credentials {}",
          userId,
          credentialsId);

      return savedToken;

    } catch (Exception e) {
      LOG.error(
          "Failed to handle OAuth callback for credentials {} and user {}",
          credentialsId,
          userId,
          e);
      throw new RuntimeException("Failed to process OAuth callback", e);
    }
  }

  /**
   * Refresh an OAuth token
   */
  public OAuthToken refreshToken(UUID tokenId) {
    Optional<OAuthToken> tokenOpt = oAuthTokenRepository.findById(tokenId);
    if (tokenOpt.isEmpty()) {
      throw new EntityNotFoundException("OAuth token not found");
    }

    OAuthToken token = tokenOpt.get();
    if (token.getRefreshToken() == null) {
      throw new IllegalStateException("No refresh token available");
    }

    try {
      Credentials credentials =
          credentialsRepository.get(
              null, token.getCredentialsId(), credentialsRepository.getFields("credentialConfig"));

      Map<String, Object> credentialConfig =
          JsonUtils.readValue(
              JsonUtils.pojoToJson(credentials.getCredentialConfig()),
              new TypeReference<Map<String, Object>>() {});

      String tokenUrl = (String) credentialConfig.get("tokenUrl");
      String clientId = (String) credentialConfig.get("clientId");
      String clientSecret = (String) credentialConfig.get("clientSecret");

      // Refresh the token
      Map<String, Object> tokenResponse =
          refreshAccessToken(token.getRefreshToken(), tokenUrl, clientId, clientSecret);

      // Update token
      token.setAccessToken((String) tokenResponse.get("access_token"));
      String newRefreshToken = (String) tokenResponse.get("refresh_token");
      if (newRefreshToken != null) {
        token.setRefreshToken(newRefreshToken);
      }

      Object expiresIn = tokenResponse.get("expires_in");
      if (expiresIn != null) {
        long expirationSeconds =
            expiresIn instanceof Number
                ? ((Number) expiresIn).longValue()
                : Long.parseLong(expiresIn.toString());
        token.setExpiresAt(Instant.now().plusSeconds(expirationSeconds).toEpochMilli());
      }

      token.setStatus(TokenStatus.Active);
      token.setLastRefreshedAt(Instant.now().toEpochMilli());
      token.setRefreshFailureCount(0);
      token.setRefreshFailureReason(null);

      OAuthToken savedToken = oAuthTokenRepository.createOrUpdate(token);
      LOG.info("Successfully refreshed OAuth token {}", tokenId);

      return savedToken;

    } catch (Exception e) {
      LOG.error("Failed to refresh OAuth token {}", tokenId, e);
      oAuthTokenRepository.markRefreshFailed(tokenId, e.getMessage());
      throw new RuntimeException("Failed to refresh OAuth token", e);
    }
  }

  /**
   * Validate if a token is still valid
   */
  public boolean validateToken(UUID tokenId) {
    Optional<OAuthToken> tokenOpt = oAuthTokenRepository.findById(tokenId);
    if (tokenOpt.isEmpty()) {
      return false;
    }

    OAuthToken token = tokenOpt.get();
    if (token.getStatus() != TokenStatus.Active) {
      return false;
    }

    if (token.getExpiresAt() != null && token.getExpiresAt() <= Instant.now().toEpochMilli()) {
      oAuthTokenRepository.markTokenExpired(tokenId);
      return false;
    }

    return true;
  }

  /**
   * Revoke an OAuth token
   */
  public void revokeToken(UUID tokenId) {
    oAuthTokenRepository.revokeToken(tokenId);
    LOG.info("Revoked OAuth token {}", tokenId);
  }

  /**
   * Get user's token for specific credentials
   */
  public Optional<OAuthToken> getUserToken(UUID userId, UUID credentialsId) {
    return oAuthTokenRepository.findByUserAndCredentials(userId, credentialsId);
  }

  /**
   * Generate signed state parameter for OAuth flow
   */
  private String generateSignedState(UUID userId, UUID credentialsId, String returnUrl) {
    long timestamp = Instant.now().toEpochMilli();

    Claims claims =
        Jwts.claims()
            .setSubject("oauth_state")
            .setIssuedAt(new java.util.Date(timestamp))
            .setExpiration(new java.util.Date(timestamp + 600000)); // 10 minutes expiry

    claims.put("userId", userId.toString());
    claims.put("credentialsId", credentialsId.toString());

    if (returnUrl != null) {
      claims.put("returnUrl", returnUrl);
    }

    return Jwts.builder().setClaims(claims).signWith(stateSecretKey).compact();
  }

  /**
   * Verify and parse state parameter
   */
  private OAuthState verifyAndParseState(String state) {
    try {
      Claims claims =
          Jwts.builder()
              .setSigningKey(stateSecretKey)
              .build()
              .parseClaimsJws(state)
              .getBody();

      return OAuthState.builder()
          .userId(UUID.fromString(claims.get("userId", String.class)))
          .credentialsId(UUID.fromString(claims.get("credentialsId", String.class)))
          .returnUrl(claims.get("returnUrl", String.class))
          .timestamp(claims.getIssuedAt().getTime())
          .build();

    } catch (Exception e) {
      LOG.error("Failed to verify OAuth state parameter", e);
      throw new IllegalArgumentException("Invalid OAuth state parameter");
    }
  }

  /**
   * Exchange authorization code for access tokens
   */
  private Map<String, Object> exchangeCodeForTokens(
      String code, String tokenUrl, String clientId, String clientSecret, String redirectUri)
      throws Exception {

    String requestBody =
        String.format(
            "grant_type=authorization_code&code=%s&redirect_uri=%s&client_id=%s&client_secret=%s",
            code, redirectUri, clientId, clientSecret);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(new URI(tokenUrl))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .header("Accept", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .build();

    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      throw new RuntimeException("Token exchange failed: " + response.body());
    }

    return JsonUtils.readValue(response.body(), new TypeReference<Map<String, Object>>() {});
  }

  /**
   * Refresh access token using refresh token
   */
  private Map<String, Object> refreshAccessToken(
      String refreshToken, String tokenUrl, String clientId, String clientSecret) throws Exception {

    String requestBody =
        String.format(
            "grant_type=refresh_token&refresh_token=%s&client_id=%s&client_secret=%s",
            refreshToken, clientId, clientSecret);

    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(new URI(tokenUrl))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .header("Accept", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .build();

    HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

    if (response.statusCode() != 200) {
      throw new RuntimeException("Token refresh failed: " + response.body());
    }

    return JsonUtils.readValue(response.body(), new TypeReference<Map<String, Object>>() {});
  }
}
