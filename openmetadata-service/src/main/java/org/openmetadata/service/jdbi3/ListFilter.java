package org.openmetadata.service.jdbi3;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import org.openmetadata.schema.type.Include;
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
    return database == null ? "" : getFqnPrefixCondition(tableName, escape(database));
  }

  public String getServiceCondition(String tableName) {
    String service = queryParams.get("service");
    return service == null ? "" : getFqnPrefixCondition(tableName, escape(service));
  }

  public String getParentCondition(String tableName) {
    String parentFqn = queryParams.get("parent");
    return parentFqn == null ? "" : getFqnPrefixCondition(tableName, escape(parentFqn));
  }

  public String getCategoryCondition(String tableName) {
    String category = queryParams.get("category");
    return category == null ? "" : getCategoryPrefixCondition(tableName, escape(category));
  }

  public String getWebhookCondition(String tableName) {
    String webhookStatus = queryParams.get("status");
    return webhookStatus == null ? "" : getStatusPrefixCondition(tableName, escape(webhookStatus));
  }

  public String getWebhookTypeCondition(String tableName) {
    String webhookType = queryParams.get("webhookType");
    return webhookType == null ? "" : getWebhookTypePrefixCondition(tableName, escape(webhookType));
  }

  private String getFqnPrefixCondition(String tableName, String fqnPrefix) {
    if (fqnPrefix.contains("_") || fqnPrefix.contains("-")) {
      fqnPrefix = format(fqnPrefix);
    }
    return tableName == null
        ? String.format("fullyQualifiedName LIKE '%s%s%%'", fqnPrefix, Entity.SEPARATOR)
        : String.format("%s.fullyQualifiedName LIKE '%s%s%%'", tableName, fqnPrefix, Entity.SEPARATOR);
  }

  private String getWebhookTypePrefixCondition(String tableName, String typePrefix) {
    return tableName == null
        ? String.format("webhookType LIKE '%s%%'", typePrefix)
        : String.format("%s.webhookType LIKE '%s%%'", tableName, typePrefix);
  }

  private String getCategoryPrefixCondition(String tableName, String category) {
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

  private String escape(String name) {
    return name.replace("'", "''");
  }

  private String format(String name) {
    return name.contains("-") ? name.replaceAll("-", "\\\\-") : name.replaceAll("_", "\\\\_");
  }
}
