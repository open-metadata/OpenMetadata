package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.auth0.jwk.RateLimitReachedException;
import com.google.common.base.Ticker;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class KeySetSourceTest {
  private static final Ticker FROZEN_CLOCK =
      new Ticker() {
        @Override
        public long read() {
          return 0L;
        }
      };

  @Test
  void refusesAFetchOnceItsBudgetIsSpentAndSaysWhenTheNextIsAllowed() throws Exception {
    KeySetFetchPolicy oneFetchAMinute =
        new KeySetFetchPolicy(
            Duration.ofSeconds(1), Duration.ofSeconds(1), 1, Duration.ofMinutes(1));
    try (KeySetServer keySet = KeySetServer.publishing("published-key")) {
      KeySetSource source = new KeySetSource(keySet.url(), oneFetchAMinute, FROZEN_CLOCK);

      assertEquals("published-key", source.fetchAll().getFirst().getId());
      RateLimitReachedException refused =
          assertThrows(RateLimitReachedException.class, source::fetchAll);

      assertEquals(Duration.ofMinutes(1).toMillis(), refused.getAvailableIn());
      assertEquals(1, keySet.requests(), "a refused fetch never reaches the key set");
    }
  }
}
