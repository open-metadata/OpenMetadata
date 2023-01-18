package org.openmetadata.service.jdbi3;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;

public class ListFilter {
  @Getter private final Include include;
  private final Map<String, String> queryParams = new HashMap<>();

  public ListFilter() {
    this(Include.NON_DELETED);
  }

  public ListFilter(Include include) {
    this.include = include;
  }

  public ListFilter addQueryParam(String name, String value) {
    queryParams.put(name, value);
    return this;
  }

  public String getQueryParam(String name) {
    return name.equals("include") ? include.value() : queryParams.get(name);
  }

  public String getCondition() {
    return getCondition(null);
  }

  public String getCondition(String tableName) {
    String condition = getIncludeCondition(tableName);
    condition = addCondition(condition, getDatabaseCondition(tableName));
    condition = addCondition(condition, getServiceCondition(tableName));
    condition = addCondition(condition, getParentCondition(tableName));
    condition = addCondition(condition, getCategoryCondition(tableName));
    condition = addCondition(condition, getWebhookCondition(tableName));
    condition = addCondition(condition, getWebhookTypeCondition(tableName));
    condition = addCondition(condition, getTestCaseCondition());
    return condition.isEmpty() ? "WHERE TRUE" : "WHERE " + condition;
  }

  public String getIncludeCondition(String tableName) {
    String columnName = tableName == null ? "deleted" : tableName + ".deleted";
    if (include == Include.NON_DELETED) {
      return columnName + " = FALSE";
    }
    if (include == Include.DELETED) {
      return columnName + " = TRUE";
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

  public String getCategoryCondition(String tableName) {
    String category = queryParams.get("category");
    return category == null ? "" : getCategoryPrefixCondition(tableName, category);
  }

  public String getWebhookCondition(String tableName) {
    String webhookStatus = queryParams.get("status");
    return webhookStatus == null ? "" : getStatusPrefixCondition(tableName, webhookStatus);
  }

  public String getWebhookTypeCondition(String tableName) {
    String webhookType = queryParams.get("webhookType");
    return webhookType == null ? "" : getWebhookTypePrefixCondition(tableName, webhookType);
  }

  private String getTestCaseCondition() {
    String condition1 = "";
    String entityFQN = getQueryParam("entityFQN");
    boolean includeAllTests = Boolean.parseBoolean(getQueryParam("includeAllTests"));
    if (entityFQN != null) {
      condition1 =
          includeAllTests
              ? String.format(
                  "entityFQN LIKE '%s%s%%' OR entityFQN = '%s'",
                  escape(entityFQN), Entity.SEPARATOR, escapeApostrophe(entityFQN))
              : String.format("entityFQN = '%s'", escapeApostrophe(entityFQN));
    }

    String condition2 = "";
    String testSuiteId = getQueryParam("testSuiteId");
    if (testSuiteId != null) {
      condition2 =
          String.format(
              "id IN (SELECT toId FROM entity_relationship WHERE fromId='%s' AND toEntity='%s' AND relation=%d AND fromEntity='%s')",
              testSuiteId, Entity.TEST_CASE, Relationship.CONTAINS.ordinal(), Entity.TEST_SUITE);
    }
    return addCondition(condition1, condition2);
  }

  private String getFqnPrefixCondition(String tableName, String fqnPrefix) {
    fqnPrefix = escape(fqnPrefix);
    return tableName == null
        ? String.format("fullyQualifiedName LIKE '%s%s%%'", fqnPrefix, Entity.SEPARATOR)
        : String.format("%s.fullyQualifiedName LIKE '%s%s%%'", tableName, fqnPrefix, Entity.SEPARATOR);
  }

  private String getWebhookTypePrefixCondition(String tableName, String typePrefix) {
    typePrefix = escape(typePrefix);
    return tableName == null
        ? String.format("webhookType LIKE '%s%%'", typePrefix)
        : String.format("%s.webhookType LIKE '%s%%'", tableName, typePrefix);
  }

  private String getCategoryPrefixCondition(String tableName, String category) {
    category = escape(category);
    return tableName == null
        ? String.format("category LIKE '%s%s%%'", category, "")
        : String.format("%s.category LIKE '%s%s%%'", tableName, category, "");
  }

  private String getStatusPrefixCondition(String tableName, String statusPrefix) {
    if (!statusPrefix.isEmpty()) {
      List<String> statusList = new ArrayList<>(Arrays.asList(statusPrefix.split(",")));
      List<String> condition = new ArrayList<>();
      for (String s : statusList) {
        String format = "\"" + s + "\"";
        condition.add(format);
      }
      return "status in (" + String.join(",", condition) + ")";
    }
    return tableName == null
        ? String.format("status LIKE '%s%s%%'", statusPrefix, "")
        : String.format("%s.status LIKE '%s%s%%'", tableName, statusPrefix, "");
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

  public static String escapeApostrophe(String name) {
    // Escape string to be using in LIKE clause
    // "'" is used for indicated start and end of the string. Use "''" to escape it.
    // "_" is a wildcard and looks for any single character. Add "\\" in front of it to escape it
    return name.replace("'", "''");
  }

  public static String escape(String name) {
    // Escape string to be using in LIKE clause
    // "'" is used for indicated start and end of the string. Use "''" to escape it.
    name = escapeApostrophe(name);
    // "_" is a wildcard and looks for any single character. Add "\\" in front of it to escape it
    return name.replaceAll("_", "\\\\_");
  }
}
