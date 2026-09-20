package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.NoopCacheProvider;

class CredentialTokenStateTest {
  private static final String USER_NAME = "token-owner";

  @ParameterizedTest
  @EnumSource(CredentialTokenState.Kind.class)
  void noSharedCoordinatorUsesBoundedLocalState(CredentialTokenState.Kind kind) {
    AtomicReference<Set<String>> storedTokens = new AtomicReference<>(Set.of("old-token"));
    AtomicInteger loads = new AtomicInteger();
    CredentialTokenState state =
        new CredentialTokenState(new NoopCacheProvider(), new CacheKeys("test:no-shared"), false);

    assertTrue(
        state.isTokenValid(
            kind,
            USER_NAME,
            "old-token",
            () -> {
              loads.incrementAndGet();
              return storedTokens.get();
            }));
    assertTrue(state.isTokenValid(kind, USER_NAME, "old-token", storedTokens::get));
    assertEquals(1, loads.get());

    state.mutate(
        kind,
        USER_NAME,
        () -> {
          storedTokens.set(Set.of("new-token"));
          return null;
        },
        storedTokens::get);

    assertFalse(state.isTokenValid(kind, USER_NAME, "old-token", storedTokens::get));
    assertTrue(state.isTokenValid(kind, USER_NAME, "new-token", storedTokens::get));
  }

  @ParameterizedTest
  @EnumSource(CredentialTokenState.Kind.class)
  void independentClientsObserveMutationThroughSharedState(CredentialTokenState.Kind kind) {
    ConcurrentMap<String, String> sharedRedis = new ConcurrentHashMap<>();
    CredentialTokenState firstNode = sharedState(sharedRedis, "test:shared");
    CredentialTokenState secondNode = sharedState(sharedRedis, "test:shared");
    AtomicReference<Set<String>> storedTokens = new AtomicReference<>(Set.of("old-token"));

    assertTrue(secondNode.isTokenValid(kind, USER_NAME, "old-token", storedTokens::get));

    firstNode.mutate(
        kind,
        USER_NAME,
        () -> {
          storedTokens.set(Set.of("new-token"));
          return null;
        },
        storedTokens::get);

    assertFalse(secondNode.isTokenValid(kind, USER_NAME, "old-token", storedTokens::get));
    assertTrue(secondNode.isTokenValid(kind, USER_NAME, "new-token", storedTokens::get));
    assertTrue(
        sharedRedis.values().stream()
            .noneMatch(value -> value.contains("old-token") || value.contains("new-token")));
  }

  @ParameterizedTest
  @EnumSource(CredentialTokenState.Kind.class)
  void mutationWinsAgainstAnInFlightInitialLoad(CredentialTokenState.Kind kind) throws Exception {
    ConcurrentMap<String, String> sharedRedis = new ConcurrentHashMap<>();
    CredentialTokenState mutatingNode = sharedState(sharedRedis, "test:load-race");
    CredentialTokenState loadingNode = sharedState(sharedRedis, "test:load-race");
    AtomicReference<Set<String>> storedTokens = new AtomicReference<>(Set.of("old-token"));
    CountDownLatch loadStarted = new CountDownLatch(1);
    CountDownLatch finishOldLoad = new CountDownLatch(1);
    ExecutorService executor = Executors.newSingleThreadExecutor();
    try {
      Future<Boolean> oldTokenAccepted =
          executor.submit(
              () ->
                  loadingNode.isTokenValid(
                      kind,
                      USER_NAME,
                      "old-token",
                      () -> {
                        loadStarted.countDown();
                        await(finishOldLoad);
                        return Set.of("old-token");
                      }));
      assertTrue(loadStarted.await(5, TimeUnit.SECONDS));

      mutatingNode.mutate(
          kind,
          USER_NAME,
          () -> {
            storedTokens.set(Set.of("new-token"));
            return null;
          },
          storedTokens::get);
      finishOldLoad.countDown();

      assertFalse(oldTokenAccepted.get(5, TimeUnit.SECONDS));
      assertTrue(loadingNode.isTokenValid(kind, USER_NAME, "new-token", storedTokens::get));
    } finally {
      finishOldLoad.countDown();
      executor.shutdownNow();
    }
  }

