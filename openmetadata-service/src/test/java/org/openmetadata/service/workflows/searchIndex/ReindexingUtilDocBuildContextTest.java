package org.openmetadata.service.workflows.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.jdbi3.TestSuiteRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.indexes.DocBuildContext;
import org.openmetadata.service.search.indexes.SearchIndex;

class ReindexingUtilDocBuildContextTest {

  private static final String TABLE = "table";
  private static MockedStatic<Entity> entityStaticMock;

  @BeforeAll
  static void bootEntity() {
    SearchRepository searchRepo = Mockito.mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
    entityStaticMock = Mockito.mockStatic(Entity.class);
    entityStaticMock.when(Entity::getSearchRepository).thenReturn(searchRepo);
  }

  @AfterAll
  static void closeEntityMock() {
    entityStaticMock.close();
  }

  @Test
  void populateDocBuildContextDoesNothingWhenAllPrefetchesReturnNull() {
    Map<String, Object> contextData = new HashMap<>();
    EntityInterface entity = mock(EntityInterface.class);

    try (MockedStatic<SearchIndex> indexMock = mockStatic(SearchIndex.class)) {
      indexMock
          .when(() -> SearchIndex.prefetchLineageIfSupported(eq(TABLE), any()))
          .thenReturn(null);
      indexMock
          .when(() -> SearchIndex.prefetchServiceStylesIfSupported(eq(TABLE), any()))
          .thenReturn(null);

      ReindexingUtil.populateDocBuildContext(contextData, TABLE, List.of(entity));

      assertFalse(contextData.containsKey(BulkSink.DOC_BUILD_CONTEXT_KEY));
    }
  }

  @Test
  void populateDocBuildContextSwallowsThrowableAndLeavesContextUntouched() {
    Map<String, Object> contextData = new HashMap<>();
    EntityInterface entity = mock(EntityInterface.class);

    try (MockedStatic<SearchIndex> indexMock = mockStatic(SearchIndex.class)) {
      indexMock
          .when(() -> SearchIndex.prefetchLineageIfSupported(eq(TABLE), any()))
          .thenThrow(new NoClassDefFoundError("simulated class-init failure"));

      ReindexingUtil.populateDocBuildContext(contextData, TABLE, List.of(entity));

      assertFalse(contextData.containsKey(BulkSink.DOC_BUILD_CONTEXT_KEY));
    }
  }

  @Test
  void populateDocBuildContextWrapsEachEntityLineageInDocBuildContext() {
    Map<String, Object> contextData = new HashMap<>();
    UUID id1 = UUID.randomUUID();
    UUID id2 = UUID.randomUUID();
    EntityInterface e1 = mock(EntityInterface.class);
    EntityInterface e2 = mock(EntityInterface.class);
    when(e1.getId()).thenReturn(id1);
    when(e2.getId()).thenReturn(id2);
    List<EsLineageData> edgesForFirst = List.of(new EsLineageData());

    try (MockedStatic<SearchIndex> indexMock = mockStatic(SearchIndex.class)) {
      indexMock
          .when(() -> SearchIndex.prefetchLineageIfSupported(eq(TABLE), any()))
          .thenReturn(Map.of(id1, edgesForFirst, id2, Collections.<EsLineageData>emptyList()));
      indexMock
          .when(() -> SearchIndex.prefetchServiceStylesIfSupported(eq(TABLE), any()))
          .thenReturn(null);

      ReindexingUtil.populateDocBuildContext(contextData, TABLE, List.of(e1, e2));

      @SuppressWarnings("unchecked")
      Map<UUID, DocBuildContext> stored =
          (Map<UUID, DocBuildContext>) contextData.get(BulkSink.DOC_BUILD_CONTEXT_KEY);
      assertNotNull(stored);
      assertEquals(2, stored.size());
      assertSame(edgesForFirst, stored.get(id1).prefetchedUpstreamLineage());
      assertTrue(stored.get(id2).prefetchedUpstreamLineage().isEmpty());
      assertFalse(stored.get(id1).serviceStylePrefetch().prefetched());
    }
  }

  @Test
  void populateDocBuildContextPrefetchesTestSuiteRelationshipRevision() {
    Map<String, Object> contextData = new HashMap<>();
    UUID id = UUID.randomUUID();
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getId()).thenReturn(id);

