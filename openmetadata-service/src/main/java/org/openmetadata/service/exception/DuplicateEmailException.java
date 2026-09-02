package org.openmetadata.service.exception;

import jakarta.ws.rs.core.Response;
import org.openmetadata.sdk.exception.WebServiceException;

/**
 * Thrown when a single email address resolves to more than one user account.
 *
 * <p>Reachable on PostgreSQL, whose unique constraint on {@code user_entity.email} is
 * case-sensitive while identity lookups compare {@code LOWER(email)}. Returning either account
 * would be a non-deterministic identity, so callers get this conflict instead and an administrator
 * merges or renames the duplicates. Authentication paths translate it into an authentication
 * failure; everything else surfaces it as a 409 data-integrity error.
 */
public class DuplicateEmailException extends WebServiceException {

  private static final String ERROR_TYPE = "DUPLICATE_EMAIL";

  public DuplicateEmailException(String message) {
    super(Response.Status.CONFLICT, ERROR_TYPE, message);
  }

  public static DuplicateEmailException byEmail(String email, int matches) {
    return new DuplicateEmailException(
        String.format(
            "Email '%s' matches %d user accounts differing only by case. "
                + "Ask an administrator to merge or rename the duplicates.",
            email, matches));
  }
}
