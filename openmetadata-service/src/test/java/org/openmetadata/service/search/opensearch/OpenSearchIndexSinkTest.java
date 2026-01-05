package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import os.org.opensearch.client.opensearch.core.BulkResponse;
import os.org.opensearch.client.opensearch.core.bulk.BulkOperation;
import os.org.opensearch.client.opensearch.core.bulk.IndexOperation;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OpenSearchIndexSinkTest {

  @Mock private SearchRepository searchRepository;
  @Mock private SearchClient searchClient;
  @Mock private BulkResponse bulkResponse;

  private OpenSearchIndexSink sink;
  private static final int TOTAL = 100;
  private static final long MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB

  @BeforeEach
  void setUp() {
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    sink = new OpenSearchIndexSink(searchRepository, TOTAL, MAX_PAYLOAD_SIZE);
  }

  @Test
  void testSinkCreation() {
    assertNotNull(sink);
    StepStats stats = sink.getStats();
    assertNotNull(stats);
    assertEquals(TOTAL, stats.getTotalRecords());
    assertEquals(0, stats.getSuccessRecords());
    assertEquals(0, stats.getFailedRecords());
  }

  @Test
  void testWriteSuccess() throws Exception {
    // Given
    List<BulkOperation> operations = createMockBulkOperations(5);
    Map<String, Object> contextData = new HashMap<>();
    contextData.put(
        "entityNameList", List.of("entity1", "entity2", "entity3", "entity4", "entity5"));

    when(searchClient.bulkOpenSearch(any())).thenReturn(bulkResponse);
    when(bulkResponse.errors()).thenReturn(false);

    // When
    BulkResponse result = sink.write(operations, contextData);

    // Then
    assertNotNull(result);
    verify(searchClient, times(1)).bulkOpenSearch(any());
    assertEquals(5, sink.getStats().getSuccessRecords());
    assertEquals(0, sink.getStats().getFailedRecords());
  }

  @Test
  void testWriteWithErrors() throws Exception {
    // Given
    List<BulkOperation> operations = createMockBulkOperations(5);
    Map<String, Object> contextData = new HashMap<>();
    contextData.put(
        "entityNameList", List.of("entity1", "entity2", "entity3", "entity4", "entity5"));

    when(searchClient.bulkOpenSearch(any()))
        .thenThrow(new RuntimeException("Bulk operation failed"));

    // When & Then
    assertThrows(SearchIndexException.class, () -> sink.write(operations, contextData));
    assertEquals(0, sink.getStats().getSuccessRecords());
    assertEquals(5, sink.getStats().getFailedRecords());
  }

  @Test
  void testUpdateStats() {
    // Given
    assertEquals(0, sink.getStats().getSuccessRecords());
    assertEquals(0, sink.getStats().getFailedRecords());

    // When
    sink.updateStats(12, 3);

    // Then
    assertEquals(12, sink.getStats().getSuccessRecords());
    assertEquals(3, sink.getStats().getFailedRecords());
  }

  @Test
  void testWriteWithEmptyData() throws Exception {
    // Given
    List<BulkOperation> operations = new ArrayList<>();
    Map<String, Object> contextData = new HashMap<>();

    // When & Then - should not throw exception for empty list
    assertDoesNotThrow(() -> sink.write(operations, contextData));
    assertEquals(0, sink.getStats().getSuccessRecords());
    assertEquals(0, sink.getStats().getFailedRecords());
  }

  private List<BulkOperation> createMockBulkOperations(int count) {
    List<BulkOperation> operations = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      int finalI = i;
      operations.add(
          BulkOperation.of(
              b ->
                  b.index(
                      IndexOperation.of(
                          io ->
                              io.index("test_index")
                                  .id("id_" + finalI)
                                  .document(Map.of("field", "value" + finalI))))));
    }
    return operations;
  }
}
