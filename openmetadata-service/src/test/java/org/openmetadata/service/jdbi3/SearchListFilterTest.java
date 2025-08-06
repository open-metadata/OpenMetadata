package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
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
}
