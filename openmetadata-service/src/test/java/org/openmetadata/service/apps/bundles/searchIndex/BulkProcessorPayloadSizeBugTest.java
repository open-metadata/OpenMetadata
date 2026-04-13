/*
 *  Copyright 2021 Collate.
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

package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.when;

import es.co.elastic.clients.elasticsearch.ElasticsearchAsyncClient;
import es.co.elastic.clients.elasticsearch.core.BulkResponse;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.OpenSearchAsyncClient;

/**
 * Reproduces the add-then-check bug in both bulk processor implementations.
 *
 * <p>Root cause: {@code buffer.add(op)} runs before the payload-size guard, so the doc that
 * triggers the threshold is always included in the flushed batch. With maxPayloadSizeBytes equal to
 * the cluster's hard limit (e.g. 10 MB on AWS OpenSearch), every boundary flush sends a request
 * that is one document over the limit → HTTP 413.
 */
@ExtendWith(MockitoExtension.class)
class BulkProcessorPayloadSizeBugTest {

  private static final long MAX_PAYLOAD_BYTES = 1000L;
  private static final long DOC_SIZE_BYTES = 110L;
  private static final int DOCS_BELOW_LIMIT = 9; // 9 × 110 = 990 < 1000

  @Mock private OpenSearchClient openSearchClient;
  @Mock private os.org.opensearch.client.opensearch.OpenSearchClient osRestClient;
  @Mock private ElasticSearchClient elasticSearchClient;
  @Mock private es.co.elastic.clients.elasticsearch.ElasticsearchClient esRestClient;

  @BeforeEach
  void setUp() {
    lenient().when(openSearchClient.getNewClient()).thenReturn(osRestClient);
    lenient().when(elasticSearchClient.getNewClient()).thenReturn(esRestClient);
  }

  // ---------------------------------------------------------------------------
  // OpenSearch
  // ---------------------------------------------------------------------------

  @Test
  @DisplayName("OpenSearch: flush triggered by overflow doc must not include that doc in the batch")
  @SuppressWarnings("unchecked")
  void openSearchBulkProcessorFlushesBatchExceedingPayloadLimit() throws Exception {
    AtomicLong totalSubmitted = new AtomicLong(0);

    os.org.opensearch.client.opensearch.core.BulkResponse mockResponse =
        mock(os.org.opensearch.client.opensearch.core.BulkResponse.class);
    when(mockResponse.errors()).thenReturn(false);

    try (var ignored =
        mockConstruction(
            OpenSearchAsyncClient.class,
            (mock, ctx) ->
                when(mock.bulk(any(Function.class)))
                    .thenReturn(CompletableFuture.completedFuture(mockResponse)))) {

      OpenSearchBulkSink.CustomBulkProcessor processor = buildOsProcessor(totalSubmitted);

      for (int i = 0; i < DOCS_BELOW_LIMIT; i++) {
        processor.add(osDeleteOp(i), "doc-" + i, "table", null, DOC_SIZE_BYTES);
      }

      assertEquals(0L, totalSubmitted.get(), "No flush should occur before the limit is reached");

      // 10th doc: estimated total = 1100 bytes > MAX_PAYLOAD_BYTES = 1000
      processor.add(osDeleteOp(99), "doc-overflow", "table", null, DOC_SIZE_BYTES);

      assertBatchSize(totalSubmitted);
    }
  }

  // ---------------------------------------------------------------------------
  // Elasticsearch
  // ---------------------------------------------------------------------------

  @Test
  @DisplayName(
      "Elasticsearch: flush triggered by overflow doc must not include that doc in the batch")
  @SuppressWarnings("unchecked")
  void elasticSearchBulkProcessorFlushesBatchExceedingPayloadLimit() throws Exception {
    AtomicLong totalSubmitted = new AtomicLong(0);

    BulkResponse mockResponse = mock(BulkResponse.class);
    when(mockResponse.errors()).thenReturn(false);

    try (var ignored =
        mockConstruction(
            ElasticsearchAsyncClient.class,
            (mock, ctx) ->
                when(mock.bulk(any(Function.class)))
                    .thenReturn(CompletableFuture.completedFuture(mockResponse)))) {

      ElasticSearchBulkSink.CustomBulkProcessor processor = buildEsProcessor(totalSubmitted);

      for (int i = 0; i < DOCS_BELOW_LIMIT; i++) {
        processor.add(esDeleteOp(i), "doc-" + i, "table", null, DOC_SIZE_BYTES);
      }

      assertEquals(0L, totalSubmitted.get(), "No flush should occur before the limit is reached");

      processor.add(esDeleteOp(99), "doc-overflow", "table", null, DOC_SIZE_BYTES);

      assertBatchSize(totalSubmitted);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private void assertBatchSize(AtomicLong totalSubmitted) {
    assertEquals(
        DOCS_BELOW_LIMIT,
        (int) totalSubmitted.get(),
        String.format(
            "Flushed batch must contain exactly %d docs (%d bytes ≤ maxPayloadSizeBytes=%d). "
                + "Actual: %d docs (%d bytes). "
                + "The overflow doc was added to the buffer BEFORE the size check ran, "
                + "so the flush included it — sending %d bytes to the cluster. "
                + "When maxPayloadSizeBytes equals the cluster hard limit this causes HTTP 413.",
            DOCS_BELOW_LIMIT,
            DOCS_BELOW_LIMIT * DOC_SIZE_BYTES,
            MAX_PAYLOAD_BYTES,
            totalSubmitted.get(),
            totalSubmitted.get() * DOC_SIZE_BYTES,
            totalSubmitted.get() * DOC_SIZE_BYTES));
  }

  private OpenSearchBulkSink.CustomBulkProcessor buildOsProcessor(AtomicLong totalSubmitted) {
    return new OpenSearchBulkSink.CustomBulkProcessor(
        openSearchClient,
        10_000, // high count limit so only the size check fires
        MAX_PAYLOAD_BYTES,
        5,
        Long.MAX_VALUE / 2, // no periodic flush during the test
        100,
        0,
        totalSubmitted,
        new AtomicLong(0),
        new AtomicLong(0),
        () -> {},
        new BulkCircuitBreaker(5, 30_000, 10_000));
  }

  private ElasticSearchBulkSink.CustomBulkProcessor buildEsProcessor(AtomicLong totalSubmitted) {
    return new ElasticSearchBulkSink.CustomBulkProcessor(
        elasticSearchClient,
        10_000,
        MAX_PAYLOAD_BYTES,
        5,
        Long.MAX_VALUE / 2,
        100,
        0,
        totalSubmitted,
        new AtomicLong(0),
        new AtomicLong(0),
        () -> {},
        new BulkCircuitBreaker(5, 30_000, 10_000));
  }

  private static os.org.opensearch.client.opensearch.core.bulk.BulkOperation osDeleteOp(int id) {
    return os.org.opensearch.client.opensearch.core.bulk.BulkOperation.of(
        b -> b.delete(d -> d.index("test-index").id("id-" + id)));
  }

  private static es.co.elastic.clients.elasticsearch.core.bulk.BulkOperation esDeleteOp(int id) {
    return es.co.elastic.clients.elasticsearch.core.bulk.BulkOperation.of(
        b -> b.delete(d -> d.index("test-index").id("id-" + id)));
  }
}
