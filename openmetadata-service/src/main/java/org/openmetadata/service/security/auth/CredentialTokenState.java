/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.security.auth;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.util.concurrent.Striped;
import java.time.Duration;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.Lock;
import java.util.function.Supplier;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CacheProvider;

/**
 * Coordinates credential validation with mutations across OpenMetadata instances. With Redis
 * configured, every validation reads a shared hash snapshot; a mutation installs a fail-closed
 * barrier before changing storage and publishes the replacement snapshot before returning. Without
 * Redis, the same protocol uses a bounded in-process cache and per-credential lock. While configured
 * Redis is unavailable, validation bypasses cached state and reads authoritative storage; mutations
 * are rejected so peers cannot keep accepting an old shared snapshot. Multi-server deployments must
 * configure Redis because the in-process fallback cannot coordinate credential state between nodes.
 */
final class CredentialTokenState {
  private static final Duration SNAPSHOT_TTL = Duration.ofMinutes(2);
  private static final Duration MUTATION_TTL = Duration.ofMinutes(10);
  private static final int LOCAL_STATE_MAX_SIZE = 1000;
  private static final int LOCAL_LOCK_STRIPES = 256;
  private static final String READY_PREFIX = "ready:";
  private static final String MUTATING_PREFIX = "mutating:";
  private static final String TOKEN_SEPARATOR = ",";
  private static final Cache<String, String> LOCAL_STATE =
      CacheBuilder.newBuilder()
          .maximumSize(LOCAL_STATE_MAX_SIZE)
          .expireAfterWrite(SNAPSHOT_TTL)
          .build();
  private static final Striped<Lock> LOCAL_LOCKS = Striped.lock(LOCAL_LOCK_STRIPES);

  enum Kind {
    BOT("bot"),
    PERSONAL_ACCESS_TOKEN("pat");

    private final String keyPart;

    Kind(String keyPart) {
      this.keyPart = keyPart;
    }
  }

  private final CacheProvider cacheProvider;
  private final CacheKeys cacheKeys;
  private final boolean sharedStateEnabled;

  CredentialTokenState(
      CacheProvider cacheProvider, CacheKeys cacheKeys, boolean sharedStateEnabled) {
    this.cacheProvider = cacheProvider;
    this.cacheKeys = cacheKeys;
    this.sharedStateEnabled = sharedStateEnabled;
  }

  static CredentialTokenState fromCacheBundle() {
    CacheConfig config = CacheBundle.getCacheConfig();
    boolean redisConfigured =
        config != null && config.provider == CacheConfig.Provider.redis && config.redis != null;
    String keyspace =
        config != null && config.redis != null ? config.redis.keyspace : "om:credential-fallback";
    return new CredentialTokenState(
        CacheBundle.getCacheProvider(), new CacheKeys(keyspace), redisConfigured);
  }

  boolean isTokenValid(
      Kind kind, String userName, String presentedToken, Supplier<Set<String>> tokenLoader) {
    if (presentedToken == null || presentedToken.isEmpty()) {
      return false;
    }
    try {
      if (!sharedStateEnabled) {
        String state = getOrLoadLocalState(kind, userName, tokenLoader);
        return readyStateContains(state, presentedToken);
      }
      if (!cacheProvider.available()) {
        return tokenHashes(tokenLoader.get()).contains(hashToken(presentedToken));
      }
      String state = getOrLoadSharedState(kind, userName, tokenLoader);
      return state != null && readyStateContains(state, presentedToken);
    } catch (RuntimeException ignored) {
      return false;
    }
  }

  <T> T mutate(
      Kind kind, String userName, Supplier<T> mutation, Supplier<Set<String>> tokenLoader) {
    if (!sharedStateEnabled) {
      return mutateLocal(kind, userName, mutation, tokenLoader);
    }

    MutationLease lease = beginMutation(kind, userName);
    try {
      T result = mutation.get();
      writeAndVerify(lease.stateKey(), readyState(tokenLoader.get()), SNAPSHOT_TTL);
      return result;
    } catch (RuntimeException | Error failure) {
      try {
        writeAndVerify(lease.stateKey(), readyState(tokenLoader.get()), SNAPSHOT_TTL);
      } catch (RuntimeException | Error restoreFailure) {
        failure.addSuppressed(restoreFailure);
      }
      throw failure;
    } finally {
      cacheProvider.deleteIfValue(lease.lockKey(), lease.owner());
    }
  }

  Runnable denyUntilReload(Kind kind, String userName, Supplier<Set<String>> tokenLoader) {
    if (!sharedStateEnabled) {
      return beginLocalDeletion(kind, userName, tokenLoader);
    }
    MutationLease lease = beginMutation(kind, userName);
    return runOnce(() -> finishDeletion(lease, tokenLoader));
  }

  void reload(Kind kind, String userName, Supplier<Set<String>> tokenLoader) {
    mutate(kind, userName, () -> null, tokenLoader);
  }

  void invalidate(Kind kind, String userName) {
    String stateKey = stateKey(kind, userName);
    if (sharedStateEnabled) {
      cacheProvider.del(stateKey);
    } else {
      LOCAL_STATE.invalidate(stateKey);
    }
  }

