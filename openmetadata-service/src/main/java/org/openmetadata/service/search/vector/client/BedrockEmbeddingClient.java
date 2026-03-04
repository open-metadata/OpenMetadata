package org.openmetadata.service.search.vector.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.security.credentials.AWSBaseConfig;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.NaturalLanguageSearchConfiguration;
import org.openmetadata.service.util.AwsCredentialsUtil;
import software.amazon.awssdk.awscore.exception.AwsServiceException;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;

@Slf4j
public final class BedrockEmbeddingClient implements EmbeddingClient, AutoCloseable {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final int PARALLEL_THREADS = 8;

  private final BedrockRuntimeClient bedrockClient;
  private final String modelId;
  private final int dimension;
  private final ExecutorService executor;

  public BedrockEmbeddingClient(ElasticSearchConfiguration config) {
    NaturalLanguageSearchConfiguration nlsCfg = config.getNaturalLanguageSearch();
    if (nlsCfg.getBedrock() == null) {
      throw new IllegalArgumentException("Bedrock configuration is required");
    }
    if (nlsCfg.getBedrock().getEmbeddingModelId() == null
        || nlsCfg.getBedrock().getEmbeddingModelId().isBlank()) {
      throw new IllegalArgumentException("Bedrock embedding model ID is required");
    }
    if (nlsCfg.getBedrock().getEmbeddingDimension() == null
        || nlsCfg.getBedrock().getEmbeddingDimension() <= 0) {
      throw new IllegalArgumentException("Bedrock embedding dimension must be positive");
    }

    AWSBaseConfig awsConfig = nlsCfg.getBedrock().getAwsConfig();
    if (awsConfig == null || awsConfig.getRegion() == null || awsConfig.getRegion().isBlank()) {
      throw new IllegalArgumentException("AWS region is required for Bedrock");
    }

    this.modelId = nlsCfg.getBedrock().getEmbeddingModelId();
    this.dimension = nlsCfg.getBedrock().getEmbeddingDimension();
    this.executor = Executors.newFixedThreadPool(PARALLEL_THREADS);

    this.bedrockClient =
        BedrockRuntimeClient.builder()
            .credentialsProvider(AwsCredentialsUtil.buildCredentialsProvider(awsConfig))
            .region(Region.of(awsConfig.getRegion()))
            .build();

    LOG.info(
        "Initialized BedrockEmbeddingClient with model={}, dimension={}, region={}",
        modelId,
        dimension,
        awsConfig.getRegion());
  }

  @Override
  public float[] embed(String text) {
    try {
      ObjectNode payload = MAPPER.createObjectNode();
      payload.put("inputText", text);
      payload.put("dimensions", dimension);
      String body = MAPPER.writeValueAsString(payload);

      InvokeModelRequest request =
          InvokeModelRequest.builder()
              .modelId(modelId)
              .contentType("application/json")
              .accept("application/json")
              .body(SdkBytes.fromUtf8String(body))
              .build();

      InvokeModelResponse response = bedrockClient.invokeModel(request);
      return parseEmbeddingResponse(response.body().asUtf8String());
    } catch (AwsServiceException e) {
      LOG.error("AWS service error calling Bedrock: {}", e.getMessage(), e);
      throw new RuntimeException("Bedrock embedding generation failed (AWS service error)", e);
    } catch (SdkClientException e) {
      LOG.error("SDK client error calling Bedrock: {}", e.getMessage(), e);
      throw new RuntimeException("Bedrock embedding generation failed (SDK client error)", e);
    } catch (IOException e) {
      LOG.error("IO error calling Bedrock: {}", e.getMessage(), e);
      throw new RuntimeException("Bedrock embedding generation failed (IO error)", e);
    }
  }

  @Override
  public List<float[]> embedBatch(List<String> texts) {
    if (texts == null || texts.isEmpty()) {
      return List.of();
    }

    List<CompletableFuture<float[]>> futures = new ArrayList<>(texts.size());
    for (String text : texts) {
      futures.add(CompletableFuture.supplyAsync(() -> embed(text), executor));
    }

    List<float[]> results = new ArrayList<>(texts.size());
    for (CompletableFuture<float[]> future : futures) {
      results.add(future.join());
    }
    return results;
  }

  @Override
  public int getDimension() {
    return dimension;
  }

  @Override
  public String getModelId() {
    return modelId;
  }

  @Override
  public void close() {
    executor.shutdown();
    try {
      if (!executor.awaitTermination(10, TimeUnit.SECONDS)) {
        executor.shutdownNow();
      }
    } catch (InterruptedException e) {
      executor.shutdownNow();
      Thread.currentThread().interrupt();
    }
    if (bedrockClient != null) {
      bedrockClient.close();
    }
  }

  private float[] parseEmbeddingResponse(String responseBody) {
    try {
      JsonNode root = MAPPER.readTree(responseBody);
      JsonNode embeddingNode = root.get("embedding");
      if (embeddingNode == null || !embeddingNode.isArray()) {
        throw new RuntimeException("Invalid Bedrock response: no embedding array found");
      }
      float[] embedding = new float[embeddingNode.size()];
      for (int i = 0; i < embeddingNode.size(); i++) {
        embedding[i] = (float) embeddingNode.get(i).asDouble();
      }
      return embedding;
    } catch (IOException e) {
      throw new RuntimeException("Failed to parse Bedrock embedding response", e);
    }
  }
}
