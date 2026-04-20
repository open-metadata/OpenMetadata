package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.service.exception.SearchIndexException;

@DisplayName("EntityReader Retry Tests")
class EntityReaderRetryTest {

  @Test
  @DisplayName("isTransientError detects timeout errors")
  void detectsTimeoutErrors() {
    SearchIndexException e =
        new SearchIndexException(
            new IndexingError().withMessage("Connection timeout while reading entities"));
    assertTrue(EntityReader.isTransientError(e));
  }

  @Test
  @DisplayName("isTransientError detects connection errors")
  void detectsConnectionErrors() {
    SearchIndexException e =
        new SearchIndexException(
            new IndexingError().withMessage("java.net.ConnectException: Connection refused"));
    assertTrue(EntityReader.isTransientError(e));
  }

  @Test
  @DisplayName("isTransientError detects pool exhaustion")
  void detectsPoolExhaustion() {
    SearchIndexException e =
        new SearchIndexException(
            new IndexingError().withMessage("Pool exhausted - no connections available"));
    assertTrue(EntityReader.isTransientError(e));
  }

  @Test
  @DisplayName("isTransientError detects socket timeout")
  void detectsSocketTimeout() {
    SearchIndexException e =
        new SearchIndexException(
            new IndexingError().withMessage("java.net.SocketTimeoutException: Read timed out"));
    assertTrue(EntityReader.isTransientError(e));
  }

  @Test
  @DisplayName("isTransientError returns false for non-transient errors")
  void rejectsNonTransientErrors() {
    SearchIndexException e =
        new SearchIndexException(new IndexingError().withMessage("Entity not found: table.xyz"));
    assertFalse(EntityReader.isTransientError(e));
  }

  @Test
  @DisplayName("isTransientError returns false for null message")
  void handleNullMessage() {
    SearchIndexException e = new SearchIndexException(new IndexingError());
    assertFalse(EntityReader.isTransientError(e));
  }

  @Test
  @DisplayName("EntityReader constructor accepts custom retry configuration")
  void customRetryConfiguration() {
    java.util.concurrent.ExecutorService executor =
        java.util.concurrent.Executors.newSingleThreadExecutor();
    java.util.concurrent.atomic.AtomicBoolean stopped =
        new java.util.concurrent.atomic.AtomicBoolean(false);
    EntityReader reader = new EntityReader(executor, stopped, 5, 1000);
    assertNotNull(reader);
    executor.shutdown();
  }

  @Test
  @DisplayName("EntityReader default constructor uses default retry values")
  void defaultRetryConfiguration() {
    java.util.concurrent.ExecutorService executor =
        java.util.concurrent.Executors.newSingleThreadExecutor();
    java.util.concurrent.atomic.AtomicBoolean stopped =
        new java.util.concurrent.atomic.AtomicBoolean(false);
    EntityReader reader = new EntityReader(executor, stopped);
    assertNotNull(reader);
    executor.shutdown();
  }

  @Test
  @DisplayName("VectorCompletionResult.success creates completed result")
  void vectorCompletionSuccess() {
    VectorCompletionResult result = VectorCompletionResult.success(150);
    assertTrue(result.completed());
    assertEquals(0, result.pendingTaskCount());
    assertEquals(150, result.waitedMillis());
  }

  @Test
  @DisplayName("VectorCompletionResult.timeout creates timeout result")
  void vectorCompletionTimeout() {
    VectorCompletionResult result = VectorCompletionResult.timeout(5, 30000);
    assertFalse(result.completed());
    assertEquals(5, result.pendingTaskCount());
    assertEquals(30000, result.waitedMillis());
  }
}
