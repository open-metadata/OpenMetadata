package org.openmetadata.service;

import org.openmetadata.api.configuration.ChangeEventConfiguration;

public class ChangeEventConfig {
  private static ChangeEventConfiguration instance;
  private static volatile boolean initialized = false;

  private ChangeEventConfig() {
    /* Hide constructor for singleton */
  }

  public static void initialize(OpenMetadataApplicationConfig config) {
    if (!initialized) {
      instance = config.getChangeEventConfiguration();
      initialized = true;
    }
  }

  public static ChangeEventConfiguration getInstance() {
    return instance;
  }
}
