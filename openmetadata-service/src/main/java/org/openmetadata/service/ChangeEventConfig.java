package org.openmetadata.service;

import org.openmetadata.api.configuration.ChangeEventConfiguration;

public class ChangeEventConfig {

  private static ChangeEventConfiguration INSTANCE;
  private static volatile boolean INITIALIZED = false;

  public static void initialize(OpenMetadataApplicationConfig config) {
    if (!INITIALIZED) {
      INSTANCE = config.getChangeEventConfiguration();
      INITIALIZED = true;
    }
  }

  public static ChangeEventConfiguration getInstance() {
    return INSTANCE;
  }
}
