package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.auth0.jwk.JwkException;
import com.auth0.jwk.SigningKeyNotFoundException;
import com.google.common.base.Ticker;
import java.io.IOException;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class IdentityProviderKeysTest {
  private static final Duration ONE_DAY = Duration.ofDays(1);
  private static final KeySetFetchPolicy BURST_OF_TWO =
      new KeySetFetchPolicy(Duration.ofSeconds(1), Duration.ofSeconds(1), 2, Duration.ofHours(1));

  @Test
  void tokenWithoutAKeyIdNamesNoKey() {
    IdentityProviderKeys keys = IdentityProviderKeys.forUrls(List.of(), ONE_DAY);

    assertThrows(SigningKeyNotFoundException.class, () -> keys.get(null));
  }

  @Test
  void madeUpKeyIdsCannotFetchTheKeySetBeyondItsBudget() throws Exception {
    try (KeySetServer keySet = KeySetServer.publishing("published-key")) {
      IdentityProviderKeys keys = configuredWith(keySet, Ticker.systemTicker());

      lookUpMadeUpKeyIds(keys, 6);

      assertEquals(2, keySet.requests(), "fetches stop once the burst is spent");
    }
  }

  @Test
  void discoveredKeySetKeepsItsBudgetAcrossLookups() throws Exception {
    try (KeySetServer keySet = KeySetServer.publishing("published-key")) {
      URL discovered = keySet.url();
      IdentityProviderKeys keys =
          new IdentityProviderKeys(
              List.of(), () -> List.of(discovered), BURST_OF_TWO, ONE_DAY, Ticker.systemTicker());

      lookUpMadeUpKeyIds(keys, 6);

      assertEquals(2, keySet.requests(), "every lookup discovers the URL again, not its budget");
    }
  }

  @Test
  void keyThePublishedSetCarriesResolvesAfterMadeUpKeyIdsSpentTheBudget() throws Exception {
    try (KeySetServer keySet = KeySetServer.publishing("rotated-key")) {
      IdentityProviderKeys keys = configuredWith(keySet, Ticker.systemTicker());
      lookUpMadeUpKeyIds(keys, 2);

      assertEquals("rotated-key", keys.get("rotated-key").getId());
      assertEquals(2, keySet.requests(), "served from the sets the made-up ids fetched");
    }
  }

  @Test
  void keyDroppedFromTheSetStopsResolvingADayAfterTheLastFetchThatCarriedIt() throws Exception {
    ManualTicker clock = new ManualTicker();
    try (KeySetServer keySet = KeySetServer.publishing("retired-key")) {
      IdentityProviderKeys keys = configuredWith(keySet, clock);
      keys.get("retired-key");
      clock.advance(Duration.ofHours(12));
      lookUpMadeUpKeyIds(keys, 1);
      keySet.publish("current-key");
      clock.advance(Duration.ofHours(1));
      keys.get("current-key");

      clock.advance(Duration.ofHours(22));
      assertEquals("retired-key", keys.get("retired-key").getId(), "kept from the hour-12 fetch");
      clock.advance(Duration.ofMinutes(61));
      assertThrows(
          SigningKeyNotFoundException.class,
          () -> keys.get("retired-key"),
          "a day after the last fetch that carried it");
    }
  }

  @Test
  void keySetThatNeverAnswersFailsTheLookupAtTheReadTimeout() throws Exception {
    try (KeySetServer keySet = KeySetServer.neverAnswering()) {
      KeySetFetchPolicy shortTimeouts =
          new KeySetFetchPolicy(
              Duration.ofMillis(500), Duration.ofMillis(500), 10, Duration.ofSeconds(6));
      IdentityProviderKeys keys =
          new IdentityProviderKeys(
              List.of(keySet.url()), List::of, shortTimeouts, ONE_DAY, Ticker.systemTicker());
      long started = System.nanoTime();

      assertThrows(SigningKeyNotFoundException.class, () -> keys.get("rotated-key"));

      long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);
      assertTrue(elapsedMillis < 5_000, "gave up after " + elapsedMillis + " ms");
    }
  }

  @Test
  void keySetThatIsNotAKeySetFailsTheLookupRatherThanFindingNoKey(@TempDir Path directory)
      throws Exception {
    Path notAKeySet = Files.writeString(directory.resolve("jwks.json"), "{\"keys\":\"none\"}");
    IdentityProviderKeys keys =
        IdentityProviderKeys.forUrls(List.of(notAKeySet.toUri().toURL()), ONE_DAY);

    JwkException thrown = assertThrows(JwkException.class, () -> keys.get("provider-key"));

    assertFalse(thrown instanceof SigningKeyNotFoundException, thrown.toString());
  }

  private static IdentityProviderKeys configuredWith(KeySetServer keySet, Ticker ticker)
      throws IOException {
    return new IdentityProviderKeys(List.of(keySet.url()), List::of, BURST_OF_TWO, ONE_DAY, ticker);
  }

  private static void lookUpMadeUpKeyIds(IdentityProviderKeys keys, int count) {
    for (int attempt = 0; attempt < count; attempt++) {
      String madeUpKeyId = "made-up-" + attempt;
      assertThrows(SigningKeyNotFoundException.class, () -> keys.get(madeUpKeyId));
    }
  }

  private static final class ManualTicker extends Ticker {
    private final AtomicLong nanos = new AtomicLong();

    @Override
    public long read() {
      return nanos.get();
    }

    void advance(Duration duration) {
      nanos.addAndGet(duration.toNanos());
    }
  }
}
