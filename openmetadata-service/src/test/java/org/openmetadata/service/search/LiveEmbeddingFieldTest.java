package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

class LiveEmbeddingFieldTest {

  private static LiveEmbeddingField elasticsearch(String reply) {
    return LiveEmbeddingField.fromFieldMapping(
        "table_search_index", JsonUtils.readTree(reply), "dense_vector", "dims");
  }

  private static LiveEmbeddingField openSearch(String reply) {
    return LiveEmbeddingField.fromFieldMapping(
        "table_search_index", JsonUtils.readTree(reply), "knn_vector", "dimension");
  }

  @Test
  void readsEveryIndexBehindAnAliasAndOnlyTheTypeAndDimensions() {
    LiveEmbeddingField live =
        elasticsearch(
            """
            {"table_search_index_rebuild_2": {"mappings": {}},
             "table_search_index_rebuild_1": {"mappings": {"embedding": {"full_name": "embedding",
               "mapping": {"embedding": {"type": "dense_vector", "dims": 384,
                 "index_options": {"type": "a_type_no_client_knows_yet", "m": 16}}}}}}}
            """);

    assertEquals(
        Set.of("table_search_index_rebuild_1", "table_search_index_rebuild_2"), live.indexes());
    assertTrue(live.readable());
    assertTrue(live.mapped());
    assertTrue(live.holds(384));
    assertFalse(live.holds(768));
    assertEquals(
        new LiveEmbeddingField.Declared("dense_vector", 384),
        live.byIndex().get("table_search_index_rebuild_1"));
  }

  @Test
  void readsTheOpenSearchVectorTypeAndItsDimensionKey() {
    LiveEmbeddingField live =
        openSearch(
            """
            {"table_search_index": {"mappings": {"embedding": {"full_name": "embedding",
              "mapping": {"embedding": {"type": "knn_vector", "dimension": 512}}}}}}
            """);

    assertTrue(live.holds(512));
    assertEquals("table_search_index has knn_vector of 512 dimensions", live.describe());
  }

  @Test
  void anEmbeddingOfAnotherTypeCannotHoldVectors() {
    LiveEmbeddingField live =
        elasticsearch(
            """
            {"table_search_index": {"mappings": {"embedding": {"full_name": "embedding",
              "mapping": {"embedding": {"type": "float"}}}}}}
            """);

    assertTrue(live.mapped());
    assertNull(live.byIndex().get("table_search_index").dimensions());
    assertFalse(live.holds(384));
    assertEquals("table_search_index has float", live.describe());
  }

  @Test
  void anIndexWithoutTheFieldIsNotMappedAndAcceptsANewOne() {
    LiveEmbeddingField live = elasticsearch("{\"table_search_index\": {\"mappings\": {}}}");

    assertFalse(live.mapped());
    assertTrue(live.acceptsNewVectorField());
  }

  @Test
  void indexesWithoutVectorSupportAreNamedAndRefuseANewField() {
    LiveEmbeddingField live =
        openSearch("{\"table_search_index_a\": {\"mappings\": {}}, \"b\": {\"mappings\": {}}}")
            .withVectorSupportOnlyIn(Set.of("b"));

    assertFalse(live.acceptsNewVectorField());
    assertEquals(Set.of("table_search_index_a"), live.withoutVectorSupport());
    assertEquals("table_search_index_a was created without vector support", live.describe());
  }

  @Test
  void anUnreadableFieldKeepsItsReason() {
    LiveEmbeddingField live = LiveEmbeddingField.unreadable("table_search_index", "503");

    assertFalse(live.readable());
    assertEquals("503", live.readFailure());
    assertFalse(LiveEmbeddingField.unreadable("table_search_index", null).readable());
  }
}
