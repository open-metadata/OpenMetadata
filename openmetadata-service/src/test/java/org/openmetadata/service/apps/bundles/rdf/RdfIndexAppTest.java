package org.openmetadata.service.apps.bundles.rdf;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipObject;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.search.SearchRepository;

@ExtendWith(MockitoExtension.class)
@DisplayName("RdfIndexApp Tests")
class RdfIndexAppTest {

  @Mock private CollectionDAO collectionDAO;
  @Mock private SearchRepository searchRepository;
  @Mock private EntityRelationshipDAO relationshipDAO;

  private static MockedStatic<RdfRepository> rdfRepositoryMockedStatic;
  private static RdfRepository mockRdfRepository;
  private RdfIndexApp rdfIndexApp;

  @BeforeAll
  static void setUpClass() {
    mockRdfRepository = mock(RdfRepository.class);
    rdfRepositoryMockedStatic = mockStatic(RdfRepository.class);
    rdfRepositoryMockedStatic.when(RdfRepository::getInstance).thenReturn(mockRdfRepository);
  }

  @AfterAll
  static void tearDownClass() {
    if (rdfRepositoryMockedStatic != null) {
      rdfRepositoryMockedStatic.close();
    }
  }

  @BeforeEach
  void setUp() {
    lenient().when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    rdfIndexApp = new RdfIndexApp(collectionDAO, searchRepository);
  }

  @Nested
  @DisplayName("Configuration Tests")
  class ConfigurationTests {

    @Test
    @DisplayName("Should have correct default batch size")
    void testDefaultBatchSize() {
      assertEquals(100, getDefaultBatchSize());
    }

    @Test
    @DisplayName("Should have correct max producer threads")
    void testMaxProducerThreads() {
      assertEquals(10, getMaxProducerThreads());
    }

    @Test
    @DisplayName("Should have correct max consumer threads")
    void testMaxConsumerThreads() {
      assertEquals(5, getMaxConsumerThreads());
    }

    @Test
    @DisplayName("Should have all relationship types defined for complete reindexing")
    void testAllRelationshipTypes() {
      List<Integer> actualRelationships = getAllRelationships();
      // Should include ALL relationship types for complete bootstrap/reindex
      assertEquals(Relationship.values().length, actualRelationships.size());
      for (Relationship rel : Relationship.values()) {
        assertTrue(
            actualRelationships.contains(rel.ordinal()),
            "Should contain " + rel.name() + " relationship");
      }
    }

    private int getDefaultBatchSize() {
      try {
        var field = RdfIndexApp.class.getDeclaredField("DEFAULT_BATCH_SIZE");
        field.setAccessible(true);
        return (int) field.get(null);
      } catch (Exception e) {
        fail("Could not access DEFAULT_BATCH_SIZE field");
        return -1;
      }
    }

    private int getMaxProducerThreads() {
      try {
        var field = RdfIndexApp.class.getDeclaredField("MAX_PRODUCER_THREADS");
        field.setAccessible(true);
        return (int) field.get(null);
      } catch (Exception e) {
        fail("Could not access MAX_PRODUCER_THREADS field");
        return -1;
      }
    }

    private int getMaxConsumerThreads() {
      try {
        var field = RdfIndexApp.class.getDeclaredField("MAX_CONSUMER_THREADS");
        field.setAccessible(true);
        return (int) field.get(null);
      } catch (Exception e) {
        fail("Could not access MAX_CONSUMER_THREADS field");
        return -1;
      }
    }

    @SuppressWarnings("unchecked")
    private List<Integer> getAllRelationships() {
      try {
        var field = RdfIndexApp.class.getDeclaredField("ALL_RELATIONSHIPS");
        field.setAccessible(true);
        return (List<Integer>) field.get(null);
      } catch (Exception e) {
        fail("Could not access ALL_RELATIONSHIPS field");
        return List.of();
      }
    }
  }

  @Nested
  @DisplayName("Initialization Tests")
  class InitializationTests {

    @Test
    @DisplayName("Should initialize jobData from app configuration")
    void testInitWithAppConfig() throws Exception {
      // Directly set jobData to test parsing without full init
      var jobDataField = RdfIndexApp.class.getDeclaredField("jobData");
      jobDataField.setAccessible(true);

      EventPublisherJob jobConfig = new EventPublisherJob();
      jobConfig.setEntities(Set.of("table"));
      jobConfig.setBatchSize(50);
      jobDataField.set(rdfIndexApp, jobConfig);

      EventPublisherJob jobData = rdfIndexApp.getJobData();
      assertNotNull(jobData);
      assertEquals(50, jobData.getBatchSize());
      assertTrue(jobData.getEntities().contains("table"));
    }

