package org.openmetadata.service.search.vector.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.configuration.LLMBedrockEmbeddingConfig;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.security.credentials.AWSBaseConfig;
import org.openmetadata.service.util.AwsCredentialsUtil;
import software.amazon.awssdk.awscore.exception.AwsServiceException;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;

@Slf4j
public final class BedrockEmbeddingClient extends EmbeddingClient implements AutoCloseable {
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private static final String FIELD_INPUT_TEXT = "inputText";
  private static final String FIELD_DIMENSIONS = "dimensions";
  private static final String FIELD_NORMALIZE = "normalize";
  private static final String FIELD_TEXTS = "texts";
  private static final String FIELD_INPUT_TYPE = "input_type";
  private static final String FIELD_TRUNCATE = "truncate";
  private static final String FIELD_EMBEDDING = "embedding";
  private static final String FIELD_EMBEDDINGS = "embeddings";
  private static final String FIELD_FLOAT = "float";
  private static final String COHERE_INPUT_TYPE_SEARCH_DOCUMENT = "search_document";
  private static final String COHERE_INPUT_TYPE_SEARCH_QUERY = "search_query";
  private static final String COHERE_TRUNCATE_END = "END";

  private static final int COHERE_FIXED_DIMENSION = 1024;

  private static final BedrockEmbeddingFamily DEFAULT_FAMILY = BedrockEmbeddingFamily.TITAN_V2;

  private static final List<FamilyMatcher> FAMILY_MATCHERS =
      List.of(
          new FamilyMatcher("cohere", BedrockEmbeddingFamily.COHERE),
          new FamilyMatcher("titan-embed-text-v2", BedrockEmbeddingFamily.TITAN_V2),
          new FamilyMatcher("titan", BedrockEmbeddingFamily.TITAN_V1));

  private record FamilyMatcher(String token, BedrockEmbeddingFamily family) {}

  /**
   * Wire-format strategy per Bedrock embedding model family. Each family knows how to build its
   * request body and extract the embedding array from its response, so adding a new family means
   * adding one constant plus a {@link FamilyMatcher} entry.
   */
  enum BedrockEmbeddingFamily {
    TITAN_V1 {
      @Override
      ObjectNode buildRequest(String text, int dimension, boolean isQuery) {
        ObjectNode payload = MAPPER.createObjectNode();
        payload.put(FIELD_INPUT_TEXT, text);
        return payload;
      }

      @Override
      JsonNode extractEmbedding(JsonNode root) {
        return root.get(FIELD_EMBEDDING);
      }
    },
    TITAN_V2 {
      @Override
      ObjectNode buildRequest(String text, int dimension, boolean isQuery) {
        ObjectNode payload = MAPPER.createObjectNode();
        payload.put(FIELD_INPUT_TEXT, text);
        payload.put(FIELD_DIMENSIONS, dimension);
        payload.put(FIELD_NORMALIZE, true);
        return payload;
      }

      @Override
      JsonNode extractEmbedding(JsonNode root) {
        return root.get(FIELD_EMBEDDING);
      }
    },
    COHERE {
      @Override
      ObjectNode buildRequest(String text, int dimension, boolean isQuery) {
        ObjectNode payload = MAPPER.createObjectNode();
        payload.putArray(FIELD_TEXTS).add(text);
        payload.put(
            FIELD_INPUT_TYPE,
            isQuery ? COHERE_INPUT_TYPE_SEARCH_QUERY : COHERE_INPUT_TYPE_SEARCH_DOCUMENT);
        payload.put(FIELD_TRUNCATE, COHERE_TRUNCATE_END);
        return payload;
      }

      @Override
      JsonNode extractEmbedding(JsonNode root) {
        return extractCohereEmbedding(root);
      }
    };

    abstract ObjectNode buildRequest(String text, int dimension, boolean isQuery);

    abstract JsonNode extractEmbedding(JsonNode root);
  }

  private final BedrockRuntimeClient bedrockClient;
  private final String modelId;
  private final int dimension;
  private final BedrockEmbeddingFamily family;

