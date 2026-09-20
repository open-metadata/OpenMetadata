package org.openmetadata.service.events.subscription.matching;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class EventFactsTest {

  private final EventFacts facts = new EventFacts();
  private final AtomicInteger reads = new AtomicInteger();

  @Test
  void failedLookupIsNeverCached() {
    EventFacts.Fact<List<String>> first = facts.lookup("owners", this::storeIsDownOnce);
    EventFacts.Fact<List<String>> second = facts.lookup("owners", this::storeIsDownOnce);

    assertTrue(first.failed());
    assertThrows(IllegalStateException.class, first::orThrow, "a failure is never an answer");
    assertEquals(Optional.of(List.of("alice")), second.orThrow(), "the next reader tries again");
  }

  @Test
  void foundAndAbsentAreAskedOnce() {
    facts.lookup("owners", () -> reads.incrementAndGet() > 0 ? List.of("alice") : null);
    facts.lookup("owners", () -> reads.incrementAndGet() > 0 ? List.of("bob") : null);
    EventFacts.Fact<String> nothing = facts.lookup("domain", () -> null);
    facts.lookup("domain", () -> "asked again");

    assertEquals(1, reads.get());
    assertFalse(nothing.failed());
    assertEquals(Optional.empty(), facts.lookup("domain", () -> "asked again").orThrow());
  }

  private List<String> storeIsDownOnce() {
    if (reads.incrementAndGet() == 1) {
      throw new IllegalStateException("the store did not answer");
    }
    return List.of("alice");
  }
}
