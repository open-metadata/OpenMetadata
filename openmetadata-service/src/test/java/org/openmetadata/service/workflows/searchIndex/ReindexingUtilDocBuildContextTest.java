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
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.BulkSink;
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
  void populateDocBuildContextDoesNothingWhenPrefetchReturnsNull() {
    Map<String, Object> contextData = new HashMap<>();
    EntityInterface entity = mock(EntityInterface.class);

    try (MockedStatic<SearchIndex> indexMock = mockStatic(SearchIndex.class)) {
      indexMock
          .when(() -> SearchIndex.prefetchLineageIfSupported(eq(TABLE), any()))
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

      ReindexingUtil.populateDocBuildContext(contextData, TABLE, List.of(e1, e2));

      @SuppressWarnings("unchecked")
      Map<UUID, DocBuildContext> stored =
          (Map<UUID, DocBuildContext>) contextData.get(BulkSink.DOC_BUILD_CONTEXT_KEY);
      assertNotNull(stored);
      assertEquals(2, stored.size());
      assertSame(edgesForFirst, stored.get(id1).prefetchedUpstreamLineage());
      assertTrue(stored.get(id2).prefetchedUpstreamLineage().isEmpty());
    }
  }
}
