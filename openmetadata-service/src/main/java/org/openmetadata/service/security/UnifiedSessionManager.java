/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.util.TokenUtil;

@Slf4j
public class UnifiedSessionManager {
  private static final String JWT_RESPONSE_SESSION_KEY = "jwtResponse";
  private static final String USER_SESSION_KEY = "authenticatedUser";
  private static final String AUTH_TYPE_SESSION_KEY = "authType";

  private final TokenRepository tokenRepository;

  public UnifiedSessionManager() {
    this.tokenRepository = Entity.getTokenRepository();
  }

  public static UnifiedSessionManager getInstance() {
    return Holder.INSTANCE;
  }

  private static class Holder {
    private static final UnifiedSessionManager INSTANCE = new UnifiedSessionManager();
  }

  /**
   * Store authentication information in session with refresh token in database
   * This implementation stores critical data in database for cluster support
   */
  public void storeAuthSession(
      HttpServletRequest request, User user, JwtResponse jwtResponse, String authType) {
    HttpSession session = request.getSession(true);
    String sessionId = session.getId();

    // Store in session for quick access (local cache)
    session.setAttribute(JWT_RESPONSE_SESSION_KEY, jwtResponse);
    session.setAttribute(USER_SESSION_KEY, user);
    session.setAttribute(AUTH_TYPE_SESSION_KEY, authType);

    // Store refresh token in database for cluster support and persistence
    if (jwtResponse.getRefreshToken() != null) {
      try {
        RefreshToken refreshToken =
            TokenUtil.getRefreshToken(user.getId(), UUID.fromString(jwtResponse.getRefreshToken()));
        // Session metadata is stored in JWT itself, no need for extra fields

        // Check if token already exists and insert if not
        try {
          tokenRepository.findByToken(jwtResponse.getRefreshToken());
          LOG.debug("Refresh token already exists for user: {}", user.getName());
        } catch (Exception e) {
          // Token doesn't exist, create it
          tokenRepository.insertToken(refreshToken);
          LOG.debug("Created new refresh token for user: {}", user.getName());
        }
      } catch (Exception e) {
        LOG.error("Failed to store refresh token for user: {}", user.getName(), e);
        // Don't fail the authentication, just log the error
        // Session will still work, just without persistent refresh token
      }
    }

    LOG.debug(
        "Stored auth session for user: {} with auth type: {} and session: {}",
        user.getName(),
        authType,
        sessionId);
  }

  /**
   * Retrieve JWT response from session
   */
  public Optional<JwtResponse> getJwtResponse(HttpServletRequest request) {
    HttpSession session = request.getSession(false);
    if (session == null) {
      return Optional.empty();
    }

    JwtResponse jwtResponse = (JwtResponse) session.getAttribute(JWT_RESPONSE_SESSION_KEY);
    return Optional.ofNullable(jwtResponse);
  }

  /**
   * Retrieve authenticated user from session
   */
  public Optional<User> getAuthenticatedUser(HttpServletRequest request) {
    HttpSession session = request.getSession(false);
    if (session == null) {
      return Optional.empty();
    }

    User user = (User) session.getAttribute(USER_SESSION_KEY);
    return Optional.ofNullable(user);
  }

  /**
   * Get the authentication type used for this session
   */
  public Optional<String> getAuthType(HttpServletRequest request) {
    HttpSession session = request.getSession(false);
    if (session == null) {
      return Optional.empty();
    }

    String authType = (String) session.getAttribute(AUTH_TYPE_SESSION_KEY);
    return Optional.ofNullable(authType);
  }

  /**
   * Clear session and associated tokens
   */
  public void clearAuthSession(HttpServletRequest request) {
    HttpSession session = request.getSession(false);
    if (session != null) {
      // Get refresh token before invalidating session
      JwtResponse jwtResponse = (JwtResponse) session.getAttribute(JWT_RESPONSE_SESSION_KEY);

      // Clear refresh token from database if it exists
      if (jwtResponse != null && jwtResponse.getRefreshToken() != null) {
        try {
          tokenRepository.deleteToken(jwtResponse.getRefreshToken());
        } catch (Exception e) {
          LOG.warn("Failed to delete refresh token from database: {}", e.getMessage());
        }
      }

      // Invalidate session
      session.invalidate();
      LOG.debug("Cleared auth session");
    }
  }

  /**
   * Update JWT response in session (for token refresh)
   */
  public void updateJwtResponse(HttpServletRequest request, JwtResponse newJwtResponse) {
    HttpSession session = request.getSession(false);
    if (session != null) {
      // Get old refresh token
      JwtResponse oldJwtResponse = (JwtResponse) session.getAttribute(JWT_RESPONSE_SESSION_KEY);

      // Clean up old refresh token if different
      if (oldJwtResponse != null
          && oldJwtResponse.getRefreshToken() != null
          && !oldJwtResponse.getRefreshToken().equals(newJwtResponse.getRefreshToken())) {
        try {
          tokenRepository.deleteToken(oldJwtResponse.getRefreshToken());
        } catch (Exception e) {
          LOG.warn("Failed to delete old refresh token: {}", e.getMessage());
        }
      }

      // Store new response
      session.setAttribute(JWT_RESPONSE_SESSION_KEY, newJwtResponse);

      // Ensure new refresh token is in database
      if (newJwtResponse.getRefreshToken() != null) {
        Optional<User> userOpt = getAuthenticatedUser(request);
        if (userOpt.isPresent()) {
          try {
            RefreshToken refreshToken =
                TokenUtil.getRefreshToken(
                    userOpt.get().getId(), UUID.fromString(newJwtResponse.getRefreshToken()));
            tokenRepository.insertToken(refreshToken);
          } catch (Exception e) {
            LOG.warn("Failed to store new refresh token: {}", e.getMessage());
          }
        }
      }

      LOG.debug("Updated JWT response in session");
    }
  }

  /**
   * Check if user is authenticated in this session
   */
  public boolean isAuthenticated(HttpServletRequest request) {
    return getAuthenticatedUser(request).isPresent() && getJwtResponse(request).isPresent();
  }
}
