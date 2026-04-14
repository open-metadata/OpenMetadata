package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.DataQualityDimensions;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchListFilter;

public class SearchListFilterTest {
  @Test
  void testSimpleGetCondition() {
    SearchListFilter searchListFilter = new SearchListFilter();
    String actual = searchListFilter.getCondition();
    String expected =
        "{\"_source\": {\"exclude\": [\"fqnParts\",\"entityType\",\"suggest\"]},\"query\": {\"bool\": {\"filter\": [{\"term\": {\"deleted\": \"false\"}}]}}}";
    assertEquals(expected, actual);
  }

  @Test
  void testComplexGetCondition() {
    // TEST_CASE entity type doesn't include the "deleted: false" condition in the filter
    // because the entity doesn't support the "deleted" field, unlike the generic case in
    // testSimpleGetCondition where entityType is null and the deleted condition is included.
    // When entityType=null, supportsDeleted defaults to true.
    // When entityType=TEST_CASE, code checks if the entity class has the deleted field.
    SearchListFilter searchListFilter = new SearchListFilter();
    searchListFilter.addQueryParam("includeFields", "field1,field2");
    searchListFilter.addQueryParam("excludeFields", "field3,field4");
    searchListFilter.addQueryParam("testCaseStatus", "failed");
    String actual = searchListFilter.getCondition(Entity.TEST_CASE);
    String expected =
        "{\"_source\": {\"exclude\": [\"fqnParts\",\"entityType\",\"suggest\",\"field3\",\"field4\"],\n\"include\": [\"field1\",\"field2\"]},\"query\": {\"bool\": {\"filter\": [{\"term\": {\"testCaseResult.testCaseStatus\": \"failed\"}}]}}}";
    assertEquals(expected, actual);
  }

  @Test
  void testDataQualityDimensionCondition() {
    SearchListFilter searchListFilter = new SearchListFilter();
    searchListFilter.addQueryParam("dataQualityDimension", DataQualityDimensions.ACCURACY.value());
    String actual = searchListFilter.getCondition(Entity.TEST_CASE);
    String expected =
        "{\"_source\": {\"exclude\": [\"fqnParts\",\"entityType\",\"suggest\"]},\"query\": {\"bool\": {\"filter\": [{\"term\": {\"dataQualityDimension\": \"Accuracy\"}}]}}}";
    assertEquals(expected, actual);
  }

  @Test
  void testDataQualityDimensionNoDimensionCondition() {
    SearchListFilter searchListFilter = new SearchListFilter();
    searchListFilter.addQueryParam(
        "dataQualityDimension", DataQualityDimensions.NO_DIMENSION.value());
    String actual = searchListFilter.getCondition(Entity.TEST_CASE);
    String expected =
        "{\"_source\": {\"exclude\": [\"fqnParts\",\"entityType\",\"suggest\"]},\"query\": {\"bool\": {\"filter\": [{\"bool\":{\"must_not\":[{\"exists\":{\"field\":\"dataQualityDimension\"}}]}}]}}}";
    assertEquals(expected, actual);
  }

  @Test
  void testDataQualityDimensionConditionForTestCaseResult() {
    SearchListFilter searchListFilter = new SearchListFilter();
    searchListFilter.addQueryParam(
        "dataQualityDimension", DataQualityDimensions.COMPLETENESS.value());
    String actual = searchListFilter.getCondition(Entity.TEST_CASE_RESULT);
    String expected =
        "{\"_source\": {\"exclude\": [\"fqnParts\",\"entityType\",\"suggest\"]},\"query\": {\"bool\": {\"filter\": [{\"term\": {\"testDefinition.dataQualityDimension\": \"Completeness\"}}]}}}";
    assertEquals(expected, actual);
  }

