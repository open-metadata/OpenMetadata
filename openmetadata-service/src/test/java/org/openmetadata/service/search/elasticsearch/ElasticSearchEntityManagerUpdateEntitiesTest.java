package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertEquals;

import es.co.elastic.clients.elasticsearch._types.Refresh;
import es.co.elastic.clients.elasticsearch.core.BulkRequest;
import es.co.elastic.clients.elasticsearch.core.bulk.UpdateOperation;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.EntityIndexWrite;

class ElasticSearchEntityManagerUpdateEntitiesTest {

  private final ElasticSearchEntityManager entityManager = new ElasticSearchEntityManager(null);

  @Test
  void liveBulkWritesAreUnrefreshedScriptedUpsertsLikeTheSingleWrite() {
    BulkRequest request =
        entityManager.buildUpdateEntitiesRequest(
            List.of(
                new EntityIndexWrite("page_search_index", "a", "script", Map.of("name", "a")),
                new EntityIndexWrite("domain_search_index", "b", "script", Map.of("name", "b"))));

    assertEquals(Refresh.False, request.refresh());
    assertEquals(2, request.operations().size());
    UpdateOperation<?, ?> first = request.operations().getFirst().update();
    assertEquals("page_search_index", first.index());
    assertEquals("a", first.id());
    assertEquals(3, first.retryOnConflict());
  }
}
