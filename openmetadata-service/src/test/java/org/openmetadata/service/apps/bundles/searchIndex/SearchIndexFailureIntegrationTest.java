package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexFailureDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexFailureDAO.SearchIndexFailureRecord;

/**
 * Integration-style tests for SearchIndex failure recording. These tests verify that failures are
 * properly recorded through the full flow from BulkSink failures to database records.
 */
@ExtendWith(MockitoExtension.class)
class SearchIndexFailureIntegrationTest {

  @Mock private CollectionDAO collectionDAO;
  @Mock private SearchIndexFailureDAO failureDAO;

  private List<SearchIndexFailureRecord> capturedFailures;

  @BeforeEach
  void setUp() {
    capturedFailures = new ArrayList<>();
    when(collectionDAO.searchIndexFailureDAO()).thenReturn(failureDAO);

    // Capture all failures that would be written to the database
    doAnswer(
            invocation -> {
              List<SearchIndexFailureRecord> records = invocation.getArgument(0);
              capturedFailures.addAll(records);
              return null;
            })
        .when(failureDAO)
        .insertBatch(anyList());
  }

  @Nested
  @DisplayName("BulkSink Failure Callback Integration")
  class BulkSinkFailureCallbackTests {

    @Test
    @DisplayName("Sink failures should be recorded via failure callback")
    void testSinkFailuresRecordedViaCallback() {
      String jobId = UUID.randomUUID().toString();
      String runId = UUID.randomUUID().toString();

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, jobId, runId, 10)) {

        // Simulate what happens when BulkSink fails to index entities
        BulkSink.FailureCallback callback =
            (entityType, entityId, entityFqn, errorMessage) ->
                recorder.recordSinkFailure(entityType, entityId, entityFqn, errorMessage);

        // Simulate 3 sink failures
        callback.onFailure("table", "uuid-1", "db.schema.table1", "Mapping error");
        callback.onFailure("table", "uuid-2", "db.schema.table2", "Document too large");
        callback.onFailure("dashboard", "uuid-3", "service.dashboard1", "Index not found");

        // Flush to capture
        recorder.flush();
      }

      // Verify failures were recorded
      assertEquals(3, capturedFailures.size());

      // Verify first failure
      SearchIndexFailureRecord first = capturedFailures.get(0);
      assertEquals(jobId, first.jobId());
      assertEquals(runId, first.runId());
      assertEquals("table", first.entityType());
      assertEquals("uuid-1", first.entityId());
      assertEquals("db.schema.table1", first.entityFqn());
      assertEquals("Mapping error", first.errorMessage());
      assertEquals("SINK", first.failureStage());