    try (MockedStatic<SearchIndex> indexMock = mockStatic(SearchIndex.class);
        MockedStatic<TestCaseRepository> repositoryMock = mockStatic(TestCaseRepository.class)) {
      indexMock
          .when(() -> SearchIndex.prefetchLineageIfSupported(eq(Entity.TEST_CASE), any()))
          .thenReturn(null);
      indexMock
          .when(() -> SearchIndex.prefetchServiceStylesIfSupported(eq(Entity.TEST_CASE), any()))
          .thenReturn(null);
      repositoryMock
          .when(() -> TestCaseRepository.getTestSuiteRelationshipRevisions(List.of(id)))
          .thenReturn(Map.of(id, 17L));

      ReindexingUtil.populateDocBuildContext(contextData, Entity.TEST_CASE, List.of(entity));

      @SuppressWarnings("unchecked")
      Map<UUID, DocBuildContext> stored =
          (Map<UUID, DocBuildContext>) contextData.get(BulkSink.DOC_BUILD_CONTEXT_KEY);
      assertEquals(17L, stored.get(id).relationshipRevision());
    }
  }

  @Test
  void populateDocBuildContextUsesSuppliedRelationshipRevisionWithoutRereadingIt() {
    UUID id = UUID.randomUUID();
    Map<String, Object> contextData =
        new HashMap<>(Map.of(BulkSink.RELATIONSHIP_REVISIONS_CONTEXT_KEY, Map.of(id, 23L)));
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getId()).thenReturn(id);

    try (MockedStatic<SearchIndex> indexMock = mockStatic(SearchIndex.class);
        MockedStatic<TestCaseRepository> repositoryMock = mockStatic(TestCaseRepository.class)) {
      indexMock
          .when(() -> SearchIndex.prefetchLineageIfSupported(eq(Entity.TEST_CASE), any()))
          .thenReturn(null);
      indexMock
          .when(() -> SearchIndex.prefetchServiceStylesIfSupported(eq(Entity.TEST_CASE), any()))
          .thenReturn(null);

      ReindexingUtil.populateDocBuildContext(contextData, Entity.TEST_CASE, List.of(entity));

      @SuppressWarnings("unchecked")
      Map<UUID, DocBuildContext> stored =
          (Map<UUID, DocBuildContext>) contextData.get(BulkSink.DOC_BUILD_CONTEXT_KEY);
      assertEquals(23L, stored.get(id).relationshipRevision());
      repositoryMock.verify(
          () -> TestCaseRepository.getTestSuiteRelationshipRevisions(any()), never());
    }
  }

  @Test
  void populateDocBuildContextPrefetchesOnlyLogicalTestSuiteRelationshipRevisions() {
    Map<String, Object> contextData = new HashMap<>();
    UUID logicalId = UUID.randomUUID();
    UUID basicId = UUID.randomUUID();
    TestSuite logicalSuite = new TestSuite().withId(logicalId).withBasic(false);
    TestSuite basicSuite = new TestSuite().withId(basicId).withBasic(true);

    try (MockedStatic<SearchIndex> indexMock = mockStatic(SearchIndex.class);
        MockedStatic<TestSuiteRepository> repositoryMock = mockStatic(TestSuiteRepository.class)) {
      indexMock
          .when(() -> SearchIndex.prefetchLineageIfSupported(eq(Entity.TEST_SUITE), any()))
          .thenReturn(null);
      indexMock
          .when(() -> SearchIndex.prefetchServiceStylesIfSupported(eq(Entity.TEST_SUITE), any()))
          .thenReturn(null);
      repositoryMock
          .when(() -> TestSuiteRepository.getTestsRelationshipRevisions(List.of(logicalId)))
          .thenReturn(Map.of(logicalId, 29L));

      ReindexingUtil.populateDocBuildContext(
          contextData, Entity.TEST_SUITE, List.of(logicalSuite, basicSuite));

      @SuppressWarnings("unchecked")
      Map<UUID, DocBuildContext> stored =
          (Map<UUID, DocBuildContext>) contextData.get(BulkSink.DOC_BUILD_CONTEXT_KEY);
      assertEquals(29L, stored.get(logicalId).relationshipRevision());
      assertFalse(stored.containsKey(basicId));
    }
  }

  @Test
  void populateDocBuildContextWrapsEachEntityServiceStyleInDocBuildContext() {
    Map<String, Object> contextData = new HashMap<>();
    UUID id1 = UUID.randomUUID();
    UUID id2 = UUID.randomUUID();
    EntityInterface e1 = mock(EntityInterface.class);
    EntityInterface e2 = mock(EntityInterface.class);
    Style style = new Style().withColor("#123456");
    when(e1.getId()).thenReturn(id1);
    when(e2.getId()).thenReturn(id2);

    try (MockedStatic<SearchIndex> indexMock = mockStatic(SearchIndex.class)) {
      indexMock
          .when(() -> SearchIndex.prefetchLineageIfSupported(eq(TABLE), any()))
          .thenReturn(null);
      indexMock
          .when(() -> SearchIndex.prefetchServiceStylesIfSupported(eq(TABLE), any()))
          .thenReturn(Map.of(id1, Optional.of(style), id2, Optional.empty()));

      ReindexingUtil.populateDocBuildContext(contextData, TABLE, List.of(e1, e2));

      @SuppressWarnings("unchecked")
      Map<UUID, DocBuildContext> stored =
          (Map<UUID, DocBuildContext>) contextData.get(BulkSink.DOC_BUILD_CONTEXT_KEY);
      assertNotNull(stored);
      assertEquals(2, stored.size());
      assertTrue(stored.get(id1).serviceStylePrefetch().prefetched());
      assertSame(style, stored.get(id1).serviceStylePrefetch().style().orElseThrow());
      assertTrue(stored.get(id2).serviceStylePrefetch().prefetched());
      assertTrue(stored.get(id2).serviceStylePrefetch().style().isEmpty());
    }
  }
}
