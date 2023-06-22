package org.openmetadata.service.resources.databases;

import io.dropwizard.db.DataSourceFactory;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

public class DatasourceConfig {
  private static DatasourceConfig INSTANCE;
  private static volatile boolean INITIALIZED = false;
  private static DataSourceFactory dataSourceFactory;

  public static void initialize(OpenMetadataApplicationConfig config) {
    if (!INITIALIZED) {
      INSTANCE = new DatasourceConfig();
      dataSourceFactory = config.getDataSourceFactory();
      INITIALIZED = true;
    }
  }

  public static DatasourceConfig getInstance() {
    return INSTANCE;
  }

  public Boolean isMySQL() {
    return ConnectionType.MYSQL.label.equals(dataSourceFactory.getDriverClass());
  }

  public ConnectionType getDatabaseConnectionType() {
    if (ConnectionType.MYSQL.label.equals(dataSourceFactory.getDriverClass())) {
      return ConnectionType.MYSQL;
    } else {
      // Currently Mysql and Postgres are only supported hence not added a label check for now for Postgres it's either
      // this or that
      return ConnectionType.POSTGRES;
    }
  }
}
