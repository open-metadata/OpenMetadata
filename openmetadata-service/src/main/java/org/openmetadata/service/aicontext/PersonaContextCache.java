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
package org.openmetadata.service.aicontext;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.type.PersonaContext;
import org.openmetadata.schema.type.PersonaContextDefinition;
import org.openmetadata.schema.type.personaContext.PersonaContextCacheState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CacheProvider;

/** Two-level cache and distributed single-flight coordinator for persona context documents. */
@Slf4j
public class PersonaContextCache {
  public static final String CACHE_HEADER = "X-Cache";
  private static final int MAX_CACHEABLE_CHARS = 8_000_000;
  private static final Duration BUILD_LEASE = Duration.ofSeconds(120);
  private static final int POLL_ATTEMPTS = 30;
  private static final long POLL_MILLIS = 500;
  private static volatile PersonaContextCache instance;

  private final CacheProvider provider;
  private final CacheKeys keys;
  private final String nodeId = UUID.randomUUID().toString();
  private final Cache<String, LocalEntry> local = Caffeine.newBuilder().maximumSize(50).build();
  private final ConcurrentMap<UUID, GenerationState> generationStates = new ConcurrentHashMap<>();

  PersonaContextCache(CacheProvider provider, CacheKeys keys) {
    this.provider = provider;
    this.keys = keys;
  }

  public static PersonaContextCache getInstance() {
    CacheProvider currentProvider = CacheBundle.getCacheProvider();
    PersonaContextCache current = instance;
    if (current == null || current.provider != currentProvider) {
      synchronized (PersonaContextCache.class) {
        current = instance;
        if (current == null || current.provider != currentProvider) {
          CacheConfig config = CacheBundle.getCacheConfig();
          String namespace = config == null ? "om:prod" : config.redis.keyspace;
          current = new PersonaContextCache(currentProvider, new CacheKeys(namespace));
          instance = current;
        }
      }
    }
    return current;
  }

  public CachedResult get(Persona persona, boolean refresh) {
    PersonaContextDefinition definition = PersonaContextBuilder.definitionOf(persona);
    String definitionHash = PersonaContextHash.definitionHash(definition);
    String localKey = localKey(persona.getId(), definitionHash);
    int ttlSeconds = PersonaContextBuilder.cacheTtlSeconds(definition);

    if (!refresh) {
      PersonaContextBuilder.MaterializedPersonaContext localValue = getLocal(localKey);
      if (localValue != null) {
        return new CachedResult(localValue, CacheStatus.HIT);
      }
    }

    boolean redisAvailable = provider.available();
    if (!refresh && redisAvailable) {
      PersonaContextBuilder.MaterializedPersonaContext cached =
          getRedis(persona.getId(), definitionHash);
      if (cached != null) {
        putLocal(localKey, cached, ttlSeconds);
        return new CachedResult(cached, CacheStatus.HIT);
      }
    }

    if (!redisAvailable) {
      PersonaContextBuilder.MaterializedPersonaContext built = build(persona);
      cacheIfEligible(localKey, built, ttlSeconds, false, persona.getId(), definitionHash);
      markFresh(persona);
      return new CachedResult(built, CacheStatus.BYPASS);
    }

    String lockKey = keys.personaContextLock(persona.getId());
    boolean ownsLock = provider.setIfAbsent(lockKey, nodeId, BUILD_LEASE);
    if (!ownsLock) {
      PersonaContextBuilder.MaterializedPersonaContext winner =
          waitForWinner(persona.getId(), definitionHash);
      if (winner != null) {
        putLocal(localKey, winner, ttlSeconds);
        return new CachedResult(winner, refresh ? CacheStatus.BYPASS : CacheStatus.HIT);
      }
    }

    try {
      PersonaContextBuilder.MaterializedPersonaContext built = build(persona);
      cacheIfEligible(localKey, built, ttlSeconds, true, persona.getId(), definitionHash);
      markFresh(persona);
      return new CachedResult(built, refresh ? CacheStatus.BYPASS : CacheStatus.MISS);
    } finally {
      if (ownsLock) {
        provider.del(lockKey);
      }
    }
  }

