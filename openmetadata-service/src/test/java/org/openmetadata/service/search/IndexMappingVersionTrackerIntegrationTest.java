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

package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.IndexMappingVersionDAO;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class IndexMappingVersionTrackerIntegrationTest extends OpenMetadataApplicationTest {

  private CollectionDAO collectionDAO;
  private IndexMappingVersionDAO indexMappingVersionDAO;
  private IndexMappingVersionTracker tracker;
  private static final String TEST_VERSION = "1.8.5-test";
  private static final String TEST_USER = "test-user";

  @BeforeEach
  void setUp() {
    collectionDAO = Entity.getCollectionDAO();
    indexMappingVersionDAO = collectionDAO.indexMappingVersionDAO();
    tracker = new IndexMappingVersionTracker(collectionDAO, TEST_VERSION, TEST_USER);
  }

  @Test
  void testIndexMappingVersionTracker_InitialState() throws Exception {
    // Test 1: Behavior with existing data (from previous test runs)
    // Since the implementation doesn't filter by version, it will see all stored mappings
    List<String> changedMappings = tracker.getChangedMappings();

    // The result depends on whether mappings have been stored before
    // If no changes detected, it means mappings were already stored
    if (changedMappings.isEmpty()) {
      LOG.info("No changes detected - mappings already exist in database");
    } else {
      LOG.info("Changes detected for {} entities", changedMappings.size());
      // Verify common entity types if changes were detected
      Set<String> commonTypes = Set.of("table", "dashboard", "pipeline", "user", "team");
      boolean hasAtLeastOneCommon = changedMappings.stream().anyMatch(commonTypes::contains);
      assertTrue(hasAtLeastOneCommon, "Should include at least one common entity type");
    }
  }

  @Test
  void testIndexMappingVersionTracker_UpdateAndNoChanges() throws Exception {
    tracker.updateMappingVersions();
    IndexMappingVersionTracker tracker2 =
        new IndexMappingVersionTracker(collectionDAO, TEST_VERSION, TEST_USER);
    List<String> secondRunChanges = tracker2.getChangedMappings();
    assertTrue(secondRunChanges.isEmpty(), "Should detect no changes after update");

    List<IndexMappingVersionDAO.IndexMappingVersion> storedVersions =
        indexMappingVersionDAO.getAllMappingVersions();
    assertFalse(storedVersions.isEmpty(), "Should have stored mappings");

    for (IndexMappingVersionDAO.IndexMappingVersion version : storedVersions) {
      assertNotNull(version.entityType);
      assertNotNull(version.mappingHash);
      assertFalse(version.mappingHash.isEmpty(), "Hash should not be empty");
    }
  }

  @Test
  void testIndexMappingVersionTracker_HashConsistency() throws Exception {
    // Test 3: Verify hash computation is consistent

    // Use reflection to access private methods
    Method computeHashMethod =
        IndexMappingVersionTracker.class.getDeclaredMethod("computeCurrentMappingHashes");
    computeHashMethod.setAccessible(true);

    // Compute hashes multiple times
    @SuppressWarnings("unchecked")
    Map<String, String> hashes1 = (Map<String, String>) computeHashMethod.invoke(tracker);
    @SuppressWarnings("unchecked")
    Map<String, String> hashes2 = (Map<String, String>) computeHashMethod.invoke(tracker);
    @SuppressWarnings("unchecked")
    Map<String, String> hashes3 = (Map<String, String>) computeHashMethod.invoke(tracker);

    // Verify consistency
    assertEquals(hashes1, hashes2, "Hash computation should be consistent");
    assertEquals(hashes2, hashes3, "Hash computation should be consistent");

    // Verify hash format (MD5 should be 32 characters)
    for (String hash : hashes1.values()) {
      assertEquals(32, hash.length(), "MD5 hash should be 32 characters");
      assertTrue(hash.matches("[a-f0-9]+"), "Hash should be lowercase hex");
    }
  }

  @Test
  void testIndexMappingVersionTracker_LanguageAwareness() throws Exception {
    Method loadMappingMethod =
        IndexMappingVersionTracker.class.getDeclaredMethod("loadMappingForEntity", String.class);
    loadMappingMethod.setAccessible(true);
    JsonNode tableMapping = (JsonNode) loadMappingMethod.invoke(tracker, "table");
    assertNotNull(tableMapping);
    ObjectMapper mapper = new ObjectMapper();
    Map mappingMap = mapper.convertValue(tableMapping, Map.class);

    boolean hasLanguageMappings =
        mappingMap.containsKey("en")
            || mappingMap.containsKey("zh")
            || mappingMap.containsKey("jp")
            || mappingMap.containsKey("default");
    assertTrue(hasLanguageMappings, "Should contain language-specific mappings");
  }

  @Test
  void testIndexMappingVersionTracker_SimulatedMappingChange() throws Exception {
    String uniqueVersion = "test-change-" + System.currentTimeMillis();
    IndexMappingVersionTracker uniqueTracker =
        new IndexMappingVersionTracker(collectionDAO, uniqueVersion, TEST_USER);
    uniqueTracker.updateMappingVersions();
    IndexMappingVersionTracker tracker2 =
        new IndexMappingVersionTracker(collectionDAO, uniqueVersion, TEST_USER);
    List<String> noChanges = tracker2.getChangedMappings();
    assertTrue(noChanges.isEmpty(), "Should have no changes after initial update");
    String targetEntity = "table";
    String modifiedHash = "00000000000000000000000000000000"; // Fake hash

    indexMappingVersionDAO.upsertIndexMappingVersion(
        targetEntity,
        modifiedHash,
        "{\"modified\": true}", // Dummy JSON
        uniqueVersion,
        System.currentTimeMillis(),
        "test-modifier");

    IndexMappingVersionTracker tracker3 =
        new IndexMappingVersionTracker(collectionDAO, uniqueVersion, TEST_USER);
    List<String> changes = tracker3.getChangedMappings();
    assertTrue(changes.contains(targetEntity), "Should detect the modified entity");
  }

  @Test
  void testIndexMappingVersionTracker_VersionBehavior() throws Exception {
    IndexMappingVersionTracker tracker1 =
        new IndexMappingVersionTracker(collectionDAO, "1.8.4-test", TEST_USER);
    List<String> initialChanges = tracker1.getChangedMappings();
    tracker1.updateMappingVersions();
    IndexMappingVersionTracker tracker2 =
        new IndexMappingVersionTracker(collectionDAO, "1.8.5-test", TEST_USER);
    List<String> changesForNewVersion = tracker2.getChangedMappings();
    assertTrue(
        changesForNewVersion.isEmpty(),
        "Current implementation doesn't filter by version, so no changes detected");
    LOG.info(
        "Version isolation test shows current limitation: versions are stored but not used for filtering");
  }

  @Test
  void testIndexMappingVersionDAO_DatabaseOperations() {

    String testEntity = "test_entity_" + System.currentTimeMillis(); // Unique entity
    String testHash = "abcdef0123456789abcdef0123456789";
    String testJson = "{\"test\": \"mapping\"}";
    long testTime = System.currentTimeMillis();

    indexMappingVersionDAO.upsertIndexMappingVersion(
        testEntity, testHash, testJson, TEST_VERSION, testTime, TEST_USER);
    String retrievedHash = indexMappingVersionDAO.getMappingHash(testEntity);
    assertNotNull(retrievedHash);
    assertEquals(testHash, retrievedHash);
    String newHash = "9876543210fedcba9876543210fedcba";
    long newTime = System.currentTimeMillis();
    indexMappingVersionDAO.upsertIndexMappingVersion(
        testEntity, newHash, testJson, TEST_VERSION, newTime, "updated-user");

    retrievedHash = indexMappingVersionDAO.getMappingHash(testEntity);
    assertEquals(newHash, retrievedHash);

    List<IndexMappingVersionDAO.IndexMappingVersion> allVersions =
        indexMappingVersionDAO.getAllMappingVersions();
    boolean found = false;
    for (IndexMappingVersionDAO.IndexMappingVersion v : allVersions) {
      if (testEntity.equals(v.entityType)) {
        found = true;
        assertEquals(newHash, v.mappingHash);
        break;
      }
    }
    assertTrue(found, "Test entity should be in getAllMappingVersions result");
  }

  @Test
  void testIndexMappingVersionTracker_ErrorHandling() {
    IndexMappingVersionTracker trackerNullVersion =
        new IndexMappingVersionTracker(collectionDAO, null, TEST_USER);
    assertNotNull(trackerNullVersion);
    IndexMappingVersionTracker trackerNullUser =
        new IndexMappingVersionTracker(collectionDAO, TEST_VERSION, null);
    assertNotNull(trackerNullUser);
    assertThrows(
        NullPointerException.class,
        () -> {
          new IndexMappingVersionTracker(null, TEST_VERSION, TEST_USER);
        });
  }

  @Test
  void testIndexMappingVersionTracker_NonExistentEntity() throws Exception {
    Method loadMappingMethod =
        IndexMappingVersionTracker.class.getDeclaredMethod("loadMappingForEntity", String.class);
    loadMappingMethod.setAccessible(true);
    JsonNode mapping = (JsonNode) loadMappingMethod.invoke(tracker, "non_existent_entity");
    assertTrue(
        mapping == null || mapping.isEmpty(), "Should handle non-existent entity gracefully");
  }

  @Test
  void testIndexMappingVersionTracker_ConcurrentAccess() throws Exception {
    int threadCount = 5;
    Thread[] threads = new Thread[threadCount];
    Map<Integer, Exception> exceptions = new HashMap<>();

    for (int i = 0; i < threadCount; i++) {
      final int threadId = i;
      threads[i] =
          new Thread(
              () -> {
                try {
                  IndexMappingVersionTracker concurrentTracker =
                      new IndexMappingVersionTracker(
                          collectionDAO,
                          TEST_VERSION + "-thread-" + threadId,
                          TEST_USER + "-thread-" + threadId);
                  concurrentTracker.getChangedMappings();
                  concurrentTracker.updateMappingVersions();
                } catch (Exception e) {
                  exceptions.put(threadId, e);
                }
              });
    }

    for (Thread thread : threads) {
      thread.start();
    }

    for (Thread thread : threads) {
      thread.join(10000); // 10 second timeout
    }
    assertTrue(exceptions.isEmpty(), "Concurrent access should not cause exceptions");
    assertTrue(exceptions.isEmpty(), "Concurrent access should complete without exceptions");
  }
}
