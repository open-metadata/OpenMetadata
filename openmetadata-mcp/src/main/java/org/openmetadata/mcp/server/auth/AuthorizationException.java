package org.openmetadata.mcp.server.auth;

import java.util.List;

/**
 * Exception thrown when a user lacks the required scopes to perform an operation.
 *
 * <p>This exception is thrown during scope validation when the authenticated user's access token
 * does not contain the necessary scopes to execute a particular MCP tool or operation.
 */
public class AuthorizationException extends RuntimeException {

  private final List<String> requiredScopes;
  private final List<String> grantedScopes;

  /**
   * Constructs a new authorization exception with the specified message.
   *
   * @param message the detail message
   */
  public AuthorizationException(String message) {
    super(message);
    this.requiredScopes = null;
    this.grantedScopes = null;
  }

  /**
   * Constructs a new authorization exception with the specified message and cause.
   *
   * @param message the detail message
   * @param cause the cause
   */
  public AuthorizationException(String message, Throwable cause) {
    super(message, cause);
    this.requiredScopes = null;
    this.grantedScopes = null;
  }

  /**
   * Constructs a new authorization exception with required and granted scopes.
   *
   * @param message the detail message
   * @param requiredScopes the scopes required for the operation
   * @param grantedScopes the scopes granted to the user
   */
  public AuthorizationException(
      String message, List<String> requiredScopes, List<String> grantedScopes) {
    super(message);
    this.requiredScopes = requiredScopes;
    this.grantedScopes = grantedScopes;
  }

  /**
   * Gets the scopes required for the operation.
   *
   * @return the required scopes, or null if not specified
   */
  public List<String> getRequiredScopes() {
    return requiredScopes;
  }

  /**
   * Gets the scopes granted to the user.
   *
   * @return the granted scopes, or null if not specified
   */
  public List<String> getGrantedScopes() {
    return grantedScopes;
  }
}
