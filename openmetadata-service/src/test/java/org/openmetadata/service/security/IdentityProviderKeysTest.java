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
import java.security.interfaces.RSAPublicKey;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class IdentityProviderKeysTest {
  private static final Duration ONE_DAY = Duration.ofDays(1);
  private static final Duration RESOLVED_KEY_REUSE_PASSED = Duration.ofMinutes(2);
  private static final KeySetFetchPolicy GENEROUS_BUDGET =
      new KeySetFetchPolicy(
          Duration.ofSeconds(1), Duration.ofSeconds(1), 10, Duration.ofSeconds(6));
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
  void keyIdTwoKeySetsPublishResolvesToTheFirstConfiguredSet() throws Exception {
    RSAPublicKey firstSetsKey = KeySetServer.newPublicKey();
    try (KeySetServer first = KeySetServer.publishing("shared", firstSetsKey);
        KeySetServer second = KeySetServer.publishing("shared", KeySetServer.newPublicKey())) {
      IdentityProviderKeys keys =
          new IdentityProviderKeys(
              List.of(first.url(), second.url()),
              List::of,
              BURST_OF_TWO,
              ONE_DAY,
              Ticker.systemTicker());
      lookUpMadeUpKeyIds(keys, 1);

      RSAPublicKey resolved = (RSAPublicKey) keys.get("shared").getPublicKey();

      assertEquals(
          firstSetsKey.getModulus(),
          resolved.getModulus(),
          "downloading the second set must not replace the first set's key");
      assertEquals(1, second.requests(), "the second set was downloaded too");
    }
  }

  @Test
  void firstConfiguredSetWinsOnceItRecoversFromAFailedDownload() throws Exception {
    RSAPublicKey firstSetsKey = KeySetServer.newPublicKey();
    try (KeySetServer first = KeySetServer.publishing("shared", firstSetsKey);
        KeySetServer second =
            KeySetServer.publishing(
                List.of("shared", "second-only"), KeySetServer.newPublicKey())) {
      IdentityProviderKeys keys = configuredWith(first, second, Ticker.systemTicker());
      first.setFailing(true);
      keys.get("second-only");
      first.setFailing(false);
      lookUpMadeUpKeyIds(keys, 1);

      RSAPublicKey resolved = (RSAPublicKey) keys.get("shared").getPublicKey();

      assertEquals(
          firstSetsKey.getModulus(),
          resolved.getModulus(),
          "a lookup of an unknown id downloads the recovered first set, which then wins");
    }
  }

  @Test
  void firstConfiguredSetWinsAfterItsCachedCopyExpiresBeforeTheSecondSets() throws Exception {
    ManualTicker clock = new ManualTicker();
    RSAPublicKey firstSetsKey = KeySetServer.newPublicKey();
    try (KeySetServer first = KeySetServer.publishing("shared", firstSetsKey);
        KeySetServer second = KeySetServer.publishing("shared", KeySetServer.newPublicKey())) {
      IdentityProviderKeys keys = configuredWith(first, second, clock);
      keys.get("shared");
      lookUpMadeUpKeyIds(keys, 1);
      clock.advance(Duration.ofMinutes(30));
      assertThrows(SigningKeyNotFoundException.class, () -> keys.get("refused-for-the-first-set"));

      clock.advance(ONE_DAY.minusMinutes(29));
      RSAPublicKey resolved = (RSAPublicKey) keys.get("shared").getPublicKey();

      assertEquals(
          firstSetsKey.getModulus(),
          resolved.getModulus(),
          "the first set's copy expired first, so it is downloaded again, not skipped");
    }
  }

  @Test
  void failingKeySetIsNotDownloadedAgainByLookupsTheCacheAnswers() throws Exception {
    ManualTicker clock = new ManualTicker();
    try (KeySetServer failing = KeySetServer.publishing("unused");
        KeySetServer provider = KeySetServer.publishing("provider-key")) {
      failing.setFailing(true);
      IdentityProviderKeys keys =
          new IdentityProviderKeys(
              List.of(failing.url(), provider.url()), List::of, GENEROUS_BUDGET, ONE_DAY, clock);

      for (int minute = 0; minute < 10; minute++) {
        assertEquals("provider-key", keys.get("provider-key").getId());
        clock.advance(Duration.ofMinutes(1));
      }

      assertEquals(1, failing.requests(), "only the first lookup asked the failing set");
      assertEquals(1, provider.requests(), "the provider's cached set keeps answering");
    }
  }

  @Test
  void hangingKeySetDoesNotHoldUpLookupsTheCacheAnswers() throws Exception {
    ManualTicker clock = new ManualTicker();
    try (KeySetServer hanging = KeySetServer.neverAnswering();
        KeySetServer provider = KeySetServer.publishing("provider-key")) {
      KeySetFetchPolicy shortTimeouts =
          new KeySetFetchPolicy(
              Duration.ofMillis(300), Duration.ofMillis(300), 10, Duration.ofSeconds(6));
      IdentityProviderKeys keys =
          new IdentityProviderKeys(
              List.of(hanging.url(), provider.url()), List::of, shortTimeouts, ONE_DAY, clock);
      keys.get("provider-key");

      clock.advance(Duration.ofMinutes(10));

      assertEquals("provider-key", keys.get("provider-key").getId());
      assertEquals(1, hanging.requests(), "the hanging set was not asked again");
    }
  }

  @Test
  void keySetThatAnswersWithNoKeysKeepsItsCachedKeys() throws Exception {
    ManualTicker clock = new ManualTicker();
    try (KeySetServer keySet = KeySetServer.publishing("cached-key")) {
      IdentityProviderKeys keys = configuredWith(keySet, clock);
      keys.get("cached-key");
      keySet.publishNoKeys();
      lookUpMadeUpKeyIds(keys, 1);
      clock.advance(RESOLVED_KEY_REUSE_PASSED);

      assertEquals("cached-key", keys.get("cached-key").getId(), "no keys counts as a failure");
      assertEquals(2, keySet.requests());
    }
  }

  @Test
  void keyIdRepeatedInOneSetResolvesToItsFirstEntry() throws Exception {
    RSAPublicKey firstEntrysKey = KeySetServer.newPublicKey();
    String document =
        KeySetServer.keySetOf(
            KeySetServer.keyJson("repeated", firstEntrysKey),
            KeySetServer.keyJson("repeated", KeySetServer.newPublicKey()));
    try (KeySetServer keySet = KeySetServer.serving(document)) {
      IdentityProviderKeys keys = configuredWith(keySet, Ticker.systemTicker());

      RSAPublicKey resolved = (RSAPublicKey) keys.get("repeated").getPublicKey();

      assertEquals(firstEntrysKey.getModulus(), resolved.getModulus());
    }
  }

  @Test
  void keySetOfSeveralHundredKeysIsCachedWhole() throws Exception {
    List<String> keyIds = IntStream.range(0, 300).mapToObj(index -> "key-" + index).toList();
    try (KeySetServer keySet = KeySetServer.publishing(keyIds, KeySetServer.newPublicKey())) {
      IdentityProviderKeys keys = configuredWith(keySet, Ticker.systemTicker());
      keys.get("key-0");

      assertEquals("key-299", keys.get("key-299").getId());
      assertEquals(1, keySet.requests(), "the second key came from the cached set");
    }
  }

  @Test
  void firstConfiguredSetWinsAfterADownloadFailedWhileItWasCached() throws Exception {
    ManualTicker clock = new ManualTicker();
    RSAPublicKey firstSetsKey = KeySetServer.newPublicKey();
    try (KeySetServer first = KeySetServer.publishing("shared", firstSetsKey);
        KeySetServer second = KeySetServer.publishing("shared", KeySetServer.newPublicKey())) {
      IdentityProviderKeys keys = configuredWith(first, second, clock);
      keys.get("shared");
      lookUpMadeUpKeyIds(keys, 1);
      clock.advance(Duration.ofHours(12));
      first.setFailing(true);
      assertThrows(SigningKeyNotFoundException.class, () -> keys.get("made-up-at-noon"));
      first.setFailing(false);

      clock.advance(Duration.ofHours(12).plusMinutes(2));
      RSAPublicKey resolved = (RSAPublicKey) keys.get("shared").getPublicKey();

      assertEquals(
          firstSetsKey.getModulus(),
          resolved.getModulus(),
          "the failure while the first set was cached must not outlive its cached copy");
    }
  }

  @Test
  void laterSetsCachedCopyAnswersWhenTheEarlierSetIsDownloadedAgain() throws Exception {
    ManualTicker clock = new ManualTicker();
    try (KeySetServer first = KeySetServer.publishing("first-only");
        KeySetServer second = KeySetServer.publishing("second-only")) {
      IdentityProviderKeys keys = configuredWith(first, second, clock);
      keys.get("first-only");
      lookUpMadeUpKeyIds(keys, 1);
      clock.advance(Duration.ofMinutes(30));
      assertThrows(SigningKeyNotFoundException.class, () -> keys.get("refused-for-the-first-set"));
      clock.advance(ONE_DAY.minusMinutes(29));

      assertEquals("second-only", keys.get("second-only").getId());
      assertEquals(2, second.requests(), "the second set answered from its cached copy");
    }
  }

  @Test
  void keyDroppedFromTheSetStopsResolvingOnceADownloadNoLongerCarriesIt() throws Exception {
    ManualTicker clock = new ManualTicker();
    try (KeySetServer keySet = KeySetServer.publishing("retired-key")) {
      IdentityProviderKeys keys = configuredWith(keySet, clock);
      keys.get("retired-key");
      keySet.publish("current-key");
      keys.get("current-key");
      clock.advance(RESOLVED_KEY_REUSE_PASSED);

      assertThrows(SigningKeyNotFoundException.class, () -> keys.get("retired-key"));
    }
  }

  @Test
  void downloadedKeySetIsUsedForItsLifetimeThenDownloadedAgain() throws Exception {
    ManualTicker clock = new ManualTicker();
    try (KeySetServer keySet = KeySetServer.publishing("retired-key")) {
      IdentityProviderKeys keys = configuredWith(keySet, clock);
      keys.get("retired-key");
      keySet.publish("current-key");

      clock.advance(ONE_DAY.minusHours(1));
      assertEquals("retired-key", keys.get("retired-key").getId(), "served from the cached set");
      clock.advance(Duration.ofMinutes(61));
      assertThrows(
          SigningKeyNotFoundException.class,
          () -> keys.get("retired-key"),
          "a day after its last download the set is downloaded again");
      assertEquals(2, keySet.requests());
    }
  }

  @Test
  void keyOfASetLargerThanTheCacheIsReadFromItsDownload() throws Exception {
    List<String> keyIds =
        IntStream.rangeClosed(0, 1_000).mapToObj(index -> "key-" + index).toList();
    try (KeySetServer keySet = KeySetServer.publishing(keyIds, KeySetServer.newPublicKey())) {
      IdentityProviderKeys keys = configuredWith(keySet, Ticker.systemTicker());

      assertEquals("key-0", keys.get("key-0").getId());
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

  private static IdentityProviderKeys configuredWith(
      KeySetServer first, KeySetServer second, Ticker ticker) throws IOException {
    return new IdentityProviderKeys(
        List.of(first.url(), second.url()), List::of, BURST_OF_TWO, ONE_DAY, ticker);
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
