package org.openmetadata.service.resources.databases;

import io.dropwizard.db.DataSourceFactory;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

public class DatasourceConfig {
  private static DatasourceConfig instance;
  private static volatile boolean initialized = false;
  private static DataSourceFactory dataSourceFactory;

  public static void initialize(OpenMetadataApplicationConfig config) {
    if (!initialized) {
      instance = new DatasourceConfig();
      dataSourceFactory = config.getDataSourceFactory();
      initialized = true;
    }
  }

  public static DatasourceConfig getInstance() {
    return instance;
  }

  public Boolean isMySQL() {
    return ConnectionType.MYSQL.label.equals(dataSourceFactory.getDriverClass());
  }
}
