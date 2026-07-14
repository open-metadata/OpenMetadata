package org.openmetadata.service.search.vector.client;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;
import software.amazon.awssdk.services.bedrockruntime.model.ValidationException;

class BedrockEmbeddingClientTest {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final float DELTA = 1e-6f;

  @Test
  void titanCapsOversizedInputToStayUnderTokenLimit() throws Exception {
    JsonNode payload = buildPayload("x".repeat(20000), 512);

    assertEquals(16384, payload.get("inputText").asText().length());
  }

  @Test
  void titanLeavesInputWithinLimitUntouched() throws Exception {
    JsonNode payload = buildPayload("short text", 512);

    assertEquals("short text", payload.get("inputText").asText());
    assertEquals(512, payload.get("dimensions").asInt());
  }

  @Test
  void halvesOversizedInputForRetry() {
    String input = "x".repeat(16384);

    String shorter = BedrockEmbeddingClient.halveInput(input);

    assertEquals(8192, shorter.length());
  }

  @Test
  void halveInputHandlesShortAndEmptyWithoutThrowing() {
    assertEquals("a", BedrockEmbeddingClient.halveInput("ab"));
    assertEquals("", BedrockEmbeddingClient.halveInput("a"));
    assertEquals("", BedrockEmbeddingClient.halveInput(""));
  }

  @Test
  void halveInputNeverSplitsASurrogatePair() {
    String emojis = "😀".repeat(3);

    String shorter = BedrockEmbeddingClient.halveInput(emojis);

    assertEquals("😀", shorter);
  }

  @Test
  void tokenLimitErrorTriggersHalvedRetryThenSucceeds() {
    BedrockRuntimeClient mockClient = mock(BedrockRuntimeClient.class);
    when(mockClient.invokeModel(any(InvokeModelRequest.class)))
        .thenThrow(tokenLimitException())
        .thenReturn(titanResponse());
    BedrockEmbeddingClient client = titanClient(mockClient);

    float[] result = client.embed("x".repeat(30000));

    assertArrayEquals(new float[] {0.1f, 0.2f}, result, DELTA);
    verify(mockClient, times(2)).invokeModel(any(InvokeModelRequest.class));
  }

  @Test
  void nonTokenValidationErrorRethrowsWithoutRetry() {
    BedrockRuntimeClient mockClient = mock(BedrockRuntimeClient.class);
    when(mockClient.invokeModel(any(InvokeModelRequest.class)))
        .thenThrow(ValidationException.builder().message("Malformed input request").build());
    BedrockEmbeddingClient client = titanClient(mockClient);

    assertThrows(RuntimeException.class, () -> client.embed("hello"));
    verify(mockClient, times(1)).invokeModel(any(InvokeModelRequest.class));
  }

  @Test
  void persistentTokenLimitErrorExhaustsRetriesThenThrows() {
    BedrockRuntimeClient mockClient = mock(BedrockRuntimeClient.class);
    when(mockClient.invokeModel(any(InvokeModelRequest.class))).thenThrow(tokenLimitException());
    BedrockEmbeddingClient client = titanClient(mockClient);

    assertThrows(RuntimeException.class, () -> client.embed("hello"));
    verify(mockClient, times(4)).invokeModel(any(InvokeModelRequest.class));
  }

  @Test
  void parseTitanResponse() {
    float[] embedding =
        BedrockEmbeddingClient.parseEmbeddingResponse(
            "{\"embedding\":[0.6,0.7],\"inputTextTokenCount\":2}");

    assertArrayEquals(new float[] {0.6f, 0.7f}, embedding, DELTA);
  }

  private static BedrockEmbeddingClient titanClient(BedrockRuntimeClient mockClient) {
    return new BedrockEmbeddingClient(mockClient, "amazon.titan-embed-text-v2:0", 512);
  }

  private static ValidationException tokenLimitException() {
    return ValidationException.builder()
        .message("Too many input tokens. Max input tokens: 8192, request input token count: 18338")
        .build();
  }

  private static InvokeModelResponse titanResponse() {
    return InvokeModelResponse.builder()
        .body(SdkBytes.fromUtf8String("{\"embedding\":[0.1,0.2]}"))
        .build();
  }

  private static JsonNode buildPayload(String text, int dimension) throws Exception {
    return MAPPER.readTree(
        BedrockEmbeddingClient.buildRequestBody(BedrockEmbeddingClient.cap(text), dimension));
  }
}
