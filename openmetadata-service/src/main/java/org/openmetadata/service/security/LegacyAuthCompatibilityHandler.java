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
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;

/**
 * Provides backward compatibility for legacy authentication endpoints
 * Routes legacy endpoints to new unified handlers while maintaining old behavior
 */
@Slf4j
public class LegacyAuthCompatibilityHandler {

  private LegacyAuthCompatibilityHandler() {
    // Utility class
  }

  /**
   * Handle legacy /api/v1/users/login endpoint
   * Routes to unified auth handler based on configuration
   */
  public static void handleLegacyBasicLogin(HttpServletRequest req, HttpServletResponse resp) {
    LOG.warn("Legacy endpoint /api/v1/users/login called. Please migrate to /api/v1/auth/login");

    // Get the appropriate handler and delegate
    AuthServeletHandler handler = AuthServeletHandlerRegistry.getHandler();
    if (handler instanceof BasicAuthHandler) {
      handler.handleLogin(req, resp);
    } else {
      // For non-basic auth, return error
      AuthErrorHandler.handleAuthError(
          resp,
          new IllegalStateException("This endpoint is only available for Basic authentication"),
          "LEGACY");
    }
  }

  /**
   * Handle legacy /api/v1/users/refresh endpoint
   */
  public static void handleLegacyBasicRefresh(HttpServletRequest req, HttpServletResponse resp) {
    LOG.warn(
        "Legacy endpoint /api/v1/users/refresh called. Please migrate to /api/v1/auth/refresh");

    AuthServeletHandler handler = AuthServeletHandlerRegistry.getHandler();
    if (handler instanceof BasicAuthHandler) {
      handler.handleRefresh(req, resp);
    } else {
      AuthErrorHandler.handleAuthError(
          resp,
          new IllegalStateException("This endpoint is only available for Basic authentication"),
          "LEGACY");
    }
  }

  /**
   * Handle legacy /api/v1/users/logout endpoint
   */
  public static void handleLegacyBasicLogout(HttpServletRequest req, HttpServletResponse resp) {
    LOG.warn("Legacy endpoint /api/v1/users/logout called. Please migrate to /api/v1/auth/logout");

    AuthServeletHandler handler = AuthServeletHandlerRegistry.getHandler();
    handler.handleLogout(req, resp);
  }

  /**
   * Handle legacy /api/v1/saml/login endpoint
   */
  public static void handleLegacySamlLogin(HttpServletRequest req, HttpServletResponse resp) {
    LOG.warn("Legacy endpoint /api/v1/saml/login called. Please migrate to /api/v1/auth/login");

    AuthServeletHandler handler = AuthServeletHandlerRegistry.getHandler();
    if (handler instanceof SamlAuthHandler) {
      handler.handleLogin(req, resp);
    } else {
      AuthErrorHandler.handleAuthError(
          resp,
          new IllegalStateException("This endpoint is only available for SAML authentication"),
          "LEGACY");
    }
  }

  /**
   * Handle legacy /api/v1/saml/acs endpoint
   */
  public static void handleLegacySamlAcs(HttpServletRequest req, HttpServletResponse resp) {
    LOG.warn("Legacy endpoint /api/v1/saml/acs called. Please migrate to /api/v1/auth/callback");

    AuthServeletHandler handler = AuthServeletHandlerRegistry.getHandler();
    if (handler instanceof SamlAuthHandler) {
      handler.handleCallback(req, resp);
    } else {
      AuthErrorHandler.handleAuthError(
          resp,
          new IllegalStateException("This endpoint is only available for SAML authentication"),
          "LEGACY");
    }
  }

  /**
   * Handle legacy /api/v1/saml/refresh endpoint
   */
  public static void handleLegacySamlRefresh(HttpServletRequest req, HttpServletResponse resp) {
    LOG.warn("Legacy endpoint /api/v1/saml/refresh called. Please migrate to /api/v1/auth/refresh");

    AuthServeletHandler handler = AuthServeletHandlerRegistry.getHandler();
    if (handler instanceof SamlAuthHandler) {
      handler.handleRefresh(req, resp);
    } else {
      AuthErrorHandler.handleAuthError(
          resp,
          new IllegalStateException("This endpoint is only available for SAML authentication"),
          "LEGACY");
    }
  }
}
