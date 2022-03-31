package org.openmetadata.catalog.util;

import java.util.regex.Pattern;
import org.openmetadata.catalog.Entity;

public final class EntityNameUtil {
  private EntityNameUtil() {
    /* Util class with static methods */
  }

  public static String getFQN(String... strings) {
    return String.join(Entity.SEPARATOR, strings);
  }

  public static String[] splitFQN(String string) {
    return string.split(Pattern.quote(Entity.SEPARATOR));
  }

  public static String getTableFQN(String columnFQN) {
    // Split columnFQN of format databaseServiceName.databaseName.tableName.columnName
    String[] split = splitFQN(columnFQN);
    if (split.length < 5) {
      throw new IllegalArgumentException("Invalid fully qualified column name " + columnFQN);
    }
    // Return table FQN of format databaseService.tableName
    return getFQN(split[0], split[1], split[2], split[3]);
  }

  public static String getColumnName(String columnFQN) {
    return EntityNameUtil.splitFQN(columnFQN)[4]; // Get from column name from FQN
  }

  public static String getServiceName(String fqn) {
    return EntityNameUtil.splitFQN(fqn)[0];
  }
}
