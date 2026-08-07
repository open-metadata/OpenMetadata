/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.io.IOException;
import java.net.SocketTimeoutException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import os.org.opensearch.client.json.JsonpDeserializer;
import os.org.opensearch.client.json.JsonpMapper;
import os.org.opensearch.client.opensearch._types.ErrorCause;
import os.org.opensearch.client.opensearch._types.ErrorResponse;
import os.org.opensearch.client.opensearch._types.OpenSearchException;
import os.org.opensearch.client.transport.Endpoint;
import os.org.opensearch.client.transport.OpenSearchTransport;
import os.org.opensearch.client.transport.TransportOptions;

class MeteredOpenSearchTransportTest {
  private static final String METRIC = "search.client.requests";
  private static final Endpoint<String, String, ErrorResponse> SEARCH_ENDPOINT =
      new SearchEndpoint();

  private SimpleMeterRegistry registry;

  @BeforeEach
  void addRegistry() {
    registry = new SimpleMeterRegistry();
    Metrics.addRegistry(registry);
  }

  @AfterEach
  void removeRegistry() {
    Metrics.removeRegistry(registry);
    registry.close();
  }

  @Test
  void successfulRequestIsCountedAsSuccess() throws IOException {
    OpenSearchTransport transport = MeteredOpenSearchTransport.wrap(new StubTransport(null));

    assertEquals("ok", transport.performRequest("q", SEARCH_ENDPOINT, null));
    assertEquals(1.0, count("success", "none"));
  }

  @Test
  void clusterErrorIsCountedWithItsHttpStatus() {
    OpenSearchTransport transport =
        MeteredOpenSearchTransport.wrap(new StubTransport(unavailable()));

    assertThrows(
        OpenSearchException.class, () -> transport.performRequest("q", SEARCH_ENDPOINT, null));
    assertEquals(1.0, count("failure", "503"));
  }

  @Test
  void connectivityFailureIsCountedByExceptionType() {
    OpenSearchTransport transport =
        MeteredOpenSearchTransport.wrap(new StubTransport(new SocketTimeoutException("read")));

    assertThrows(
        SocketTimeoutException.class, () -> transport.performRequest("q", SEARCH_ENDPOINT, null));
    assertEquals(1.0, count("failure", "SocketTimeoutException"));
  }

  @Test
  void asyncRequestsAreCountedOnceTheFutureCompletes() {
    OpenSearchTransport failing = MeteredOpenSearchTransport.wrap(new StubTransport(unavailable()));
    OpenSearchTransport succeeding = MeteredOpenSearchTransport.wrap(new StubTransport(null));

    CompletableFuture<String> future = failing.performRequestAsync("q", SEARCH_ENDPOINT, null);

    assertThrows(CompletionException.class, future::join);
    assertEquals("ok", succeeding.performRequestAsync("q", SEARCH_ENDPOINT, null).join());
    assertEquals(1.0, count("failure", "503"));
    assertEquals(1.0, count("success", "none"));
  }

  @Test
  void passThroughMethodsReachTheDelegate() throws IOException {
    StubTransport delegate = new StubTransport(null);
    OpenSearchTransport transport = MeteredOpenSearchTransport.wrap(delegate);

    assertNull(transport.jsonpMapper());
    assertNull(transport.options());
    transport.close();
    assertTrue(delegate.closed());
  }

  @Test
  void wrapKeepsNullTransportDetectable() {
    assertNull(MeteredOpenSearchTransport.wrap(null));
  }

  @Test
  void unwrapReturnsTheUnderlyingTransport() {
    StubTransport delegate = new StubTransport(null);

    assertSame(
        delegate, MeteredOpenSearchTransport.unwrap(MeteredOpenSearchTransport.wrap(delegate)));
    assertSame(delegate, MeteredOpenSearchTransport.unwrap(delegate));
  }

  private double count(String outcome, String status) {
    return registry
        .get(METRIC)
        .tags("engine", "opensearch", "method", "POST", "outcome", outcome, "status", status)
        .counter()
        .count();
  }

  private static OpenSearchException unavailable() {
    return new OpenSearchException(
        ErrorResponse.of(
            builder ->
                builder
                    .status(503)
                    .error(
                        ErrorCause.of(
                            cause ->
                                cause
                                    .type("search_phase_execution_exception")
                                    .reason("all shards failed")))));
  }

  /** Fails every request with the given failure, or returns "ok" when it is null. */
  private static final class StubTransport implements OpenSearchTransport {
    private final RuntimeException runtimeFailure;
    private final IOException ioFailure;
    private boolean closed;

    private StubTransport(Throwable failure) {
      this.runtimeFailure = failure instanceof RuntimeException runtime ? runtime : null;
      this.ioFailure = failure instanceof IOException io ? io : null;
    }

    private boolean closed() {
      return closed;
    }

    @Override
    public <RequestT, ResponseT, ErrorT> ResponseT performRequest(
        RequestT request, Endpoint<RequestT, ResponseT, ErrorT> endpoint, TransportOptions options)
        throws IOException {
      if (ioFailure != null) {
        throw ioFailure;
      }
      if (runtimeFailure != null) {
        throw runtimeFailure;
      }
      @SuppressWarnings("unchecked")
      ResponseT response = (ResponseT) "ok";
      return response;
    }

    @Override
    public <RequestT, ResponseT, ErrorT> CompletableFuture<ResponseT> performRequestAsync(
        RequestT request,
        Endpoint<RequestT, ResponseT, ErrorT> endpoint,
        TransportOptions options) {
      CompletableFuture<ResponseT> future = new CompletableFuture<>();
      try {
        future.complete(performRequest(request, endpoint, options));
      } catch (IOException | RuntimeException e) {
        future.completeExceptionally(e);
      }
      return future;
    }

    @Override
    public JsonpMapper jsonpMapper() {
      return null;
    }

    @Override
    public TransportOptions options() {
      return null;
    }

    @Override
    public void close() {
      closed = true;
    }
  }

  /** Minimal endpoint standing in for {@code POST /<index>/_search}. */
  private record SearchEndpoint() implements Endpoint<String, String, ErrorResponse> {
    @Override
    public String method(String request) {
      return "POST";
    }

    @Override
    public String requestUrl(String request) {
      return "/table_search_index/_search";
    }

    @Override
    public boolean hasRequestBody() {
      return true;
    }

    @Override
    public boolean isError(int statusCode) {
      return statusCode >= 400;
    }

    @Override
    public JsonpDeserializer<ErrorResponse> errorDeserializer(int statusCode) {
      return ErrorResponse._DESERIALIZER;
    }
  }
}
