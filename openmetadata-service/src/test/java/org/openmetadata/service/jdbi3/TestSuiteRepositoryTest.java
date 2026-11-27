package org.openmetadata.service.jdbi3;

import static java.util.stream.Collectors.joining;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.Entity.TEST_CASE;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.type.ColumnTestSummaryDefinition;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventHandler;
import org.openmetadata.service.exception.EntityNotFoundException;

class TestSuiteRepositoryTest {

  @Test
  void summaryTotalIncludesTestsWithoutResults() {
    List<ResultSummary> results = List.of(new ResultSummary().withStatus(TestCaseStatus.Success));

    TestSummary summary = TestSuiteRepository.computeSimpleSummary(results, 3);

    assertEquals(1, summary.getSuccess());
    assertEquals(3, summary.getTotal());
  }

  @Test
  void emptySuiteHasZeroSummaryCounts() {
    TestSummary summary = TestSuiteRepository.computeSimpleSummary(List.of(), 0);

    assertEquals(0, summary.getSuccess());
    assertEquals(0, summary.getFailed());
    assertEquals(0, summary.getAborted());
    assertEquals(0, summary.getQueued());
    assertEquals(0, summary.getTotal());
  }

  @Test
  void readsPersistedTestsRelationshipRevisions() {
    UUID firstId = UUID.randomUUID();
    UUID secondId = UUID.randomUUID();
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityExtensionDAO extensionDAO = mock(CollectionDAO.EntityExtensionDAO.class);
    when(collectionDAO.entityExtensionDAO()).thenReturn(extensionDAO);
    when(extensionDAO.getExtensionBatch(
            List.of(firstId.toString(), secondId.toString()),
            TestSuiteRepository.TESTS_REVISION_EXTENSION))
        .thenReturn(
            List.of(
                new CollectionDAO.ExtensionRecordWithId(
                    firstId, TestSuiteRepository.TESTS_REVISION_EXTENSION, "{\"revision\":5}"),
                new CollectionDAO.ExtensionRecordWithId(
                    secondId, TestSuiteRepository.TESTS_REVISION_EXTENSION, "{\"revision\":13}")));

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      assertEquals(
          Map.of(firstId, 5L, secondId, 13L),
          TestSuiteRepository.getTestsRelationshipRevisions(List.of(firstId, secondId)));
    }
  }

  @Test
  void readsRevisionsThroughTheCallersDaoRatherThanTheGlobalOne() {
    // The suite revision is written and read back inside one transaction, so the read has to use
    // the caller's DAO. Going through the mutable Entity.getCollectionDAO() can pick a different
    // Jdbi's connection, which under MySQL's REPEATABLE READ snapshot cannot see that write.
    UUID testSuiteId = UUID.randomUUID();
    CollectionDAO callerDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityExtensionDAO extensionDAO = mock(CollectionDAO.EntityExtensionDAO.class);
    when(callerDAO.entityExtensionDAO()).thenReturn(extensionDAO);
    when(extensionDAO.getExtensionBatch(
            List.of(testSuiteId.toString()), TestSuiteRepository.TESTS_REVISION_EXTENSION))
        .thenReturn(
            List.of(
                new CollectionDAO.ExtensionRecordWithId(
                    testSuiteId,
                    TestSuiteRepository.TESTS_REVISION_EXTENSION,
                    "{\"revision\":9}")));
    CollectionDAO globalDAO = mock(CollectionDAO.class);

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(globalDAO);

      assertEquals(
          Map.of(testSuiteId, 9L),
          TestSuiteRepository.getTestsRelationshipRevisions(callerDAO, List.of(testSuiteId)));
      verifyNoInteractions(globalDAO);
    }
  }

  @Test
  void softDeletedFailingCaseDoesNotAffectInMemorySuiteSummary() {
    final String liveFqn = "service.db.schema.table.live";
    final String softDeletedFqn = "service.db.schema.table.deleted";
    final TestCase live =
        new TestCase()
            .withFullyQualifiedName(liveFqn)
            .withEntityLink("<#E::table::service.db.schema.table>");
    final List<ResultSummary> historicResults =
        List.of(
            new ResultSummary().withTestCaseName(liveFqn).withStatus(TestCaseStatus.Success),
            new ResultSummary().withTestCaseName(softDeletedFqn).withStatus(TestCaseStatus.Failed));
    final TestCaseRepository testCases = mock(TestCaseRepository.class);
    when(testCases.findByNames(anyList(), eq(Include.NON_DELETED))).thenReturn(List.of(live));

    try (final MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      entity.when(() -> Entity.getEntityRepository(TEST_CASE)).thenReturn(testCases);

      final TestSummary summary = TestSuiteRepository.getTestSummary(historicResults);

      assertEquals(1, summary.getSuccess());
      assertEquals(0, summary.getFailed());
    }
  }

  @Test
  void summaryLeavesOutResultsOfTestCasesDeletedAfterTheyWereListed() {
    String tableTestFqn = "svc.db.schema.orders.row_count";
    String columnTestFqn = "svc.db.schema.orders.id.not_null";
    String deletedTestFqn = "svc.db.schema.orders.deleted_by_another_request";
    TestCase tableTest =
        new TestCase()
            .withFullyQualifiedName(tableTestFqn)
            .withEntityLink("<#E::table::svc.db.schema.orders>");
    TestCase columnTest =
        new TestCase()
            .withFullyQualifiedName(columnTestFqn)
            .withEntityLink("<#E::table::svc.db.schema.orders::columns::id>");
    List<ResultSummary> listedResults =
        List.of(
            new ResultSummary().withTestCaseName(tableTestFqn).withStatus(TestCaseStatus.Success),
            new ResultSummary().withTestCaseName(columnTestFqn).withStatus(TestCaseStatus.Failed),
            new ResultSummary().withTestCaseName(deletedTestFqn).withStatus(TestCaseStatus.Failed));
    TestCaseRepository testCaseRepository = mock(TestCaseRepository.class);
    when(testCaseRepository.findByNames(anyList(), eq(Include.NON_DELETED)))
        .thenReturn(List.of(tableTest, columnTest));

    try (MockedStatic<Entity> entity = Mockito.mockStatic(Entity.class)) {
      // The deleted test case is gone from the database, so neither lookup can find it
      entity.when(() -> Entity.getEntityRepository(TEST_CASE)).thenReturn(testCaseRepository);
      entity
          .when(() -> Entity.getEntityByName(TEST_CASE, tableTestFqn, "", Include.ALL))
          .thenReturn(tableTest);
      entity
          .when(() -> Entity.getEntityByName(TEST_CASE, columnTestFqn, "", Include.ALL))
          .thenReturn(columnTest);
      entity
          .when(() -> Entity.getEntityByName(TEST_CASE, deletedTestFqn, "", Include.ALL))
          .thenThrow(
              EntityNotFoundException.byMessage("Entity not found: testCase " + deletedTestFqn));

      TestSummary summary = TestSuiteRepository.getTestSummary(listedResults);

      assertEquals(1, summary.getSuccess());
      assertEquals(1, summary.getFailed());
      assertEquals(
          List.of(columnTest.getEntityLink()),
          summary.getColumnTestSummary().stream()
              .map(ColumnTestSummaryDefinition::getEntityLink)
              .toList());
    }
  }

  /**
   * A logical suite, a data contract's among them, is hard deleted outside the generic delete
   * path, so it prepares the lifecycle handlers itself: before its rows are removed, with the
   * cleanup run once they are gone. The vector handler deletes the suite's chunks there.
   */
  @Test
  void aLogicalSuiteHardDeletePreparesTheHandlersBeforeItsRowsAreRemoved() {
    List<String> steps = new ArrayList<>();
    EntityLifecycleEventDispatcher dispatcher = EntityLifecycleEventDispatcher.getInstance();
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.relationshipDAO())
        .thenReturn(mock(CollectionDAO.EntityRelationshipDAO.class));
    Entity.setCollectionDAO(collectionDAO);
    TestSuite suite =
        new TestSuite()
            .withId(UUID.randomUUID())
            .withName("orders_contract_suite")
            .withFullyQualifiedName("orders_contract_suite")
            .withBasic(false);
    try {
      TestSuiteRepository suites = spy(new TestSuiteRepository());
      doNothing().when(suites).preDelete(any(), anyString());
      doReturn(suite).when(suites).setFieldsInternal(any(), any());
      doAnswer(call -> steps.add("rows removed")).when(suites).cleanup(anyString(), any());
      dispatcher.registerHandler(new RecordingHandler(steps));

      suites.deleteLogicalTestSuite("admin", suite, true);

      String deleted = suite.getId().toString();
      assertEquals(List.of("prepare " + deleted, "rows removed", "clean up " + deleted), steps);
    } finally {
      dispatcher.unregisterHandler(RecordingHandler.NAME);
      dispatcher.unregisterHandler("TestSuitePipelineStatusHandler");
      Entity.setCollectionDAO(null);
      Entity.cleanup();
    }
  }

  private static final class RecordingHandler implements EntityLifecycleEventHandler {
    private static final String NAME = "TestSuiteRepositoryTest-recording";
    private final List<String> steps;

    private RecordingHandler(List<String> steps) {
      this.steps = steps;
    }

    @Override
    public Runnable prepareHardDelete(List<? extends EntityInterface<?>> entities) {
      String deleted =
          entities.stream().map(entity -> entity.getId().toString()).collect(joining(","));
      steps.add("prepare " + deleted);
      return () -> steps.add("clean up " + deleted);
    }

    @Override
    public String getHandlerName() {
      return NAME;
    }

    @Override
    public boolean isAsync() {
      return false;
    }

    @Override
    public Set<String> getSupportedEntityTypes() {
      return Set.of(Entity.TEST_SUITE);
    }
  }
}