  @Test
  void testDataQualityDimensionNoDimensionConditionForTestCaseResult() {
    SearchListFilter searchListFilter = new SearchListFilter();
    searchListFilter.addQueryParam(
        "dataQualityDimension", DataQualityDimensions.NO_DIMENSION.value());
    String actual = searchListFilter.getCondition(Entity.TEST_CASE_RESULT);
    String expected =
        "{\"_source\": {\"exclude\": [\"fqnParts\",\"entityType\",\"suggest\"]},\"query\": {\"bool\": {\"filter\": [{\"bool\":{\"must_not\":[{\"exists\":{\"field\":\"testDefinition.dataQualityDimension\"}}]}}]}}}";
    assertEquals(expected, actual);
  }

  @Test
  void testIncludeAllWithoutConditionsUsesMatchAllQuery() {
    SearchListFilter searchListFilter = new SearchListFilter(Include.ALL);

    JsonNode actual = parse(searchListFilter.getCondition(Entity.TABLE));

    assertTrue(actual.has("_source"));
    assertTrue(actual.at("/query/match_all").isObject());
  }

  @Test
  void testGetFilterQueryReturnsOnlyQuerySection() {
    SearchListFilter searchListFilter = new SearchListFilter();
    searchListFilter.addQueryParam("owners", "owner1,owner2");

    JsonNode actual = parse(searchListFilter.getFilterQuery(null));

    assertFalse(actual.has("_source"));
    assertEquals("false", actual.at("/bool/filter/0/term/deleted").asText());
    assertEquals("owners", actual.at("/bool/filter/1/nested/path").asText());
    assertEquals("owner1", actual.at("/bool/filter/1/nested/query/terms/owners.id/0").asText());
    assertEquals("owner2", actual.at("/bool/filter/1/nested/query/terms/owners.id/1").asText());
    assertTrue(
        actual.at("/bool/filter/1/nested/ignore_unmapped").asBoolean(),
        "Nested owners query must set ignore_unmapped to true");
  }

  @Test
  void testQueryTextWithoutFiltersReturnsSourceOnly() {
    SearchListFilter searchListFilter = new SearchListFilter(Include.ALL);
    searchListFilter.addQueryParam("q", "orders");

    JsonNode actual = parse(searchListFilter.getCondition());

    assertTrue(actual.has("_source"));
    assertFalse(actual.has("query"));
  }

  @Test
  void testDeletedIncludeTargetsDeletedAssets() {
    SearchListFilter searchListFilter = new SearchListFilter(Include.DELETED);

    JsonNode actual = parse(searchListFilter.getCondition());

    assertEquals("true", actual.at("/query/bool/filter/0/term/deleted").asText());
  }

  @Test
  void testGenericFiltersCombineDomainOwnersAndCreatedBy() {
    SearchListFilter searchListFilter = new SearchListFilter();
    searchListFilter.addQueryParam("domains", "finance.\"raw\"");
    searchListFilter.addQueryParam("owners", "owner1,owner2");
    searchListFilter.addQueryParam("createdBy", "user\"name");

    String actual = searchListFilter.getCondition(Entity.TABLE);

    assertTrue(
        actual.contains("{\"term\": {\"domains.fullyQualifiedName\": \"finance.\\\"raw\\\"\"}}"));
    assertTrue(
        actual.contains(
            "{\"nested\":{\"path\":\"owners\",\"query\":{\"terms\":{\"owners.id\":[\"owner1\", \"owner2\"]}},\"ignore_unmapped\":true}}"));
    assertTrue(actual.contains("{\"term\": {\"createdBy\": \"user\\\"name\"}}"));
  }