  public void invalidate(Persona persona) {
    if (persona == null || persona.getId() == null) {
      return;
    }
    String definitionHash =
        PersonaContextHash.definitionHash(PersonaContextBuilder.definitionOf(persona));
    invalidate(persona.getId(), definitionHash);
    generationStates.remove(persona.getId());
  }

  public void invalidate(Persona original, Persona updated) {
    if (original == null || original.getId() == null) {
      return;
    }
    String oldHash =
        PersonaContextHash.definitionHash(PersonaContextBuilder.definitionOf(original));
    String newHash = PersonaContextHash.definitionHash(PersonaContextBuilder.definitionOf(updated));
    provider.del(
        keys.personaContextMarkdown(original.getId(), oldHash),
        keys.personaContextJson(original.getId(), oldHash),
        keys.personaContextMarkdown(original.getId(), newHash),
        keys.personaContextJson(original.getId(), newHash));
    local.invalidate(localKey(original.getId(), oldHash));
    local.invalidate(localKey(original.getId(), newHash));
    generationStates.remove(original.getId());
  }

  public CachedResult refresh(Persona persona) {
    try {
      CachedResult result = get(persona, true);
      markFresh(persona);
      return result;
    } catch (RuntimeException exception) {
      markFailed(persona, exception);
      throw exception;
    }
  }

  public void refreshAsync(Persona persona) {
    if (persona == null || persona.getId() == null) {
      return;
    }
    synchronized (generationStates) {
      GenerationState current = generationStates.get(persona.getId());
      if (current != null && current.state() == PersonaContextCacheState.GENERATING) {
        return;
      }
      generationStates.put(
          persona.getId(), new GenerationState(PersonaContextCacheState.GENERATING, null));
    }
    CompletableFuture.runAsync(
        () -> {
          try {
            refresh(persona);
          } catch (RuntimeException exception) {
            LOG.warn(
                "Persona context compilation failed for {}: {}",
                persona.getFullyQualifiedName(),
                exception.getMessage());
          }
        });
  }

  public CacheSnapshot snapshot(Persona persona) {
    PersonaContextDefinition definition = PersonaContextBuilder.definitionOf(persona);
    String definitionHash = PersonaContextHash.definitionHash(definition);
    String localKey = localKey(persona.getId(), definitionHash);
    PersonaContextBuilder.MaterializedPersonaContext value = getLocal(localKey);
    if (value == null && provider.available()) {
      value = getRedis(persona.getId(), definitionHash);
      if (value != null) {
        putLocal(localKey, value, PersonaContextBuilder.cacheTtlSeconds(definition));
      }
    }
    GenerationState generation = generationStates.get(persona.getId());
    if (generation != null && generation.state() == PersonaContextCacheState.GENERATING) {
      return new CacheSnapshot(generation.state(), value, null);
    }
    if (generation != null && generation.state() == PersonaContextCacheState.FAILED) {
      return new CacheSnapshot(generation.state(), value, generation.error());
    }
    return new CacheSnapshot(
        value == null ? PersonaContextCacheState.STALE : PersonaContextCacheState.FRESH,
        value,
        null);
  }

  private void invalidate(UUID personaId, String definitionHash) {
    provider.del(
        keys.personaContextMarkdown(personaId, definitionHash),
        keys.personaContextJson(personaId, definitionHash));
    local.invalidate(localKey(personaId, definitionHash));
  }

  protected PersonaContextBuilder.MaterializedPersonaContext build(Persona persona) {
    return new PersonaContextBuilder(persona).build();
  }