  public BedrockEmbeddingClient(LLMConfiguration config) {
    super(resolveMaxConcurrent(config));
    LLMBedrockEmbeddingConfig bedrockEmbedding =
        config.getEmbeddings() != null ? config.getEmbeddings().getBedrock() : null;
    if (bedrockEmbedding == null) {
      throw new IllegalArgumentException("Bedrock configuration is required");
    }
    if (bedrockEmbedding.getEmbeddingModelId() == null
        || bedrockEmbedding.getEmbeddingModelId().isBlank()) {
      throw new IllegalArgumentException("Bedrock embedding model ID is required");
    }
    if (bedrockEmbedding.getEmbeddingDimension() == null
        || bedrockEmbedding.getEmbeddingDimension() <= 0) {
      throw new IllegalArgumentException("Bedrock embedding dimension must be positive");
    }

    AWSBaseConfig awsConfig =
        config.getBedrock() != null ? config.getBedrock().getAwsConfig() : null;
    if (awsConfig == null || awsConfig.getRegion() == null || awsConfig.getRegion().isBlank()) {
      throw new IllegalArgumentException("AWS region is required for Bedrock");
    }

    this.modelId = bedrockEmbedding.getEmbeddingModelId();
    this.dimension = bedrockEmbedding.getEmbeddingDimension();
    this.family = familyFor(modelId);
    validateCohereDimension(family, dimension);

    this.bedrockClient =
        BedrockRuntimeClient.builder()
            .credentialsProvider(AwsCredentialsUtil.buildCredentialsProvider(awsConfig))
            .region(Region.of(awsConfig.getRegion()))
            .build();

    LOG.info(
        "Initialized BedrockEmbeddingClient with model={}, family={}, dimension={}, region={}",
        modelId,
        family,
        dimension,
        awsConfig.getRegion());
  }

  @Override
  protected float[] doEmbed(String text) {
    return invokeEmbedding(text, false);
  }

  @Override
  protected float[] doEmbedQuery(String text) {
    return invokeEmbedding(text, true);
  }

  private float[] invokeEmbedding(String text, boolean isQuery) {
    try {
      String body = buildRequestBody(family, text, dimension, isQuery);

      InvokeModelRequest request =
          InvokeModelRequest.builder()
              .modelId(modelId)
              .contentType("application/json")
              .accept("application/json")
              .body(SdkBytes.fromUtf8String(body))
              .build();

      InvokeModelResponse response = bedrockClient.invokeModel(request);
      return parseEmbeddingResponse(family, response.body().asUtf8String());
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
  public int getDimension() {
    return dimension;
  }

  @Override
  public String getModelId() {
    return modelId;
  }

  @Override
  public void close() {
    if (bedrockClient != null) {
      bedrockClient.close();
    }
  }

  static BedrockEmbeddingFamily familyFor(String modelId) {
    String normalized = modelId == null ? "" : modelId.toLowerCase(Locale.ROOT);
    BedrockEmbeddingFamily result = DEFAULT_FAMILY;
    for (FamilyMatcher matcher : FAMILY_MATCHERS) {
      if (normalized.contains(matcher.token())) {
        result = matcher.family();
        break;
      }
    }
    return result;
  }

  static String buildRequestBody(
      BedrockEmbeddingFamily family, String text, int dimension, boolean isQuery)
      throws IOException {
    return MAPPER.writeValueAsString(family.buildRequest(text, dimension, isQuery));
  }

  static void validateCohereDimension(BedrockEmbeddingFamily family, int dimension) {
    if (family == BedrockEmbeddingFamily.COHERE && dimension != COHERE_FIXED_DIMENSION) {
      throw new IllegalArgumentException(
          String.format(
              "Cohere Bedrock embedding models produce %d-dimensional vectors; "
                  + "configured embedding dimension %d is incompatible. "
                  + "Set the embedding dimension to %d.",
              COHERE_FIXED_DIMENSION, dimension, COHERE_FIXED_DIMENSION));
    }
  }

  static float[] parseEmbeddingResponse(BedrockEmbeddingFamily family, String responseBody) {
    try {
      JsonNode root = MAPPER.readTree(responseBody);
      JsonNode embeddingNode = family.extractEmbedding(root);
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

  private static JsonNode extractCohereEmbedding(JsonNode root) {
    JsonNode embeddings = root.get(FIELD_EMBEDDINGS);
    JsonNode result = null;
    if (embeddings != null && embeddings.isArray() && !embeddings.isEmpty()) {
      result = embeddings.get(0);
    } else if (embeddings != null && embeddings.isObject()) {
      JsonNode floatEmbeddings = embeddings.get(FIELD_FLOAT);
      if (floatEmbeddings != null && floatEmbeddings.isArray() && !floatEmbeddings.isEmpty()) {
        result = floatEmbeddings.get(0);
      }
    }
    return result;
  }
}
