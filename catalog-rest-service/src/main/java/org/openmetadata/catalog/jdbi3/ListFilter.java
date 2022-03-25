package org.openmetadata.catalog.jdbi3;

import java.util.HashMap;
import java.util.Map;
import org.openmetadata.catalog.Entity;

public class ListFilter {
  Map<String, String> queryParams = new HashMap<>();

  public ListFilter addQueryParam(String name, String value) {
    queryParams.put(name, value);
    return this;
  }

  public String getQueryParam(String name) {
    return queryParams.get(name);
  }

  public String getCondition() {
    return getCondition(null);
  }

  public String getCondition(String tableName) {
    String condition = getIncludeCondition(tableName);
    condition = addCondition(condition, getDatabaseCondition(tableName));
    condition = addCondition(condition, getServiceCondition(tableName));
    condition = addCondition(condition, getParentCondition(tableName));
    return condition.isEmpty() ? "WHERE true" : "WHERE " + condition;
  }

  public String getIncludeCondition(String tableName) {
    String include = queryParams.get("include");
    String columnName = tableName == null ? "deleted" : tableName + ".deleted";
    if (include == null || include.equals("non-deleted")) {
      return columnName + " = false";
    }
    if (include.equals("deleted")) {
      return columnName + " = true";
    }
    return "";
  }

  public String getDatabaseCondition(String tableName) {
    String database = queryParams.get("database");
    return database == null ? "" : getFqnPrefixCondition(tableName, database);
  }

  public String getServiceCondition(String tableName) {
    String service = queryParams.get("service");
    return service == null ? "" : getFqnPrefixCondition(tableName, service);
  }

  public String getParentCondition(String tableName) {
    String parentFqn = queryParams.get("parent");
    return parentFqn == null ? "" : getFqnPrefixCondition(tableName, parentFqn);
  }

  private String getFqnPrefixCondition(String tableName, String fqnPrefix) {
    return tableName == null
        ? String.format("fullyQualifiedName LIKE '%s%s%%'", fqnPrefix, Entity.SEPARATOR)
        : String.format("%s.fullyQualifiedName LIKE '%s%s%%'", tableName, fqnPrefix, Entity.SEPARATOR);
  }

  private String addCondition(String condition1, String condition2) {
    if (condition1.isEmpty()) {
      return condition2;
    }
    if (condition2.isEmpty()) {
      return condition1;
    }
    return condition1 + " AND " + condition2;
  }
}
