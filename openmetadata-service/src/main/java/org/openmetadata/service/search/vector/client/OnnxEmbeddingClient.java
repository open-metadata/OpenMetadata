package org.openmetadata.service.search.vector.client;

import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.onnx.allminilml6v2.AllMiniLmL6V2EmbeddingModel;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMOnnxEmbeddingConfig;

/**
 * Embedding client backed by an ONNX model running in the OpenMetadata process. The weights ship
 * inside the application, so unlike {@link DjlEmbeddingClient} there is no model download at
 * startup, and unlike the hosted providers there is no credential and no outbound call. That makes
 * it the provider that works in an air-gapped deployment.
 */
@Slf4j
public class OnnxEmbeddingClient extends EmbeddingClient {

  public static final String ALL_MINILM_L6_V2 = "all-MiniLM-L6-v2";

  /** Placeholder embedded in place of blank input so batch indices stay aligned. */
  private static final String BLANK_PLACEHOLDER = "placeholder";

  private final AllMiniLmL6V2EmbeddingModel model;
  private final String modelName;
  private final int dimension;

  public OnnxEmbeddingClient(LLMConfiguration config) {
    super(resolveMaxConcurrent(config));
    LLMOnnxEmbeddingConfig onnxCfg =
        config.getEmbeddings() != null ? config.getEmbeddings().getOnnx() : null;
    if (onnxCfg == null) {
      throw new IllegalArgumentException("ONNX configuration is required");
    }
    String configuredModel =
        onnxCfg.getEmbeddingModel() != null ? onnxCfg.getEmbeddingModel() : ALL_MINILM_L6_V2;
    if (!ALL_MINILM_L6_V2.equalsIgnoreCase(configuredModel)) {
      throw new IllegalArgumentException(
          String.format(
              "Unsupported ONNX embedding model '%s'. Supported models: %s",
              configuredModel, ALL_MINILM_L6_V2));
    }
    // Canonical casing rather than whatever was configured: getModelId() is stamped into the index
    // _meta, and a case-only difference there reads as a model change and forces a reindex.
    this.modelName = ALL_MINILM_L6_V2;
    this.model = new AllMiniLmL6V2EmbeddingModel();
    this.dimension = model.dimension();
    LOG.info("Initialized OnnxEmbeddingClient with model={}, dimension={}", modelName, dimension);
  }

  @Override
  protected float[] doEmbed(String text) {
    if (text == null || text.isBlank()) {
      LOG.debug("Null or blank text, returning zero vector");
      return new float[dimension];
    }
    return model.embed(text).content().vector();
  }

  @Override
  public List<float[]> embedBatch(List<String> texts) {
    if (texts == null || texts.isEmpty()) {
      return List.of();
    }

    List<TextSegment> segments = new ArrayList<>(texts.size());
    List<Integer> blankIndices = new ArrayList<>();
    for (int i = 0; i < texts.size(); i++) {
      String text = texts.get(i);
      if (text == null || text.isBlank()) {
        blankIndices.add(i);
        segments.add(TextSegment.from(BLANK_PLACEHOLDER));
      } else {
        segments.add(TextSegment.from(text));
      }
    }

    List<Embedding> embeddings = model.embedAll(segments).content();
    List<float[]> vectors = new ArrayList<>(embeddings.size());
    for (Embedding embedding : embeddings) {
      vectors.add(embedding.vector());
    }
    for (int index : blankIndices) {
      vectors.set(index, new float[dimension]);
    }
    return vectors;
  }

  @Override
  public int getDimension() {
    return dimension;
  }

  @Override
  public String getModelId() {
    return modelName;
  }
}
