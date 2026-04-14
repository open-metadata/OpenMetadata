package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
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
}
