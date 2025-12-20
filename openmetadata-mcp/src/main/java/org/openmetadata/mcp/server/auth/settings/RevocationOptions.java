package org.openmetadata.mcp.server.auth.settings;

/**
 * Options for OAuth token revocation.
 */
public class RevocationOptions {

  private boolean enabled = true;

  /**
   * Check if token revocation is enabled.
   * @return true if token revocation is enabled, false otherwise
   */
  public boolean isEnabled() {
    return enabled;
  }

  /**
   * Set whether token revocation is enabled.
   * @param enabled true to enable token revocation, false to disable
   */
  public void setEnabled(boolean enabled) {
    this.enabled = enabled;
  }
}
