package org.openmetadata.mcp.server.auth.middleware;

import java.util.Collections;
import java.util.List;
import org.openmetadata.mcp.auth.AccessToken;
import org.openmetadata.mcp.server.auth.AuthorizationException;
import org.openmetadata.mcp.server.auth.ScopeValidator;

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
   * Gets the scopes granted to the authenticated user.
   * @return The list of granted scopes, or an empty list if no token is present
   */
  public List<String> getScopes() {
    return accessToken != null && accessToken.getScopes() != null
        ? accessToken.getScopes()
        : Collections.emptyList();
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
   * Checks if the user has at least one of the specified scopes.
   * @param scopes The scopes to check (OR logic).
   * @return True if the user has at least one of the scopes, false otherwise.
   */
  public boolean hasAnyScope(String... scopes) {
    return ScopeValidator.hasAnyScope(getScopes(), scopes);
  }

  /**
   * Checks if the user has all of the specified scopes.
   * @param scopes The scopes to check (AND logic).
   * @return True if the user has all of the scopes, false otherwise.
   */
  public boolean hasAllScopes(String... scopes) {
    return ScopeValidator.hasAllScopes(getScopes(), scopes);
  }

  /**
   * Validates that the user has the required scopes.
   * @param requiredScopes The scopes required for the operation.
   * @param requireAll If true, all scopes must be present; if false, at least one must be present.
   * @throws AuthorizationException if the user does not have the required scopes.
   */
  public void requireScopes(String[] requiredScopes, boolean requireAll) {
    ScopeValidator.validateScopes(getScopes(), requiredScopes, requireAll);
  }

  /**
   * Validates that the user has at least one of the required scopes.
   * @param requiredScopes The scopes required for the operation (OR logic).
   * @throws AuthorizationException if the user does not have any of the required scopes.
   */
  public void requireAnyScope(String... requiredScopes) {
    ScopeValidator.validateScopes(getScopes(), requiredScopes, false);
  }

  /**
   * Validates that the user has all of the required scopes.
   * @param requiredScopes The scopes required for the operation (AND logic).
   * @throws AuthorizationException if the user does not have all of the required scopes.
   */
  public void requireAllScopes(String... requiredScopes) {
    ScopeValidator.validateScopes(getScopes(), requiredScopes, true);
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
