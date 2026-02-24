package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.vector.client.EmbeddingClient;

class EmbeddingClientTest {

  @Test
  void testMockEmbeddingClient() {
    EmbeddingClient client = new MockEmbeddingClient(384);

    float[] embedding = client.embed("test text");
    assertNotNull(embedding);
    assertEquals(384, embedding.length);
    assertEquals(384, client.getDimension());
    assertEquals("mock-model", client.getModelId());
  }

  @Test
  void testBatchEmbeddings() {
    EmbeddingClient client = new MockEmbeddingClient(512);

    List<float[]> embeddings = client.embedBatch(List.of("text1", "text2", "text3"));
    assertNotNull(embeddings);
    assertEquals(3, embeddings.size());
    for (float[] emb : embeddings) {
      assertEquals(512, emb.length);
    }
  }

  @Test
  void testDefaultBatchUsesEmbed() {
    EmbeddingClient client = new MockEmbeddingClient(128);

    List<float[]> embeddings = client.embedBatch(List.of("a", "b"));
    assertEquals(2, embeddings.size());
    assertEquals(128, embeddings.get(0).length);
    assertEquals(128, embeddings.get(1).length);
  }

  @Test
  void testDifferentDimensions() {
    EmbeddingClient client768 = new MockEmbeddingClient(768);
    EmbeddingClient client1536 = new MockEmbeddingClient(1536);

    assertEquals(768, client768.embed("test").length);
    assertEquals(1536, client1536.embed("test").length);
  }

  static class MockEmbeddingClient implements EmbeddingClient {
    private final int dimension;

    MockEmbeddingClient(int dimension) {
      this.dimension = dimension;
    }

    @Override
    public float[] embed(String text) {
      float[] embedding = new float[dimension];
      int hash = text.hashCode();
      for (int i = 0; i < dimension; i++) {
        embedding[i] = (float) Math.sin(hash + i) * 0.1f;
      }
      return embedding;
    }

    @Override
    public int getDimension() {
      return dimension;
    }

    @Override
    public String getModelId() {
      return "mock-model";
    }
  }
}