  @Test
  void testTestCaseConditionBuildsAllEntitySpecificFilters() {
    SearchListFilter searchListFilter = new SearchListFilter();
    searchListFilter.addQueryParam("entityFQN", "service.db.schema.table");
    searchListFilter.addQueryParam("includeAllTests", true);
    searchListFilter.addQueryParam("testCaseStatus", "Failed");
    searchListFilter.addQueryParam("testSuiteId", "suite-id");
    searchListFilter.addQueryParam("testCaseType", "column");
    searchListFilter.addQueryParam("testPlatforms", "great_expectations,dbt");
    searchListFilter.addQueryParam("startTimestamp", "10");
    searchListFilter.addQueryParam("endTimestamp", "20");
    searchListFilter.addQueryParam("tags", "PII,Sensitive");
    searchListFilter.addQueryParam("tier", "Tier.Tier1");
    searchListFilter.addQueryParam("serviceName", "sample-service");
    searchListFilter.addQueryParam("dataQualityDimension", DataQualityDimensions.ACCURACY.value());
    searchListFilter.addQueryParam("followedBy", "follower-id");

    String actual = searchListFilter.getCondition(Entity.TEST_CASE);

    assertTrue(
        actual.contains(
            "{\"bool\":{\"should\": [{\"prefix\": {\"entityFQN\": \"service.db.schema.table.\"}},{\"term\": {\"entityFQN\": \"service.db.schema.table\"}}]}}"));
    assertTrue(actual.contains("{\"term\": {\"testCaseResult.testCaseStatus\": \"Failed\"}}"));
    assertTrue(
        actual.contains(
            "{\"nested\":{\"path\":\"testSuites\",\"query\":{\"term\":{\"testSuites.id\":\"suite-id\"}}}}"));
    assertTrue(actual.contains("{\"regexp\": {\"entityLink\": \".*::columns::.*\"}}"));
    assertTrue(
        actual.contains("{\"terms\": {\"testPlatforms\": [\"great_expectations\", \"dbt\"]}}"));
    assertTrue(actual.contains("{\"range\": {\"testCaseResult.timestamp\": {\"gte\": 10}}}"));
    assertTrue(actual.contains("{\"range\": {\"testCaseResult.timestamp\": {\"lte\": 20}}}"));
    assertTrue(actual.contains("{\"terms\":{\"tags.tagFQN\":[\"PII\", \"Sensitive\"]}}"));
    assertTrue(actual.contains("{\"terms\":{\"tags.tagFQN\":[\"Tier.Tier1\"]}}"));
    assertTrue(actual.contains("{\"term\": {\"service.name\": \"sample-service\"}}"));
    assertTrue(actual.contains("{\"term\": {\"dataQualityDimension\": \"Accuracy\"}}"));
    assertTrue(actual.contains("{\"term\": {\"followers.keyword\": \"follower-id\"}}"));
  }

  @Test
  void testTestCaseResultConditionBuildsFqnStatusTypeAndTimestampFilters() {
    SearchListFilter searchListFilter = new SearchListFilter();
    searchListFilter.addQueryParam("entityFQN", "service.db.schema.table");
    searchListFilter.addQueryParam("startTimestamp", "100");
    searchListFilter.addQueryParam("endTimestamp", "200");
    searchListFilter.addQueryParam("testCaseFQN", "service.db.schema.table.test");
    searchListFilter.addQueryParam("testCaseStatus", "Success");
    searchListFilter.addQueryParam("testCaseType", Entity.TABLE);
    searchListFilter.addQueryParam("testSuiteId", "suite-id");
    searchListFilter.addQueryParam(
        "dataQualityDimension", DataQualityDimensions.COMPLETENESS.value());

    String actual = searchListFilter.getCondition(Entity.TEST_CASE_RESULT);

    assertTrue(
        actual.contains(
            "{\"bool\":{\"should\": [{\"prefix\": {\"testCase.entityFQN\": \"service.db.schema.table.\"}},{\"term\": {\"testCase.entityFQN\": \"service.db.schema.table\"}}]}}"));
    assertTrue(actual.contains("{\"range\": {\"timestamp\": {\"gte\": 100}}}"));
    assertTrue(actual.contains("{\"range\": {\"timestamp\": {\"lte\": 200}}}"));
    assertTrue(
        actual.contains(
            "{\"bool\":{\"should\": [{\"term\": {\"testCaseFQN\": \"service.db.schema.table.test\"}},{\"term\": {\"testCase.fullyQualifiedName\": \"service.db.schema.table.test\"}}]}}"));
    assertTrue(actual.contains("{\"term\": {\"testCaseStatus\": \"Success\"}}"));
    assertTrue(
        actual.contains(
            "{\"bool\": {\"must_not\": [{\"regexp\": {\"testCase.entityLink\": \".*::columns::.*\"}}]}}"));
    assertTrue(
        actual.contains(
            "{\"nested\":{\"path\":\"testSuites\",\"query\":{\"term\":{\"testSuites.id\":\"suite-id\"}}}}"));
    assertTrue(
        actual.contains("{\"term\": {\"testDefinition.dataQualityDimension\": \"Completeness\"}}"));
  }

