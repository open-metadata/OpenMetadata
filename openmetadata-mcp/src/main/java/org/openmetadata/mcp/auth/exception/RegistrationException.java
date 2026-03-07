package org.openmetadata.mcp.auth.exception;

/**
 * Exception thrown during client registration.
 */
public class RegistrationException extends Exception {

  private final String error;

  private final String errorDescription;

  public RegistrationException(String error, String errorDescription) {
    super(errorDescription != null ? errorDescription : error);
    this.error = error;
    this.errorDescription = errorDescription;
  }

  public String getError() {
    return error;
  }

  public String getErrorDescription() {
    return errorDescription;
  }
}
