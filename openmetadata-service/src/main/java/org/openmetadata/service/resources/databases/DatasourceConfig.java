package org.openmetadata.service.resources.databases;

import lombok.Getter;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

public class DatasourceConfig {
  private static DatasourceConfig instance;
  private static volatile boolean initialized = false;
  @Getter private static ConnectionType connectionType;

  public static void initialize(String driverClass) {
    if (!initialized) {
      instance = new DatasourceConfig();
      connectionType = ConnectionType.from(driverClass);
      initialized = true;
    }
  }

  public static DatasourceConfig getInstance() {
    return instance;
  }

  public Boolean isMySQL() {
    return ConnectionType.MYSQL.equals(connectionType);
  }
}