    @Test
    @DisplayName("Should handle null jobData gracefully")
    void testInitWithNullConfig() throws Exception {
      var jobDataField = RdfIndexApp.class.getDeclaredField("jobData");
      jobDataField.setAccessible(true);

      // jobData is null by default
      assertNull(rdfIndexApp.getJobData());
    }
  }

  @Nested
  @DisplayName("Entity Relationship Conversion Tests")
  class EntityRelationshipConversionTests {

    @Test
    @DisplayName("Should convert EntityRelationshipObject to EntityRelationship")
    void testConvertToEntityRelationship() throws Exception {
      UUID fromId = UUID.randomUUID();
      UUID toId = UUID.randomUUID();

      EntityRelationshipObject relObj =
          EntityRelationshipObject.builder()
              .fromId(fromId.toString())
              .toId(toId.toString())
              .fromEntity("table")
              .toEntity("database")
              .relation(Relationship.CONTAINS.ordinal())
              .build();

      var method =
          RdfIndexApp.class.getDeclaredMethod(
              "convertToEntityRelationship", EntityRelationshipObject.class);
      method.setAccessible(true);

      org.openmetadata.schema.type.EntityRelationship result =
          (org.openmetadata.schema.type.EntityRelationship) method.invoke(rdfIndexApp, relObj);

      assertNotNull(result);
      assertEquals(fromId, result.getFromId());
      assertEquals(toId, result.getToId());
      assertEquals("table", result.getFromEntity());
      assertEquals("database", result.getToEntity());
      assertEquals(Relationship.CONTAINS.ordinal(), result.getRelation());
      assertEquals(Relationship.CONTAINS, result.getRelationshipType());
    }

    @Test
    @DisplayName("Should handle UUID conversion for relationship objects")
    void testUuidConversion() throws Exception {
      String fromIdStr = "123e4567-e89b-12d3-a456-426614174000";
      String toIdStr = "123e4567-e89b-12d3-a456-426614174001";

      EntityRelationshipObject relObj =
          EntityRelationshipObject.builder()
              .fromId(fromIdStr)
              .toId(toIdStr)
              .fromEntity("table")
              .toEntity("column")
              .relation(Relationship.HAS.ordinal())
              .build();

      var method =
          RdfIndexApp.class.getDeclaredMethod(
              "convertToEntityRelationship", EntityRelationshipObject.class);
      method.setAccessible(true);

      org.openmetadata.schema.type.EntityRelationship result =
          (org.openmetadata.schema.type.EntityRelationship) method.invoke(rdfIndexApp, relObj);

      assertEquals(UUID.fromString(fromIdStr), result.getFromId());
      assertEquals(UUID.fromString(toIdStr), result.getToId());
    }

    @Test
    @DisplayName("Should handle all relationship types correctly")
    void testAllRelationshipTypes() throws Exception {
      var method =
          RdfIndexApp.class.getDeclaredMethod(
              "convertToEntityRelationship", EntityRelationshipObject.class);
      method.setAccessible(true);

      for (Relationship relationship : Relationship.values()) {
        UUID fromId = UUID.randomUUID();
        UUID toId = UUID.randomUUID();

        EntityRelationshipObject relObj =
            EntityRelationshipObject.builder()
                .fromId(fromId.toString())
                .toId(toId.toString())
                .fromEntity("entity1")
                .toEntity("entity2")
                .relation(relationship.ordinal())
                .build();

        org.openmetadata.schema.type.EntityRelationship result =
            (org.openmetadata.schema.type.EntityRelationship) method.invoke(rdfIndexApp, relObj);

        assertEquals(relationship, result.getRelationshipType());
        assertEquals(relationship.ordinal(), result.getRelation());
      }
    }
  }

  @Nested
  @DisplayName("Memory-Aware Queue Size Tests")
  class MemoryAwareQueueSizeTests {

