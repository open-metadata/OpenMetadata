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

package org.openmetadata.service.search.elasticsearch;

import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import es.co.elastic.clients.json.JsonpMapper;
import es.co.elastic.clients.transport.ElasticsearchTransport;
import es.co.elastic.clients.transport.Endpoint;
import es.co.elastic.clients.transport.Transport;
import es.co.elastic.clients.transport.TransportException;
import es.co.elastic.clients.transport.TransportOptions;
import java.io.IOException;
import java.util.concurrent.CompletableFuture;
import lombok.Getter;
import org.openmetadata.service.search.SearchRequestMetrics;

/**
 * Wraps the Elasticsearch transport so that every request the server sends to the cluster — search,
 * bulk, index management — is counted in {@link SearchRequestMetrics}. This is the single point all
 * Elasticsearch traffic funnels through.
 */
public class MeteredElasticsearchTransport implements ElasticsearchTransport {
  private static final String ENGINE = "elasticsearch";

  @Getter private final ElasticsearchTransport delegate;

  public MeteredElasticsearchTransport(ElasticsearchTransport delegate) {
    this.delegate = delegate;
  }

  /** Callers that need the concrete transport type (e.g. to reach the low-level client). */
  public static ElasticsearchTransport unwrap(ElasticsearchTransport transport) {
    return transport instanceof MeteredElasticsearchTransport metered
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
  public Transport withOptions(TransportOptions options) {
    Transport derived = delegate.withOptions(options);
    return derived instanceof ElasticsearchTransport elasticsearch
        ? new MeteredElasticsearchTransport(elasticsearch)
        : derived;
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
    if (cause instanceof ElasticsearchException clusterError) {
      status = clusterError.status();
    } else if (cause instanceof TransportException transportError) {
      status = transportError.statusCode();
    }
    return status;
  }
}
