package org.openmetadata.service.search.vector.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.Locale;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
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
import software.amazon.awssdk.services.bedrockruntime.model.ValidationException;

@Slf4j
public final class BedrockEmbeddingClient extends EmbeddingClient implements AutoCloseable {
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private static final String FIELD_INPUT_TEXT = "inputText";
  private static final String FIELD_DIMENSIONS = "dimensions";
  private static final String FIELD_EMBEDDING = "embedding";

  // Titan text-embedding models accept at most 8192 input tokens and expose no request-side
  // truncate directive, so oversized text throws a ValidationException (issue #4930). Capping at
  // 16384 chars keeps even token-dense input (~2 chars/token worst case) under the limit while
  // staying well above the 380-word chunk bound, so normal text is never truncated.
  // ponytail: char/token ratio is empirical — lower this knob if a denser corpus still overflows.
  private static final int TITAN_MAX_INPUT_CHARS = 16384;

  // The char cap is a fast-path that keeps typical English input to a single call; token-dense
  // scripts (CJK, emoji) where chars approx tokens can still exceed it. AWS lumps token overflow
  // under a generic ValidationException with no machine-readable code, so detection matches the
  // message marker; the amount, though, we don't parse — we cap the input up front and then halve
  // the *capped* value on each retry, so halving converges within these retries.
  private static final int MAX_TOKEN_LIMIT_RETRIES = 3;
  private static final String TOKEN_LIMIT_ERROR_MARKER = "input token";

  private final BedrockRuntimeClient bedrockClient;
  private final String modelId;
  private final int dimension;

  public BedrockEmbeddingClient(ElasticSearchConfiguration config) {
    super(resolveMaxConcurrent(config));
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

    this.bedrockClient =
        BedrockRuntimeClient.builder()
            .credentialsProvider(AwsCredentialsUtil.buildCredentialsProvider(awsConfig))
            .region(Region.of(awsConfig.getRegion()))
            .overrideConfiguration(AwsCredentialsUtil.throttleResilientOverrideConfiguration())
            .build();

    LOG.info(
        "Initialized BedrockEmbeddingClient with model={}, dimension={}, region={}",
        modelId,
        dimension,
        awsConfig.getRegion());
  }

  BedrockEmbeddingClient(BedrockRuntimeClient bedrockClient, String modelId, int dimension) {
    super(1);
    this.bedrockClient = bedrockClient;
    this.modelId = modelId;
    this.dimension = dimension;
  }

  @Override
  protected float[] doEmbed(String text) {
    String input = cap(text);
    float[] embedding = null;
    int attempt = 0;
    while (embedding == null) {
      try {
        embedding = invokeOnce(input);
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

  private float[] invokeOnce(String text) throws IOException {
    String body = buildRequestBody(text, dimension);
    InvokeModelRequest request =
        InvokeModelRequest.builder()
            .modelId(modelId)
            .contentType("application/json")
            .accept("application/json")
            .body(SdkBytes.fromUtf8String(body))
            .build();
    InvokeModelResponse response = bedrockClient.invokeModel(request);
    return parseEmbeddingResponse(response.body().asUtf8String());
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

  static String cap(String text) {
    return StringUtils.truncate(text, TITAN_MAX_INPUT_CHARS);
  }

  static String halveInput(String input) {
    int cut = input.length() / 2;
    if (cut > 0 && Character.isHighSurrogate(input.charAt(cut - 1))) {
      cut--;
    }
    return input.substring(0, cut);
  }

  static String buildRequestBody(String text, int dimension) throws IOException {
    ObjectNode payload = MAPPER.createObjectNode();
    payload.put(FIELD_INPUT_TEXT, text);
    payload.put(FIELD_DIMENSIONS, dimension);
    return MAPPER.writeValueAsString(payload);
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

  static float[] parseEmbeddingResponse(String responseBody) {
    try {
      JsonNode root = MAPPER.readTree(responseBody);
      JsonNode embeddingNode = root.get(FIELD_EMBEDDING);
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