    @Test
    @DisplayName("Should calculate memory-aware queue size")
    void testCalculateMemoryAwareQueueSize() throws Exception {
      // Initialize just the jobData without calling init() to avoid Entity repository lookup
      var jobDataField = RdfIndexApp.class.getDeclaredField("jobData");
      jobDataField.setAccessible(true);
      EventPublisherJob jobConfig = new EventPublisherJob();
      jobConfig.setBatchSize(100);
      jobDataField.set(rdfIndexApp, jobConfig);

      var method = RdfIndexApp.class.getDeclaredMethod("calculateMemoryAwareQueueSize", int.class);
      method.setAccessible(true);

      int result = (int) method.invoke(rdfIndexApp, 10000);

      assertTrue(result >= 100, "Queue size should be at least 100");
      assertTrue(result <= 10000, "Queue size should not exceed requested size");
    }

    @Test
    @DisplayName("Should return minimum queue size when memory is constrained")
    void testMinimumQueueSize() throws Exception {
      // Initialize just the jobData without calling init() to avoid Entity repository lookup
      var jobDataField = RdfIndexApp.class.getDeclaredField("jobData");
      jobDataField.setAccessible(true);
      EventPublisherJob jobConfig = new EventPublisherJob();
      jobConfig.setBatchSize(1000);
      jobDataField.set(rdfIndexApp, jobConfig);

      var method = RdfIndexApp.class.getDeclaredMethod("calculateMemoryAwareQueueSize", int.class);
      method.setAccessible(true);

      int result = (int) method.invoke(rdfIndexApp, 50);

      assertTrue(result >= 50, "Queue size should be at least the requested size when small");
    }
  }

  @Nested
  @DisplayName("Stop Functionality Tests")
  class StopFunctionalityTests {

    @Test
    @DisplayName("Should set stopped flag when stop is called")
    void testStopSetsStopped() throws Exception {
      // Initialize just the jobData without calling init() to avoid Entity repository lookup
      var jobDataField = RdfIndexApp.class.getDeclaredField("jobData");
      jobDataField.setAccessible(true);
      EventPublisherJob jobConfig = new EventPublisherJob();
      jobConfig.setStatus(EventPublisherJob.Status.RUNNING);
      jobDataField.set(rdfIndexApp, jobConfig);

      rdfIndexApp.stop();

      var stoppedField = RdfIndexApp.class.getDeclaredField("stopped");
      stoppedField.setAccessible(true);
      assertTrue((boolean) stoppedField.get(rdfIndexApp));
    }

    @Test
    @DisplayName("Should set producersDone flag when stop is called")
    void testStopSetsProducersDone() throws Exception {
      // Initialize just the jobData without calling init() to avoid Entity repository lookup
      var jobDataField = RdfIndexApp.class.getDeclaredField("jobData");
      jobDataField.setAccessible(true);
      EventPublisherJob jobConfig = new EventPublisherJob();
      jobConfig.setStatus(EventPublisherJob.Status.RUNNING);
      jobDataField.set(rdfIndexApp, jobConfig);

      rdfIndexApp.stop();

      var producersDoneField = RdfIndexApp.class.getDeclaredField("producersDone");
      producersDoneField.setAccessible(true);
      var producersDone =
          (java.util.concurrent.atomic.AtomicBoolean) producersDoneField.get(rdfIndexApp);
      assertTrue(producersDone.get());
    }

    @Test
    @DisplayName("Should update job status to STOP_IN_PROGRESS")
    void testStopUpdatesJobStatus() throws Exception {
      // Initialize just the jobData without calling init() to avoid Entity repository lookup
      var jobDataField = RdfIndexApp.class.getDeclaredField("jobData");
      jobDataField.setAccessible(true);
      EventPublisherJob jobConfig = new EventPublisherJob();
      jobConfig.setStatus(EventPublisherJob.Status.RUNNING);
      jobDataField.set(rdfIndexApp, jobConfig);

      rdfIndexApp.stop();

      assertEquals(EventPublisherJob.Status.STOP_IN_PROGRESS, rdfIndexApp.getJobData().getStatus());
    }
  }

  @Nested
  @DisplayName("Validation Tests")
  class ValidationTests {

    @Test
    @DisplayName("Should validate valid configuration")
    void testValidateValidConfig() {
      EventPublisherJob validConfig = new EventPublisherJob();
      validConfig.setEntities(Set.of("table"));
      validConfig.setBatchSize(100);

      assertDoesNotThrow(
          () ->
              rdfIndexApp.validateConfig(
                  org.openmetadata.schema.utils.JsonUtils.convertValue(
                      validConfig, java.util.Map.class)));
    }
  }

