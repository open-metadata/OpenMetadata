package org.openmetadata.schema.utils;

public final class EntityInterfaceUtil {
  /** Adds quotes to name as required */
  public static String quoteName(String name) {
    if (name != null && !name.contains("\"")) {
      return name.contains(".") ? "\"" + name + "\"" : name;
    }
    return name;
  }
}
