package org.openmetada.restclient.model;

public class SandboxConfiguration {
  private boolean isSandboxModeEnabled;

  public boolean isSandboxModeEnabled() {
    return isSandboxModeEnabled;
  }

  public void setSandboxModeEnabled(boolean sandboxModeEnabled) {
    isSandboxModeEnabled = sandboxModeEnabled;
  }
}