  @Nested
  @DisplayName("IndexingTask Record Tests")
  class IndexingTaskTests {

    @Test
    @DisplayName("Should identify poison pill correctly")
    void testPoisonPillIdentification() {
      var poisonPill = new RdfIndexApp.IndexingTask("__POISON_PILL__", null, -1, 0);
      assertTrue(poisonPill.isPoisonPill());
    }

    @Test
    @DisplayName("Should not identify regular task as poison pill")
    void testRegularTaskNotPoisonPill() {
      List<EntityInterface> entities = new ArrayList<>();
      var regularTask = new RdfIndexApp.IndexingTask("table", entities, 0, 0);
      assertFalse(regularTask.isPoisonPill());
    }

    @Test
    @DisplayName("Should create task with default retry count")
    void testTaskWithDefaultRetryCount() {
      List<EntityInterface> entities = new ArrayList<>();
      var task = new RdfIndexApp.IndexingTask("table", entities, 100);
      assertEquals(0, task.retryCount());
      assertEquals("table", task.entityType());
      assertEquals(100, task.offset());
    }

    @Test
    @DisplayName("Should preserve entity list in task")
    void testTaskPreservesEntities() {
      List<EntityInterface> entities = new ArrayList<>();
      var task = new RdfIndexApp.IndexingTask("column", entities, 50, 2);
      assertSame(entities, task.entities());
      assertEquals("column", task.entityType());
      assertEquals(50, task.offset());
      assertEquals(2, task.retryCount());
    }
  }

  @Nested
  @DisplayName("Relationship Storage Tests")
  class RelationshipStorageTests {

    @Test
    @DisplayName("Should query ALL relationship types when processing batch relationships")
    void testProcessBatchRelationshipsQueriesAllTypes() throws Exception {
      // Setup mock entities
      List<EntityInterface> mockEntities = new ArrayList<>();
      EntityInterface mockEntity = mock(EntityInterface.class);
      UUID entityId = UUID.randomUUID();
      when(mockEntity.getId()).thenReturn(entityId);
      mockEntities.add(mockEntity);

      // Setup mock relationship results (empty list is fine - we're testing the query params)
      when(relationshipDAO.findToBatchWithRelations(anyList(), anyString(), anyList()))
          .thenReturn(new ArrayList<>());
      when(relationshipDAO.findFromBatch(anyList(), anyInt(), any(Include.class)))
          .thenReturn(new ArrayList<>());

      // Call processBatchRelationships via reflection
      var method =
          RdfIndexApp.class.getDeclaredMethod(
              "processBatchRelationships", String.class, List.class);
      method.setAccessible(true);
      method.invoke(rdfIndexApp, "table", mockEntities);

      // Verify findToBatchWithRelations was called with ALL relationship types
      var captor = org.mockito.ArgumentCaptor.forClass(List.class);
      verify(relationshipDAO).findToBatchWithRelations(anyList(), eq("table"), captor.capture());

      @SuppressWarnings("unchecked")
      List<Integer> queriedRelationships = captor.getValue();

      // Should include ALL relationship types
      assertEquals(
          Relationship.values().length,
          queriedRelationships.size(),
          "Should query ALL relationship types, not a subset");

      for (Relationship rel : Relationship.values()) {
        assertTrue(
            queriedRelationships.contains(rel.ordinal()),
            "Should include " + rel.name() + " relationship in query");
      }
    }

