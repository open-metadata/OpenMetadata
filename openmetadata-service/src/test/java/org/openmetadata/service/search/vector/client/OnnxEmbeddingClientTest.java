package org.openmetadata.service.search.vector.client;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMEmbeddingsConfig;
import org.openmetadata.schema.configuration.LLMOnnxEmbeddingConfig;

/**
 * Exercises the real in-process ONNX model rather than a mock: the whole point of this provider is
 * that it needs no network and no credentials, so the model it ships with is available to the test.
 */
class OnnxEmbeddingClientTest {
  private static final int MINILM_DIMENSION = 384;

  private static OnnxEmbeddingClient client;

  @BeforeAll
  static void setUp() {
    client = new OnnxEmbeddingClient(config(null));
  }

  @Test
  void missingOnnxBlockIsRejected() {
    LLMConfiguration noEmbeddings = new LLMConfiguration();
    assertThrows(IllegalArgumentException.class, () -> new OnnxEmbeddingClient(noEmbeddings));

    LLMConfiguration noOnnxBlock = new LLMConfiguration().withEmbeddings(new LLMEmbeddingsConfig());
    assertThrows(IllegalArgumentException.class, () -> new OnnxEmbeddingClient(noOnnxBlock));
  }

  @Test
  void unsupportedModelIsRejected() {
    LLMConfiguration config = config("bge-small-en-v1.5");
    IllegalArgumentException failure =
        assertThrows(IllegalArgumentException.class, () -> new OnnxEmbeddingClient(config));
    assertTrue(failure.getMessage().contains("bge-small-en-v1.5"), failure.getMessage());
  }

  @Test
  void configuredModelNameIsCaseInsensitive() {
    assertEquals(
        OnnxEmbeddingClient.ALL_MINILM_L6_V2,
        new OnnxEmbeddingClient(config("all-minilm-l6-v2")).getModelId());
  }

  @Test
  void defaultsToMiniLmWhenModelIsUnset() {
    assertEquals(OnnxEmbeddingClient.ALL_MINILM_L6_V2, client.getModelId());
    assertEquals(MINILM_DIMENSION, client.getDimension());
  }

  @Test
  void embedProducesADeterministicNonZeroVector() {
    float[] first = client.embed("customer lifetime value table");
    float[] second = client.embed("customer lifetime value table");

    assertEquals(MINILM_DIMENSION, first.length);
    assertArrayEquals(first, second);
    assertTrue(magnitude(first) > 0.0f, "embedding should not be the zero vector");
  }

  @Test
  void blankTextEmbedsToTheZeroVector() {
    assertArrayEquals(new float[MINILM_DIMENSION], client.embed(null));
    assertArrayEquals(new float[MINILM_DIMENSION], client.embed("   "));
  }

  @Test
  void relatedTextsEmbedCloserThanUnrelatedOnes() {
    float[] orders = client.embed("table of customer orders and invoices");
    float[] purchases = client.embed("table of customer purchases and receipts");
    float[] weather = client.embed("hourly rainfall measurements by weather station");

    assertTrue(
        cosine(orders, purchases) > cosine(orders, weather),
        "related descriptions should be closer than unrelated ones");
  }

  @Test
  void embedBatchMatchesSingleEmbeddingsAndKeepsIndicesAligned() {
    List<String> texts = Arrays.asList("first table", null, "second table", "  ");

    List<float[]> batch = client.embedBatch(texts);

    assertEquals(texts.size(), batch.size());
    assertArrayEquals(client.embed("first table"), batch.get(0));
    assertArrayEquals(new float[MINILM_DIMENSION], batch.get(1));
    assertArrayEquals(client.embed("second table"), batch.get(2));
    assertArrayEquals(new float[MINILM_DIMENSION], batch.get(3));
    assertNotEquals(0.0f, magnitude(batch.get(2)));
  }

  @Test
  void embedBatchOfNothingReturnsNothing() {
    assertEquals(List.of(), client.embedBatch(null));
    assertEquals(List.of(), client.embedBatch(Collections.emptyList()));
  }

  private static LLMConfiguration config(String embeddingModel) {
    return new LLMConfiguration()
        .withEmbeddings(
            new LLMEmbeddingsConfig()
                .withOnnx(new LLMOnnxEmbeddingConfig().withEmbeddingModel(embeddingModel)));
  }

  private static float magnitude(float[] vector) {
    double sum = 0.0;
    for (float value : vector) {
      sum += (double) value * value;
    }
    return (float) Math.sqrt(sum);
  }

  private static float cosine(float[] left, float[] right) {
    double dot = 0.0;
    for (int i = 0; i < left.length; i++) {
      dot += (double) left[i] * right[i];
    }
    return (float) (dot / (magnitude(left) * magnitude(right)));
  }
}
