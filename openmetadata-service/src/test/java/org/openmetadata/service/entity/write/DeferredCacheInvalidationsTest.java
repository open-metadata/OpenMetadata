package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DeferredCacheInvalidationsTest {
  @Test
  void repeatedIdentityKeepsTheFirstKnownNameAndOriginalOrder() {
    List<String> names = new ArrayList<>();
    var queue = new DeferredCacheInvalidations((type, id, fqn) -> names.add(fqn));
    UUID id = UUID.randomUUID();
    assertTrue(queue.begin());
    assertFalse(queue.begin());
    queue.deferOrRun("table", id, null);
    queue.deferOrRun("chart", id, "chart");
    queue.deferOrRun("table", id, "table");
    queue.deferOrRun("table", id, "later-name");
    assertTrue(names.isEmpty());

    queue.drain();

    assertEquals(List.of("table", "chart"), names);
  }

  @Test
  void rollbackDiscardsWorkAndReleasesTheThread() {
    List<String> names = new ArrayList<>();
    var queue = new DeferredCacheInvalidations((type, id, fqn) -> names.add(fqn));
    queue.begin();
    queue.deferOrRun("table", UUID.randomUUID(), "rolled-back");
    queue.clear();
    queue.drain();
    queue.deferOrRun("table", UUID.randomUUID(), "committed");
    assertEquals(List.of("committed"), names);
  }

  @Test
  void publicationFailureReleasesTheThreadBeforeCallingTheProvider() {
    var queue =
        new DeferredCacheInvalidations(
            (type, id, fqn) -> {
              throw new IllegalStateException("Redis unavailable");
            });
    queue.begin();
    queue.deferOrRun("table", UUID.randomUUID(), "table");
    assertThrows(IllegalStateException.class, queue::drain);
    assertTrue(queue.begin());
    queue.clear();
  }
}