      // Verify entity types are correct
      assertEquals("table", capturedFailures.get(0).entityType());
      assertEquals("table", capturedFailures.get(1).entityType());
      assertEquals("dashboard", capturedFailures.get(2).entityType());
    }

    @Test
    @DisplayName("Reader failures should be recorded with correct stage")
    void testReaderFailuresRecorded() {
      String jobId = UUID.randomUUID().toString();
      String runId = UUID.randomUUID().toString();

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, jobId, runId, 10)) {

        // Simulate reader failures (e.g., entity deserialization errors)
        recorder.recordReaderFailure("table", "Failed to deserialize entity");
        recorder.recordReaderFailure(
            "pipeline", "Database connection error", "java.sql.SQLException...");

        recorder.flush();
      }

      assertEquals(2, capturedFailures.size());

      // Reader failures should have READER stage
      assertTrue(capturedFailures.stream().allMatch(r -> "READER".equals(r.failureStage())));

      // Reader failures should have null entityId and entityFqn
      assertTrue(capturedFailures.stream().allMatch(r -> r.entityId() == null));
      assertTrue(capturedFailures.stream().allMatch(r -> r.entityFqn() == null));
    }
  }

  @Nested
  @DisplayName("Stats and Failure Recording Consistency")
  class StatsFailureConsistencyTests {

    @Test
    @DisplayName("Failure count should match recorded failures")
    void testFailureCountMatchesRecords() {
      String jobId = UUID.randomUUID().toString();
      String runId = UUID.randomUUID().toString();

      AtomicInteger failureCount = new AtomicInteger(0);

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, jobId, runId, 100)) {

        // Simulate failures and count them
        for (int i = 0; i < 25; i++) {
          recorder.recordSinkFailure("table", "uuid-" + i, "db.schema.table" + i, "Error " + i);
          failureCount.incrementAndGet();
        }

        recorder.flush();
      }

      assertEquals(failureCount.get(), capturedFailures.size());
    }

    @Test
    @DisplayName("Mixed reader and sink failures should be recorded correctly")
    void testMixedFailures() {
      String jobId = UUID.randomUUID().toString();
      String runId = UUID.randomUUID().toString();

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, jobId, runId, 100)) {

        // Mix of reader and sink failures
        recorder.recordReaderFailure("table", "Read error 1");
        recorder.recordSinkFailure("table", "id1", "fqn1", "Sink error 1");
        recorder.recordReaderFailure("dashboard", "Read error 2");
        recorder.recordSinkFailure("dashboard", "id2", "fqn2", "Sink error 2");
        recorder.recordSinkFailure("pipeline", "id3", "fqn3", "Sink error 3");

        recorder.flush();
      }

      assertEquals(5, capturedFailures.size());

      long readerFailures =
          capturedFailures.stream().filter(r -> "READER".equals(r.failureStage())).count();
      long sinkFailures =
          capturedFailures.stream().filter(r -> "SINK".equals(r.failureStage())).count();

      assertEquals(2, readerFailures);
      assertEquals(3, sinkFailures);
    }
  }

  @Nested
  @DisplayName("Error Details Recording")
  class ErrorDetailsRecordingTests {

    @Test
    @DisplayName("Stack traces should be preserved in failure records")
    void testStackTracesPreserved() {
      String jobId = UUID.randomUUID().toString();
      String runId = UUID.randomUUID().toString();

      String stackTrace =
          "java.lang.RuntimeException: Test error\n"
              + "\tat com.example.Test.method(Test.java:10)\n"
              + "\tat com.example.Test.main(Test.java:5)";

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, jobId, runId, 1)) {

        recorder.recordReaderFailure("table", "Test error", stackTrace);
      }

      assertEquals(1, capturedFailures.size());
      assertEquals(stackTrace, capturedFailures.get(0).stackTrace());
    }

    @Test
    @DisplayName("Error messages with special characters should be recorded")
    void testSpecialCharactersInErrorMessages() {
      String jobId = UUID.randomUUID().toString();
      String runId = UUID.randomUUID().toString();

      String errorWithSpecialChars =
          "Error: field 'name' contains invalid JSON: {\"key\": \"value with 'quotes'\"}";

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, jobId, runId, 1)) {

        recorder.recordSinkFailure("table", "id1", "fqn1", errorWithSpecialChars);
      }

      assertEquals(1, capturedFailures.size());
      assertEquals(errorWithSpecialChars, capturedFailures.get(0).errorMessage());
    }

    @Test
    @DisplayName("Entity FQN with dots and special chars should be recorded correctly")
    void testEntityFqnWithSpecialChars() {
      String jobId = UUID.randomUUID().toString();
      String runId = UUID.randomUUID().toString();

      String complexFqn = "production.analytics.user_events.2024-01-15";

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, jobId, runId, 1)) {

        recorder.recordSinkFailure("table", "id1", complexFqn, "Error");
      }

      assertEquals(1, capturedFailures.size());
      assertEquals(complexFqn, capturedFailures.get(0).entityFqn());
    }
  }

  @Nested
  @DisplayName("Failure Recovery Tests")
  class FailureRecoveryTests {

    @Test
    @DisplayName("Failures should be queryable by runId for troubleshooting")
    void testFailuresQueryableByRunId() {
      String jobId = UUID.randomUUID().toString();
      String runId1 = UUID.randomUUID().toString();
      String runId2 = UUID.randomUUID().toString();

      // First run
      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, jobId, runId1, 10)) {
        recorder.recordSinkFailure("table", "id1", "fqn1", "Error from run 1");
        recorder.flush();
      }

      // Second run
      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, jobId, runId2, 10)) {
        recorder.recordSinkFailure("table", "id2", "fqn2", "Error from run 2");
        recorder.flush();
      }

      // Verify both runs recorded
      assertEquals(2, capturedFailures.size());

      // Verify runIds are different
      long run1Count = capturedFailures.stream().filter(r -> runId1.equals(r.runId())).count();
      long run2Count = capturedFailures.stream().filter(r -> runId2.equals(r.runId())).count();

      assertEquals(1, run1Count);
      assertEquals(1, run2Count);
    }

    @Test
    @DisplayName("Timestamps should allow chronological ordering of failures")
    void testTimestampsForOrdering() throws InterruptedException {
      String jobId = UUID.randomUUID().toString();
      String runId = UUID.randomUUID().toString();

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, jobId, runId, 10)) {

        recorder.recordSinkFailure("table", "id1", "fqn1", "First error");
        Thread.sleep(10); // Small delay to ensure different timestamps
        recorder.recordSinkFailure("table", "id2", "fqn2", "Second error");
        Thread.sleep(10);
        recorder.recordSinkFailure("table", "id3", "fqn3", "Third error");

        recorder.flush();
      }

      assertEquals(3, capturedFailures.size());

      // Verify timestamps are in order
      for (int i = 1; i < capturedFailures.size(); i++) {
        assertTrue(
            capturedFailures.get(i).timestamp() >= capturedFailures.get(i - 1).timestamp(),
            "Timestamps should be in chronological order");
      }
    }
  }

  @Nested
  @DisplayName("Edge Cases")
  class EdgeCaseTests {

    @Test
    @DisplayName("Should handle null error message gracefully")
    void testNullErrorMessage() {
      String jobId = UUID.randomUUID().toString();
      String runId = UUID.randomUUID().toString();

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, jobId, runId, 1)) {

        recorder.recordReaderFailure("table", null);
      }

      assertEquals(1, capturedFailures.size());
      // Should not throw, null is acceptable
    }

    @Test
    @DisplayName("Should handle empty entity type")
    void testEmptyEntityType() {
      String jobId = UUID.randomUUID().toString();
      String runId = UUID.randomUUID().toString();

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, jobId, runId, 1)) {

        recorder.recordReaderFailure("", "Error with empty entity type");
      }

      assertEquals(1, capturedFailures.size());
      assertEquals("", capturedFailures.get(0).entityType());
    }

    @Test
    @DisplayName("Should handle very long FQN")
    void testVeryLongFqn() {
      String jobId = UUID.randomUUID().toString();
      String runId = UUID.randomUUID().toString();

      // Create a 2000 character FQN (exceeds typical limits)
      String longFqn = "db." + "a".repeat(2000) + ".table";

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, jobId, runId, 1)) {

        recorder.recordSinkFailure("table", "id1", longFqn, "Error");
      }

      assertEquals(1, capturedFailures.size());
      // FQN should be recorded (possibly truncated by the DAO)
      assertNotNull(capturedFailures.get(0).entityFqn());
    }

    @Test
    @DisplayName("Should generate unique IDs even for identical failures")
    void testUniqueIdsForIdenticalFailures() {
      String jobId = UUID.randomUUID().toString();
      String runId = UUID.randomUUID().toString();

      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, jobId, runId, 5)) {

        // Record 5 identical failures
        for (int i = 0; i < 5; i++) {
          recorder.recordSinkFailure("table", "same-id", "same.fqn", "Same error");
        }

        recorder.flush();
      }

      assertEquals(5, capturedFailures.size());

      // All IDs should be unique
      long uniqueIds =
          capturedFailures.stream().map(SearchIndexFailureRecord::id).distinct().count();

      assertEquals(5, uniqueIds, "Each failure should have a unique ID");
    }
  }

  @Nested
  @DisplayName("Database Error Handling")
  class DatabaseErrorHandlingTests {

    @Test
    @DisplayName("Should handle database insert failure gracefully")
    void testDatabaseInsertFailure() {
      String jobId = UUID.randomUUID().toString();
      String runId = UUID.randomUUID().toString();

      // Reset the mock to throw instead of capturing
      org.mockito.Mockito.reset(failureDAO);
      doThrow(new RuntimeException("Database connection lost"))
          .when(failureDAO)
          .insertBatch(anyList());

      // Should not throw - errors should be logged and swallowed
      try (IndexingFailureRecorder recorder =
          new IndexingFailureRecorder(collectionDAO, jobId, runId, 1)) {

        recorder.recordSinkFailure("table", "id1", "fqn1", "Error");
        // Auto-flush on batch size reached - should not throw
      }

      // Recorder should continue working even after DB error
      // (failures are lost but process continues)
    }
  }
}
