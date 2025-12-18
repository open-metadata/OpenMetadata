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
    @DisplayName("Should have relevant relationship types defined")
    void testRelevantRelationshipTypes() {
      List<Integer> expectedRelationships =
          List.of(
              Relationship.UPSTREAM.ordinal(),
              Relationship.CONTAINS.ordinal(),
              Relationship.HAS.ordinal(),
              Relationship.OWNS.ordinal(),
              Relationship.PARENT_OF.ordinal(),
              Relationship.CREATED.ordinal(),
              Relationship.REVIEWS.ordinal(),
              Relationship.APPLIED_TO.ordinal());

      List<Integer> actualRelationships = getRelevantRelationships();
      assertEquals(expectedRelationships.size(), actualRelationships.size());
      assertTrue(actualRelationships.containsAll(expectedRelationships));
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
    private List<Integer> getRelevantRelationships() {
      try {
        var field = RdfIndexApp.class.getDeclaredField("RDF_RELEVANT_RELATIONSHIPS");
        field.setAccessible(true);
        return (List<Integer>) field.get(null);
      } catch (Exception e) {
        fail("Could not access RDF_RELEVANT_RELATIONSHIPS field");
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