  private PersonaContextBuilder.MaterializedPersonaContext getLocal(String key) {
    LocalEntry entry = local.getIfPresent(key);
    PersonaContextBuilder.MaterializedPersonaContext result = null;
    if (entry != null) {
      if (entry.expiresAtNanos() > System.nanoTime()) {
        result = entry.value();
      } else {
        local.invalidate(key);
      }
    }
    return result;
  }

  private PersonaContextBuilder.MaterializedPersonaContext getRedis(
      UUID personaId, String definitionHash) {
    List<Optional<String>> values =
        provider.mget(
            List.of(
                keys.personaContextMarkdown(personaId, definitionHash),
                keys.personaContextJson(personaId, definitionHash)));
    if (values.size() != 2 || values.get(0).isEmpty() || values.get(1).isEmpty()) {
      return null;
    }
    try {
      PersonaContext context = JsonUtils.readValue(values.get(1).get(), PersonaContext.class);
      return new PersonaContextBuilder.MaterializedPersonaContext(context, values.get(0).get());
    } catch (RuntimeException exception) {
      LOG.warn("Ignoring invalid cached persona context for {}", personaId, exception);
      return null;
    }
  }

  private PersonaContextBuilder.MaterializedPersonaContext waitForWinner(
      UUID personaId, String definitionHash) {
    for (int attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
      try {
        TimeUnit.MILLISECONDS.sleep(POLL_MILLIS);
      } catch (InterruptedException exception) {
        Thread.currentThread().interrupt();
        break;
      }
      PersonaContextBuilder.MaterializedPersonaContext cached = getRedis(personaId, definitionHash);
      if (cached != null) {
        return cached;
      }
    }
    return null;
  }

  private void cacheIfEligible(
      String localKey,
      PersonaContextBuilder.MaterializedPersonaContext value,
      int ttlSeconds,
      boolean writeRedis,
      UUID personaId,
      String definitionHash) {
    String json = JsonUtils.pojoToJson(value.context());
    if (value.markdown().length() > MAX_CACHEABLE_CHARS || json.length() > MAX_CACHEABLE_CHARS) {
      LOG.warn("Persona context {} exceeds the cache safety limit", personaId);
      return;
    }
    putLocal(localKey, value, ttlSeconds);
    if (writeRedis) {
      Duration ttl = Duration.ofSeconds(ttlSeconds);
      provider.set(keys.personaContextMarkdown(personaId, definitionHash), value.markdown(), ttl);
      provider.set(keys.personaContextJson(personaId, definitionHash), json, ttl);
    }
  }

  private void putLocal(
      String key, PersonaContextBuilder.MaterializedPersonaContext value, int ttlSeconds) {
    local.put(
        key,
        new LocalEntry(
            value, System.nanoTime() + TimeUnit.SECONDS.toNanos(Math.max(1, ttlSeconds))));
  }

  private void markFresh(Persona persona) {
    if (persona != null && persona.getId() != null) {
      generationStates.remove(persona.getId());
    }
  }

  private void markFailed(Persona persona, RuntimeException exception) {
    if (persona != null && persona.getId() != null) {
      generationStates.put(
          persona.getId(),
          new GenerationState(PersonaContextCacheState.FAILED, nullOrMessage(exception)));
    }
  }

  private static String nullOrMessage(RuntimeException exception) {
    return exception.getMessage() == null
        ? "Persona context compilation failed."
        : exception.getMessage();
  }

  private static String localKey(UUID personaId, String definitionHash) {
    return personaId + ":" + definitionHash;
  }

  public enum CacheStatus {
    HIT,
    MISS,
    BYPASS
  }

  public record CachedResult(
      PersonaContextBuilder.MaterializedPersonaContext value, CacheStatus status) {}

  public record CacheSnapshot(
      PersonaContextCacheState state,
      PersonaContextBuilder.MaterializedPersonaContext value,
      String error) {}

  private record LocalEntry(
      PersonaContextBuilder.MaterializedPersonaContext value, long expiresAtNanos) {}

  private record GenerationState(PersonaContextCacheState state, String error) {}
}
