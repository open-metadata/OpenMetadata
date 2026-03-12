package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import es.co.elastic.clients.elasticsearch._types.ErrorCause;
import es.co.elastic.clients.elasticsearch._types.ErrorResponse;
import es.co.elastic.clients.elasticsearch.core.BulkResponse;
import es.co.elastic.clients.elasticsearch.core.bulk.BulkOperation;
import es.co.elastic.clients.elasticsearch.core.bulk.IndexOperation;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.workflows.interfaces.TaggedOperation;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ElasticSearchIndexSinkTest {

  @Mock private SearchRepository searchRepository;
  @Mock private SearchClient searchClient;
  @Mock private BulkResponse bulkResponse;

  private ElasticSearchIndexSink sink;
  private static final int TOTAL = 100;
  private static final long MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB

  @BeforeEach
  void setUp() {
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    sink = new ElasticSearchIndexSink(searchRepository, TOTAL, MAX_PAYLOAD_SIZE);
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
    List<TaggedOperation<BulkOperation>> data = createTaggedOperations(5);

    when(searchClient.bulkElasticSearch(any())).thenReturn(bulkResponse);
    when(bulkResponse.errors()).thenReturn(false);

    BulkResponse result = sink.write(data);

    assertNotNull(result);
    verify(searchClient, times(1)).bulkElasticSearch(any());
    assertEquals(5, sink.getStats().getSuccessRecords());
    assertEquals(0, sink.getStats().getFailedRecords());
  }

  @Test
  void testWriteWithErrors() throws Exception {
    List<TaggedOperation<BulkOperation>> data = createTaggedOperations(5);

    when(searchClient.bulkElasticSearch(any()))
        .thenThrow(new RuntimeException("Bulk operation failed"));

    assertThrows(SearchIndexException.class, () -> sink.write(data));
    assertEquals(0, sink.getStats().getSuccessRecords());
    assertEquals(5, sink.getStats().getFailedRecords());
  }

  @Test
  void testUpdateStats() {
    assertEquals(0, sink.getStats().getSuccessRecords());
    assertEquals(0, sink.getStats().getFailedRecords());

    sink.updateStats(10, 2);

    assertEquals(10, sink.getStats().getSuccessRecords());
    assertEquals(2, sink.getStats().getFailedRecords());
  }

  @Test
  void testWriteWithEmptyData() throws Exception {
    List<TaggedOperation<BulkOperation>> data = new ArrayList<>();

    assertDoesNotThrow(() -> sink.write(data));
    assertEquals(0, sink.getStats().getSuccessRecords());
    assertEquals(0, sink.getStats().getFailedRecords());
  }

  @Test
  void testSingleDocumentExceedsPayloadLimit413() throws Exception {
    List<TaggedOperation<BulkOperation>> data = createTaggedOperations(1);

    ElasticsearchException e413 =
        new ElasticsearchException(
            "Request Entity Too Large",
            new ErrorResponse.Builder()
                .status(413)
                .error(
                    new ErrorCause.Builder()
                        .reason("Request Entity Too Large")
                        .type("request_entity_too_large")
                        .build())
                .build());

    when(searchClient.bulkElasticSearch(any())).thenThrow(e413);

    SearchIndexException ex = assertThrows(SearchIndexException.class, () -> sink.write(data));

    assertEquals(1, ex.getIndexingError().getFailedCount());
    assertEquals(0, ex.getIndexingError().getSuccessCount());
  }

  @Test
  void testBisectionOnPayloadTooLargeWithMixedResults() throws Exception {
    List<TaggedOperation<BulkOperation>> data = createTaggedOperations(4);

    ElasticsearchException e413 =
        new ElasticsearchException(
            "Request Entity Too Large",
            new ErrorResponse.Builder()
                .status(413)
                .error(
                    new ErrorCause.Builder()
                        .reason("Request Entity Too Large")
                        .type("request_entity_too_large")
                        .build())
                .build());

    BulkResponse successResponse = BulkResponse.of(b -> b.errors(false).items(List.of()).took(1));

    // Call 1: full batch (4 ops) → 413, bisects into [0,1] and [2,3]
    // Call 2: [0,1] → success
    // Call 3: [2,3] → 413, bisects into [2] and [3]
    // Call 4: [2] → success
    // Call 5: [3] → 413 on single doc, recorded as error
    when(searchClient.bulkElasticSearch(argThat(ops -> ops != null && ops.size() == 4)))
        .thenThrow(e413);
    when(searchClient.bulkElasticSearch(argThat(ops -> ops != null && ops.size() == 2)))
        .thenReturn(successResponse)
        .thenThrow(e413);
    when(searchClient.bulkElasticSearch(argThat(ops -> ops != null && ops.size() == 1)))
        .thenReturn(successResponse)
        .thenThrow(e413);

    SearchIndexException ex = assertThrows(SearchIndexException.class, () -> sink.write(data));

    assertEquals(1, ex.getIndexingError().getFailedCount());
    assertEquals(3, ex.getIndexingError().getSuccessCount());
    verify(searchClient, times(5)).bulkElasticSearch(any());
  }

  private List<TaggedOperation<BulkOperation>> createTaggedOperations(int count) {
    List<TaggedOperation<BulkOperation>> tagged = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      int finalI = i;
      BulkOperation op =
          BulkOperation.of(
              b ->
                  b.index(
                      IndexOperation.of(
                          io ->
                              io.index("test_index")
                                  .id("id_" + finalI)
                                  .document(Map.of("field", "value" + finalI)))));
      tagged.add(
          new TaggedOperation<>(
              op, new EntityReference().withId(UUID.randomUUID()).withType("table")));
    }
    return tagged;
  }
}
