package org.openmetadata.schema.utils;

public final class EntityInterfaceUtil {
  /** Adds quotes to name as required */
  // TODO change this FullyQualifiedName
  public static String quoteName(String name) {
    if (name != null && !name.contains("\"")) {
      return name.contains(".") ? "\"" + name + "\"" : name;
    }
    return name;
  }

  /** Inverse of {@link #quoteName(String)}: strips a single enclosing pair of quotes if present. */
  public static String unquoteName(String name) {
    if (name != null && name.length() > 1 && name.startsWith("\"") && name.endsWith("\"")) {
      return name.substring(1, name.length() - 1);
    }
    return name;
  }
}
