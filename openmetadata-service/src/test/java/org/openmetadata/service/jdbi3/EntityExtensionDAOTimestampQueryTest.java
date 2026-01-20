/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;

/**
 * Integration tests for EntityExtensionDAO.getExtensionsByTimestampRange and
 * getExtensionsByTimestampRangeCount methods. These tests verify that timestamp-based queries on
 * entity_extension table return correct results with proper filtering and pagination.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class EntityExtensionDAOTimestampQueryTest extends OpenMetadataApplicationTest {

  private static final String EXTENSION_PREFIX = "testExtension";
  private static final String TABLE_NAME = "table_entity";
  private static final List<UUID> testExtensionIds = new ArrayList<>();
  private static final List<Long> testExtensionTimestamps = new ArrayList<>();
  private static long beforeCreationTs;
  private static long afterFirstBatchTs;
  private static long afterAllCreationTs;

  @BeforeAll
  public static void setupExtensions() {
    CollectionDAO.EntityExtensionDAO extensionDAO = Entity.getCollectionDAO().entityExtensionDAO();

    beforeCreationTs = System.currentTimeMillis();

    for (int i = 0; i < 3; i++) {
      UUID id = UUID.randomUUID();
      long timestamp = System.currentTimeMillis();
      String extension = EXTENSION_PREFIX + ".batch1_" + i;
      String json = createExtensionJson(id, timestamp, "batch1_value_" + i);

      extensionDAO.insert(id, extension, "{}", json);
      testExtensionIds.add(id);
      testExtensionTimestamps.add(timestamp);
    }

    afterFirstBatchTs = System.currentTimeMillis();

    try {
      Thread.sleep(50);
    } catch (InterruptedException ignored) {
    }

    for (int i = 0; i < 2; i++) {
      UUID id = UUID.randomUUID();
      long timestamp = System.currentTimeMillis();
      String extension = EXTENSION_PREFIX + ".batch2_" + i;
      String json = createExtensionJson(id, timestamp, "batch2_value_" + i);

      extensionDAO.insert(id, extension, "{}", json);
      testExtensionIds.add(id);
      testExtensionTimestamps.add(timestamp);
    }

    afterAllCreationTs = System.currentTimeMillis();
  }

  @AfterAll
  public static void cleanupExtensions() {
    CollectionDAO.EntityExtensionDAO extensionDAO = Entity.getCollectionDAO().entityExtensionDAO();

    for (int i = 0; i < testExtensionIds.size(); i++) {
      UUID id = testExtensionIds.get(i);
      String extension =
          i < 3 ? EXTENSION_PREFIX + ".batch1_" + i : EXTENSION_PREFIX + ".batch2_" + (i - 3);
      extensionDAO.delete(id, extension);
    }
  }

  private static String createExtensionJson(UUID id, long updatedAt, String value) {
    return JsonUtils.pojoToJson(new TestExtensionData(id.toString(), updatedAt, value));
  }

  @Test
  @Order(1)
  void test_getExtensionsByTimestampRange_returnsEntityHistoryInRange() {
    CollectionDAO.EntityExtensionDAO extensionDAO = Entity.getCollectionDAO().entityExtensionDAO();

    List<String> results =
        extensionDAO.getEntityHistoryByTimestampRange(
            TABLE_NAME,
            beforeCreationTs,
            afterAllCreationTs,
            "",
            EXTENSION_PREFIX,
            null,
            null,
            100);

    assertNotNull(results);
    assertTrue(results.size() >= 5, "Should return at least 5 extensions created in test setup");
  }

  @Test
  @Order(2)
  void test_getEntityHistoryByTimestampRange_filtersCorrectlyByTimeRange() {
    CollectionDAO.EntityExtensionDAO extensionDAO = Entity.getCollectionDAO().entityExtensionDAO();

    List<String> firstBatchResults =
        extensionDAO.getEntityHistoryByTimestampRange(
            TABLE_NAME, beforeCreationTs, afterFirstBatchTs, "", EXTENSION_PREFIX, null, null, 100);

    assertNotNull(firstBatchResults);
    assertTrue(
        firstBatchResults.size() >= 3, "Should return at least 3 extensions from first batch");

    for (String json : firstBatchResults) {
      TestExtensionData data = JsonUtils.readValue(json, TestExtensionData.class);
      assertTrue(data.updatedAt >= beforeCreationTs, "Extension updatedAt should be >= startTs");
      assertTrue(data.updatedAt <= afterFirstBatchTs, "Extension updatedAt should be <= endTs");
    }
  }

  @Test
  @Order(3)
  void test_getEntityHistoryByTimestampRange_orderingIsDescending() {
    CollectionDAO.EntityExtensionDAO extensionDAO = Entity.getCollectionDAO().entityExtensionDAO();

    List<String> results =
        extensionDAO.getEntityHistoryByTimestampRange(
            TABLE_NAME,
            beforeCreationTs,
            afterAllCreationTs,
            "",
            EXTENSION_PREFIX,
            null,
            null,
            100);

    assertNotNull(results);
    assertTrue(results.size() >= 2, "Need at least 2 results to verify ordering");

    Long previousTimestamp = null;
    for (String json : results) {
      TestExtensionData data = JsonUtils.readValue(json, TestExtensionData.class);
      if (previousTimestamp != null) {
        assertTrue(
            previousTimestamp >= data.updatedAt,
            String.format(
                "Results should be ordered by updatedAt DESC: %d should be >= %d",
                previousTimestamp, data.updatedAt));
      }
      previousTimestamp = data.updatedAt;
    }
  }

  @Test
  @Order(4)
  void test_getEntityHistoryByTimestampRange_pagination() {
    CollectionDAO.EntityExtensionDAO extensionDAO = Entity.getCollectionDAO().entityExtensionDAO();

    List<String> page1 =
        extensionDAO.getEntityHistoryByTimestampRange(
            TABLE_NAME, beforeCreationTs, afterAllCreationTs, "", EXTENSION_PREFIX, null, null, 2);

    assertNotNull(page1);
    assertEquals(2, page1.size(), "First page should have exactly 2 extensions");

    TestExtensionData lastEntityPage1 =
        JsonUtils.readValue(page1.get(page1.size() - 1), TestExtensionData.class);
    Long cursorUpdatedAt = lastEntityPage1.updatedAt;
    String cursorId = lastEntityPage1.id;

    String cursorCondition =
        String.format(
            "AND (updatedAt < %d OR (updatedAt = %d AND id < '%s'))",
            cursorUpdatedAt, cursorUpdatedAt, cursorId);

    List<String> page2 =
        extensionDAO.getEntityHistoryByTimestampRange(
            TABLE_NAME,
            beforeCreationTs,
            afterAllCreationTs,
            cursorCondition,
            EXTENSION_PREFIX,
            cursorUpdatedAt,
            cursorId,
            2);

    assertNotNull(page2);

    Set<String> page1Ids = new HashSet<>();
    for (String json : page1) {
      TestExtensionData data = JsonUtils.readValue(json, TestExtensionData.class);
      page1Ids.add(data.id);
    }

    for (String json : page2) {
      TestExtensionData data = JsonUtils.readValue(json, TestExtensionData.class);
      assertFalse(page1Ids.contains(data.id), "Page 2 should not contain extensions from page 1");
    }
  }

  @Test
  @Order(5)
  void test_getEntityHistoryByTimestampRangeCount_returnsCorrectCount() {
    CollectionDAO.EntityExtensionDAO extensionDAO = Entity.getCollectionDAO().entityExtensionDAO();

    int count =
        extensionDAO.getEntityHistoryByTimestampRangeCount(
            TABLE_NAME, beforeCreationTs, afterAllCreationTs, EXTENSION_PREFIX);

    assertTrue(count >= 5, "Count should be at least 5 (the extensions we created)");

    List<String> allExtensions =
        extensionDAO.getEntityHistoryByTimestampRange(
            TABLE_NAME,
            beforeCreationTs,
            afterAllCreationTs,
            "",
            EXTENSION_PREFIX,
            null,
            null,
            10000);

    assertEquals(
        count,
        allExtensions.size(),
        "Count should match the actual number of extensions returned by data query");
  }

  @Test
  @Order(6)
  void test_getEntityHistoryByTimestampRangeCount_matchesFilteredRange() {
    CollectionDAO.EntityExtensionDAO extensionDAO = Entity.getCollectionDAO().entityExtensionDAO();

    int firstBatchCount =
        extensionDAO.getEntityHistoryByTimestampRangeCount(
            TABLE_NAME, beforeCreationTs, afterFirstBatchTs, EXTENSION_PREFIX);

    int fullRangeCount =
        extensionDAO.getEntityHistoryByTimestampRangeCount(
            TABLE_NAME, beforeCreationTs, afterAllCreationTs, EXTENSION_PREFIX);

    assertTrue(
        fullRangeCount >= firstBatchCount, "Full range count should be >= first batch count");
  }

  @Test
  @Order(7)
  void test_getEntityHistoryByTimestampRange_filtersCorrectlyByExtensionPrefix() {
    CollectionDAO.EntityExtensionDAO extensionDAO = Entity.getCollectionDAO().entityExtensionDAO();

    List<String> ourExtensions =
        extensionDAO.getEntityHistoryByTimestampRange(
            TABLE_NAME,
            beforeCreationTs,
            afterAllCreationTs,
            "",
            EXTENSION_PREFIX,
            null,
            null,
            100);

    List<String> otherExtensions =
        extensionDAO.getEntityHistoryByTimestampRange(
            TABLE_NAME,
            beforeCreationTs,
            afterAllCreationTs,
            "",
            "nonExistentPrefix",
            null,
            null,
            100);

    assertTrue(ourExtensions.size() >= 5, "Should find our test extensions");
    assertTrue(otherExtensions.isEmpty(), "Should not find extensions with non-existent prefix");
  }

  @Test
  @Order(8)
  void test_getEntityHistoryByTimestampRange_emptyRangeReturnsEmptyList() {
    CollectionDAO.EntityExtensionDAO extensionDAO = Entity.getCollectionDAO().entityExtensionDAO();

    long futureStart = System.currentTimeMillis() + 86400000L;
    long futureEnd = futureStart + 3600000L;

    List<String> results =
        extensionDAO.getEntityHistoryByTimestampRange(
            TABLE_NAME, futureStart, futureEnd, "", EXTENSION_PREFIX, null, null, 100);

    assertNotNull(results);
    assertTrue(results.isEmpty(), "Should return empty list for future timestamp range");

    int count =
        extensionDAO.getEntityHistoryByTimestampRangeCount(
            TABLE_NAME, futureStart, futureEnd, EXTENSION_PREFIX);
    assertEquals(0, count, "Count should be 0 for future timestamp range");
  }

  @Test
  @Order(9)
  void test_getEntityHistoryByTimestampRange_limitIsRespected() {
    CollectionDAO.EntityExtensionDAO extensionDAO = Entity.getCollectionDAO().entityExtensionDAO();

    List<String> results1 =
        extensionDAO.getEntityHistoryByTimestampRange(
            TABLE_NAME, beforeCreationTs, afterAllCreationTs, "", EXTENSION_PREFIX, null, null, 1);

    assertNotNull(results1);
    assertEquals(1, results1.size(), "Should return exactly 1 extension when limit is 1");

    List<String> results3 =
        extensionDAO.getEntityHistoryByTimestampRange(
            TABLE_NAME, beforeCreationTs, afterAllCreationTs, "", EXTENSION_PREFIX, null, null, 3);

    assertNotNull(results3);
    assertEquals(3, results3.size(), "Should return exactly 3 extensions when limit is 3");
  }

  @Test
  @Order(10)
  void test_getEntityHistoryByTimestampRange_inclusiveBoundaries() {
    CollectionDAO.EntityExtensionDAO extensionDAO = Entity.getCollectionDAO().entityExtensionDAO();

    long knownTimestamp = testExtensionTimestamps.get(0);

    List<String> results =
        extensionDAO.getEntityHistoryByTimestampRange(
            TABLE_NAME, knownTimestamp, knownTimestamp, "", EXTENSION_PREFIX, null, null, 100);

    assertTrue(
        results.size() >= 1,
        "Should find at least one extension when querying with exact timestamp (inclusive boundaries)");

    int count =
        extensionDAO.getEntityHistoryByTimestampRangeCount(
            TABLE_NAME, knownTimestamp, knownTimestamp, EXTENSION_PREFIX);
    assertTrue(count >= 1, "Count should be >= 1 at exact timestamp boundary");
  }

  /** Simple POJO for test extension data with updatedAt field */
  public static class TestExtensionData {
    public String id;
    public long updatedAt;
    public String value;

    public TestExtensionData() {}

    public TestExtensionData(String id, long updatedAt, String value) {
      this.id = id;
      this.updatedAt = updatedAt;
      this.value = value;
    }
  }
}
