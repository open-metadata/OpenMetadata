package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.client.EmbeddingModel;

class EmbeddingFieldUpdateTest {
  private static final String INDEX = "table_search_index";
  private static final EmbeddingModel MODEL = new EmbeddingModel("model-a", 384);

  private static LiveEmbeddingField declared(String type, Integer dimensions, String recorded) {
    return new LiveEmbeddingField(
        INDEX,
        Set.of(INDEX),
        Map.of(INDEX, new LiveEmbeddingField.Declared(type, dimensions)),
        recorded == null ? Map.of() : Map.of(INDEX, recorded),
        Set.of(),
        null);
  }

  @Test
  void anIndexWithoutTheFieldGetsItDeclared() {
    assertEquals(
        EmbeddingFieldUpdate.DECLARE,
        EmbeddingFieldUpdate.updateFor(LiveEmbeddingField.notMapped(INDEX), MODEL));
  }

  @Test
  void aVectorOfTheModelIsKept() {
    assertEquals(
        EmbeddingFieldUpdate.KEEP,
        EmbeddingFieldUpdate.updateFor(declared("dense_vector", 384, "model-a"), MODEL));
    assertEquals(
        EmbeddingFieldUpdate.KEEP,
        EmbeddingFieldUpdate.updateFor(declared("dense_vector", 384, null), MODEL));
  }

  @Test
  void aVectorOfOtherDimensionsIsLeftOut() {
    assertEquals(
        EmbeddingFieldUpdate.LEAVE_OUT,
        EmbeddingFieldUpdate.updateFor(
            declared("dense_vector", 384, "model-a"), new EmbeddingModel("model-a", 768)));
  }

  @Test
  void aVectorOfTheSameDimensionsBuiltForAnotherModelIsLeftOut() {
    assertEquals(
        EmbeddingFieldUpdate.LEAVE_OUT,
        EmbeddingFieldUpdate.updateFor(declared("dense_vector", 384, "model-b"), MODEL));
  }

  @Test
  void aFieldOfAnotherTypeIsLeftOut() {
    assertEquals(
        EmbeddingFieldUpdate.LEAVE_OUT,
        EmbeddingFieldUpdate.updateFor(declared("float", null, null), MODEL));
  }

  @Test
  void anIndexThatCannotTakeAVectorFieldIsLeftOut() {
    LiveEmbeddingField withoutKnn =
        new LiveEmbeddingField(INDEX, Set.of(INDEX), Map.of(), Map.of(), Set.of(INDEX), null);

    assertEquals(EmbeddingFieldUpdate.LEAVE_OUT, EmbeddingFieldUpdate.updateFor(withoutKnn, MODEL));
  }

  @Test
  void anUnreadableFieldIsLeftOut() {
    assertEquals(
        EmbeddingFieldUpdate.LEAVE_OUT,
        EmbeddingFieldUpdate.updateFor(LiveEmbeddingField.unreadable(INDEX, "503"), MODEL));
  }

  @Test
  void aMappingUpdateRecordsItsDecisionInTheServersVectorFieldHealth() {
    SearchRepository searchRepository = mock(SearchRepository.class);
    VectorFieldHealth health = mock(VectorFieldHealth.class);
    when(searchRepository.getVectorFieldHealth()).thenReturn(health);
    LiveEmbeddingField live = declared("dense_vector", 768, "model-a");

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      assertEquals(EmbeddingFieldUpdate.LEAVE_OUT, EmbeddingFieldUpdate.decide(live, MODEL));
    }

    verify(health).record(live, MODEL, EmbeddingFieldUpdate.LEAVE_OUT);
  }

  @Test
  void onlyADeclaredFieldRecordsTheModelInMeta() {
    ObjectNode declare = mappingsWithMeta();
    EmbeddingFieldUpdate.DECLARE.applyModelMeta(declare, MODEL);
    assertEquals("model-a", declare.path("_meta").path("embedding_model").asText());
    assertEquals(384, declare.path("_meta").path("embedding_dimension").asInt());
    assertEquals("kept", declare.path("_meta").path("other").asText());

    ObjectNode keep = mappingsWithMeta();
    EmbeddingFieldUpdate.KEEP.applyModelMeta(keep, MODEL);
    assertFalse(keep.path("_meta").has("embedding_model"));
    assertFalse(keep.path("_meta").has("embedding_dimension"));
    assertEquals("kept", keep.path("_meta").path("other").asText());

    ObjectNode leaveOut =
        (ObjectNode)
            JsonUtils.readTree(
                "{\"_meta\":{\"embedding_model\":\"old\",\"embedding_dimension\":768}}");
    EmbeddingFieldUpdate.LEAVE_OUT.applyModelMeta(leaveOut, MODEL);
    assertFalse(leaveOut.has("_meta"), "an emptied _meta is left out, keeping the live one");
  }

  private static ObjectNode mappingsWithMeta() {
    return (ObjectNode)
        JsonUtils.readTree(
            "{\"_meta\":{\"embedding_model\":\"old\",\"embedding_dimension\":768,"
                + "\"other\":\"kept\"}}");
  }
}
