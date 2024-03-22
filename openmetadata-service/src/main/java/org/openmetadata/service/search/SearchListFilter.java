package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.Filter;

public class SearchListFilter extends Filter<SearchListFilter> {
  public SearchListFilter() {
    this(Include.NON_DELETED);
  }

  public SearchListFilter(Include include) {
    this.include = include;
  }

  @Override
  public String getCondition(String entityType) {
    ArrayList<String> conditions = new ArrayList<>();
    conditions.add(getIncludeCondition());

    if (entityType != null) {
      conditions.add(entityType.equals(Entity.TEST_CASE) ? getTestCaseCondition() : null);
    }
    return buildQueryFilter(addCondition(conditions));
  }

  @Override
  protected String addCondition(List<String> conditions) {
    StringBuffer condition = new StringBuffer();
    for (String c : conditions) {
      if (!c.isEmpty()) {
        if (!condition.isEmpty()) {
          // Add `,` between conditions
          condition.append(",\n");
        }
        condition.append(c);
      }
    }
    return condition.toString();
  }

  private String getTimestampFilter(String conditionAlias, Long value) {
    return getTimestampFilter("timestamp", conditionAlias, value);
  }

  private String getTimestampFilter(String timestampField, String conditionAlias, Long value) {
    return String.format(
        "{\"range\": {\"%s\": {\"%s\": %d}}}", timestampField, conditionAlias, value);
  }

  private String getIncludeCondition() {
    String deleted = "";
    if (include != Include.ALL) {
      deleted = String.format("{\"term\": {\"deleted\": \"%s\"}}", include == Include.DELETED);
    }
    return deleted;
  }

  private String buildQueryFilter(String condition) {
    String q = queryParams.get("q");
    boolean isQEmpty = nullOrEmpty(q);
    if (!condition.isEmpty()) {
      return String.format("{\"query\": {\"bool\": {\"filter\": [%s]}}}", condition);
    } else if (!isQEmpty) {
      return "";
    } else {
      return "{\"query\": {\"match_all\": {}}}";
    }
  }

  private String getTestCaseCondition() {
    ArrayList<String> conditions = new ArrayList<>();

    String entityFQN = getQueryParam("entityFQN");
    boolean includeAllTests = Boolean.parseBoolean(getQueryParam("includeAllTests"));
    String status = getQueryParam("testCaseStatus");
    String testSuiteId = getQueryParam("testSuiteId");
    String type = getQueryParam("testCaseType");
    String testPlatform = getQueryParam("testPlatform");
    String startTimestamp = getQueryParam("startTimestamp");
    String endTimestamp = getQueryParam("endTimestamp");

    if (entityFQN != null) {
      conditions.add(
          includeAllTests
              ? String.format("{\"regexp\": {\"entityFQN\": \"%s.*\"}}", entityFQN)
              : String.format("{\"term\": {\"entityFQN\": \"%s\"}}", entityFQN));
    }

    if (testSuiteId != null) {
      conditions.add(String.format("{\"term\": {\"testSuite.id\": \"%s\"}}", testSuiteId));
    }

    if (status != null) {
      conditions.add(
          String.format("{\"term\": {\"testCaseResult.testCaseStatus\": \"%s\"}}", status));
    }

    if (type != null) {
      conditions.add(
          switch (type) {
            case "table" -> "{\"bool\": {\"must_not\": [{\"regexp\": {\"entityLink\": \".*::columns::.*\"}}]}}";
            case "column" -> "{\"regexp\": {\"entityLink\": \".*::columns::.*\"}}";
            default -> "";
          });
    }

    if (testPlatform != null) {
      conditions.add(String.format("{\"term\": {\"testPlatforms\": \"%s\"}}", testPlatform));
    }

    if (startTimestamp != null && endTimestamp != null) {
      conditions.add(
          getTimestampFilter("testCaseResult.timestamp", "gte", Long.parseLong(startTimestamp)));
      conditions.add(
          getTimestampFilter("testCaseResult.timestamp", "lte", Long.parseLong(endTimestamp)));
    }

    return addCondition(conditions);
  }
}
