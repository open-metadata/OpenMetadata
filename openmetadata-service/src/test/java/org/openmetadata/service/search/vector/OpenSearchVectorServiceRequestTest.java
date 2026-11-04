package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.generic.Body;
import os.org.opensearch.client.opensearch.generic.OpenSearchGenericClient;
import os.org.opensearch.client.opensearch.generic.Request;
import os.org.opensearch.client.opensearch.generic.Response;

class OpenSearchVectorServiceRequestTest {
  private static final String ENDPOINT = "/test_case_search_index/_update/test?retry_on_conflict=3";
  private static final String UPDATE_BODY = "{\"doc\":{\"embedding\":[0.1,0.2]}}";
  private static final String CLOSED_SEGMENT =
      "{\"error\":{\"type\":\"already_closed_exception\"}}";

  private OpenSearchGenericClient genericClient;
  private OpenSearchVectorService service;

  @BeforeEach
  void setUp() {
    OpenSearchClient client = mock(OpenSearchClient.class);
    genericClient = mock(OpenSearchGenericClient.class);
    when(client.generic()).thenReturn(genericClient);
    service = new OpenSearchVectorService(client, null);
  }

  @Test
  void retriesClosedSegmentsAndReplaysTheRequestBody() throws IOException {
    Response first = response(500, CLOSED_SEGMENT);
    Response second = response(503, CLOSED_SEGMENT);
    Response success = response(200, "{\"result\":\"updated\"}");
    AtomicInteger attempts = new AtomicInteger();
    when(genericClient.execute(any()))
        .thenAnswer(
            invocation -> {
              Request request = invocation.getArgument(0, Request.class);
              assertEquals("POST", request.getMethod());
              assertEquals(ENDPOINT, request.getEndpoint());
              assertEquals(UPDATE_BODY, request.getBody().orElseThrow().bodyAsString());
              return switch (attempts.getAndIncrement()) {
                case 0 -> first;
                case 1 -> second;
                default -> success;
              };
            });

    assertEquals(
        "{\"result\":\"updated\"}", service.executeGenericRequest("POST", ENDPOINT, UPDATE_BODY));
    assertEquals(3, attempts.get());
    verify(first).close();
    verify(second).close();
    verify(success).close();
  }

  @Test
  void stopsAfterThreeTransientFailures() throws IOException {
    Response failure = response(500, CLOSED_SEGMENT);
    when(genericClient.execute(any())).thenReturn(failure);

    RuntimeException error =
        assertThrows(
            RuntimeException.class,
            () -> service.executeGenericRequest("POST", ENDPOINT, UPDATE_BODY));

    assertInstanceOf(IOException.class, error.getCause());
    assertTrue(error.getCause().getMessage().contains(CLOSED_SEGMENT));
    verify(genericClient, times(3)).execute(any());
    verify(failure, times(3)).close();
  }

  @ParameterizedTest
  @CsvSource({
    "400,already_closed_exception",
    "429,already_closed_exception",
    "500,unrelated_error",
    "503,unrelated_error"
  })
  void unrelatedErrorsFailImmediately(int status, String errorBody) throws IOException {
    Response failure = response(status, errorBody);
    when(genericClient.execute(any())).thenReturn(failure);

    RuntimeException error =
        assertThrows(
            RuntimeException.class,
            () -> service.executeGenericRequest("POST", ENDPOINT, UPDATE_BODY));

    assertEquals(
        "OpenSearch request failed with status " + status + ": " + errorBody,
        error.getCause().getMessage());
    verify(genericClient).execute(any());
    verify(failure).close();
  }

  @Test
  void transportErrorsFailImmediately() throws IOException {
    IOException failure = new IOException("Connection refused");
    when(genericClient.execute(any())).thenThrow(failure);

    RuntimeException error =
        assertThrows(
            RuntimeException.class,
            () -> service.executeGenericRequest("POST", ENDPOINT, UPDATE_BODY));

    assertSame(failure, error.getCause());
    verify(genericClient).execute(any());
  }

  @Test
  void releasesResponseBeforeBackoffAndPreservesInterruption() throws IOException {
    Response failure = response(500, CLOSED_SEGMENT);
    when(genericClient.execute(any())).thenReturn(failure);
    doAnswer(
            invocation -> {
              Thread.currentThread().interrupt();
              return null;
            })
        .when(failure)
        .close();

    try {
      assertThrows(
          RuntimeException.class,
          () -> service.executeGenericRequest("POST", ENDPOINT, UPDATE_BODY));
      assertTrue(Thread.currentThread().isInterrupted());
      verify(genericClient).execute(any());
      verify(failure).close();
    } finally {
      Thread.interrupted();
    }
  }

  @Test
  void successfulEmptyResponseDefaultsToEmptyJson() throws IOException {
    Response success = mock(Response.class);
    when(success.getStatus()).thenReturn(204);
    when(success.getBody()).thenReturn(Optional.empty());
    when(genericClient.execute(any())).thenReturn(success);

    assertEquals("{}", service.executeGenericRequest("DELETE", ENDPOINT, null));
    verify(genericClient).execute(any());
    verify(success).close();
  }

  @Test
  void unreadableSuccessBodyDefaultsToEmptyJson() throws IOException {
    Response success = response(200, "{}");
    when(success.getBody().orElseThrow().bodyAsBytes())
        .thenThrow(new IllegalStateException("Response body unavailable"));
    when(genericClient.execute(any())).thenReturn(success);

    assertEquals("{}", service.executeGenericRequest("GET", ENDPOINT, null));
    verify(genericClient).execute(any());
    verify(success).close();
  }

  @Test
  void serverErrorWithoutBodyFailsImmediately() throws IOException {
    Response failure = mock(Response.class);
    when(failure.getStatus()).thenReturn(500);
    when(failure.getBody()).thenReturn(Optional.empty());
    when(genericClient.execute(any())).thenReturn(failure);

    RuntimeException error =
        assertThrows(
            RuntimeException.class,
            () -> service.executeGenericRequest("POST", ENDPOINT, UPDATE_BODY));

    assertEquals(
        "OpenSearch request failed with status 500: no body", error.getCause().getMessage());
    verify(genericClient).execute(any());
    verify(failure).close();
  }

  private static Response response(int status, String json) throws IOException {
    Response response = mock(Response.class);
    Body body = mock(Body.class);
    when(response.getStatus()).thenReturn(status);
    when(response.getBody()).thenReturn(Optional.of(body));
    when(body.bodyAsString()).thenReturn(json);
    when(body.bodyAsBytes()).thenReturn(json.getBytes(StandardCharsets.UTF_8));
    return response;
  }
}
