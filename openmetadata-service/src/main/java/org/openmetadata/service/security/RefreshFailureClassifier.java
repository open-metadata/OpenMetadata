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

import jakarta.servlet.http.HttpServletResponse;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.util.Set;
import org.openmetadata.sdk.exception.WebServiceException;

/**
 * Maps a failure raised while renewing a session on {@code /auth/refresh} to an HTTP status.
 *
 * <p>A refresh credential that has expired, was rotated away, or was never ours is the server
 * rejecting the caller's credentials — 401. Reporting it as 500 tells the client the failure is
 * transient, so it keeps the dead session and retries forever instead of re-authenticating; the
 * browser only recovers on a full reload. Anything else really is a server fault and stays 500.
 *
 * <p>Classification is by the status the exception already carries rather than by exception type:
 * the refresh path raises two unrelated hierarchies for the same condition — {@link
 * WebServiceException} (via {@code CustomExceptionMessage} for an expired token and {@code
 * EntityNotFoundException} for one that is gone) and {@link WebApplicationException} (via {@code
 * BadRequestException} on the SAML and OIDC paths).
 */
public final class RefreshFailureClassifier {

  /**
   * Statuses that mean the presented refresh credential was refused. 404 is included because a
   * rotated-away token surfaces as "token not found", and 400 because an expired one is raised as a
   * bad request.
   */
  private static final Set<Integer> REJECTED_CREDENTIAL_STATUSES =
      Set.of(
          Response.Status.BAD_REQUEST.getStatusCode(),
          Response.Status.UNAUTHORIZED.getStatusCode(),
          Response.Status.NOT_FOUND.getStatusCode());

  /**
   * Sent instead of the underlying message, which embeds the refresh token's UUID (see {@code
   * "Expired token. Please login again : " + token}) and must not reach the client.
   */
  public static final String REJECTED_CREDENTIAL_MESSAGE = "Session expired. Please login again.";

  private RefreshFailureClassifier() {}

  public static int statusFor(Throwable failure) {
    int status = HttpServletResponse.SC_INTERNAL_SERVER_ERROR;
    if (isCredentialRejected(failure)) {
      status = HttpServletResponse.SC_UNAUTHORIZED;
    }
    return status;
  }

  public static String messageFor(Throwable failure) {
    String message = failure.getMessage();
    if (isCredentialRejected(failure)) {
      message = REJECTED_CREDENTIAL_MESSAGE;
    }
    return message;
  }

  public static boolean isCredentialRejected(Throwable failure) {
    boolean rejected = false;
    if (failure instanceof WebServiceException webServiceException) {
      rejected = isRejectedStatus(webServiceException.getResponse().getStatus());
    } else if (failure instanceof WebApplicationException webApplicationException) {
      rejected = isRejectedStatus(webApplicationException.getResponse().getStatus());
    }
    return rejected;
  }

  private static boolean isRejectedStatus(int status) {
    return REJECTED_CREDENTIAL_STATUSES.contains(status);
  }
}
