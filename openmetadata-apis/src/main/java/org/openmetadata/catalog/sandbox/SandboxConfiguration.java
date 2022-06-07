package org.openmetadata.catalog.sandbox;

public class SandboxConfiguration {
  private boolean isSandboxModeEnabled;

  public boolean isSandboxModeEnabled() {
    return isSandboxModeEnabled;
  }

  public void setSandboxModeEnabled(boolean sandboxModeEnabled) {
    isSandboxModeEnabled = sandboxModeEnabled;
  }
}
