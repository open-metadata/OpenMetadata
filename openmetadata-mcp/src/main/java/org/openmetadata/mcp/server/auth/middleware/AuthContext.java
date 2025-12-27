package org.openmetadata.mcp.server.auth.middleware;

import org.openmetadata.mcp.auth.AccessToken;

/**
 * Holds authentication context for a request.
 */
public class AuthContext {

  private final AccessToken accessToken;

  private static final ThreadLocal<AuthContext> currentContext = new ThreadLocal<>();

  /**
   * Creates a new AuthContext.
   * @param accessToken The authenticated access token.
   */
  public AuthContext(AccessToken accessToken) {
    this.accessToken = accessToken;
  }

  /**
   * Gets the access token.
   * @return The access token.
   */
  public AccessToken getAccessToken() {
    return accessToken;
  }

  /**
   * Gets the client ID.
   * @return The client ID.
   */
  public String getClientId() {
    return accessToken != null ? accessToken.getClientId() : null;
  }

  /**
   * Checks if the user has the specified scope.
   * @param scope The scope to check.
   * @return True if the user has the scope, false otherwise.
   */
  public boolean hasScope(String scope) {
    return accessToken != null && accessToken.getScopes().contains(scope);
  }

  /**
   * Sets the current auth context for this thread.
   * @param authContext The auth context to set
   */
  public static void setCurrent(AuthContext authContext) {
    currentContext.set(authContext);
  }

  /**
   * Gets the current auth context for this thread.
   * @return The current auth context, or null if not set
   */
  public static AuthContext getCurrent() {
    return currentContext.get();
  }

  /**
   * Clears the current auth context for this thread.
   */
  public static void clearCurrent() {
    currentContext.remove();
  }
}
