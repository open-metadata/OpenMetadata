package org.openmetadata.service.search.vector.client;

import ai.djl.Application;
import ai.djl.MalformedModelException;
import ai.djl.huggingface.translator.TextEmbeddingTranslatorFactory;
import ai.djl.inference.Predictor;
import ai.djl.repository.zoo.Criteria;
import ai.djl.repository.zoo.ModelNotFoundException;
import ai.djl.repository.zoo.ZooModel;
import ai.djl.translate.TranslateException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;

@Slf4j
public class DjlEmbeddingClient implements EmbeddingClient, AutoCloseable {

  public static class EmbeddingInitializationException extends RuntimeException {
    public EmbeddingInitializationException(String message, Throwable cause) {
      super(message, cause);
    }
  }

  public static class EmbeddingGenerationException extends RuntimeException {
    public EmbeddingGenerationException(String message, Throwable cause) {
      super(message, cause);
    }
  }

  private final ZooModel<String, float[]> model;
  private final String modelName;
  private final int dimension;

  public DjlEmbeddingClient(ElasticSearchConfiguration config) {
    NaturalLanguageSearchConfiguration nlsCfg = config.getNaturalLanguageSearch();
    if (nlsCfg.getDjl() == null) {
      throw new IllegalArgumentException("DJL configuration is required");
    }
    this.modelName =
        nlsCfg.getDjl().getEmbeddingModel() != null
            ? nlsCfg.getDjl().getEmbeddingModel()
            : "ai.djl.huggingface.pytorch/sentence-transformers/all-MiniLM-L6-v2";

    try {
      Criteria<String, float[]> criteria =
          Criteria.builder()
              .setTypes(String.class, float[].class)
              .optModelUrls("djl://" + modelName)
              .optEngine("PyTorch")
              .optTranslatorFactory(new TextEmbeddingTranslatorFactory())
              .optApplication(Application.NLP.TEXT_EMBEDDING)
              .build();

      this.model = criteria.loadModel();
      this.dimension = detectDimension();

      LOG.info("Initialized DjlEmbeddingClient with model={}, dimension={}", modelName, dimension);
    } catch (ModelNotFoundException e) {
      throw new EmbeddingInitializationException("DJL model not found: " + modelName, e);
    } catch (MalformedModelException e) {
      throw new EmbeddingInitializationException("DJL model is malformed: " + modelName, e);
    } catch (IOException e) {
      throw new EmbeddingInitializationException("IO error loading DJL model: " + modelName, e);
    }
  }

  private int detectDimension() {
    try (Predictor<String, float[]> pred = model.newPredictor()) {
      float[] sample = pred.predict("test");
      return sample.length;
    } catch (TranslateException e) {
      throw new EmbeddingInitializationException(
          "Failed to detect embedding dimension for model: " + modelName, e);
    }
  }

  @Override
  public float[] embed(String text) {
    if (text == null || text.isBlank()) {
      LOG.debug("Null or blank text, returning zero vector");
      return new float[dimension];
    }

    try (Predictor<String, float[]> pred = model.newPredictor()) {
      String preview = text.length() > 100 ? text.substring(0, 100) + "..." : text;
      LOG.debug("Generating embedding for text: {}", preview);
      return pred.predict(text);
    } catch (TranslateException e) {
      throw new EmbeddingGenerationException("DJL embedding generation failed", e);
    } catch (Exception e) {
      throw new EmbeddingGenerationException("Unexpected error during DJL embedding generation", e);
    }
  }

  @Override
  public List<float[]> embedBatch(List<String> texts) {
    if (texts == null || texts.isEmpty()) {
      return List.of();
    }

    List<String> processedTexts = new ArrayList<>(texts.size());
    List<Integer> emptyIndices = new ArrayList<>();
    for (int i = 0; i < texts.size(); i++) {
      String text = texts.get(i);
      if (text == null || text.isBlank()) {
        emptyIndices.add(i);
        processedTexts.add("placeholder");
      } else {
        processedTexts.add(text);
      }
    }

    try (Predictor<String, float[]> pred = model.newPredictor()) {
      List<float[]> embeddings = pred.batchPredict(processedTexts);
      for (int idx : emptyIndices) {
        embeddings.set(idx, new float[dimension]);
      }
      return embeddings;
    } catch (TranslateException e) {
      throw new EmbeddingGenerationException("DJL batch embedding generation failed", e);
    } catch (Exception e) {
      throw new EmbeddingGenerationException(
          "Unexpected error during DJL batch embedding generation", e);
    }
  }

  @Override
  public int getDimension() {
    return dimension;
  }

  @Override
  public String getModelId() {
    return modelName;
  }

  @Override
  public void close() {
    if (model != null) {
      model.close();
    }
  }
}
