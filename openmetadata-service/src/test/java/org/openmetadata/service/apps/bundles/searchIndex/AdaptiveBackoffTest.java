package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("AdaptiveBackoff Tests")
class AdaptiveBackoffTest {

  @Test
  @DisplayName("returns initial delay on first call")
  void initialDelay() {
    AdaptiveBackoff backoff = new AdaptiveBackoff(100, 2000);
    assertEquals(100, backoff.nextDelay());
  }

  @Test
  @DisplayName("doubles delay on each subsequent call")
  void exponentialDoubling() {
    AdaptiveBackoff backoff = new AdaptiveBackoff(50, 10000);
    assertEquals(50, backoff.nextDelay());
    assertEquals(100, backoff.nextDelay());
    assertEquals(200, backoff.nextDelay());
    assertEquals(400, backoff.nextDelay());
    assertEquals(800, backoff.nextDelay());
  }

  @Test
  @DisplayName("caps at maxMs")
  void capAtMax() {
    AdaptiveBackoff backoff = new AdaptiveBackoff(100, 300);
    assertEquals(100, backoff.nextDelay());
    assertEquals(200, backoff.nextDelay());
    assertEquals(300, backoff.nextDelay());
    assertEquals(300, backoff.nextDelay());
  }

  @Test
  @DisplayName("reset returns to initial delay")
  void resetToInitial() {
    AdaptiveBackoff backoff = new AdaptiveBackoff(50, 1000);
    backoff.nextDelay();
    backoff.nextDelay();
    backoff.nextDelay();

    backoff.reset();
    assertEquals(50, backoff.nextDelay());
  }

  @Test
  @DisplayName("rejects invalid initialMs")
  void rejectsInvalidInitialMs() {
    assertThrows(IllegalArgumentException.class, () -> new AdaptiveBackoff(0, 1000));
    assertThrows(IllegalArgumentException.class, () -> new AdaptiveBackoff(-1, 1000));
  }

  @Test
  @DisplayName("rejects maxMs less than initialMs")
  void rejectsMaxLessThanInitial() {
    assertThrows(IllegalArgumentException.class, () -> new AdaptiveBackoff(200, 100));
  }

  @Test
  @DisplayName("works when initialMs equals maxMs")
  void initialEqualsMax() {
    AdaptiveBackoff backoff = new AdaptiveBackoff(500, 500);
    assertEquals(500, backoff.nextDelay());
    assertEquals(500, backoff.nextDelay());
  }
}
