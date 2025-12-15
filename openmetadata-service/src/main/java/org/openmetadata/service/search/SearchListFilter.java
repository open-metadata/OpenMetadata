package org.openmetadata.service.search;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.DataQualityDimensions;
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

  // Elasticsearch field name constants
  private static final String FIELD_DELETED = "deleted";
  private static final String FIELD_OWNERS_ID = "owners.id";
  private static final String FIELD_CREATED_BY = "createdBy";
  private static final String FIELD_DOMAINS_FQN = "domains.fullyQualifiedName";
  private static final String FIELD_SERVICE_NAME = "service.name";
  private static final String FIELD_TEST_CASE_STATUS = "testCaseResult.testCaseStatus";
  private static final String FIELD_TEST_PLATFORMS = "testPlatforms";
  private static final String FIELD_FOLLOWERS_KEYWORD = "followers.keyword";
  private static final String FIELD_TEST_STATUS = "testCaseStatus";
  private static final String FIELD_BASIC = "basic";

  @Override
  public String getCondition(String entityType) {
    String conditionFilter = buildConditionFilter(entityType);
    String sourceFilter = getExcludeIncludeFields();
    return buildQueryFilter(conditionFilter, sourceFilter);
  }

  /**
   * Get only the query part (without _source) for use in filter aggregations.
   * Filter aggregations expect just the query structure, not the full query document.
   */
  public String getFilterQuery(String entityType) {
    String conditionFilter = buildConditionFilter(entityType);
    return buildQueryOnly(conditionFilter);
  }

  /**
   * Shared method to build condition filter - implements DRY principle.
   * This method contains the core logic for building query conditions.
   */
  private String buildConditionFilter(String entityType) {
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
      conditions.add(
          entityType.equals(Entity.TEST_CASE_RESOLUTION_STATUS)
              ? getTestCaseResolutionStatusCondition()
              : null);
    }
    return addCondition(conditions);
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
    String domain = getQueryParam("domains");
    if (!nullOrEmpty(domain)) {
      return String.format(
          "{\"term\": {\"%s\": \"%s\"}}", FIELD_DOMAINS_FQN, escapeDoubleQuotes(domain));
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
      deleted =
          String.format("{\"term\": {\"%s\": \"%s\"}}", FIELD_DELETED, include == Include.DELETED);
    }
    return deleted;
  }

  private String getOwnerCondition() {
    String owners = getQueryParam("owners");
    if (!nullOrEmpty(owners)) {
      String ownersList =
          Arrays.stream(owners.split(",")).collect(Collectors.joining("\", \"", "\"", "\""));
      return String.format("{\"terms\": {\"%s\": [%s]}}", FIELD_OWNERS_ID, ownersList);
    }
    return "";
  }

  private String getCreatedByCondition() {
    String createdBy = getQueryParam("createdBy");
    if (!nullOrEmpty(createdBy)) {
      return String.format(
          "{\"term\": {\"%s\": \"%s\"}}", FIELD_CREATED_BY, escapeDoubleQuotes(createdBy));
    }
    return "";
  }

  private String buildQueryFilter(String conditionFilter, String sourceFilter) {
    String queryPart = buildQueryPart(conditionFilter);
    String q = queryParams.get("q");
    boolean isQEmpty = nullOrEmpty(q);

    if (!conditionFilter.isEmpty()) {
      return String.format("{%s,\"query\": %s}", sourceFilter, queryPart);
    } else if (!isQEmpty) {
      return String.format("{%s}", sourceFilter);
    } else {
      return String.format("{%s,\"query\": %s}", sourceFilter, queryPart);
    }
  }

  /**
   * Helper method to build query-only format (without _source) for filter aggregations.
   */
  private String buildQueryOnly(String conditionFilter) {
    return buildQueryPart(conditionFilter);
  }

  /**
   * Core method to build the query part - implements DRY principle for query construction.
   * This method contains the shared logic for building the actual query structure.
   */
  private String buildQueryPart(String conditionFilter) {
    if (!conditionFilter.isEmpty()) {
      return String.format("{\"bool\": {\"filter\": [%s]}}", conditionFilter);
    } else {
      return "{\"match_all\": {}}";
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
    String followedBy = getQueryParam("followedBy");

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
          String.format(
              "{\"term\": {\"%s\": \"%s\"}}", FIELD_SERVICE_NAME, escapeDoubleQuotes(serviceName)));
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
      conditions.add(String.format("{\"term\": {\"%s\": \"%s\"}}", FIELD_TEST_CASE_STATUS, status));
    }

    if (type != null) conditions.add(getTestCaseTypeCondition(type, "entityLink"));

    if (testPlatform != null) {
      String platforms =
          Arrays.stream(testPlatform.split(",")).collect(Collectors.joining("\", \"", "\"", "\""));
      conditions.add(String.format("{\"terms\": {\"%s\": [%s]}}", FIELD_TEST_PLATFORMS, platforms));
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

    if (followedBy != null) {
      conditions.add(
          String.format("{\"term\": {\"%s\": \"%s\"}}", FIELD_FOLLOWERS_KEYWORD, followedBy));
    }

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
    String dataContractId = getQueryParam("dataContractId");

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
      conditions.add(
          String.format("{\"term\": {\"%s\": \"%s\"}}", FIELD_TEST_STATUS, testCaseStatus));
    if (type != null) conditions.add(getTestCaseTypeCondition(type, "testCase.entityLink"));
    if (testSuiteId != null) conditions.add(getTestSuiteIdCondition(testSuiteId));
    if (dataQualityDimension != null)
      conditions.add(
          getDataQualityDimensionCondition(
              dataQualityDimension, "testDefinition.dataQualityDimension"));
    if (dataContractId != null)
      conditions.add(String.format("{\"term\": {\"dataContract.id\": \"%s\"}}", dataContractId));
    return addCondition(conditions);
  }

  private String getTestSuiteCondition() {
    ArrayList<String> conditions = new ArrayList<>();

    String testSuiteType = getQueryParam("testSuiteType");
    String fullyQualifiedName = getQueryParam("fullyQualifiedName");
    boolean includeEmptyTestSuites = Boolean.parseBoolean(getQueryParam("includeEmptyTestSuites"));

    if (testSuiteType != null) {
      boolean basic = !testSuiteType.equals("logical");
      conditions.add(String.format("{\"term\": {\"%s\": \"%s\"}}", FIELD_BASIC, basic));
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
    if (DataQualityDimensions.NO_DIMENSION.value().equals(dataQualityDimension)) {
      return String.format("{\"bool\":{\"must_not\":[{\"exists\":{\"field\":\"%s\"}}]}}", field);
    }
    return String.format("{\"term\": {\"%s\": \"%s\"}}", field, dataQualityDimension);
  }

  private String getTestCaseResolutionStatusCondition() {
    ArrayList<String> conditions = new ArrayList<>();

    String testCaseResolutionStatusType = getQueryParam("testCaseResolutionStatusType");
    String assignee = getQueryParam("assignee");
    String testCaseFqn = getQueryParam("testCaseFqn");
    String originEntityFQN = getQueryParam("originEntityFQN");
    String startTimestamp = getQueryParam("startTimestamp");
    String endTimestamp = getQueryParam("endTimestamp");

    if (startTimestamp != null && endTimestamp != null) {
      conditions.add(getTimestampFilter("@timestamp", "gte", Long.parseLong(startTimestamp)));
      conditions.add(getTimestampFilter("@timestamp", "lte", Long.parseLong(endTimestamp)));
    }

    if (testCaseResolutionStatusType != null) {
      conditions.add(
          String.format(
              "{\"term\": {\"testCaseResolutionStatusType\": \"%s\"}}",
              escapeDoubleQuotes(testCaseResolutionStatusType)));
    }

    if (assignee != null) {
      conditions.add(
          String.format(
              "{\"term\": {\"testCaseResolutionStatusDetails.assignee.name\": \"%s\"}}",
              escapeDoubleQuotes(assignee)));
    }

    if (testCaseFqn != null) {
      conditions.add(
          String.format(
              "{\"term\": {\"testCase.fullyQualifiedName.keyword\": \"%s\"}}",
              escapeDoubleQuotes(testCaseFqn)));
    }

    if (originEntityFQN != null) {
      conditions.add(getTestCaseForEntityCondition(originEntityFQN, "testCase.entityFQN.keyword"));
    }

    return addCondition(conditions);
  }
}
