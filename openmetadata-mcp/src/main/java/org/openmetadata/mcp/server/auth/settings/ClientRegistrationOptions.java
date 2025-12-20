package org.openmetadata.mcp.server.auth.settings;

import java.util.List;

/**
 * Options for client registration.
 */
public class ClientRegistrationOptions {

  private boolean enabled = true;

  private boolean allowLocalhostRedirect;

  private List<String> validScopes;

  /**
   * Check if client registration is enabled.
   * @return true if client registration is enabled, false otherwise
   */
  public boolean isEnabled() {
    return enabled;
  }

  /**
   * Set whether client registration is enabled.
   * @param enabled true to enable client registration, false to disable
   */
  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }

  /**
   * Gets whether localhost redirects are allowed.
   * @return true if localhost redirects are allowed, false otherwise
   */
  public boolean isAllowLocalhostRedirect() {
    return allowLocalhostRedirect;
  }

  /**
   * Sets whether localhost redirects are allowed.
   * @param allowLocalhostRedirect true to allow localhost redirects, false otherwise
   */
  public void setAllowLocalhostRedirect(boolean allowLocalhostRedirect) {
    this.allowLocalhostRedirect = allowLocalhostRedirect;
  }

  /**
   * Gets the valid scopes.
   * @return the valid scopes
   */
  public List<String> getValidScopes() {
    return validScopes;
  }

  /**
   * Sets the valid scopes.
   * @param validScopes the valid scopes
   */
  public void setValidScopes(List<String> validScopes) {
    this.validScopes = validScopes;
  }
}
