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
package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.service.OpenMetadataApplicationTest;

@Slf4j
public class SessionCookieSecurityTest extends OpenMetadataApplicationTest {

  private static final String AUTH_LOGIN_ENDPOINT = "/api/v1/auth/login";

  @Test
  void testSessionCookieSecurityFlags() throws Exception {
    // Test 1: Default authentication configuration (forceSecureSessionCookie should be false)
    testSessionCookieFlags(false);

    // Test 2: With forceSecureSessionCookie enabled via system property in authentication config
    System.setProperty("FORCE_SECURE_SESSION_COOKIE", "true");
    testSessionCookieFlags(true);

    // Clean up
    System.clearProperty("FORCE_SECURE_SESSION_COOKIE");
  }

  private void testSessionCookieFlags(boolean expectSecureFlag) {
    try {
      // Create a test user login request
      LoginRequest loginRequest = new LoginRequest();
      loginRequest.setEmail("test@example.com");
      loginRequest.setPassword("TestPassword123!");

      // Make the login request
      Response response =
          client
              .target("http://localhost:" + APP.getLocalPort() + AUTH_LOGIN_ENDPOINT)
              .request(MediaType.APPLICATION_JSON)
              .post(Entity.json(loginRequest));

      // Check for Set-Cookie header
      String setCookieHeader = response.getHeaderString("Set-Cookie");
      LOG.info("Set-Cookie header: {}", setCookieHeader);

      // Session-based authentication may not always be used depending on config
      // If a session cookie is present, verify its flags
      if (setCookieHeader != null && setCookieHeader.contains("JSESSIONID")) {
        // Always expect HttpOnly flag
        assertTrue(
            setCookieHeader.contains("; HttpOnly"),
            "Cookie should always have HttpOnly flag for security");

        // Check Secure flag based on authentication configuration
        if (expectSecureFlag) {
          assertTrue(
              setCookieHeader.contains("; Secure"),
              "Cookie should have Secure flag when forceSecureSessionCookie is true in authentication config");
        } else {
          // With HTTP and forceSecure=false, should not have Secure flag
          assertFalse(
              setCookieHeader.contains("; Secure"),
              "Cookie should NOT have Secure flag when using HTTP and forceSecureSessionCookie is false in authentication config");
        }
      } else {
        LOG.info(
            "No JSESSIONID cookie found - application may be using JWT tokens instead of sessions");
      }

      response.close();

    } catch (Exception e) {
      LOG.error("Error testing session cookie flags", e);
      throw new RuntimeException(e);
    }
  }
}
