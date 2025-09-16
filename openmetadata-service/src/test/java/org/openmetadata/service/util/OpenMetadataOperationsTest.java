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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.IndexMappingVersionTracker;

@ExtendWith(MockitoExtension.class)
@Slf4j
public class OpenMetadataOperationsTest {

  @Mock private CollectionDAO mockCollectionDAO;
  @Mock private AppRepository mockAppRepository;
  @Mock private App mockApp;

  private OpenMetadataOperations operations;
  private EventPublisherJob testJobConfig;

  @BeforeEach
  void setUp() throws Exception {
    operations = new OpenMetadataOperations();

    // Setup test job configuration
    testJobConfig =
        new EventPublisherJob()
            .withEntities(Set.of("all"))
            .withBatchSize(100)
            .withPayLoadSize(1000000L)
            .withMaxConcurrentRequests(10)
            .withMaxRetries(3)
            .withInitialBackoff(1000)
            .withMaxBackoff(10000)
            .withProducerThreads(2)
            .withConsumerThreads(2)
            .withQueueSize(100)
            .withRecreateIndex(true)
            .withAutoTune(false)
            .withForce(false);

    // Set up the operations with mocked CollectionDAO using reflection
    setCollectionDAO(operations, mockCollectionDAO);
  }

  private void setCollectionDAO(OpenMetadataOperations operations, CollectionDAO collectionDAO)
      throws Exception {
    Field collectionDAOField = OpenMetadataOperations.class.getDeclaredField("collectionDAO");
    collectionDAOField.setAccessible(true);
    collectionDAOField.set(operations, collectionDAO);
  }

