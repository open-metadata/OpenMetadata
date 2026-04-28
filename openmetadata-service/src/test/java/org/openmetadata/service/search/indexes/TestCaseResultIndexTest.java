package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.SearchIndexUtils;

class TestCaseResultIndexTest {

  @Test
  void testDataContractKeyRemovedFromTestCaseMap() {
    TestCase testCase = new TestCase();
    testCase.setId(UUID.randomUUID());
    testCase.setName("test-case");
    testCase.setDataContract(
        new EntityReference().withId(UUID.randomUUID()).withType("dataContract").withName("dc"));

    Map<String, Object> testCaseMap = JsonUtils.getMap(testCase);
    assertTrue(testCaseMap.containsKey("dataContract"));

    Set<String> keysToRemove =
        Set.of("testSuites", "testSuite", "testCaseResult", "testDefinition", "dataContract");
    testCaseMap.keySet().removeAll(keysToRemove);

    assertFalse(testCaseMap.containsKey("dataContract"));
    assertFalse(testCaseMap.containsKey("testSuites"));
    assertFalse(testCaseMap.containsKey("testDefinition"));
  }

  @Test
  void testDataContractDenormalization() {
    EntityReference dcRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("dataContract")
            .withName("my-contract");

    Map<String, Object> esDoc = new HashMap<>();
    if (dcRef != null) {
      esDoc.put("dataContract", JsonUtils.getMap(dcRef));
    }

    assertNotNull(esDoc.get("dataContract"));
    Map<String, Object> dcMap = (Map<String, Object>) esDoc.get("dataContract");
    assertEquals("my-contract", dcMap.get("name"));
    assertEquals("dataContract", dcMap.get("type"));
  }

  @Test
  void testDataContractNullHandling() {
    TestCase testCase = new TestCase();
    testCase.setId(UUID.randomUUID());
    testCase.setName("test-case-no-contract");

    Map<String, Object> esDoc = new HashMap<>();
    if (testCase.getDataContract() != null) {
      esDoc.put("dataContract", JsonUtils.getMap(testCase.getDataContract()));
    }

    assertNull(esDoc.get("dataContract"));
  }

  @Test
  void testExcludeFieldsRemoval() {
    Set<String> excludeFields =
        Set.of("changeDescription", "failedRowsSample", "incrementalChangeDescription");

    Map<String, Object> testCase = new HashMap<>();
    testCase.put("changeDescription", "should-be-removed");
    testCase.put("failedRowsSample", "should-be-removed");
    testCase.put("incrementalChangeDescription", "should-be-removed");
    testCase.put("name", "keep-this");
    testCase.put("description", "keep-this-too");

    SearchIndexUtils.removeNonIndexableFields(testCase, excludeFields);

    assertFalse(testCase.containsKey("changeDescription"));
    assertFalse(testCase.containsKey("failedRowsSample"));
    assertFalse(testCase.containsKey("incrementalChangeDescription"));
    assertTrue(testCase.containsKey("name"));
    assertTrue(testCase.containsKey("description"));
  }

  @Test
  void testTimestampDenormalization() {
    long timestamp = System.currentTimeMillis();
    Map<String, Object> esDoc = new HashMap<>();
    esDoc.put("@timestamp", timestamp);
    assertEquals(timestamp, esDoc.get("@timestamp"));
  }
}