  @Test
  void testTestSuiteConditionSupportsLogicalSuitesAndEmptyToggle() {
    SearchListFilter searchListFilter = new SearchListFilter();
    searchListFilter.addQueryParam("testSuiteType", "logical");
    searchListFilter.addQueryParam("fullyQualifiedName", "service.testSuite");

    String logicalSuites = searchListFilter.getCondition(Entity.TEST_SUITE);
    assertTrue(logicalSuites.contains("{\"term\": {\"basic\": \"false\"}}"));
    assertTrue(logicalSuites.contains("{\"exists\": {\"field\": \"tests\"}}"));
    assertTrue(
        logicalSuites.contains("{\"term\": {\"fullyQualifiedName\": \"service.testSuite\"}}"));

    SearchListFilter includeEmptySuites = new SearchListFilter();
    includeEmptySuites.addQueryParam("includeEmptyTestSuites", true);
    includeEmptySuites.addQueryParam("testSuiteType", "basic");

    String includeEmpty = includeEmptySuites.getCondition(Entity.TEST_SUITE);
    assertTrue(includeEmpty.contains("{\"term\": {\"basic\": \"true\"}}"));
    assertFalse(includeEmpty.contains("{\"exists\": {\"field\": \"tests\"}}"));
  }

  @Test
  void testResolutionStatusConditionBuildsAssigneeOriginAndTimeFilters() {
    SearchListFilter searchListFilter = new SearchListFilter();
    searchListFilter.addQueryParam("testCaseResolutionStatusType", "Acknowledged");
    searchListFilter.addQueryParam("assignee", "qa-user");
    searchListFilter.addQueryParam("testCaseFqn", "service.db.schema.table.test");
    searchListFilter.addQueryParam("originEntityFQN", "service.db.schema.table");
    searchListFilter.addQueryParam("startTimestamp", "1");
    searchListFilter.addQueryParam("endTimestamp", "2");

    String actual = searchListFilter.getCondition(Entity.TEST_CASE_RESOLUTION_STATUS);

    assertTrue(actual.contains("{\"range\": {\"@timestamp\": {\"gte\": 1}}}"));
    assertTrue(actual.contains("{\"range\": {\"@timestamp\": {\"lte\": 2}}}"));
    assertTrue(actual.contains("{\"term\": {\"testCaseResolutionStatusType\": \"Acknowledged\"}}"));
    assertTrue(
        actual.contains(
            "{\"term\": {\"testCaseResolutionStatusDetails.assignee.name\": \"qa-user\"}}"));
    assertTrue(
        actual.contains(
            "{\"term\": {\"testCase.fullyQualifiedName.keyword\": \"service.db.schema.table.test\"}}"));
    assertTrue(
        actual.contains(
            "{\"bool\":{\"should\": [{\"prefix\": {\"testCase.entityFQN.keyword\": \"service.db.schema.table.\"}},{\"term\": {\"testCase.entityFQN.keyword\": \"service.db.schema.table\"}}]}}"));
  }