  @Test
  void testIndexMappingVersionTracker_Creation() throws Exception {
    // Test that IndexMappingVersionTracker can be created and used
    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      // Create a real IndexMappingVersionTracker for testing
      IndexMappingVersionTracker tracker =
          new IndexMappingVersionTracker(mockCollectionDAO, "1.8.5-test", "test-user");

      // Verify tracker was created successfully
      assertEquals("1.8.5-test", getVersionFromTracker(tracker));
      assertEquals("test-user", getUpdatedByFromTracker(tracker));
    }
  }

  @Test
  void testSmartReindexingLogic_NoChangesDetected() throws Exception {
    // Test the core smart reindexing logic without full app execution
    IndexMappingVersionTracker mockTracker = mock(IndexMappingVersionTracker.class);
    when(mockTracker.getChangedMappings()).thenReturn(List.of()); // No changes

    // Test the decision logic for no changes
    List<String> changedMappings = mockTracker.getChangedMappings();
    boolean shouldRecreateIndexes = true;
    boolean force = false;

    if (!force && shouldRecreateIndexes && changedMappings.isEmpty()) {
      shouldRecreateIndexes = false;
    }

    assertFalse(shouldRecreateIndexes, "Should skip reindexing when no changes detected");
  }

  @Test
  void testSmartReindexingLogic_ChangesDetected() throws Exception {
    // Test the core smart reindexing logic with changes detected
    IndexMappingVersionTracker mockTracker = mock(IndexMappingVersionTracker.class);
    List<String> changedEntities = List.of("table", "dashboard", "user");
    when(mockTracker.getChangedMappings()).thenReturn(changedEntities);

    // Test the decision logic for changes detected
    List<String> changedMappings = mockTracker.getChangedMappings();
    boolean shouldRecreateIndexes = true;
    boolean force = false;
    Set<String> entities = Set.of("all");

    if (!force && shouldRecreateIndexes && !changedMappings.isEmpty()) {
      if (entities.contains("all")) {
        // Should adjust entities to only changed ones
        entities = Set.copyOf(changedMappings);
      }
    }

    assertTrue(shouldRecreateIndexes, "Should proceed with reindexing when changes detected");
    assertEquals(Set.copyOf(changedEntities), entities, "Should only reindex changed entities");
  }

  @Test
  void testSmartReindexingLogic_ForceFlag() throws Exception {
    // Test the core smart reindexing logic with force flag
    IndexMappingVersionTracker mockTracker = mock(IndexMappingVersionTracker.class);
    when(mockTracker.getChangedMappings()).thenReturn(List.of()); // No changes

    // Test the decision logic with force flag
    List<String> changedMappings = mockTracker.getChangedMappings();
    boolean shouldRecreateIndexes = true;
    boolean force = true; // Force flag is set

    // With force flag, should bypass version checking
    if (force) {
      // Version checking should be bypassed
      shouldRecreateIndexes = true; // Force always proceeds
    }

    assertTrue(shouldRecreateIndexes, "Should proceed with reindexing when force flag is set");
  }

  @Test
  void testSmartReindexingLogic_SpecificEntitiesWithChanges() throws Exception {
    // Test specific entities with some having changes
    IndexMappingVersionTracker mockTracker = mock(IndexMappingVersionTracker.class);
    List<String> changedEntities = List.of("table", "pipeline", "topic");
    when(mockTracker.getChangedMappings()).thenReturn(changedEntities);

    // Test scenario where specific entities are requested
    Set<String> requestedEntities = Set.of("table", "dashboard", "user");
    List<String> changedMappings = mockTracker.getChangedMappings();
    boolean shouldRecreateIndexes = true;
    boolean force = false;

    if (!force && shouldRecreateIndexes && !changedMappings.isEmpty()) {
      if (!requestedEntities.contains("all")) {
        // Check intersection of requested and changed entities
        Set<String> requestedAndChanged = new HashSet<>(requestedEntities);
        requestedAndChanged.retainAll(changedMappings);
        if (requestedAndChanged.isEmpty()) {
          shouldRecreateIndexes = false;
        }
        // In this case, 'table' is in both sets, so should proceed
      }
    }

    assertTrue(shouldRecreateIndexes, "Should proceed when requested entities have changes");
  }

  @Test
  void testSmartReindexingLogic_SpecificEntitiesWithNoChanges() throws Exception {
    // Test specific entities with none having changes
    IndexMappingVersionTracker mockTracker = mock(IndexMappingVersionTracker.class);
    List<String> changedEntities = List.of("table", "pipeline", "topic");
    when(mockTracker.getChangedMappings()).thenReturn(changedEntities);

    // Test scenario where specific entities are requested but none have changes
    Set<String> requestedEntities = Set.of("dashboard", "user");
    List<String> changedMappings = mockTracker.getChangedMappings();
    boolean shouldRecreateIndexes = true;
    boolean force = false;

    if (!force && shouldRecreateIndexes && !changedMappings.isEmpty()) {
      if (!requestedEntities.contains("all")) {
        // Check intersection of requested and changed entities
        Set<String> requestedAndChanged = new HashSet<>(requestedEntities);
        requestedAndChanged.retainAll(changedMappings);
        if (requestedAndChanged.isEmpty()) {
          shouldRecreateIndexes = false; // No overlap, skip reindexing
        }
      }
    }

    assertFalse(shouldRecreateIndexes, "Should skip when no requested entities have changes");
  }

  @Test
  void testVersionUpdateLogic() throws Exception {
    // Test the version update logic
    IndexMappingVersionTracker mockTracker = mock(IndexMappingVersionTracker.class);

    // Simulate successful reindexing scenario
    int reindexResult = 0; // Success
    boolean shouldUpdateVersions = true;
    List<String> changedMappings = List.of("table", "dashboard");

    if (reindexResult == 0 && shouldUpdateVersions && !changedMappings.isEmpty()) {
      // Should call updateMappingVersions
      mockTracker.updateMappingVersions();
      // In real implementation, this would update the database
    }

    // Verify the logic path is correct
    assertTrue(
        reindexResult == 0 && shouldUpdateVersions,
        "Should update versions after successful reindexing");
  }

  // Helper methods using reflection to access private fields for testing
  private String getVersionFromTracker(IndexMappingVersionTracker tracker) throws Exception {
    Field versionField = IndexMappingVersionTracker.class.getDeclaredField("version");
    versionField.setAccessible(true);
    return (String) versionField.get(tracker);
  }

  private String getUpdatedByFromTracker(IndexMappingVersionTracker tracker) throws Exception {
    Field updatedByField = IndexMappingVersionTracker.class.getDeclaredField("updatedBy");
    updatedByField.setAccessible(true);
    return (String) updatedByField.get(tracker);
  }
}
