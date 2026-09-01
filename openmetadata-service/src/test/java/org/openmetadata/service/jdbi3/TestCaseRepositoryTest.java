package org.openmetadata.service.jdbi3;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.TestCaseDimensionResult;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.DataQualityDimensions;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.rdf.RdfUpdater;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class TestCaseRepositoryTest {

  private static final String TEST_CASE_FQN = "service.database.schema.table.row_count";
  private static final String ASYNC_DELETE_THREAD_NAME = "om-test-case-async";

  @Test
  void readsPersistedTestSuiteRelationshipRevisions() {
    UUID firstId = UUID.randomUUID();
    UUID secondId = UUID.randomUUID();
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityExtensionDAO extensionDAO = mock(CollectionDAO.EntityExtensionDAO.class);
    when(collectionDAO.entityExtensionDAO()).thenReturn(extensionDAO);
    when(extensionDAO.getExtensionBatch(
            List.of(firstId.toString(), secondId.toString()),
            TestCaseRepository.TEST_SUITES_REVISION_EXTENSION))
        .thenReturn(
            List.of(
                new CollectionDAO.ExtensionRecordWithId(
                    firstId, TestCaseRepository.TEST_SUITES_REVISION_EXTENSION, "{\"revision\":7}"),
                new CollectionDAO.ExtensionRecordWithId(
                    secondId,
                    TestCaseRepository.TEST_SUITES_REVISION_EXTENSION,
                    "{\"revision\":11}")));

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      assertEquals(
          Map.of(firstId, 7L, secondId, 11L),
          TestCaseRepository.getTestSuiteRelationshipRevisions(List.of(firstId, secondId)));
    }
  }

  @Test
  void readsRevisionsThroughTheCallersDaoRatherThanTheGlobalOne() {
    // A repository writes revisions through the daoCollection it captured at construction and then
    // reads them straight back. Resolving the mutable Entity.getCollectionDAO() for that read can
    // land on a different Jdbi's connection, and MySQL pins its REPEATABLE READ snapshot at the
    // transaction's first read, so the rows just written come back missing.
    UUID testCaseId = UUID.randomUUID();
    CollectionDAO callerDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityExtensionDAO extensionDAO = mock(CollectionDAO.EntityExtensionDAO.class);
    when(callerDAO.entityExtensionDAO()).thenReturn(extensionDAO);
    when(extensionDAO.getExtensionBatch(
            List.of(testCaseId.toString()), TestCaseRepository.TEST_SUITES_REVISION_EXTENSION))
        .thenReturn(
            List.of(
                new CollectionDAO.ExtensionRecordWithId(
                    testCaseId,
                    TestCaseRepository.TEST_SUITES_REVISION_EXTENSION,
                    "{\"revision\":4}")));
    CollectionDAO globalDAO = mock(CollectionDAO.class);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(globalDAO);

      assertEquals(
          Map.of(testCaseId, 4L),
          TestCaseRepository.getTestSuiteRelationshipRevisions(callerDAO, List.of(testCaseId)));
      verifyNoInteractions(globalDAO);
    }
  }

  @Test
  void postUpdateHydratesTestSuitesBeforeLifecycleUpdate() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.testCaseDAO()).thenReturn(mock(CollectionDAO.TestCaseDAO.class));

    EntityLifecycleEventDispatcher dispatcher = mock(EntityLifecycleEventDispatcher.class);
    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class);
        MockedStatic<EntityLifecycleEventDispatcher> lifecycleDispatcher =
            Mockito.mockStatic(EntityLifecycleEventDispatcher.class);
        MockedStatic<RdfUpdater> ignoredRdfUpdater = Mockito.mockStatic(RdfUpdater.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      entity.when(() -> Entity.getEntityFields(TestCase.class)).thenCallRealMethod();
      lifecycleDispatcher.when(EntityLifecycleEventDispatcher::getInstance).thenReturn(dispatcher);

      EntityReference basicSuiteRef = entityReference(Entity.TEST_SUITE, "basicSuite");
      TestSuite logicalSuite =
          new TestSuite()
              .withId(UUID.randomUUID())
              .withName("logicalSuite")
              .withFullyQualifiedName("logicalSuite")
              .withBasic(false);
      HydratingTestCaseRepository repository =
          new HydratingTestCaseRepository(basicSuiteRef, List.of(logicalSuite));

      UUID testCaseId = UUID.randomUUID();
      TestCase original =
          testCase(testCaseId, "original", basicSuiteRef).withTestSuites(List.of(logicalSuite));
      TestCase updated = testCase(testCaseId, "updated", basicSuiteRef).withTestSuites(null);

      repository.postUpdate(original, updated);

      assertNotNull(repository.capturedFields);
      assertTrue(repository.capturedFields.contains(TestCaseRepository.TEST_SUITE_FIELD));
      assertTrue(repository.capturedFields.contains(Entity.FIELD_TEST_SUITES));
      assertTrue(
          updated.getTestSuites().stream()
              .anyMatch(suite -> suite.getId().equals(logicalSuite.getId())));
    }
  }

  @Test
  void testCaseInheritsTheTestDefinitionDimensionWhenNoneIsGiven() {
    TestDefinition testDefinition =
        new TestDefinition().withDataQualityDimension(DataQualityDimensions.ACCURACY);

    TestCase withoutDimension = new TestCase();
    TestCaseRepository.setDataQualityDimension(withoutDimension, testDefinition);

    assertEquals("Accuracy", withoutDimension.getDataQualityDimension());

    TestCase blankDimension = new TestCase().withDataQualityDimension("  ");
    TestCaseRepository.setDataQualityDimension(blankDimension, testDefinition);

    assertEquals("Accuracy", blankDimension.getDataQualityDimension());
  }

  @Test
  void testCaseKeepsItsOwnCustomDimension() {
    TestDefinition testDefinition =
        new TestDefinition().withDataQualityDimension(DataQualityDimensions.ACCURACY);

    TestCase testCase = new TestCase().withDataQualityDimension(" Timeliness ");
    TestCaseRepository.setDataQualityDimension(testCase, testDefinition);

    assertEquals("Timeliness", testCase.getDataQualityDimension());

    // A test definition without a dimension leaves the test case without one too
    TestCase noDimension = new TestCase();
    TestCaseRepository.setDataQualityDimension(noDimension, new TestDefinition());

    assertNull(noDimension.getDataQualityDimension());
  }

  @Test
  void hardDeleteCleanupDeletesTestCaseResultsExactlyOnce() {
    DeleteBoundaries boundaries = new DeleteBoundaries();

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      TestCaseRepository repository = boundaries.registerRepositories(entity);

      String callingThread = Thread.currentThread().getName();
      repository.entitySpecificCleanup(
          testCase(UUID.randomUUID(), "delete me", entityReference(Entity.TEST_SUITE, "suite")));

      await().atMost(Duration.ofSeconds(5)).until(() -> boundaries.timeSeriesDeletes.get() > 0);
      // A redundant second delete would push these past one, so the counts must *hold* at one for a
      // window rather than merely reach it.
      await()
          .during(Duration.ofSeconds(1))
          .atMost(Duration.ofSeconds(5))
          .untilAsserted(
              () -> {
                assertEquals(
                    1, boundaries.timeSeriesDeletes.get(), "test case result rows deleted");
                assertEquals(1, boundaries.dimensionDeletes.get(), "dimension result rows deleted");
                assertEquals(1, boundaries.searchDeletes.get(), "search index deletes issued");
              });
      assertTrue(
          boundaries.deleteThreadNames.stream().noneMatch(callingThread::equals),
          "delete must be dispatched asynchronously, never run on the calling thread");
      assertTrue(
          Thread.getAllStackTraces().keySet().stream()
              .noneMatch(thread -> ASYNC_DELETE_THREAD_NAME.equals(thread.getName())),
          "async delete must use the shared AsyncService, not a private thread pool");
    }
  }

  @Test
  void bulkHardDeleteCleanupUsesOneBatchedDelete() {
    DeleteBoundaries boundaries = new DeleteBoundaries();
    String secondFqn = TEST_CASE_FQN + "_two";

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      TestCaseRepository repository = boundaries.registerRepositories(entity);
      TestCase first =
          testCase(UUID.randomUUID(), "first", entityReference(Entity.TEST_SUITE, "s"));
      TestCase second =
          testCase(UUID.randomUUID(), "second", entityReference(Entity.TEST_SUITE, "s"))
              .withFullyQualifiedName(secondFqn);

      repository.bulkEntitySpecificCleanup(List.of(first, second), "admin");

      await().atMost(Duration.ofSeconds(5)).until(() -> boundaries.searchDeletes.get() == 1);
      assertEquals(List.of(TEST_CASE_FQN, secondFqn), boundaries.deletedTestCaseFQNs.get());
      assertEquals(1, boundaries.dimensionDeletes.get());
      assertEquals(1, boundaries.searchDeletes.get());
      assertEquals(
          "!doc['testCaseFQN.keyword'].empty && "
              + "params.fqns.contains(doc['testCaseFQN.keyword'].value)",
          boundaries.searchDeleteScript.get());
      assertEquals(
          Map.of("fqns", List.of(TEST_CASE_FQN, secondFqn)), boundaries.searchDeleteParams.get());
    }
  }

  /**
   * Mocks of the two boundaries a test case result delete reaches — the JDBI DAOs (the database) and
   * {@link SearchRepository} (the search cluster) — each counting how many times it is called.
   */
  private static class DeleteBoundaries {
    private final AtomicInteger timeSeriesDeletes = new AtomicInteger();
    private final AtomicInteger dimensionDeletes = new AtomicInteger();
    private final AtomicInteger searchDeletes = new AtomicInteger();
    private final AtomicReference<List<String>> deletedTestCaseFQNs = new AtomicReference<>();
    private final AtomicReference<String> searchDeleteScript = new AtomicReference<>();
    private final AtomicReference<Map<String, Object>> searchDeleteParams = new AtomicReference<>();
    private final Set<String> deleteThreadNames = ConcurrentHashMap.newKeySet();
    private final CollectionDAO collectionDAO = mock(CollectionDAO.class);
    private final SearchRepository searchRepository = mock(SearchRepository.class);

    private DeleteBoundaries() {
      CollectionDAO.DataQualityDataTimeSeriesDAO dataQualityDao =
          mock(CollectionDAO.DataQualityDataTimeSeriesDAO.class);
      CollectionDAO.TestCaseDimensionResultTimeSeriesDAO dimensionDao =
          mock(CollectionDAO.TestCaseDimensionResultTimeSeriesDAO.class);
      when(collectionDAO.testCaseDAO()).thenReturn(mock(CollectionDAO.TestCaseDAO.class));
      when(collectionDAO.testCaseResultTimeSeriesDao())
          .thenReturn(mock(CollectionDAO.TestCaseResultTimeSeriesDAO.class));
      when(collectionDAO.dataQualityDataTimeSeriesDao()).thenReturn(dataQualityDao);
      when(collectionDAO.testCaseDimensionResultTimeSeriesDao()).thenReturn(dimensionDao);
      doAnswer(
              invocation -> {
                deleteThreadNames.add(Thread.currentThread().getName());
                List<String> testCaseFQNs = invocation.getArgument(0);
                deletedTestCaseFQNs.set(List.copyOf(testCaseFQNs));
                return timeSeriesDeletes.incrementAndGet();
              })
          .when(dataQualityDao)
          .deleteAllBatch(anyList());
      doAnswer(invocation -> dimensionDeletes.incrementAndGet())
          .when(dimensionDao)
          .deleteAllBatch(anyList());
      doAnswer(
              invocation -> {
                searchDeleteScript.set(invocation.getArgument(1));
                searchDeleteParams.set(Map.copyOf(invocation.getArgument(2)));
                return searchDeletes.incrementAndGet();
              })
          .when(searchRepository)
          .deleteByScript(eq(Entity.TEST_CASE_RESULT), anyString(), anyMap());
    }

    private TestCaseRepository registerRepositories(MockedStatic<Entity> entity) {
      entity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      entity.when(() -> Entity.getEntityFields(TestCase.class)).thenCallRealMethod();
      entity.when(() -> Entity.getEntityFields(TestCaseResult.class)).thenCallRealMethod();
      entity.when(() -> Entity.getEntityFields(TestCaseDimensionResult.class)).thenCallRealMethod();
      // Built before stubbing starts: its constructor itself drives Mockito, which would otherwise
      // interleave with the in-progress when(...) call.
      TestCaseResultRepository testCaseResultRepository = new TestCaseResultRepository();
      entity
          .when(() -> Entity.getEntityTimeSeriesRepository(Entity.TEST_CASE_RESULT))
          .thenReturn(testCaseResultRepository);
      return new TestCaseRepository();
    }
  }

  private static TestCase testCase(UUID id, String description, EntityReference basicSuiteRef) {
    return new TestCase()
        .withId(id)
        .withName("row_count")
        .withFullyQualifiedName(TEST_CASE_FQN)
        .withDescription(description)
        .withEntityLink("<#E::table::service.database.schema.table>")
        .withTestSuite(basicSuiteRef);
  }

  private static EntityReference entityReference(String type, String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(type)
        .withName(name)
        .withFullyQualifiedName(name);
  }

  private static class HydratingTestCaseRepository extends TestCaseRepository {
    private final EntityReference basicSuiteRef;
    private final List<TestSuite> testSuites;
    private Fields capturedFields;

    private HydratingTestCaseRepository(EntityReference basicSuiteRef, List<TestSuite> testSuites) {
      this.basicSuiteRef = basicSuiteRef;
      this.testSuites = testSuites;
    }

    @Override
    public void setFields(TestCase test, Fields fields, RelationIncludes relationIncludes) {
      capturedFields = fields;
      if (fields.contains(TEST_SUITE_FIELD)) {
        test.setTestSuite(basicSuiteRef);
      }
      if (fields.contains(Entity.FIELD_TEST_SUITES)) {
        test.setTestSuites(testSuites);
      }
    }
  }
}
