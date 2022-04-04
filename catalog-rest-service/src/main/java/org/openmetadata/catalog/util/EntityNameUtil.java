package org.openmetadata.catalog.util;

import org.openmetadata.catalog.Entity;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class EntityNameUtil {
  // Match the sub parts of fqn string "sss". or sss. or sss$
  private static final Pattern partsPattern = Pattern.compile("(\")([^\"]+)(\")|([^.]+)([.$])?");

  // Quoted name of format "sss" or sss
  private static final Pattern namePattern = Pattern.compile("(\")([^\"]+)(\")|(.*)$");

  private EntityNameUtil() {
    /* Util class with static methods */
  }

  public static String addToFQN(String fqn, String name) {
    return fqn + Entity.SEPARATOR + quoteName(name);
  }

  public static String getFQN(String... strings) {
    List<String> list = new ArrayList<>();
    for (String string : strings) {
      if (string.contains(".")) {
        string = String.format("\"%s\"", string);
      }
      list.add(string);
    }
    return String.join(Entity.SEPARATOR, list);
  }

  public static String[] splitFQN(String string) {
    List<String> list = new ArrayList<>();
    Matcher matcher = partsPattern.matcher(string);
    while (matcher.find()) {
      if (matcher.group(1) != null) {
        list.add(matcher.group(2));
      } else {
        list.add(matcher.group(4));
      }
    }
    return list.toArray(new String[list.size()]);
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

  /** Adds quotes to name as required */
  public static String quoteName(String name) {
    Matcher matcher = namePattern.matcher(name);
    if (matcher.find()) {
      if (matcher.end() != name.length()) {
        throw new IllegalArgumentException("Invalid name " + name); // Partial match
      }
      // Name is already quoted. Return unquoted name if "." does not exist in the name
      if (matcher.group(1) != null) {
        String unquotedName = matcher.group(2);
        return unquotedName.contains(".") ? name : unquotedName;
        // Name is not quoted. Return quoted name if "." does not exist in the name
      } else {
        String unquotedName = matcher.group(4);
        if (!unquotedName.contains("\"")) {
          return unquotedName.contains(".") ? "\"" + name + "\"" : unquotedName;
        }
      }
    }
    throw new IllegalArgumentException("Invalid name " + name);
  }
}
