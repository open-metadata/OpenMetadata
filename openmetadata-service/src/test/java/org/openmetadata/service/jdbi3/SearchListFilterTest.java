package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.DataQualityDimensions;
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
}