  @ParameterizedTest
  @EnumSource(CredentialTokenState.Kind.class)
  void mutationDoesNotReturnBeforeTheReplacementSnapshotIsVisible(CredentialTokenState.Kind kind)
      throws Exception {
    ConcurrentMap<String, String> sharedRedis = new ConcurrentHashMap<>();
    CountDownLatch readyWriteStarted = new CountDownLatch(1);
    CountDownLatch finishReadyWrite = new CountDownLatch(1);
    CredentialTokenState mutatingNode =
        new CredentialTokenState(
            new BlockingReadyCacheProvider(sharedRedis, readyWriteStarted, finishReadyWrite),
            new CacheKeys("test:synchronous-mutation"),
            true);
    CredentialTokenState readingNode = sharedState(sharedRedis, "test:synchronous-mutation");
    AtomicReference<Set<String>> storedTokens = new AtomicReference<>(Set.of("old-token"));
    assertTrue(readingNode.isTokenValid(kind, USER_NAME, "old-token", storedTokens::get));

    ExecutorService executor = Executors.newSingleThreadExecutor();
    try {
      Future<String> mutation =
          executor.submit(
              () ->
                  mutatingNode.mutate(
                      kind,
                      USER_NAME,
                      () -> {
                        storedTokens.set(Set.of("new-token"));
                        return "updated";
                      },
                      storedTokens::get));

      assertTrue(readyWriteStarted.await(5, TimeUnit.SECONDS));
      assertFalse(mutation.isDone());
      assertFalse(readingNode.isTokenValid(kind, USER_NAME, "old-token", storedTokens::get));

      finishReadyWrite.countDown();
      assertEquals("updated", mutation.get(5, TimeUnit.SECONDS));
      assertTrue(readingNode.isTokenValid(kind, USER_NAME, "new-token", storedTokens::get));
    } finally {
      finishReadyWrite.countDown();
      executor.shutdownNow();
    }
  }

  @ParameterizedTest
  @EnumSource(CredentialTokenState.Kind.class)
  void deletionBarrierRejectsAStillPresentDatabaseToken(CredentialTokenState.Kind kind) {
    ConcurrentMap<String, String> sharedRedis = new ConcurrentHashMap<>();
    CredentialTokenState state = sharedState(sharedRedis, "test:delete");

    assertTrue(state.isTokenValid(kind, USER_NAME, "old-token", () -> Set.of("old-token")));

    Runnable finishDeletion = state.denyUntilReload(kind, USER_NAME, () -> Set.of("old-token"));

    assertFalse(state.isTokenValid(kind, USER_NAME, "old-token", () -> Set.of("old-token")));

    finishDeletion.run();

    assertTrue(state.isTokenValid(kind, USER_NAME, "old-token", () -> Set.of("old-token")));
  }

  @ParameterizedTest
  @EnumSource(CredentialTokenState.Kind.class)
  void completedDeletionReleasesLeaseAndRestoreReloadsTokens(CredentialTokenState.Kind kind) {
    ConcurrentMap<String, String> sharedRedis = new ConcurrentHashMap<>();
    CredentialTokenState state = sharedState(sharedRedis, "test:delete-restore");
    AtomicReference<Set<String>> storedTokens = new AtomicReference<>(Set.of("old-token"));

    Runnable finishDeletion = state.denyUntilReload(kind, USER_NAME, storedTokens::get);
    storedTokens.set(Set.of());
    finishDeletion.run();

    assertFalse(state.isTokenValid(kind, USER_NAME, "old-token", storedTokens::get));

    storedTokens.set(Set.of("old-token"));
    state.reload(kind, USER_NAME, storedTokens::get);

    assertTrue(state.isTokenValid(kind, USER_NAME, "old-token", storedTokens::get));
  }

  @ParameterizedTest
  @EnumSource(CredentialTokenState.Kind.class)
  void ambiguousLockAcquisitionCleansUpAcceptedWrite(CredentialTokenState.Kind kind) {
    ConcurrentMap<String, String> sharedRedis = new ConcurrentHashMap<>();
    CredentialTokenState ambiguousNode =
        new CredentialTokenState(
            new AmbiguousAcquireCacheProvider(sharedRedis),
            new CacheKeys("test:ambiguous-acquire"),
            true);

    assertThrows(
        IllegalStateException.class,
        () -> ambiguousNode.mutate(kind, USER_NAME, () -> null, () -> Set.of("current-token")));

    CredentialTokenState healthyNode = sharedState(sharedRedis, "test:ambiguous-acquire");
    healthyNode.mutate(kind, USER_NAME, () -> null, () -> Set.of("current-token"));

    assertTrue(
        healthyNode.isTokenValid(kind, USER_NAME, "current-token", () -> Set.of("current-token")));
  }