    @Test
    @DisplayName("Should store relationships returned from batch query")
    void testProcessBatchRelationshipsStoresResults() throws Exception {
      // Setup mock entities
      List<EntityInterface> mockEntities = new ArrayList<>();
      EntityInterface mockEntity = mock(EntityInterface.class);
      UUID entityId = UUID.randomUUID();
      when(mockEntity.getId()).thenReturn(entityId);
      mockEntities.add(mockEntity);

      // Create mock relationship results
      UUID fromId = UUID.randomUUID();
      UUID toId = UUID.randomUUID();
      List<EntityRelationshipObject> mockRelationships = new ArrayList<>();
      mockRelationships.add(
          EntityRelationshipObject.builder()
              .fromId(fromId.toString())
              .toId(toId.toString())
              .fromEntity("table")
              .toEntity("database")
              .relation(Relationship.CONTAINS.ordinal())
              .build());
      mockRelationships.add(
          EntityRelationshipObject.builder()
              .fromId(fromId.toString())
              .toId(UUID.randomUUID().toString())
              .fromEntity("table")
              .toEntity("user")
              .relation(Relationship.OWNS.ordinal())
              .build());

      when(relationshipDAO.findToBatchWithRelations(anyList(), anyString(), anyList()))
          .thenReturn(mockRelationships);
      when(relationshipDAO.findFromBatch(anyList(), anyInt(), any(Include.class)))
          .thenReturn(new ArrayList<>());

      // Call processBatchRelationships
      var method =
          RdfIndexApp.class.getDeclaredMethod(
              "processBatchRelationships", String.class, List.class);
      method.setAccessible(true);
      method.invoke(rdfIndexApp, "table", mockEntities);

      // Verify bulkAddRelationships was called with the relationships
      var captor = org.mockito.ArgumentCaptor.forClass(List.class);
      verify(mockRdfRepository).bulkAddRelationships(captor.capture());

      @SuppressWarnings("unchecked")
      List<org.openmetadata.schema.type.EntityRelationship> storedRelationships = captor.getValue();

      assertEquals(2, storedRelationships.size(), "Should store all relationships");
      assertTrue(
          storedRelationships.stream()
              .anyMatch(r -> r.getRelationshipType() == Relationship.CONTAINS),
          "Should include CONTAINS relationship");
      assertTrue(
          storedRelationships.stream().anyMatch(r -> r.getRelationshipType() == Relationship.OWNS),
          "Should include OWNS relationship");
    }

    @Test
    @DisplayName("Should handle lineage relationships with details separately")
    void testProcessBatchRelationshipsHandlesLineageWithDetails() throws Exception {
      // Setup mock entities
      List<EntityInterface> mockEntities = new ArrayList<>();
      EntityInterface mockEntity = mock(EntityInterface.class);
      UUID entityId = UUID.randomUUID();
      when(mockEntity.getId()).thenReturn(entityId);
      mockEntities.add(mockEntity);

      // Create mock lineage relationship with JSON details
      UUID fromId = UUID.randomUUID();
      UUID toId = UUID.randomUUID();
      String lineageJson = "{\"sqlQuery\":\"SELECT * FROM source\"}";

      List<EntityRelationshipObject> mockOutgoing = new ArrayList<>();
      mockOutgoing.add(
          EntityRelationshipObject.builder()
              .fromId(fromId.toString())
              .toId(toId.toString())
              .fromEntity("table")
              .toEntity("table")
              .relation(Relationship.UPSTREAM.ordinal())
              .json(lineageJson)
              .build());

      when(relationshipDAO.findToBatchWithRelations(anyList(), anyString(), anyList()))
          .thenReturn(mockOutgoing);
      when(relationshipDAO.findFromBatch(anyList(), anyInt(), any(Include.class)))
          .thenReturn(new ArrayList<>());

      // Call processBatchRelationships
      var method =
          RdfIndexApp.class.getDeclaredMethod(
              "processBatchRelationships", String.class, List.class);
      method.setAccessible(true);
      method.invoke(rdfIndexApp, "table", mockEntities);

      // Verify addLineageWithDetails was called (lineage with JSON should use special method)
      verify(mockRdfRepository)
          .addLineageWithDetails(eq("table"), eq(fromId), eq("table"), eq(toId), any());
    }
  }

  @Nested
  @DisplayName("Producer-Consumer Architecture Tests")
  class ProducerConsumerTests {

    @Test
    @DisplayName("Should have poison pill constant defined")
    void testPoisonPillConstant() throws Exception {
      var field = RdfIndexApp.class.getDeclaredField("POISON_PILL");
      field.setAccessible(true);
      String poisonPill = (String) field.get(null);
      assertEquals("__POISON_PILL__", poisonPill);
    }

    @Test
    @DisplayName("Should have default queue size defined")
    void testDefaultQueueSize() throws Exception {
      var field = RdfIndexApp.class.getDeclaredField("DEFAULT_QUEUE_SIZE");
      field.setAccessible(true);
      int defaultQueueSize = (int) field.get(null);
      assertEquals(5000, defaultQueueSize);
    }

    @Test
    @DisplayName("Should have websocket update interval defined")
    void testWebsocketUpdateInterval() throws Exception {
      var field = RdfIndexApp.class.getDeclaredField("WEBSOCKET_UPDATE_INTERVAL_MS");
      field.setAccessible(true);
      long interval = (long) field.get(null);
      assertEquals(2000L, interval);
    }
  }
}
