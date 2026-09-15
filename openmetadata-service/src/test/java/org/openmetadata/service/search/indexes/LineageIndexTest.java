package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
import org.openmetadata.schema.api.lineage.EsLineageData;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;

class LineageIndexTest {

  private static MockedStatic<Entity> entityStaticMock;

  @BeforeAll
  static void setUp() {
    SearchRepository mockSearchRepo =
        Mockito.mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
    entityStaticMock = Mockito.mockStatic(Entity.class);
    entityStaticMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepo);
  }

  @AfterAll
  static void tearDown() {
    entityStaticMock.close();
  }

  @Test
  void testApplyLineageFieldsSetsUpstreamLineage() {
    UUID metricId = UUID.randomUUID();
    Metric metric =
        new Metric()
            .withId(metricId)
            .withName("test-metric")
            .withFullyQualifiedName("svc.test-metric");

    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relDao = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relDao);
    when(relDao.findFrom(any(UUID.class), anyString(), anyInt()))
        .thenReturn(Collections.emptyList());
    entityStaticMock.when(Entity::getCollectionDAO).thenReturn(dao);

    MetricIndex index = new MetricIndex(metric);
    Map<String, Object> doc = new HashMap<>();

    index.applyLineageFields(doc);

    assertTrue(doc.containsKey("upstreamLineage"));
    assertNotNull(doc.get("upstreamLineage"));
    assertTrue(((List<?>) doc.get("upstreamLineage")).isEmpty());
  }

  @Test
  void testApplyLineageFieldsWithNonEntityInterfaceDoesNothing() {
    LineageIndex index =
        new LineageIndex() {
          @Override
          public Object getEntity() {
            return "not-an-entity";
          }

          @Override
          public String getEntityTypeName() {
            return "unknown";
          }

          @Override
          public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
            return esDoc;
          }
        };

    Map<String, Object> doc = new HashMap<>();
    index.applyLineageFields(doc);

    assertFalse(doc.containsKey("upstreamLineage"));
  }

  @Test
  void testApplyLineageFieldsUsesPrefetchedContextAndDoesNotHitDb() {
    UUID metricId = UUID.randomUUID();
    Metric metric =
        new Metric()
            .withId(metricId)
            .withName("test-metric")
            .withFullyQualifiedName("svc.test-metric");

    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relDao = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relDao);
    entityStaticMock.when(Entity::getCollectionDAO).thenReturn(dao);

    List<EsLineageData> prefetched = List.of(new EsLineageData());
    MetricIndex index = new MetricIndex(metric);
    Map<String, Object> doc = new HashMap<>();

    index.applyLineageFields(doc, DocBuildContext.withUpstreamLineage(prefetched));

    // Content, not identity: the prefetched edges are copied before SQL deduplication rewrites
    // them in place, so the batch context is never mutated. What this test guards is that the
    // prefetched context was used and no DB lookup happened.
    assertEquals(prefetched, doc.get("upstreamLineage"));
    verify(relDao, never()).findFrom(any(UUID.class), anyString(), anyInt());
  }

  /**
   * The live {@code ADD_UPDATE_LINEAGE} script stores each distinct edge SQL once and points edges
   * at it via {@code sqlQueryKey}. A rebuild used to inline the full text on every edge, so each
   * reindex silently reverted the deduplication — caught by {@code LiveVsReindexParityIT}.
   */
  @Test
  void testApplyLineageFieldsDeduplicatesSqlAcrossEdges() {
    Metric metric =
        new Metric().withId(UUID.randomUUID()).withName("m").withFullyQualifiedName("svc.m");
    String sharedSql = "SELECT 1";
    List<EsLineageData> prefetched =
        List.of(
            new EsLineageData().withSqlQuery(sharedSql),
            new EsLineageData().withSqlQuery(sharedSql),
            new EsLineageData().withSqlQuery("SELECT 2"));
    Map<String, Object> doc = new HashMap<>();

    new MetricIndex(metric)
        .applyLineageFields(doc, DocBuildContext.withUpstreamLineage(prefetched));

    @SuppressWarnings("unchecked")
    Map<String, String> sqlQueries = (Map<String, String>) doc.get("lineageSqlQueries");
    assertNotNull(sqlQueries, "rebuilt document must carry the deduplicated SQL map");
    assertEquals(2, sqlQueries.size(), "two distinct queries across three edges");
    assertTrue(sqlQueries.containsValue(sharedSql));

    @SuppressWarnings("unchecked")
    List<EsLineageData> edges = (List<EsLineageData>) doc.get("upstreamLineage");
    assertEquals(
        edges.get(0).getSqlQueryKey(),
        edges.get(1).getSqlQueryKey(),
        "edges sharing SQL must share the key");
    assertNull(edges.get(0).getSqlQuery(), "inline SQL is replaced by the key");
  }

  /** The prefetched list belongs to the batch context and must survive a doc build unchanged. */
  @Test
  void testApplyLineageFieldsDoesNotMutatePrefetchedEdges() {
    Metric metric =
        new Metric().withId(UUID.randomUUID()).withName("m").withFullyQualifiedName("svc.m");
    List<EsLineageData> prefetched = List.of(new EsLineageData().withSqlQuery("SELECT 1"));

    new MetricIndex(metric)
        .applyLineageFields(new HashMap<>(), DocBuildContext.withUpstreamLineage(prefetched));

    assertEquals("SELECT 1", prefetched.get(0).getSqlQuery(), "source edge must be untouched");
    assertNull(prefetched.get(0).getSqlQueryKey());
  }

  @Test
  void testApplyLineageFieldsUsesEmptyPrefetchedList() {
    UUID metricId = UUID.randomUUID();
    Metric metric =
        new Metric()
            .withId(metricId)
            .withName("test-metric")
            .withFullyQualifiedName("svc.test-metric");

    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relDao = mock(CollectionDAO.EntityRelationshipDAO.class);
    when(dao.relationshipDAO()).thenReturn(relDao);
    entityStaticMock.when(Entity::getCollectionDAO).thenReturn(dao);

    MetricIndex index = new MetricIndex(metric);
    Map<String, Object> doc = new HashMap<>();

    index.applyLineageFields(doc, DocBuildContext.withUpstreamLineage(Collections.emptyList()));

    assertNotNull(doc.get("upstreamLineage"));
    assertEquals(0, ((List<?>) doc.get("upstreamLineage")).size());
    verify(relDao, never()).findFrom(any(UUID.class), anyString(), anyInt());
  }
}
