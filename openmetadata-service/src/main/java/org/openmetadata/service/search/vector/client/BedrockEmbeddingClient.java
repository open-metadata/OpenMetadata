package org.openmetadata.service.search.vector.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.util.List;
import java.util.Locale;
import java.util.OptionalInt;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
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
import software.amazon.awssdk.services.bedrockruntime.model.ValidationException;

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
  private static final int TITAN_V1_FIXED_DIMENSION = 1536;

  // Bedrock validates each Cohere input against a 2048-character maxLength in the request schema
  // before the Cohere-side `truncate` directive runs, so oversized text must be capped client-side.
  private static final int COHERE_MAX_INPUT_CHARS = 2048;

  // Titan text-embedding models accept at most 8192 input tokens and — unlike Cohere — expose no
  // request-side truncate directive, so oversized text throws a ValidationException (issue #4930).
  // Capping at 16384 chars keeps even token-dense input (~2 chars/token worst case) under the limit
  // while staying well above the 380-word chunk bound, so normal text is never truncated.
  // ponytail: char/token ratio is empirical — lower this knob if a denser corpus still overflows.
  private static final int TITAN_MAX_INPUT_CHARS = 16384;

  // The char cap is a fast-path that keeps typical English input to a single call; token-dense
  // scripts (CJK, emoji) where chars approx tokens can still exceed it. AWS lumps token overflow
  // under a generic ValidationException with no machine-readable code, so detection matches the
  // message marker; the amount, though, we don't parse — we cap the input up front and then halve
  // the *capped* value on each retry, so halving converges within these retries and the char cap
  // already bounds the starting size. This beats depending on AWS's exact error wording to cut.
  private static final int MAX_TOKEN_LIMIT_RETRIES = 3;
  private static final String TOKEN_LIMIT_ERROR_MARKER = "input token";

  private static final BedrockEmbeddingFamily DEFAULT_FAMILY = BedrockEmbeddingFamily.TITAN_V2;

  private static final List<FamilyMatcher> FAMILY_MATCHERS =
      List.of(
          new FamilyMatcher("cohere", BedrockEmbeddingFamily.COHERE),
          new FamilyMatcher("titan-embed-text-v2", BedrockEmbeddingFamily.TITAN_V2),
          new FamilyMatcher("titan-embed-text-v1", BedrockEmbeddingFamily.TITAN_V1));

  private record FamilyMatcher(String token, BedrockEmbeddingFamily family) {}

  /**
   * Wire-format strategy per Bedrock embedding model family. Each family knows how to build its
   * request body and extract the embedding array from its response, so adding a new family means
   * adding one constant plus a {@link FamilyMatcher} entry.
   */
  enum BedrockEmbeddingFamily {
    TITAN_V1(OptionalInt.of(TITAN_V1_FIXED_DIMENSION), TITAN_MAX_INPUT_CHARS) {
      @Override
      ObjectNode buildRequest(String text, int dimension, boolean isQuery) {
        ObjectNode payload = MAPPER.createObjectNode();
        payload.put(FIELD_INPUT_TEXT, cap(text));
        return payload;
      }

      @Override
      JsonNode extractEmbedding(JsonNode root) {
        return root.get(FIELD_EMBEDDING);
      }
    },
    TITAN_V2(OptionalInt.empty(), TITAN_MAX_INPUT_CHARS) {
      @Override
      ObjectNode buildRequest(String text, int dimension, boolean isQuery) {
        ObjectNode payload = MAPPER.createObjectNode();
        payload.put(FIELD_INPUT_TEXT, cap(text));
        payload.put(FIELD_DIMENSIONS, dimension);
        payload.put(FIELD_NORMALIZE, true);
        return payload;
      }

      @Override
      JsonNode extractEmbedding(JsonNode root) {
        return root.get(FIELD_EMBEDDING);
      }
    },
    COHERE(OptionalInt.of(COHERE_FIXED_DIMENSION), COHERE_MAX_INPUT_CHARS) {
      @Override
      ObjectNode buildRequest(String text, int dimension, boolean isQuery) {
        ObjectNode payload = MAPPER.createObjectNode();
        payload.putArray(FIELD_TEXTS).add(cap(text));
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

    private final OptionalInt fixedDimension;
    private final int maxInputChars;

    BedrockEmbeddingFamily(OptionalInt fixedDimension, int maxInputChars) {
      this.fixedDimension = fixedDimension;
      this.maxInputChars = maxInputChars;
    }

    abstract ObjectNode buildRequest(String text, int dimension, boolean isQuery);

    abstract JsonNode extractEmbedding(JsonNode root);

    OptionalInt fixedDimension() {
      return fixedDimension;
    }

    String cap(String text) {
      return StringUtils.truncate(text, maxInputChars);
    }
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
    validateDimension(family, dimension);

    this.bedrockClient =
        BedrockRuntimeClient.builder()
            .credentialsProvider(AwsCredentialsUtil.buildCredentialsProvider(awsConfig))
            .region(Region.of(awsConfig.getRegion()))
            .overrideConfiguration(AwsCredentialsUtil.throttleResilientOverrideConfiguration())
            .build();

    LOG.info(
        "Initialized BedrockEmbeddingClient with model={}, family={}, dimension={}, region={}",
        modelId,
        family,
        dimension,
        awsConfig.getRegion());
  }

  BedrockEmbeddingClient(
      BedrockRuntimeClient bedrockClient,
      String modelId,
      int dimension,
      BedrockEmbeddingFamily family) {
    super(1);
    this.bedrockClient = bedrockClient;
    this.modelId = modelId;
    this.dimension = dimension;
    this.family = family;
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
    String input = family.cap(text);
    float[] embedding = null;
    int attempt = 0;
    while (embedding == null) {
      try {
        embedding = invokeOnce(input, isQuery);
      } catch (AwsServiceException e) {
        requireRetryable(e, attempt++);
        input = halveInput(input);
        LOG.warn("Bedrock rejected oversized input; retrying at {} chars", input.length());
      } catch (SdkClientException e) {
        LOG.error("SDK client error calling Bedrock: {}", e.getMessage(), e);
        throw new RuntimeException("Bedrock embedding generation failed (SDK client error)", e);
      } catch (IOException e) {
        LOG.error("IO error calling Bedrock: {}", e.getMessage(), e);
        throw new RuntimeException("Bedrock embedding generation failed (IO error)", e);
      }
    }
    return embedding;
  }

  private float[] invokeOnce(String text, boolean isQuery) throws IOException {
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
  }

  /**
   * Rethrow unless the call is worth retrying: only a token-limit {@link ValidationException} within
   * the retry budget is, since halving the input is the only thing that can help it. Everything else
   * (throttling, auth, non-token validation) is surfaced immediately. The input is already capped to
   * {@link #TITAN_MAX_INPUT_CHARS} up front, so halving quickly converges below the token limit even
   * for token-dense scripts (CJK, emoji) that the char cap alone can't bound.
   */
  private void requireRetryable(AwsServiceException e, int attempt) {
    boolean retryable = attempt < MAX_TOKEN_LIMIT_RETRIES && isTokenLimitError(e);
    if (!retryable) {
      LOG.error("AWS service error calling Bedrock: {}", e.getMessage(), e);
      throw new RuntimeException("Bedrock embedding generation failed (AWS service error)", e);
    }
  }

  private static boolean isTokenLimitError(AwsServiceException e) {
    String message = e.getMessage();
    return e instanceof ValidationException
        && message != null
        && message.toLowerCase(Locale.ROOT).contains(TOKEN_LIMIT_ERROR_MARKER);
  }

  static String halveInput(String input) {
    int cut = input.length() / 2;
    if (cut > 0 && Character.isHighSurrogate(input.charAt(cut - 1))) {
      cut--;
    }
    return input.substring(0, cut);
  }

  @Override
  protected boolean isPermanentFailure(RuntimeException failure) {
    return failure.getCause() instanceof AwsServiceException awsError
        && isNonRetryableStatus(awsError.statusCode());
  }

  private static boolean isNonRetryableStatus(int statusCode) {
    return statusCode == HttpURLConnection.HTTP_UNAUTHORIZED
        || statusCode == HttpURLConnection.HTTP_FORBIDDEN
        || statusCode == HttpURLConnection.HTTP_NOT_FOUND;
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

  static void validateDimension(BedrockEmbeddingFamily family, int dimension) {
    OptionalInt fixedDimension = family.fixedDimension();
    if (fixedDimension.isPresent() && fixedDimension.getAsInt() != dimension) {
      throw new IllegalArgumentException(
          String.format(
              "%s Bedrock embedding models produce %d-dimensional vectors; "
                  + "configured embedding dimension %d is incompatible. "
                  + "Set the embedding dimension to %d.",
              family, fixedDimension.getAsInt(), dimension, fixedDimension.getAsInt()));
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
