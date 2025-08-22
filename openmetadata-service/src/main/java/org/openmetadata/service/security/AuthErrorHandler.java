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

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.exception.AuthenticationException;

/**
 * Standardized error handler for authentication/authorization errors
 * Ensures consistent error responses across all auth mechanisms
 */
@Slf4j
public class AuthErrorHandler {

  private AuthErrorHandler() {
    // Utility class
  }

  /**
   * Handle authentication errors with standardized response using redirection
   */
  public static void handleAuthError(
      HttpServletResponse response, Exception error, String authType) {

    String errorCode = "AUTH_ERROR";
    String errorMessage = "Authentication failed";

    // Determine error type
    if (error instanceof AuthenticationException) {
      errorCode = "AUTHENTICATION_FAILED";
      errorMessage = error.getMessage();
    } else if (error instanceof AuthorizationException) {
      errorCode = "AUTHORIZATION_FAILED";
      errorMessage = error.getMessage();
    } else if (error instanceof IllegalArgumentException) {
      errorCode = "INVALID_REQUEST";
      errorMessage = error.getMessage();
    }

    // Log the error with context
    LOG.error("Authentication error for auth type: {} - {}", authType, errorMessage, error);

    // Redirect to callback or signin page with error parameters
    try {
      String errorRedirectUrl =
          "/callback?error="
              + errorCode
              + "&error_description="
              + java.net.URLEncoder.encode(errorMessage, "UTF-8");
      response.sendRedirect(errorRedirectUrl);
    } catch (IOException e) {
      LOG.error("Failed to redirect with error", e);
      // Fallback to status code if redirect fails
      response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
    }
  }

  //  /**
  //   * Handle successful authentication with standardized response
  //   */
  //  public static void handleAuthSuccess(
  //      HttpServletResponse response, String message, Map<String, Object> additionalData) {
  //
  //    Map<String, Object> successResponse = new HashMap<>();
  //    successResponse.put("status", "success");
  //    successResponse.put("message", message);
  //    successResponse.put("timestamp", Instant.now().toString());
  //
  //    if (additionalData != null) {
  //      successResponse.putAll(additionalData);
  //    }
  //
  //    response.setStatus(HttpServletResponse.SC_OK);
  //    response.setContentType("application/json");
  //
  //    try {
  //      writeJsonResponse(response, JsonUtils.pojoToJson(successResponse));
  //    } catch (Exception e) {
  //      LOG.error("Failed to write success response", e);
  //    }
  //  }
}