  // --- TestCaseResolutionStatus / dateField tests ---
  // These tests cover the dateField routing logic added to
  // SearchListFilter.getTestCaseResolutionStatusCondition(). The dateField param
  // selects which Elasticsearch field is used for the timestamp range filter:
  //   - "timestamp" (default / absent) → "@timestamp" ES field (incident creation time)
  //   - "updatedAt"                    → "updatedAt"   ES field (last status update time)

  @Test
  void testResolutionStatusCondition_noTimestamp() {
    // When no timestamp params are supplied and no other filters are active the query falls
    // back to match_all. TestCaseResolutionStatus is a time-series entity with no 'deleted'
    // field, so the usual deleted:false term is NOT injected into the filter.
    SearchListFilter filter = new SearchListFilter();
    String actual = filter.getCondition(Entity.TEST_CASE_RESOLUTION_STATUS);
    String expected =
        "{\"_source\": {\"exclude\": [\"fqnParts\",\"entityType\",\"suggest\"]},\"query\": {\"match_all\": {}}}";
    assertEquals(expected, actual);
  }

  @Test
  void testResolutionStatusCondition_defaultDateField_usesAtTimestamp() {
    // When dateField is absent the range filter must target the "@timestamp" ES field,
    // which maps to the incident creation time stored by the indexing pipeline.
    SearchListFilter filter = new SearchListFilter();
    filter.addQueryParam("startTimestamp", "1000000");
    filter.addQueryParam("endTimestamp", "2000000");
    String actual = filter.getCondition(Entity.TEST_CASE_RESOLUTION_STATUS);
    assertTrue(
        actual.contains("\"@timestamp\""),
        "Expected '@timestamp' field in condition but got: " + actual);
  }

  @Test
  void testResolutionStatusCondition_explicitTimestampDateField_usesAtTimestamp() {
    // An explicit dateField=timestamp is equivalent to the default and must also
    // resolve to the "@timestamp" ES field.
    SearchListFilter filter = new SearchListFilter();
    filter.addQueryParam("startTimestamp", "1000000");
    filter.addQueryParam("endTimestamp", "2000000");
    filter.addQueryParam("dateField", "timestamp");
    String actual = filter.getCondition(Entity.TEST_CASE_RESOLUTION_STATUS);
    assertTrue(
        actual.contains("\"@timestamp\""),
        "Expected '@timestamp' field in condition but got: " + actual);
  }

  @Test
  void testResolutionStatusCondition_updatedAtDateField_usesUpdatedAt() {
    // When dateField=updatedAt the range filter must target the "updatedAt" ES field
    // so that the UI can filter incidents by their last-updated time.
    SearchListFilter filter = new SearchListFilter();
    filter.addQueryParam("startTimestamp", "1000000");
    filter.addQueryParam("endTimestamp", "2000000");
    filter.addQueryParam("dateField", "updatedAt");
    String actual = filter.getCondition(Entity.TEST_CASE_RESOLUTION_STATUS);
    assertTrue(
        actual.contains("\"updatedAt\""),
        "Expected 'updatedAt' field in condition but got: " + actual);
  }

  @Test
  void testResolutionStatusCondition_updatedAtDateField_doesNotUseAtTimestamp() {
    // Complementary to the above: when dateField=updatedAt the "@timestamp" field
    // must NOT appear so the two date fields are mutually exclusive in the query.
    SearchListFilter filter = new SearchListFilter();
    filter.addQueryParam("startTimestamp", "1000000");
    filter.addQueryParam("endTimestamp", "2000000");
    filter.addQueryParam("dateField", "updatedAt");
    String actual = filter.getCondition(Entity.TEST_CASE_RESOLUTION_STATUS);
    assertFalse(
        actual.contains("\"@timestamp\""),
        "Did not expect '@timestamp' in condition when dateField=updatedAt, got: " + actual);
  }

