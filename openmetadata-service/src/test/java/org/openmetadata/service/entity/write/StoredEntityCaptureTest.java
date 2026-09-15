package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.utils.JsonUtils;

class StoredEntityCaptureTest {
  @Test
  void publicationReusesTheCanonicalBytesBeforeResponseEnrichment() {
    final StoredEntityCapture capture = new StoredEntityCapture();
    final Table entity = table("stored");
    final String json = JsonUtils.pojoToJson(entity);
    capture.capture(
        entity,
        () -> {
          capture.record(entity, json);
          capture.record(entity, "later side effect");
        });
    entity.setDescription("enriched response");
    assertEquals(json, publish(capture, entity));
    assertNull(publish(capture, entity));
  }

  @Test
  void anUnrelatedWriteOrPublicationCannotReuseAnotherEntitysBytes() {
    final StoredEntityCapture capture = new StoredEntityCapture();
    final Table first = table("first");
    final Table other = table("other");
    capture.record(first, "outside capture");
    assertNull(publish(capture, first));
    capture.capture(first, () -> capture.record(other, "other row"));
    assertNull(publish(capture, first));
    capture.capture(first, () -> capture.record(first, "first row"));
    assertNull(publish(capture, other));
    assertNull(publish(capture, first));
  }

  @Test
  void failedOrIncompleteWritesCannotPublishCapturedRows() {
    final StoredEntityCapture capture = new StoredEntityCapture();
    final Table entity = table("failed");
    assertThrows(
        IllegalStateException.class,
        () ->
            capture.capture(
                entity,
                () -> {
                  capture.record(entity, "rolled back");
                  throw new IllegalStateException("Write failed");
                }));
    assertNull(publish(capture, entity));
    capture.capture(entity, () -> {});
    assertNull(publish(capture, entity));
    capture.capture(
        entity,
        () -> {
          capture.record(entity, "previous identity");
          entity.setId(UUID.randomUUID());
        });
    assertNull(publish(capture, entity));
  }

  @Test
  void publicationFailureAndExplicitCleanupReleaseTheThread() {
    final StoredEntityCapture capture = new StoredEntityCapture();
    final Table entity = table("published");
    capture.capture(entity, () -> capture.record(entity, "row"));
    assertThrows(
        IllegalStateException.class,
        () ->
            capture.publish(
                entity,
                (value, json) -> {
                  throw new IllegalStateException("Cache unavailable");
                }));
    assertNull(publish(capture, entity));
    capture.capture(entity, () -> capture.record(entity, "row"));
    capture.clear();
    assertNull(publish(capture, entity));
  }

  @Test
  void independentThreadsKeepTheirOwnCapturedRow() {
    final StoredEntityCapture capture = new StoredEntityCapture();
    final Table entity = table("same identity");
    capture.capture(entity, () -> capture.record(entity, "first transaction"));
    CompletableFuture.runAsync(
            () -> {
              assertNull(publish(capture, entity));
              capture.capture(entity, () -> capture.record(entity, "second transaction"));
              assertEquals("second transaction", publish(capture, entity));
            })
        .join();
    assertEquals("first transaction", publish(capture, entity));
  }

  @Test
  void nullPublicationAndNestedWritesCannotLeaveCapturedBytes() {
    final StoredEntityCapture capture = new StoredEntityCapture();
    final Table first = table("first");
    capture.capture(first, () -> capture.record(first, "first"));
    assertNull(publish(capture, null));
    assertNull(publish(capture, first));
    capture.capture(first, () -> capture.capture(table("nested"), capture::clear));
    assertNull(publish(capture, first));
  }

  private static String publish(StoredEntityCapture capture, Table entity) {
    final AtomicReference<String> value = new AtomicReference<>();
    capture.publish(entity, (ignored, json) -> value.set(json));
    return value.get();
  }

  private static Table table(String description) {
    return new Table().withId(UUID.randomUUID()).withName("table").withDescription(description);
  }
}
