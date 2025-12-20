package org.openmetadata.mcp.server.auth.middleware;

/**
 * Interface for transports that support authentication context.
 */
public interface AuthContextProvider {

  /**
   * Gets the authentication context.
   * @return The authentication context, or null if not authenticated
   */
  AuthContext getAuthContext();

  /**
   * Sets the authentication context.
   * @param authContext The authentication context
   */
  void setAuthContext(AuthContext authContext);
}
