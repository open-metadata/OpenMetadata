package org.openmetadata.sdk.network;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.type.TypeFactory;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.AllModels;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Verifies the {@code default} {@link HttpClient#executeForType} overloads on a minimal custom
 * {@link HttpClient} implementing only the pre-existing interface methods, plus {@link
 * ListResponse} null-safety guards.
 */
class HttpClientDefaultExecuteForTypeTest {

  private static final TypeReference<ResultList<PipelineStatus>> STATUS_RESULT_LIST_TYPE =
      new TypeReference<>() {};

  @Test
  void defaultExecuteForTypeDeserializesTypedElementsAndIgnoresUnknownProperties() {
    String json =
        """
        {
          "data": [
            {
              "timestamp": 1700000500000,
              "executionStatus": "Successful",
              "unknownFutureField": "ignored"
            }
          ],
          "paging": {"total": 1}
        }
        """;
    MinimalHttpClient client = new MinimalHttpClient(json);
    RequestOptions options = RequestOptions.builder().queryParam("limit", "10").build();

    ResultList<PipelineStatus> byTypeRef =
        client.executeForType(
            HttpMethod.GET, "/v1/pipelines/p/status", null, STATUS_RESULT_LIST_TYPE, options);

    assertEquals(HttpMethod.GET, client.lastMethod);
    assertEquals("/v1/pipelines/p/status", client.lastPath);
    assertEquals(Map.of("limit", "10"), client.lastOptions.getQueryParams());
    assertEquals(1, byTypeRef.getData().size());
    for (PipelineStatus status : byTypeRef.getData()) {
      assertEquals(1700000500000L, status.getTimestamp());
      assertEquals(StatusType.Successful, status.getExecutionStatus());
    }

    ResultList<PipelineStatus> byTypeRefNoOptions =
        client.executeForType(
            HttpMethod.GET, "/v1/pipelines/p/status", null, STATUS_RESULT_LIST_TYPE);
    assertNull(client.lastOptions);
    assertEquals(1700000500000L, byTypeRefNoOptions.getData().getFirst().getTimestamp());

    JavaType listResponseType =
        TypeFactory.defaultInstance()
            .constructParametricType(ListResponse.class, PipelineStatus.class);
    ListResponse<PipelineStatus> byJavaType =
        client.executeForType(HttpMethod.GET, "/v1/pipelines/p/status", null, listResponseType);
    assertEquals(1, byJavaType.getData().size());
    for (PipelineStatus status : byJavaType.getData()) {
      assertEquals(StatusType.Successful, status.getExecutionStatus());
    }
  }

  @Test
  void defaultExecuteForTypeReturnsNullOnEmptyBlankNullOrVoid() {
    assertNull(
        new MinimalHttpClient(null)
            .executeForType(HttpMethod.GET, "/v1/empty", null, STATUS_RESULT_LIST_TYPE));
    assertNull(
        new MinimalHttpClient("")
            .executeForType(HttpMethod.GET, "/v1/empty", null, STATUS_RESULT_LIST_TYPE));
    assertNull(
        new MinimalHttpClient("   ")
            .executeForType(HttpMethod.GET, "/v1/empty", null, STATUS_RESULT_LIST_TYPE));

    JavaType voidType = TypeFactory.defaultInstance().constructType(Void.class);
    assertNull(
        new MinimalHttpClient("{\"ignored\":true}")
            .executeForType(HttpMethod.DELETE, "/v1/resource", null, voidType));
  }

  @Test
  void defaultExecuteForTypeThrowsOpenMetadataExceptionOnMalformedJson() {
    MinimalHttpClient client = new MinimalHttpClient("{not-valid-json");

    OpenMetadataException exception =
        assertThrows(
            OpenMetadataException.class,
            () ->
                client.executeForType(HttpMethod.GET, "/v1/broken", null, STATUS_RESULT_LIST_TYPE));
    assertTrue(exception.getMessage().contains("Failed to parse response"));
  }

  @Test
  void defaultExecuteForTypeRejectsNullResponseTypeBeforeCallingExecuteForString() {
    MinimalHttpClient client = new MinimalHttpClient("{}");

    assertThrows(
        NullPointerException.class,
        () -> client.executeForType(HttpMethod.POST, "/v1/mutate", null, (JavaType) null, null));
    assertThrows(
        NullPointerException.class,
        () ->
            client.executeForType(
                HttpMethod.POST, "/v1/mutate", null, (TypeReference<?>) null, null));
    assertEquals(0, client.callCount);
  }

  @Test
  void listResponseHandlesNullResultListNullDataAndNullPagingTotal() {
    ListResponse<PipelineStatus> fromNull = new ListResponse<>((ResultList<PipelineStatus>) null);
    assertNotNull(fromNull.getData());
    assertTrue(fromNull.getData().isEmpty());
    assertEquals(0, fromNull.getTotal());

    ResultList<PipelineStatus> nullDataResult = new ResultList<>();
    nullDataResult.setData(null);
    ListResponse<PipelineStatus> fromNullData = new ListResponse<>(nullDataResult);
    assertNotNull(fromNullData.getData());
    assertTrue(fromNullData.getData().isEmpty());
    assertEquals(0, fromNullData.getTotal());

    ListResponse<PipelineStatus> nullPagingTotal =
        new ListResponse<>(
            List.of(new PipelineStatus().withTimestamp(1L)),
            new AllModels.Paging().withAfter("cursor"));
    assertEquals(1, nullPagingTotal.getTotal());
  }

  /** Implements only the pre-existing abstract {@link HttpClient} methods. */
  private static final class MinimalHttpClient implements HttpClient {
    private final String responseBody;
    private int callCount;
    private HttpMethod lastMethod;
    private String lastPath;
    private RequestOptions lastOptions;

    private MinimalHttpClient(String responseBody) {
      this.responseBody = responseBody;
    }

    @Override
    public <T> T execute(HttpMethod method, String path, Object requestBody, Class<T> responseClass)
        throws OpenMetadataException {
      throw new UnsupportedOperationException();
    }

    @Override
    public <T> T execute(
        HttpMethod method,
        String path,
        Object requestBody,
        Class<T> responseClass,
        RequestOptions options)
        throws OpenMetadataException {
      throw new UnsupportedOperationException();
    }

    @Override
    public <T> CompletableFuture<T> executeAsync(
        HttpMethod method, String path, Object requestBody, Class<T> responseClass) {
      throw new UnsupportedOperationException();
    }

    @Override
    public <T> CompletableFuture<T> executeAsync(
        HttpMethod method,
        String path,
        Object requestBody,
        Class<T> responseClass,
        RequestOptions options) {
      throw new UnsupportedOperationException();
    }

    @Override
    public String executeForString(HttpMethod method, String path, Object requestBody)
        throws OpenMetadataException {
      return executeForString(method, path, requestBody, null);
    }

    @Override
    public String executeForString(
        HttpMethod method, String path, Object requestBody, RequestOptions options)
        throws OpenMetadataException {
      this.callCount++;
      this.lastMethod = method;
      this.lastPath = path;
      this.lastOptions = options;
      return responseBody;
    }

    @Override
    public CompletableFuture<String> executeForStringAsync(
        HttpMethod method, String path, Object requestBody) {
      throw new UnsupportedOperationException();
    }

    @Override
    public CompletableFuture<String> executeForStringAsync(
        HttpMethod method, String path, Object requestBody, RequestOptions options) {
      throw new UnsupportedOperationException();
    }
  }
}
