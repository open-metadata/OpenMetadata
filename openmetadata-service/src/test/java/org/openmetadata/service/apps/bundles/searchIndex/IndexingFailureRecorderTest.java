package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexFailureDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexFailureDAO.SearchIndexFailureRecord;

@ExtendWith(MockitoExtension.class)
class IndexingFailureRecorderTest {

  @Mock private CollectionDAO collectionDAO;
  @Mock private SearchIndexFailureDAO failureDAO;

  private static final String JOB_ID = "job-123";
  private static final String RUN_ID = "run-456";

  @BeforeEach
  void setUp() {
    when(collectionDAO.searchIndexFailureDAO()).thenReturn(failureDAO);
  }

  @Nested
  @DisplayName("Recording Failures Tests")
  class RecordingFailuresTests {

    @Test
    @DisplayName("Should buffer reader failures")
    void testRecordReaderFailure() {
      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 10)) {

        recorder.recordReaderFailure("table", "Error reading entity");

        assertEquals(1, recorder.getBufferedCount());
        verify(failureDAO, never()).insertBatch(anyList());
      }
    }

    @Test
    @DisplayName("Should buffer sink failures")
    void testRecordSinkFailure() {
      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 10)) {

        recorder.recordSinkFailure("table", "entity-id-1", "fqn.path", "Indexing failed");

        assertEquals(1, recorder.getBufferedCount());
        verify(failureDAO, never()).insertBatch(anyList());
      }
    }

    @Test
    @DisplayName("Should auto-flush when batch is full")
    void testAutoFlushOnBatchFull() {
      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 3)) {

        recorder.recordReaderFailure("table", "Error 1");
        recorder.recordReaderFailure("table", "Error 2");

        assertEquals(2, recorder.getBufferedCount());
        verify(failureDAO, never()).insertBatch(anyList());

        recorder.recordReaderFailure("table", "Error 3");

        assertEquals(0, recorder.getBufferedCount());
        verify(failureDAO, times(1)).insertBatch(anyList());
      }
    }

    @Test
    @DisplayName("Should record with stack trace")
    @SuppressWarnings("unchecked")
    void testRecordWithStackTrace() {
      ArgumentCaptor<List<SearchIndexFailureRecord>> captor = ArgumentCaptor.forClass(List.class);

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 1)) {

        recorder.recordReaderFailure("table", "Error message", "Stack trace here");

        verify(failureDAO).insertBatch(captor.capture());
        List<SearchIndexFailureRecord> records = captor.getValue();

        assertEquals(1, records.size());
        assertEquals("Stack trace here", records.get(0).stackTrace());
      }
    }

    @Test
    @DisplayName("Should record multiple failures before flush")
    void testRecordMultipleFailures() {
      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 10)) {

        recorder.recordReaderFailure("table", "Error 1");
        recorder.recordSinkFailure("dashboard", "id-1", "fqn.1", "Error 2");
        recorder.recordReaderFailure("pipeline", "Error 3", "stack");

        assertEquals(3, recorder.getBufferedCount());
        verify(failureDAO, never()).insertBatch(anyList());
      }
    }
  }

  @Nested
  @DisplayName("Flush Tests")
  class FlushTests {

    @Test
    @DisplayName("Should flush remaining failures on explicit flush")
    void testExplicitFlush() {
      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 100)) {

        recorder.recordReaderFailure("table", "Error 1");
        recorder.recordReaderFailure("table", "Error 2");

        assertEquals(2, recorder.getBufferedCount());

        recorder.flush();

        assertEquals(0, recorder.getBufferedCount());
        verify(failureDAO, times(1)).insertBatch(anyList());
      }
    }

    @Test
    @DisplayName("Should flush on close")
    void testFlushOnClose() {
      IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 100);

      recorder.recordReaderFailure("table", "Error 1");
      recorder.recordReaderFailure("table", "Error 2");

      recorder.close();

      verify(failureDAO, times(1)).insertBatch(anyList());
    }

    @Test
    @DisplayName("Should handle empty buffer flush")
    void testEmptyBufferFlush() {
      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 100)) {

        recorder.flush();

        verify(failureDAO, never()).insertBatch(anyList());
      }
    }

    @Test
    @DisplayName("Should handle flush errors gracefully")
    void testFlushErrorHandling() {
      doThrow(new RuntimeException("DB error")).when(failureDAO).insertBatch(anyList());

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 1)) {

        recorder.recordReaderFailure("table", "Error 1");

        assertEquals(0, recorder.getBufferedCount());
      }
    }

    @Test
    @DisplayName("Should not flush again on double close")
    void testDoubleClose() {
      IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 100);

      recorder.recordReaderFailure("table", "Error 1");

      recorder.close();
      recorder.close();

      verify(failureDAO, times(1)).insertBatch(anyList());
    }

    @Test
    @DisplayName("Should not record failures after close")
    void testRecordAfterClose() {
      IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 100);

      recorder.close();
      recorder.recordReaderFailure("table", "Error 1");

      assertEquals(0, recorder.getBufferedCount());
    }
  }

  @Nested
  @DisplayName("Thread Safety Tests")
  class ThreadSafetyTests {

    @Test
    @DisplayName("Should handle concurrent writes safely")
    void testConcurrentWrites() throws InterruptedException {
      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 1000)) {

        Thread[] threads = new Thread[10];
        for (int i = 0; i < threads.length; i++) {
          final int threadNum = i;
          threads[i] =
              new Thread(
                  () -> {
                    for (int j = 0; j < 10; j++) {
                      recorder.recordReaderFailure("table", "Error " + threadNum + "-" + j);
                    }
                  });
        }

        for (Thread thread : threads) {
          thread.start();
        }

        for (Thread thread : threads) {
          thread.join();
        }

        assertEquals(100, recorder.getBufferedCount());
      }
    }

    @Test
    @DisplayName("Should handle concurrent writes with flush threshold")
    void testConcurrentWritesWithFlush() throws InterruptedException {
      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 50)) {

        Thread[] threads = new Thread[10];
        for (int i = 0; i < threads.length; i++) {
          final int threadNum = i;
          threads[i] =
              new Thread(
                  () -> {
                    for (int j = 0; j < 10; j++) {
                      recorder.recordReaderFailure("table", "Error " + threadNum + "-" + j);
                    }
                  });
        }

        for (Thread thread : threads) {
          thread.start();
        }

        for (Thread thread : threads) {
          thread.join();
        }

        verify(failureDAO, times(2)).insertBatch(anyList());
      }
    }
  }

  @Nested
  @DisplayName("Error Message Truncation Tests")
  class TruncationTests {

    @Test
    @DisplayName("Should truncate long error messages")
    @SuppressWarnings("unchecked")
    void testLongErrorMessageTruncation() {
      ArgumentCaptor<List<SearchIndexFailureRecord>> captor = ArgumentCaptor.forClass(List.class);

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 1)) {

        String longMessage = "A".repeat(70000);
        recorder.recordReaderFailure("table", longMessage);

        verify(failureDAO).insertBatch(captor.capture());
        List<SearchIndexFailureRecord> records = captor.getValue();

        assertEquals(65000, records.get(0).errorMessage().length());
        assertTrue(records.get(0).errorMessage().endsWith("..."));
      }
    }

    @Test
    @DisplayName("Should not truncate short messages")
    @SuppressWarnings("unchecked")
    void testShortMessageNotTruncated() {
      ArgumentCaptor<List<SearchIndexFailureRecord>> captor = ArgumentCaptor.forClass(List.class);

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 1)) {

        String shortMessage = "Short error";
        recorder.recordReaderFailure("table", shortMessage);

        verify(failureDAO).insertBatch(captor.capture());
        List<SearchIndexFailureRecord> records = captor.getValue();

        assertEquals(shortMessage, records.get(0).errorMessage());
      }
    }

    @Test
    @DisplayName("Should truncate long stack traces")
    @SuppressWarnings("unchecked")
    void testLongStackTraceTruncation() {
      ArgumentCaptor<List<SearchIndexFailureRecord>> captor = ArgumentCaptor.forClass(List.class);

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 1)) {

        String longStackTrace = "B".repeat(70000);
        recorder.recordReaderFailure("table", "Error", longStackTrace);

        verify(failureDAO).insertBatch(captor.capture());
        List<SearchIndexFailureRecord> records = captor.getValue();

        assertEquals(65000, records.get(0).stackTrace().length());
        assertTrue(records.get(0).stackTrace().endsWith("..."));
      }
    }

    @Test
    @DisplayName("Should handle null error message")
    @SuppressWarnings("unchecked")
    void testNullErrorMessage() {
      ArgumentCaptor<List<SearchIndexFailureRecord>> captor = ArgumentCaptor.forClass(List.class);

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 1)) {

        recorder.recordReaderFailure("table", null);

        verify(failureDAO).insertBatch(captor.capture());
        List<SearchIndexFailureRecord> records = captor.getValue();

        assertEquals(1, records.size());
      }
    }

    @Test
    @DisplayName("Should handle boundary length message")
    @SuppressWarnings("unchecked")
    void testBoundaryLengthMessage() {
      ArgumentCaptor<List<SearchIndexFailureRecord>> captor = ArgumentCaptor.forClass(List.class);

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 1)) {

        String boundaryMessage = "A".repeat(65000);
        recorder.recordReaderFailure("table", boundaryMessage);

        verify(failureDAO).insertBatch(captor.capture());
        List<SearchIndexFailureRecord> records = captor.getValue();

        assertEquals(65000, records.get(0).errorMessage().length());
        assertEquals(boundaryMessage, records.get(0).errorMessage());
      }
    }
  }

  @Nested
  @DisplayName("Failure Stage Tests")
  class FailureStageTests {

    @Test
    @DisplayName("Reader failures should have READER stage")
    @SuppressWarnings("unchecked")
    void testReaderFailureStage() {
      ArgumentCaptor<List<SearchIndexFailureRecord>> captor = ArgumentCaptor.forClass(List.class);

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 1)) {

        recorder.recordReaderFailure("table", "Error");

        verify(failureDAO).insertBatch(captor.capture());
        assertEquals("READER", captor.getValue().get(0).failureStage());
      }
    }

    @Test
    @DisplayName("Sink failures should have SINK stage")
    @SuppressWarnings("unchecked")
    void testSinkFailureStage() {
      ArgumentCaptor<List<SearchIndexFailureRecord>> captor = ArgumentCaptor.forClass(List.class);

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 1)) {

        recorder.recordSinkFailure("table", "entity-1", "fqn", "Error");

        verify(failureDAO).insertBatch(captor.capture());
        assertEquals("SINK", captor.getValue().get(0).failureStage());
      }
    }
  }

  @Nested
  @DisplayName("Record Content Tests")
  class RecordContentTests {

    @Test
    @DisplayName("Should set correct job and run IDs")
    @SuppressWarnings("unchecked")
    void testJobAndRunIds() {
      ArgumentCaptor<List<SearchIndexFailureRecord>> captor = ArgumentCaptor.forClass(List.class);

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 1)) {

        recorder.recordReaderFailure("table", "Error");

        verify(failureDAO).insertBatch(captor.capture());
        SearchIndexFailureRecord record = captor.getValue().get(0);

        assertEquals(JOB_ID, record.jobId());
        assertEquals(RUN_ID, record.runId());
      }
    }

    @Test
    @DisplayName("Should set correct entity type")
    @SuppressWarnings("unchecked")
    void testEntityType() {
      ArgumentCaptor<List<SearchIndexFailureRecord>> captor = ArgumentCaptor.forClass(List.class);

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 1)) {

        recorder.recordReaderFailure("dashboard", "Error");

        verify(failureDAO).insertBatch(captor.capture());
        assertEquals("dashboard", captor.getValue().get(0).entityType());
      }
    }

    @Test
    @DisplayName("Should set entity ID and FQN for sink failures")
    @SuppressWarnings("unchecked")
    void testEntityIdAndFqn() {
      ArgumentCaptor<List<SearchIndexFailureRecord>> captor = ArgumentCaptor.forClass(List.class);

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 1)) {

        recorder.recordSinkFailure("table", "entity-uuid", "database.schema.table", "Error");

        verify(failureDAO).insertBatch(captor.capture());
        SearchIndexFailureRecord record = captor.getValue().get(0);

        assertEquals("entity-uuid", record.entityId());
        assertEquals("database.schema.table", record.entityFqn());
      }
    }

    @Test
    @DisplayName("Reader failures should have null entity ID and FQN")
    @SuppressWarnings("unchecked")
    void testReaderFailureNullEntityFields() {
      ArgumentCaptor<List<SearchIndexFailureRecord>> captor = ArgumentCaptor.forClass(List.class);

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 1)) {

        recorder.recordReaderFailure("table", "Error");

        verify(failureDAO).insertBatch(captor.capture());
        SearchIndexFailureRecord record = captor.getValue().get(0);

        assertEquals(null, record.entityId());
        assertEquals(null, record.entityFqn());
      }
    }

    @Test
    @DisplayName("Should set timestamp")
    @SuppressWarnings("unchecked")
    void testTimestamp() {
      ArgumentCaptor<List<SearchIndexFailureRecord>> captor = ArgumentCaptor.forClass(List.class);

      long beforeRecord = System.currentTimeMillis();
      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 1)) {

        recorder.recordReaderFailure("table", "Error");

        verify(failureDAO).insertBatch(captor.capture());
        long timestamp = captor.getValue().get(0).timestamp();
        long afterRecord = System.currentTimeMillis();

        assertTrue(timestamp >= beforeRecord);
        assertTrue(timestamp <= afterRecord);
      }
    }

    @Test
    @DisplayName("Should generate unique IDs for each record")
    @SuppressWarnings("unchecked")
    void testUniqueIds() {
      ArgumentCaptor<List<SearchIndexFailureRecord>> captor = ArgumentCaptor.forClass(List.class);

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID, 2)) {

        recorder.recordReaderFailure("table", "Error 1");
        recorder.recordReaderFailure("table", "Error 2");

        verify(failureDAO).insertBatch(captor.capture());
        List<SearchIndexFailureRecord> records = captor.getValue();

        assertTrue(records.get(0).id() != null && !records.get(0).id().isEmpty());
        assertTrue(records.get(1).id() != null && !records.get(1).id().isEmpty());
        assertTrue(!records.get(0).id().equals(records.get(1).id()));
      }
    }
  }

  @Nested
  @DisplayName("Default Batch Size Tests")
  class DefaultBatchSizeTests {

    @Test
    @DisplayName("Should use default batch size when not specified")
    void testDefaultBatchSize() {
      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, JOB_ID, RUN_ID)) {

        for (int i = 0; i < 99; i++) {
          recorder.recordReaderFailure("table", "Error " + i);
        }
        verify(failureDAO, never()).insertBatch(anyList());

        recorder.recordReaderFailure("table", "Error 100");
        verify(failureDAO, times(1)).insertBatch(anyList());
      }
    }
  }
}
