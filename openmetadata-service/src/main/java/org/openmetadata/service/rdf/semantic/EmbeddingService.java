package org.openmetadata.service.rdf.semantic;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.OpenMetadataApplicationConfig;

/**
 * Service for generating text embeddings using various embedding models.
 * This can integrate with OpenAI, Sentence Transformers, or local models.
 */
@Slf4j
public class EmbeddingService {

  private static final int EMBEDDING_DIMENSION = 384; // Dimension for SimpleSemanticEmbeddingProvider
  private static volatile EmbeddingService INSTANCE;
  private final EmbeddingProvider provider;
  private final ExecutorService executorService;

  public interface EmbeddingProvider {
    float[] generateEmbedding(String text);

    int getDimension();
  }

  /**
   * Local embedding provider using pre-computed embeddings or simple hashing
   * In production, this would integrate with real embedding models
   */
  public static class LocalEmbeddingProvider implements EmbeddingProvider {
    private final Random random = new Random();

    @Override
    public float[] generateEmbedding(String text) {
      // For demo purposes, generate deterministic embeddings based on text hash
      // In production, use actual embedding models like:
      // - OpenAI embeddings API
      // - Sentence Transformers via ONNX
      // - Local BERT models

      random.setSeed(text.hashCode());
      float[] embedding = new float[EMBEDDING_DIMENSION];

      // Generate normalized random embedding
      float norm = 0;
      for (int i = 0; i < EMBEDDING_DIMENSION; i++) {
        embedding[i] = random.nextFloat() - 0.5f;
        norm += embedding[i] * embedding[i];
      }

      // Normalize
      norm = (float) Math.sqrt(norm);
      for (int i = 0; i < EMBEDDING_DIMENSION; i++) {
        embedding[i] /= norm;
      }

      return embedding;
    }

    @Override
    public int getDimension() {
      return EMBEDDING_DIMENSION;
    }
  }

  /**
   * OpenAI embedding provider
   */
  public static class OpenAIEmbeddingProvider implements EmbeddingProvider {
    private final String apiKey;
    private final String model;

    public OpenAIEmbeddingProvider(String apiKey, String model) {
      this.apiKey = apiKey;
      this.model = model != null ? model : "text-embedding-ada-002";
    }

    @Override
    public float[] generateEmbedding(String text) {
      // For demo, using the OpenAIEmbeddingProvider implementation
      // In production, this would be injected via configuration
      OpenAIEmbeddingProvider provider = new OpenAIEmbeddingProvider(apiKey, model);
      return provider.generateEmbedding(text);
    }

    @Override
    public int getDimension() {
      // OpenAI ada-002 has 1536 dimensions
      return 1536;
    }
  }

  /**
   * Sentence Transformers provider using ONNX runtime
   */
  public static class SentenceTransformerProvider implements EmbeddingProvider {
    private final String modelPath;

    public SentenceTransformerProvider(String modelPath) {
      this.modelPath = modelPath;
    }

    @Override
    public float[] generateEmbedding(String text) {
      // TODO: Implement ONNX runtime inference
      // For now, fallback to local provider
      return new LocalEmbeddingProvider().generateEmbedding(text);
    }

    @Override
    public int getDimension() {
      return EMBEDDING_DIMENSION;
    }
  }

  private EmbeddingService() {
    this(null);
  }

  private EmbeddingService(OpenMetadataApplicationConfig config) {
    this.executorService = Executors.newFixedThreadPool(4);

    // For now, always use local provider
    // TODO: Add configuration support for different providers
    this.provider = new LocalEmbeddingProvider();

    LOG.info(
        "Initialized embedding service with provider: {}", provider.getClass().getSimpleName());
  }

  public static EmbeddingService getInstance() {
    if (INSTANCE == null) {
      synchronized (EmbeddingService.class) {
        if (INSTANCE == null) {
          INSTANCE = new EmbeddingService();
        }
      }
    }
    return INSTANCE;
  }

  public static EmbeddingService getInstance(OpenMetadataApplicationConfig config) {
    if (INSTANCE == null) {
      synchronized (EmbeddingService.class) {
        if (INSTANCE == null) {
          INSTANCE = new EmbeddingService(config);
        }
      }
    }
    return INSTANCE;
  }

  /**
   * Generate embedding for a single text
   */
  public float[] generateEmbedding(String text) {
    if (text == null || text.trim().isEmpty()) {
      return new float[provider.getDimension()];
    }

    // Truncate text if too long (most models have token limits)
    String truncated = text.length() > 512 ? text.substring(0, 512) : text;

    return provider.generateEmbedding(truncated);
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  public CompletableFuture<Map<String, float[]>> generateBatchEmbeddings(List<String> texts) {
    Map<String, CompletableFuture<float[]>> futures = new HashMap<>();

    for (String text : texts) {
      CompletableFuture<float[]> future =
          CompletableFuture.supplyAsync(() -> generateEmbedding(text), executorService);
      futures.put(text, future);
    }

    // Combine all futures
    return CompletableFuture.allOf(futures.values().toArray(new CompletableFuture[0]))
        .thenApply(
            v -> {
              Map<String, float[]> results = new HashMap<>();
              futures.forEach(
                  (text, future) -> {
                    try {
                      results.put(text, future.get());
                    } catch (Exception e) {
                      LOG.error("Failed to generate embedding for text: {}", text, e);
                      results.put(text, new float[provider.getDimension()]);
                    }
                  });
              return results;
            });
  }

  /**
   * Calculate similarity between two embeddings
   */
  public static double cosineSimilarity(float[] a, float[] b) {
    if (a.length != b.length) {
      throw new IllegalArgumentException("Embeddings must have same dimension");
    }

    double dotProduct = 0.0;
    double normA = 0.0;
    double normB = 0.0;

    for (int i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA == 0.0 || normB == 0.0) {
      return 0.0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find k nearest neighbors from a set of embeddings
   */
  public static List<Integer> findNearestNeighbors(float[] query, List<float[]> embeddings, int k) {
    List<IndexedScore> scores = new ArrayList<>();

    for (int i = 0; i < embeddings.size(); i++) {
      double similarity = cosineSimilarity(query, embeddings.get(i));
      scores.add(new IndexedScore(i, similarity));
    }

    // Sort by similarity descending and take top k
    return scores.stream()
        .sorted((a, b) -> Double.compare(b.score, a.score))
        .limit(k)
        .map(is -> is.index)
        .collect(java.util.stream.Collectors.toList());
  }

  private static class IndexedScore {
    final int index;
    final double score;

    IndexedScore(int index, double score) {
      this.index = index;
      this.score = score;
    }
  }

  public void shutdown() {
    executorService.shutdown();
  }
}