  @Test
  void configuredButUnavailableCoordinatorReadsStorageAndBlocksMutation() {
    AtomicBoolean mutationRan = new AtomicBoolean(false);
    CredentialTokenState state =
        new CredentialTokenState(
            new SharedCacheProvider(new ConcurrentHashMap<>(), false),
            new CacheKeys("test:unavailable"),
            true);

    assertTrue(
        state.isTokenValid(
            CredentialTokenState.Kind.PERSONAL_ACCESS_TOKEN,
            USER_NAME,
            "token",
            () -> Set.of("token")));
    assertFalse(
        state.isTokenValid(
            CredentialTokenState.Kind.PERSONAL_ACCESS_TOKEN,
            USER_NAME,
            "wrong-token",
            () -> Set.of("token")));
    assertThrows(
        IllegalStateException.class,
        () ->
            state.mutate(
                CredentialTokenState.Kind.PERSONAL_ACCESS_TOKEN,
                USER_NAME,
                () -> {
                  mutationRan.set(true);
                  return null;
                },
                () -> Set.of("token")));
    assertFalse(mutationRan.get());
  }

  private static CredentialTokenState sharedState(
      ConcurrentMap<String, String> values, String keyspace) {
    return new CredentialTokenState(
        new SharedCacheProvider(values, true), new CacheKeys(keyspace), true);
  }

  private static void await(CountDownLatch latch) {
    try {
      if (!latch.await(5, TimeUnit.SECONDS)) {
        throw new IllegalStateException("Timed out waiting for test latch");
      }
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted waiting for test latch", interrupted);
    }
  }

  private static class SharedCacheProvider extends NoopCacheProvider {
    private final ConcurrentMap<String, String> values;
    private final boolean available;

    private SharedCacheProvider(ConcurrentMap<String, String> values, boolean available) {
      this.values = values;
      this.available = available;
    }

    @Override
    public Optional<String> get(String key) {
      return available ? Optional.ofNullable(values.get(key)) : Optional.empty();
    }

    @Override
    public void set(String key, String value, Duration ttl) {
      if (available) {
        values.put(key, value);
      }
    }

    @Override
    public boolean setIfAbsent(String key, String value, Duration ttl) {
      return available && values.putIfAbsent(key, value) == null;
    }

    @Override
    public void del(String... keys) {
      for (String key : keys) {
        values.remove(key);
      }
    }

    @Override
    public boolean deleteIfValue(String key, String expectedValue) {
      return values.remove(key, expectedValue);
    }

    @Override
    public boolean available() {
      return available;
    }

    @Override
    public Map<String, Object> getStats() {
      return Map.of("available", available);
    }
  }

  private static final class BlockingReadyCacheProvider extends SharedCacheProvider {
    private final CountDownLatch readyWriteStarted;
    private final CountDownLatch finishReadyWrite;

    private BlockingReadyCacheProvider(
        ConcurrentMap<String, String> values,
        CountDownLatch readyWriteStarted,
        CountDownLatch finishReadyWrite) {
      super(values, true);
      this.readyWriteStarted = readyWriteStarted;
      this.finishReadyWrite = finishReadyWrite;
    }

    @Override
    public void set(String key, String value, Duration ttl) {
      if (value.startsWith("ready:")) {
        readyWriteStarted.countDown();
        await(finishReadyWrite);
      }
      super.set(key, value, ttl);
    }
  }

  private static final class AmbiguousAcquireCacheProvider extends SharedCacheProvider {
    private AmbiguousAcquireCacheProvider(ConcurrentMap<String, String> values) {
      super(values, true);
    }

    @Override
    public boolean setIfAbsent(String key, String value, Duration ttl) {
      super.setIfAbsent(key, value, ttl);
      return false;
    }
  }
}