  private String getOrLoadSharedState(
      Kind kind, String userName, Supplier<Set<String>> tokenLoader) {
    String stateKey = stateKey(kind, userName);
    Optional<String> existing = cacheProvider.get(stateKey);
    if (existing.isPresent()) {
      return existing.get();
    }

    String loadedState = readyState(tokenLoader.get());
    cacheProvider.setIfAbsent(stateKey, loadedState, SNAPSHOT_TTL);
    return cacheProvider.get(stateKey).orElse(null);
  }

  private String getOrLoadLocalState(
      Kind kind, String userName, Supplier<Set<String>> tokenLoader) {
    String stateKey = stateKey(kind, userName);
    Lock lock = LOCAL_LOCKS.get(stateKey);
    lock.lock();
    try {
      String state = LOCAL_STATE.getIfPresent(stateKey);
      if (state == null) {
        state = readyState(tokenLoader.get());
        LOCAL_STATE.put(stateKey, state);
      }
      return state;
    } finally {
      lock.unlock();
    }
  }

  private <T> T mutateLocal(
      Kind kind, String userName, Supplier<T> mutation, Supplier<Set<String>> tokenLoader) {
    String stateKey = stateKey(kind, userName);
    Lock lock = LOCAL_LOCKS.get(stateKey);
    lock.lock();
    try {
      LOCAL_STATE.put(stateKey, MUTATING_PREFIX + UUID.randomUUID());
      T result = mutation.get();
      LOCAL_STATE.put(stateKey, readyState(tokenLoader.get()));
      return result;
    } catch (RuntimeException | Error failure) {
      try {
        LOCAL_STATE.put(stateKey, readyState(tokenLoader.get()));
      } catch (RuntimeException | Error restoreFailure) {
        failure.addSuppressed(restoreFailure);
      }
      throw failure;
    } finally {
      lock.unlock();
    }
  }

  private Runnable beginLocalDeletion(
      Kind kind, String userName, Supplier<Set<String>> tokenLoader) {
    String stateKey = stateKey(kind, userName);
    Lock lock = LOCAL_LOCKS.get(stateKey);
    lock.lock();
    try {
      LOCAL_STATE.put(stateKey, MUTATING_PREFIX + UUID.randomUUID());
    } catch (RuntimeException | Error failure) {
      lock.unlock();
      throw failure;
    }
    return runOnce(
        () -> {
          try {
            LOCAL_STATE.put(stateKey, readyState(tokenLoader.get()));
          } finally {
            lock.unlock();
          }
        });
  }

  private MutationLease beginMutation(Kind kind, String userName) {
    if (!cacheProvider.available()) {
      throw new IllegalStateException(
          "Credential mutation requires the configured Redis cache to be available");
    }

    String owner = UUID.randomUUID().toString();
    String lockKey = cacheKeys.credentialMutationLock(kind.keyPart, userName);
    if (!cacheProvider.setIfAbsent(lockKey, owner, MUTATION_TTL)) {
      cacheProvider.deleteIfValue(lockKey, owner);
      throw new IllegalStateException("Another credential mutation is already in progress");
    }

    String stateKey = stateKey(kind, userName);
    String mutatingState = MUTATING_PREFIX + owner;
    try {
      writeAndVerify(stateKey, mutatingState, MUTATION_TTL);
      return new MutationLease(stateKey, lockKey, owner);
    } catch (RuntimeException failure) {
      cacheProvider.deleteIfValue(stateKey, mutatingState);
      cacheProvider.deleteIfValue(lockKey, owner);
      throw failure;
    }
  }

  private void finishDeletion(MutationLease lease, Supplier<Set<String>> tokenLoader) {
    try {
      writeAndVerify(lease.stateKey(), readyState(tokenLoader.get()), SNAPSHOT_TTL);
    } finally {
      cacheProvider.deleteIfValue(lease.lockKey(), lease.owner());
    }
  }

  private String stateKey(Kind kind, String userName) {
    return cacheKeys.credentialState(kind.keyPart, userName);
  }

  private void writeAndVerify(String key, String value, Duration ttl) {
    cacheProvider.set(key, value, ttl);
    if (!cacheProvider.get(key).filter(value::equals).isPresent()) {
      throw new IllegalStateException("Unable to synchronize credential state through Redis");
    }
  }

  private static String readyState(Collection<String> tokens) {
    return READY_PREFIX + String.join(TOKEN_SEPARATOR, tokenHashes(tokens));
  }

  private static Set<String> tokenHashes(Collection<String> tokens) {
    if (tokens == null || tokens.isEmpty()) {
      return Set.of();
    }
    Set<String> hashes = new TreeSet<>();
    tokens.stream()
        .filter(token -> token != null && !token.isEmpty())
        .map(CredentialTokenState::hashToken)
        .forEach(hashes::add);
    return Collections.unmodifiableSet(hashes);
  }

  private static boolean readyStateContains(String state, String presentedToken) {
    if (!state.startsWith(READY_PREFIX)) {
      return false;
    }
    String hashes = state.substring(READY_PREFIX.length());
    if (hashes.isEmpty()) {
      return false;
    }
    String presentedHash = hashToken(presentedToken);
    return Arrays.stream(hashes.split(TOKEN_SEPARATOR)).anyMatch(presentedHash::equals);
  }

  private static String hashToken(String token) {
    return DigestUtils.sha256Hex(token);
  }

  private static Runnable runOnce(Runnable action) {
    AtomicBoolean pending = new AtomicBoolean(true);
    return () -> {
      if (pending.compareAndSet(true, false)) {
        action.run();
      }
    };
  }

  private record MutationLease(String stateKey, String lockKey, String owner) {}
}
