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

  @Test
  void testResolutionStatusCondition_noTimestamp() {
    SearchListFilter filter = new SearchListFilter();
    String actual = filter.getCondition(Entity.TEST_CASE_RESOLUTION_STATUS);
    String expected =
        "{\"_source\": {\"exclude\": [\"fqnParts\",\"entityType\",\"suggest\"]},\"query\": {\"bool\": {\"filter\": [{\"term\": {\"deleted\": \"false\"}}]}}}";
    assertEquals(expected, actual);
  }

  @Test
  void testResolutionStatusCondition_defaultDateField_usesAtTimestamp() {
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
    SearchListFilter filter = new SearchListFilter();
    filter.addQueryParam("testCaseResolutionStatusType", "Resolved");
    String actual = filter.getCondition(Entity.TEST_CASE_RESOLUTION_STATUS);
    assertTrue(
        actual.contains("testCaseResolutionStatusType") && actual.contains("Resolved"),
        "Expected testCaseResolutionStatusType filter but got: " + actual);
  }

  @Test
  void testResolutionStatusCondition_withAssignee() {
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
    SearchListFilter filter = new SearchListFilter();
    filter.addQueryParam("testCaseFqn", "db.schema.table.test1");
    String actual = filter.getCondition(Entity.TEST_CASE_RESOLUTION_STATUS);
    assertTrue(
        actual.contains("testCase.fullyQualifiedName.keyword")
            && actual.contains("db.schema.table.test1"),
        "Expected testCaseFqn filter but got: " + actual);
  }
}
