/*
 *  Copyright 2026 Collate
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

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.exception.CatalogExceptionMessage.PASSWORD_RESET_TOKEN_EXPIRED;

import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.BadRequestException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;

class RefreshFailureClassifierTest {

  private static final UUID REFRESH_TOKEN = UUID.randomUUID();

  @Test
  void testExpiredRefreshTokenIsAnAuthenticationFailure() {
    // LdapAuthenticator/BasicAuthenticator raise this when the stored refresh token is past its
    // expiry. Reported as 500 the browser reads it as transient, keeps the dead session and
    // retries forever; only 401 tells it to re-authenticate.
    CustomExceptionMessage expired =
        new CustomExceptionMessage(
            BAD_REQUEST,
            PASSWORD_RESET_TOKEN_EXPIRED,
            "Expired token. Please login again : " + REFRESH_TOKEN);

    assertTrue(RefreshFailureClassifier.isCredentialRejected(expired));
    assertEquals(HttpServletResponse.SC_UNAUTHORIZED, RefreshFailureClassifier.statusFor(expired));
  }

  @Test
  void testExpiredRefreshTokenMessageDoesNotLeakTheToken() {
    CustomExceptionMessage expired =
        new CustomExceptionMessage(
            BAD_REQUEST,
            PASSWORD_RESET_TOKEN_EXPIRED,
            "Expired token. Please login again : " + REFRESH_TOKEN);

    String message = RefreshFailureClassifier.messageFor(expired);

    assertEquals(RefreshFailureClassifier.REJECTED_CREDENTIAL_MESSAGE, message);
    assertFalse(message.contains(REFRESH_TOKEN.toString()));
  }

  @Test
  void testRotatedAwayRefreshTokenIsAnAuthenticationFailure() {
    // TokenRepository throws this once the token has been rotated out or revoked.
    EntityNotFoundException notFound =
        new EntityNotFoundException("Invalid Request Token. Please check your Token");

    assertEquals(HttpServletResponse.SC_UNAUTHORIZED, RefreshFailureClassifier.statusFor(notFound));
  }

  @Test
  void testEmptyRefreshTokenIsAnAuthenticationFailure() {
    // The SAML and OIDC paths raise the JAX-RS type rather than CustomExceptionMessage, so the
    // classifier has to span both hierarchies.
    BadRequestException emptyToken =
        new BadRequestException("Token Cannot be Null or Empty String");

    assertEquals(
        HttpServletResponse.SC_UNAUTHORIZED, RefreshFailureClassifier.statusFor(emptyToken));
  }

  @Test
  void testServerSideFailureStaysAServerError() {
    // A signing or database failure says nothing about the caller's credentials — telling the
    // client to re-authenticate would sign out a session that is still perfectly valid.
    IllegalStateException signingFailure = new IllegalStateException("Failed to sign JWT");

    assertFalse(RefreshFailureClassifier.isCredentialRejected(signingFailure));
    assertEquals(
        HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
        RefreshFailureClassifier.statusFor(signingFailure));
    assertEquals("Failed to sign JWT", RefreshFailureClassifier.messageFor(signingFailure));
  }

  @Test
  void testConflictFromTheServerStaysAServerError() {
    // Only statuses that mean "your credential was refused" map to 401; a 409 must not.
    CustomExceptionMessage conflict =
        new CustomExceptionMessage(
            HttpServletResponse.SC_CONFLICT, "CONFLICT", "Session already rotated");

    assertEquals(
        HttpServletResponse.SC_INTERNAL_SERVER_ERROR, RefreshFailureClassifier.statusFor(conflict));
  }
}
