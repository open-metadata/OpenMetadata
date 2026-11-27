package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.vector.client.EmbeddingModel;

class LiveEmbeddingFieldTest {

  private static final EmbeddingModel MODEL_384 = new EmbeddingModel("model-a", 384);

  private static LiveEmbeddingField elasticsearch(String reply) {
    return LiveEmbeddingField.fromFieldMapping(
        "table_search_index", JsonUtils.readTree(reply), "dense_vector", "dims");
  }

  private static LiveEmbeddingField openSearch(String reply) {
    return LiveEmbeddingField.fromFieldMapping(
        "table_search_index", JsonUtils.readTree(reply), "knn_vector", "dimension");
  }

  private static LiveEmbeddingField vector384(String index) {
    return elasticsearch(
        "{\""
            + index
            + "\": {\"mappings\": {\"embedding\": {\"full_name\": \"embedding\","
            + "\"mapping\": {\"embedding\": {\"type\": \"dense_vector\", \"dims\": 384}}}}}}");
  }

  private static String recorded(String index, String model) {
    return "{\""
        + index
        + "\": {\"mappings\": {\"_meta\": {\"embedding_model\": \""
        + model
        + "\"}}}}";
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
    assertTrue(live.holds(MODEL_384));
    assertFalse(live.holds(new EmbeddingModel("model-a", 768)));
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

    assertTrue(live.holds(new EmbeddingModel("model-a", 512)));
    assertEquals("table_search_index has knn_vector of 512 dimensions", live.describe(MODEL_384));
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
    assertFalse(live.holds(MODEL_384));
    assertEquals("table_search_index has float", live.describe(MODEL_384));
  }

  @Test
  void aFieldOfTheSameDimensionBuiltForAnotherModelCannotHoldItsVectors() {
    LiveEmbeddingField live =
        vector384("table_search_index_rebuild_1")
            .withRecordedModels(
                JsonUtils.readTree(recorded("table_search_index_rebuild_1", "model-b")));

    assertEquals(Map.of("table_search_index_rebuild_1", "model-b"), live.recordedModels());
    assertFalse(live.holds(MODEL_384));
    assertEquals(Set.of("table_search_index_rebuild_1"), live.indexesThatCannotHold(MODEL_384));
    assertEquals(
        "table_search_index_rebuild_1 holds vectors of model model-b", live.describe(MODEL_384));
    assertTrue(live.holds(new EmbeddingModel("model-b", 384)));
  }

  @Test
  void anIndexThatRecordsNoModelIsJudgedByItsDimension() {
    LiveEmbeddingField live =
        vector384("table_search_index").withRecordedModels(JsonUtils.readTree("{}"));

    assertTrue(live.recordedModels().isEmpty());
    assertTrue(live.holds(MODEL_384));
    assertTrue(live.indexesThatCannotHold(MODEL_384).isEmpty());
  }

  @Test
  void onlyTheIndexesThatCannotHoldTheModelAreNamed() {
    LiveEmbeddingField live =
        elasticsearch(
            """
            {"table_search_index_rebuild_2": {"mappings": {"embedding": {"full_name": "embedding",
               "mapping": {"embedding": {"type": "dense_vector", "dims": 384}}}}},
             "table_search_index_rebuild_1": {"mappings": {"embedding": {"full_name": "embedding",
               "mapping": {"embedding": {"type": "dense_vector", "dims": 768}}}}}}
            """);

    assertEquals(Set.of("table_search_index_rebuild_1"), live.indexesThatCannotHold(MODEL_384));
    assertEquals(
        "table_search_index_rebuild_1 has dense_vector of 768 dimensions",
        live.describe(MODEL_384));
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
    assertEquals(Set.of("table_search_index_a"), live.indexesThatCannotHold(MODEL_384));
    assertEquals(
        "table_search_index_a was created without vector support", live.describe(MODEL_384));
  }

  @Test
  void anUnreadableFieldKeepsItsReason() {
    LiveEmbeddingField live = LiveEmbeddingField.unreadable("table_search_index", "503");

    assertFalse(live.readable());
    assertEquals("503", live.readFailure());
    assertFalse(LiveEmbeddingField.unreadable("table_search_index", null).readable());
  }

  @Test
  void aFieldOfTheModelsDimensionTakesItsVectorsWhateverModelItRecords() {
    LiveEmbeddingField anotherModel =
        vector384("table_search_index_a")
            .withRecordedModels(JsonUtils.readTree(recorded("table_search_index_a", "model-b")));

    assertFalse(anotherModel.holds(MODEL_384));
    assertTrue(anotherModel.takesVectorsOf(MODEL_384));
    assertFalse(anotherModel.takesVectorsOf(new EmbeddingModel("model-a", 768)));
  }

  @Test
  void noIndexWithoutTheFieldTakesVectors() {
    LiveEmbeddingField oneWithout =
        elasticsearch(
            "{\"a\": {\"mappings\": {\"embedding\": {\"full_name\": \"embedding\",\"mapping\":"
                + " {\"embedding\": {\"type\": \"dense_vector\", \"dims\": 384}}}}},"
                + " \"b\": {\"mappings\": {}}}");

    assertFalse(oneWithout.takesVectorsOf(MODEL_384));
    assertFalse(
        LiveEmbeddingField.unreadable("table_search_index", "503").takesVectorsOf(MODEL_384));
    assertFalse(LiveEmbeddingField.notMapped("table_search_index").takesVectorsOf(MODEL_384));
  }
}
