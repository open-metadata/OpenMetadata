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

import java.io.IOException;
import java.util.concurrent.CompletableFuture;
import lombok.Getter;
import org.openmetadata.service.search.SearchRequestMetrics;
import os.org.opensearch.client.json.JsonpMapper;
import os.org.opensearch.client.opensearch._types.OpenSearchException;
import os.org.opensearch.client.transport.Endpoint;
import os.org.opensearch.client.transport.OpenSearchTransport;
import os.org.opensearch.client.transport.TransportOptions;
import os.org.opensearch.client.transport.httpclient5.ResponseException;

/**
 * Wraps the OpenSearch transport so that every request the server sends to the cluster — search,
 * bulk, index management, generic — is counted in {@link SearchRequestMetrics}. This is the single
 * point all OpenSearch traffic funnels through.
 */
public class MeteredOpenSearchTransport implements OpenSearchTransport {
  private static final String ENGINE = "opensearch";

  @Getter private final OpenSearchTransport delegate;

  private MeteredOpenSearchTransport(OpenSearchTransport delegate) {
    this.delegate = delegate;
  }

  /** Returns {@code null} unchanged so callers keep their "transport failed to build" check. */
  public static OpenSearchTransport wrap(OpenSearchTransport delegate) {
    return delegate == null ? null : new MeteredOpenSearchTransport(delegate);
  }

  /** Callers that need the concrete transport type (e.g. to tell AWS SigV4 from plain HTTP). */
  public static OpenSearchTransport unwrap(OpenSearchTransport transport) {
    return transport instanceof MeteredOpenSearchTransport metered
        ? metered.getDelegate()
        : transport;
  }

  @Override
  public <RequestT, ResponseT, ErrorT> ResponseT performRequest(
      RequestT request, Endpoint<RequestT, ResponseT, ErrorT> endpoint, TransportOptions options)
      throws IOException {
    ResponseT response;
    try {
      response = delegate.performRequest(request, endpoint, options);
    } catch (IOException | RuntimeException e) {
      recordFailure(request, endpoint, e);
      throw e;
    }
    SearchRequestMetrics.recordSuccess(ENGINE, endpoint.method(request));
    return response;
  }

  @Override
  public <RequestT, ResponseT, ErrorT> CompletableFuture<ResponseT> performRequestAsync(
      RequestT request, Endpoint<RequestT, ResponseT, ErrorT> endpoint, TransportOptions options) {
    return delegate
        .performRequestAsync(request, endpoint, options)
        .whenComplete(
            (response, error) -> {
              if (error == null) {
                SearchRequestMetrics.recordSuccess(ENGINE, endpoint.method(request));
              } else {
                recordFailure(request, endpoint, error);
              }
            });
  }

  @Override
  public JsonpMapper jsonpMapper() {
    return delegate.jsonpMapper();
  }

  @Override
  public TransportOptions options() {
    return delegate.options();
  }

  @Override
  public void close() throws IOException {
    delegate.close();
  }

  private <RequestT> void recordFailure(
      RequestT request, Endpoint<RequestT, ?, ?> endpoint, Throwable error) {
    SearchRequestMetrics.recordFailure(ENGINE, endpoint.method(request), statusOf(error), error);
  }

  private static int statusOf(Throwable error) {
    Throwable cause = SearchRequestMetrics.unwrap(error);
    int status = 0;
    if (cause instanceof OpenSearchException clusterError) {
      status = clusterError.status();
    } else if (cause instanceof ResponseException responseError) {
      status = responseError.status();
    }
    return status;
  }
}
