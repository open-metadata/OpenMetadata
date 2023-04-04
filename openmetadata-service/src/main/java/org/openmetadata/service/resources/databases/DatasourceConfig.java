package org.openmetadata.service.resources.databases;

import io.dropwizard.db.DataSourceFactory;
import org.openmetadata.service.OpenMetadataApplicationConfig;

public class DatasourceConfig {
  private static DataSourceFactory INSTANCE;
  private static volatile boolean INITIALIZED = false;

  public static void initialize(OpenMetadataApplicationConfig config) {
    if (!INITIALIZED) {
      INSTANCE = config.getDataSourceFactory();
      INITIALIZED = true;
    }
  }

  public static DataSourceFactory getInstance() {
    return INSTANCE;
  }
}
