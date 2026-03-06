package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.core.BulkRequest;
import os.org.opensearch.client.opensearch.core.BulkResponse;
import os.org.opensearch.client.opensearch.core.bulk.BulkResponseItem;

class VectorBulkProcessorTest {
  private OpenSearchClient mockClient;
  private VectorBulkProcessor processor;

  @BeforeEach
  void setUp() {
    mockClient = mock(OpenSearchClient.class);
    processor = new VectorBulkProcessor(mockClient, "test_vector_index", 3, 50 * 1024 * 1024);
  }

  @Test
  void testAddChunkDoesNotFlushUnderThreshold() throws IOException {
    processor.addChunk("chunk-1", Map.of("parent_id", "p1", "text", "hello"));

    verify(mockClient, never()).bulk(any(BulkRequest.class));
    assertEquals(0, processor.getTotalSuccess());
    assertEquals(0, processor.getTotalFailed());
  }

  @Test
  void testFlushSendsBufferedChunks() throws IOException {
    BulkResponse mockResponse = createMockBulkResponse(2, 0);
    when(mockClient.bulk(any(BulkRequest.class))).thenReturn(mockResponse);

    processor.addChunk("chunk-1", Map.of("parent_id", "p1", "text", "hello"));
    processor.addChunk("chunk-2", Map.of("parent_id", "p2", "text", "world"));

    processor.flush();

    verify(mockClient).bulk(any(BulkRequest.class));
    assertEquals(2, processor.getTotalSuccess());
    assertEquals(0, processor.getTotalFailed());
  }

  @Test
  void testAutoFlushWhenBufferFull() throws IOException {
    BulkResponse mockResponse = createMockBulkResponse(3, 0);
    when(mockClient.bulk(any(BulkRequest.class))).thenReturn(mockResponse);

    processor.addChunk("chunk-1", Map.of("parent_id", "p1", "text", "a"));
    processor.addChunk("chunk-2", Map.of("parent_id", "p2", "text", "b"));
    processor.addChunk("chunk-3", Map.of("parent_id", "p3", "text", "c"));

    // shouldFlush checks buffer.size() >= maxBulkActions BEFORE adding,
    // so 4th add triggers flush of the 3 buffered items
    verify(mockClient, never()).bulk(any(BulkRequest.class));

    processor.addChunk("chunk-4", Map.of("parent_id", "p4", "text", "d"));
    verify(mockClient).bulk(any(BulkRequest.class));
  }

  @Test
  void testFlushWithFailedItems() throws IOException {
    BulkResponse mockResponse = createMockBulkResponse(1, 1);
    when(mockClient.bulk(any(BulkRequest.class))).thenReturn(mockResponse);

    processor.addChunk("chunk-1", Map.of("parent_id", "p1", "text", "a"));
    processor.addChunk("chunk-2", Map.of("parent_id", "p2", "text", "b"));
    processor.flush();

    assertEquals(1, processor.getTotalSuccess());
    assertEquals(1, processor.getTotalFailed());
  }

  @Test
  void testFlushEmptyBufferNoOp() throws IOException {
    processor.flush();
    verify(mockClient, never()).bulk(any(BulkRequest.class));
  }

  @Test
  void testCloseFlushesRemainingChunks() throws IOException {
    BulkResponse mockResponse = createMockBulkResponse(1, 0);
    when(mockClient.bulk(any(BulkRequest.class))).thenReturn(mockResponse);

    processor.addChunk("chunk-1", Map.of("parent_id", "p1", "text", "a"));
    processor.close();

    verify(mockClient).bulk(any(BulkRequest.class));
    assertEquals(1, processor.getTotalSuccess());
  }

  @Test
  void testBulkExceptionCountsAsFailure() throws IOException {
    when(mockClient.bulk(any(BulkRequest.class))).thenThrow(new IOException("connection error"));

    processor.addChunk("chunk-1", Map.of("parent_id", "p1", "text", "a"));
    processor.flush();

    assertEquals(0, processor.getTotalSuccess());
    assertEquals(1, processor.getTotalFailed());
  }

  @SuppressWarnings("unchecked")
  private BulkResponse createMockBulkResponse(int successCount, int failedCount) {
    BulkResponse response = mock(BulkResponse.class);
    List<BulkResponseItem> items = new java.util.ArrayList<>();

    for (int i = 0; i < successCount; i++) {
      BulkResponseItem item = mock(BulkResponseItem.class);
      when(item.error()).thenReturn(null);
      items.add(item);
    }
    for (int i = 0; i < failedCount; i++) {
      BulkResponseItem item = mock(BulkResponseItem.class);
      os.org.opensearch.client.opensearch._types.ErrorCause error =
          mock(os.org.opensearch.client.opensearch._types.ErrorCause.class);
      when(item.error()).thenReturn(error);
      items.add(item);
    }

    when(response.items()).thenReturn(items);
    when(response.errors()).thenReturn(failedCount > 0);
    return response;
  }
}