  @Test
  void testResolutionStatusCondition_timestampRangeValues_presentInQuery() {
    // The exact start/end timestamp values supplied by the caller must be present
    // verbatim in the generated Elasticsearch range query.
    SearchListFilter filter = new SearchListFilter();
    filter.addQueryParam("startTimestamp", "1709556624254");
    filter.addQueryParam("endTimestamp", "1710161424255");
    String actual = filter.getCondition(Entity.TEST_CASE_RESOLUTION_STATUS);
    assertTrue(
        actual.contains("1709556624254") && actual.contains("1710161424255"),
        "Expected timestamp values in condition but got: " + actual);
  }

  @Test
  void testResolutionStatusCondition_withStatusType() {
    // The testCaseResolutionStatusType param must produce a term filter on the
    // matching ES field so callers can narrow results to a specific status (e.g. "Resolved").
    SearchListFilter filter = new SearchListFilter();
    filter.addQueryParam("testCaseResolutionStatusType", "Resolved");
    String actual = filter.getCondition(Entity.TEST_CASE_RESOLUTION_STATUS);
    assertTrue(
        actual.contains("testCaseResolutionStatusType") && actual.contains("Resolved"),
        "Expected testCaseResolutionStatusType filter but got: " + actual);
  }

  @Test
  void testResolutionStatusCondition_withAssignee() {
    // The assignee param must produce a term filter on the nested assignee name field
    // so callers can list incidents assigned to a specific user.
    SearchListFilter filter = new SearchListFilter();
    filter.addQueryParam("assignee", "john_doe");
    String actual = filter.getCondition(Entity.TEST_CASE_RESOLUTION_STATUS);
    assertTrue(
        actual.contains("testCaseResolutionStatusDetails.assignee.name")
            && actual.contains("john_doe"),
        "Expected assignee filter but got: " + actual);
  }

  @Test
  void testResolutionStatusCondition_withTestCaseFqn() {
    // The testCaseFqn param must produce a term filter on the keyword sub-field so
    // callers can retrieve all statuses belonging to a single test case.
    SearchListFilter filter = new SearchListFilter();
    filter.addQueryParam("testCaseFqn", "db.schema.table.test1");
    String actual = filter.getCondition(Entity.TEST_CASE_RESOLUTION_STATUS);
    assertTrue(
        actual.contains("testCase.fullyQualifiedName.keyword")
            && actual.contains("db.schema.table.test1"),
        "Expected testCaseFqn filter but got: " + actual);
  }

  @Test
  void testNestedQueryWorksForMappedFields() {
    // Verifies nested query produces correct structure for indexes with owners as nested
    SearchListFilter searchListFilter = new SearchListFilter();
    searchListFilter.addQueryParam("owners", "owner-abc,owner-def");

    JsonNode actual = parse(searchListFilter.getFilterQuery(null));

    JsonNode nested = actual.at("/bool/filter/1/nested");
    assertFalse(nested.isMissingNode(), "nested query must be present");
    assertEquals("owners", nested.at("/path").asText(), "must target correct nested path");
    assertEquals(
        "owner-abc",
        nested.at("/query/terms/owners.id/0").asText(),
        "must contain first owner value");
    assertEquals(
        "owner-def",
        nested.at("/query/terms/owners.id/1").asText(),
        "must contain second owner value");
  }

  @Test
  void testNestedQueryDoesNotFailForUnmappedFields() {
    // Verifies ignore_unmapped is set so indexes without owners (e.g. user) don't throw errors
    SearchListFilter searchListFilter = new SearchListFilter();
    searchListFilter.addQueryParam("owners", "owner-abc");

    JsonNode actual = parse(searchListFilter.getFilterQuery(null));

    JsonNode nested = actual.at("/bool/filter/1/nested");
    assertTrue(
        nested.at("/ignore_unmapped").asBoolean(),
        "must set ignore_unmapped so query works on indexes without this nested field");
  }

  private JsonNode parse(String json) {
    return JsonUtils.readTree(json);
  }
}
