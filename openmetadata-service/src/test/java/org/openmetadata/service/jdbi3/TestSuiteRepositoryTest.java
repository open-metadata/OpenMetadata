package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.tests.ResultSummary;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.tests.type.TestSummary;
import org.openmetadata.service.Entity;

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
}
