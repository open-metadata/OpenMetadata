package org.openmetadata.service.search.vector.client;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.vector.client.BedrockEmbeddingClient.BedrockEmbeddingFamily;

class BedrockEmbeddingClientTest {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final float DELTA = 1e-6f;

  @Test
  void cohereModelsResolveToCohereFamily() {
    assertEquals(
        BedrockEmbeddingFamily.COHERE, BedrockEmbeddingClient.familyFor("cohere.embed-english-v3"));
    assertEquals(
        BedrockEmbeddingFamily.COHERE,
        BedrockEmbeddingClient.familyFor("cohere.embed-multilingual-v3"));
    assertEquals(
        BedrockEmbeddingFamily.COHERE,
        BedrockEmbeddingClient.familyFor("us.cohere.embed-english-v3"));
  }

  @Test
  void titanModelsResolveToTheirVersionedFamily() {
    assertEquals(
        BedrockEmbeddingFamily.TITAN_V1,
        BedrockEmbeddingClient.familyFor("amazon.titan-embed-text-v1"));
    assertEquals(
        BedrockEmbeddingFamily.TITAN_V2,
        BedrockEmbeddingClient.familyFor("amazon.titan-embed-text-v2:0"));
  }

  @Test
  void unknownAndNullModelsFallBackToDefaultTitanV2() {
    assertEquals(
        BedrockEmbeddingFamily.TITAN_V2, BedrockEmbeddingClient.familyFor("some.unknown-model"));
    assertEquals(BedrockEmbeddingFamily.TITAN_V2, BedrockEmbeddingClient.familyFor(null));
  }

  @Test
  void titanV1RequestSendsOnlyInputText() throws Exception {
    JsonNode payload = buildPayload(BedrockEmbeddingFamily.TITAN_V1, "hello world", 1024, false);

    assertEquals("hello world", payload.get("inputText").asText());
    assertFalse(payload.has("dimensions"));
    assertFalse(payload.has("normalize"));
  }

  @Test
  void titanV2RequestSendsInputTextDimensionsAndNormalize() throws Exception {
    JsonNode payload = buildPayload(BedrockEmbeddingFamily.TITAN_V2, "hello world", 512, false);

    assertEquals("hello world", payload.get("inputText").asText());
    assertEquals(512, payload.get("dimensions").asInt());
    assertTrue(payload.get("normalize").asBoolean());
  }

  @Test
  void cohereDocumentRequestUsesTextsAndSearchDocumentInputType() throws Exception {
    JsonNode payload = buildPayload(BedrockEmbeddingFamily.COHERE, "hello world", 1024, false);

    assertTrue(payload.get("texts").isArray());
    assertEquals("hello world", payload.get("texts").get(0).asText());
    assertEquals("search_document", payload.get("input_type").asText());
    assertEquals("END", payload.get("truncate").asText());

    assertFalse(payload.has("inputText"));
    assertFalse(payload.has("dimensions"));
  }

  @Test
  void cohereQueryRequestUsesSearchQueryInputType() throws Exception {
    JsonNode payload = buildPayload(BedrockEmbeddingFamily.COHERE, "hello world", 1024, true);

    assertEquals("search_query", payload.get("input_type").asText());
  }

  @Test
  void titanQueryRequestIsIdenticalToDocumentRequest() throws Exception {
    JsonNode document = buildPayload(BedrockEmbeddingFamily.TITAN_V2, "hello world", 512, false);
    JsonNode query = buildPayload(BedrockEmbeddingFamily.TITAN_V2, "hello world", 512, true);

    assertEquals(document, query);
  }

  @Test
  void parseTitanResponse() {
    float[] embedding =
        BedrockEmbeddingClient.parseEmbeddingResponse(
            BedrockEmbeddingFamily.TITAN_V2, "{\"embedding\":[0.6,0.7],\"inputTextTokenCount\":2}");
    assertArrayEquals(new float[] {0.6f, 0.7f}, embedding, DELTA);
  }

  @Test
  void parseCohereFloatsResponse() {
    float[] embedding =
        BedrockEmbeddingClient.parseEmbeddingResponse(
            BedrockEmbeddingFamily.COHERE, "{\"embeddings\":[[0.1,0.2,0.3]]}");
    assertArrayEquals(new float[] {0.1f, 0.2f, 0.3f}, embedding, DELTA);
  }

  @Test
  void parseCohereEmbeddingsByTypeResponse() {
    float[] embedding =
        BedrockEmbeddingClient.parseEmbeddingResponse(
            BedrockEmbeddingFamily.COHERE, "{\"embeddings\":{\"float\":[[0.4,0.5]]}}");
    assertArrayEquals(new float[] {0.4f, 0.5f}, embedding, DELTA);
  }

  @Test
  void cohereRejectsDimensionsOtherThanItsFixedSize() {
    assertThrows(
        IllegalArgumentException.class,
        () -> BedrockEmbeddingClient.validateCohereDimension(BedrockEmbeddingFamily.COHERE, 512));
  }

  @Test
  void cohereAcceptsItsFixedDimension() {
    BedrockEmbeddingClient.validateCohereDimension(BedrockEmbeddingFamily.COHERE, 1024);
  }

  @Test
  void titanFamiliesAcceptAnyDimension() {
    BedrockEmbeddingClient.validateCohereDimension(BedrockEmbeddingFamily.TITAN_V2, 512);
    BedrockEmbeddingClient.validateCohereDimension(BedrockEmbeddingFamily.TITAN_V1, 256);
  }

  private static JsonNode buildPayload(
      BedrockEmbeddingFamily family, String text, int dimension, boolean isQuery) throws Exception {
    return MAPPER.readTree(
        BedrockEmbeddingClient.buildRequestBody(family, text, dimension, isQuery));
  }
}
