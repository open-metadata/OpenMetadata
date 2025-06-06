package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
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

  static final String SEARCH_LIST_FILTER_EXCLUDE = "fqnParts,entityType,suggest";

  @Override
  public String getCondition(String entityType) {
    ArrayList<String> conditions = new ArrayList<>();
    conditions.add(getIncludeCondition(entityType));
    conditions.add(getDomainCondition());
    conditions.add(getOwnerCondition());
    conditions.add(getCreatedByCondition());

    if (entityType != null) {
      conditions.add(entityType.equals(Entity.TEST_CASE) ? getTestCaseCondition() : null);
      conditions.add(entityType.equals(Entity.TEST_SUITE) ? getTestSuiteCondition() : null);
      conditions.add(
          entityType.equals(Entity.TEST_CASE_RESULT) ? getTestCaseResultCondition() : null);
    }
    String conditionFilter = addCondition(conditions);
    String sourceFilter = getExcludeIncludeFields();
    return buildQueryFilter(conditionFilter, sourceFilter);
  }

  @Override
  protected String addCondition(List<String> conditions) {
    StringBuffer condition = new StringBuffer();
    for (String c : conditions) {
      if (!nullOrEmpty(c)) {
        if (!nullOrEmpty(condition)) {
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

  private String getExcludeIncludeFields() {
    ArrayList<String> conditions = new ArrayList<>();
    StringBuffer excludeCondition = new StringBuffer();
    excludeCondition.append(SEARCH_LIST_FILTER_EXCLUDE);

    String excludeFields = queryParams.get("excludeFields");
    String includeFields = queryParams.get("includeFields");

    if (!nullOrEmpty(excludeCondition)) {
      if (!nullOrEmpty(excludeFields)) {
        excludeCondition.append(",").append(excludeFields);
      }
      String[] excludes = excludeCondition.toString().split(",");
      String excludesStr = Arrays.stream(excludes).collect(Collectors.joining("\",\"", "\"", "\""));

      conditions.add(String.format("\"exclude\": [%s]", excludesStr));
    }
    if (!nullOrEmpty(includeFields)) {
      String[] includes = includeFields.split(",");
      String includesStr = Arrays.stream(includes).collect(Collectors.joining("\",\"", "\"", "\""));
      conditions.add(String.format("\"include\": [%s]", includesStr));
    }

    return String.format("\"_source\": {%s}", addCondition(conditions));
  }

  private String getDomainCondition() {
    String domain = getQueryParam("domain");
    if (!nullOrEmpty(domain)) {
      return String.format(
          "{\"term\": {\"domain.fullyQualifiedName\": \"%s\"}}", escapeDoubleQuotes(domain));
    }
    return "";
  }

  private String getIncludeCondition(String entityType) {
    boolean supportsDeleted = true;
    if (entityType != null) {
      Class<?> clazz = Entity.getEntityClassFromType(entityType);
      if (clazz == null) clazz = Entity.getEntityTimeSeriesClassFromType(entityType);
      supportsDeleted = (clazz != null) && Entity.getEntityFields(clazz).contains("deleted");
    }
    String deleted = "";
    if (include != Include.ALL && supportsDeleted) {
      deleted = String.format("{\"term\": {\"deleted\": \"%s\"}}", include == Include.DELETED);
    }
    return deleted;
  }

  private String getOwnerCondition() {
    String owners = getQueryParam("owners");
    if (!nullOrEmpty(owners)) {
      String ownersList =
          Arrays.stream(owners.split(",")).collect(Collectors.joining("\", \"", "\"", "\""));
      return String.format("{\"terms\": {\"owners.id\": [%s]}}", ownersList);
    }
    return "";
  }

  private String getCreatedByCondition() {
    String createdBy = getQueryParam("createdBy");
    if (!nullOrEmpty(createdBy)) {
      return String.format("{\"term\": {\"createdBy\": \"%s\"}}", escapeDoubleQuotes(createdBy));
    }
    return "";
  }

  private String buildQueryFilter(String conditionFilter, String sourceFilter) {
    String q = queryParams.get("q");
    boolean isQEmpty = nullOrEmpty(q);
    if (!conditionFilter.isEmpty()) {
      return String.format(
          "{%s,\"query\": {\"bool\": {\"filter\": [%s]}}}", sourceFilter, conditionFilter);
    } else if (!isQEmpty) {
      return String.format("{%s}", sourceFilter);
    } else {
      return String.format("{%s,\"query\": {\"match_all\": {}}}", sourceFilter);
    }
  }

  private String getTestCaseCondition() {
    ArrayList<String> conditions = new ArrayList<>();

    String entityFQN = getQueryParam("entityFQN");
    boolean includeAllTests = Boolean.parseBoolean(getQueryParam("includeAllTests"));
    String status = getQueryParam("testCaseStatus");
    String testSuiteId = getQueryParam("testSuiteId");
    String type = getQueryParam("testCaseType");
    String testPlatform = getQueryParam("testPlatforms");
    String startTimestamp = getQueryParam("startTimestamp");
    String endTimestamp = getQueryParam("endTimestamp");
    String tags = getQueryParam("tags");
    String tier = getQueryParam("tier");
    String serviceName = getQueryParam("serviceName");
    String dataQualityDimension = getQueryParam("dataQualityDimension");

    if (tags != null) {
      String tagsList =
          Arrays.stream(tags.split(","))
              .map(this::escapeDoubleQuotes)
              .collect(Collectors.joining("\", \"", "\"", "\""));
      conditions.add(
          String.format(
              "{\"nested\":{\"path\":\"tags\",\"query\":{\"terms\":{\"tags.tagFQN\":[%s]}}}}",
              tagsList));
    }

    if (tier != null) {
      conditions.add(
          String.format(
              "{\"nested\":{\"path\":\"tags\",\"query\":{\"terms\":{\"tags.tagFQN\":[\"%s\"]}}}}",
              escapeDoubleQuotes(tier)));
    }

    if (serviceName != null) {
      conditions.add(
          String.format("{\"term\": {\"service.name\": \"%s\"}}", escapeDoubleQuotes(serviceName)));
    }

    if (entityFQN != null) {
      conditions.add(
          includeAllTests
              ? getTestCaseForEntityCondition(entityFQN, "entityFQN")
              : String.format(
                  "{\"term\": {\"entityFQN\": \"%s\"}}", escapeDoubleQuotes(entityFQN)));
    }

    if (testSuiteId != null) conditions.add(getTestSuiteIdCondition(testSuiteId));

    if (status != null) {
      conditions.add(
          String.format("{\"term\": {\"testCaseResult.testCaseStatus\": \"%s\"}}", status));
    }

    if (type != null) conditions.add(getTestCaseTypeCondition(type, "entityLink"));

    if (testPlatform != null) {
      String platforms =
          Arrays.stream(testPlatform.split(",")).collect(Collectors.joining("\", \"", "\"", "\""));
      conditions.add(String.format("{\"terms\": {\"testPlatforms\": [%s]}}", platforms));
    }

    if (startTimestamp != null && endTimestamp != null) {
      conditions.add(
          getTimestampFilter("testCaseResult.timestamp", "gte", Long.parseLong(startTimestamp)));
      conditions.add(
          getTimestampFilter("testCaseResult.timestamp", "lte", Long.parseLong(endTimestamp)));
    }

    if (dataQualityDimension != null)
      conditions.add(
          getDataQualityDimensionCondition(dataQualityDimension, "dataQualityDimension"));

    return addCondition(conditions);
  }

  private String getTestCaseResultCondition() {
    ArrayList<String> conditions = new ArrayList<>();

    String entityFQN = getQueryParam("entityFQN");
    String dataQualityDimension = getQueryParam("dataQualityDimension");
    String type = getQueryParam("testCaseType");
    String startTimestamp = getQueryParam("startTimestamp");
    String endTimestamp = getQueryParam("endTimestamp");
    String testCaseFQN = getQueryParam("testCaseFQN");
    String testCaseStatus = getQueryParam("testCaseStatus");
    String testSuiteId = getQueryParam("testSuiteId");

    if (entityFQN != null)
      conditions.add(getTestCaseForEntityCondition(entityFQN, "testCase.entityFQN"));

    if (startTimestamp != null && endTimestamp != null) {
      conditions.add(getTimestampFilter("timestamp", "gte", Long.parseLong(startTimestamp)));
      conditions.add(getTimestampFilter("timestamp", "lte", Long.parseLong(endTimestamp)));
    }
    if (testCaseFQN != null) {
      conditions.add(
          String.format(
              "{\"bool\":{\"should\": ["
                  + "{\"term\": {\"testCaseFQN\": \"%1$s\"}},"
                  + "{\"term\": {\"testCase.fullyQualifiedName\": \"%1$s\"}}]}}",
              escapeDoubleQuotes(testCaseFQN)));
    }
    if (testCaseStatus != null)
      conditions.add(String.format("{\"term\": {\"testCaseStatus\": \"%s\"}}", testCaseStatus));
    if (type != null) conditions.add(getTestCaseTypeCondition(type, "testCase.entityLink"));
    if (testSuiteId != null) conditions.add(getTestSuiteIdCondition(testSuiteId));
    if (dataQualityDimension != null)
      conditions.add(
          getDataQualityDimensionCondition(
              dataQualityDimension, "testDefinition.dataQualityDimension"));
    return addCondition(conditions);
  }

  private String getTestSuiteCondition() {
    ArrayList<String> conditions = new ArrayList<>();

    String testSuiteType = getQueryParam("testSuiteType");
    String fullyQualifiedName = getQueryParam("fullyQualifiedName");
    boolean includeEmptyTestSuites = Boolean.parseBoolean(getQueryParam("includeEmptyTestSuites"));

    if (testSuiteType != null) {
      boolean basic = !testSuiteType.equals("logical");
      conditions.add(String.format("{\"term\": {\"basic\": \"%s\"}}", basic));
    }

    if (!includeEmptyTestSuites) {
      conditions.add("{\"exists\": {\"field\": \"tests\"}}");
    }

    if (fullyQualifiedName != null) {
      conditions.add(
          String.format(
              "{\"term\": {\"fullyQualifiedName\": \"%s\"}}",
              escapeDoubleQuotes(fullyQualifiedName)));
    }

    return addCondition(conditions);
  }

  private String escapeDoubleQuotes(String str) {
    return str.replace("\"", "\\\"");
  }

  private String getTestSuiteIdCondition(String testSuiteId) {
    return String.format(
        "{\"nested\":{\"path\":\"testSuites\",\"query\":{\"term\":{\"testSuites.id\":\"%s\"}}}}",
        testSuiteId);
  }

  private String getTestCaseTypeCondition(String type, String field) {
    return switch (type) {
      case Entity.TABLE -> String.format(
          "{\"bool\": {\"must_not\": [{\"regexp\": {\"%s\": \".*::columns::.*\"}}]}}", field);
      case "column" -> String.format("{\"regexp\": {\"%s\": \".*::columns::.*\"}}", field);
      default -> "";
    };
  }

  private String getTestCaseForEntityCondition(String entityFQN, String field) {
    return String.format(
        "{\"bool\":{\"should\": ["
            + "{\"prefix\": {\"%s\": \"%s%s\"}},"
            + "{\"term\": {\"%s\": \"%s\"}}]}}",
        field,
        escapeDoubleQuotes(entityFQN),
        Entity.SEPARATOR,
        field,
        escapeDoubleQuotes(entityFQN));
  }

  private String getDataQualityDimensionCondition(String dataQualityDimension, String field) {
    return String.format("{\"term\": {\"%s\": \"%s\"}}", field, dataQualityDimension);
  }
}
