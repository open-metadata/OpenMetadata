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
package org.openmetadata.service.cache;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NotFoundCacheTest {
  @Mock private CacheProvider provider;

  private final Map<String, String> values = new HashMap<>();
  private CacheKeys keys;
  private NotFoundCache cache;

  @BeforeEach
  void setUp() {
    CacheConfig config = new CacheConfig();
    config.notFoundTtlSeconds = 30;
    keys = new CacheKeys("test");
    cache = new NotFoundCache(provider, keys, config);

    when(provider.available()).thenReturn(true);
    when(provider.get(anyString()))
        .thenAnswer(invocation -> Optional.ofNullable(values.get(invocation.getArgument(0))));
    lenient()
        .when(provider.mget(any()))
        .thenAnswer(
            invocation -> {
              List<String> cacheKeys = invocation.getArgument(0);
              if (cacheKeys.stream().anyMatch(Objects::isNull)) {
                throw new IllegalArgumentException("Cache keys must not be null");
              }
              return cacheKeys.stream().map(key -> Optional.ofNullable(values.get(key))).toList();
            });
    lenient()
        .when(provider.setIfAbsent(anyString(), anyString(), any()))
        .thenAnswer(
            invocation ->
                values.putIfAbsent(invocation.getArgument(0), invocation.getArgument(1)) == null);
    lenient()
        .doAnswer(
            invocation -> {
              values.put(invocation.getArgument(0), invocation.getArgument(1));
              return null;
            })
        .when(provider)
        .set(anyString(), anyString(), any());
    lenient()
        .doAnswer(
            invocation -> {
              for (Object argument : invocation.getArguments()) {
                if (argument instanceof String[] keys) {
                  for (String key : keys) values.remove(key);
                } else {
                  values.remove((String) argument);
                }
              }
              return null;
            })
        .when(provider)
        .del(any(String[].class));
    lenient()
        .when(provider.deleteIfValue(anyString(), anyString()))
        .thenAnswer(
            invocation ->
                values.remove(
                    invocation.getArgument(0, String.class),
                    invocation.getArgument(1, String.class)));
    lenient()
        .when(provider.deleteIfValues(anyMap()))
        .thenAnswer(
            invocation -> {
              Map<String, String> expectedValues = invocation.getArgument(0);
              int deleted = 0;
              for (Map.Entry<String, String> entry : expectedValues.entrySet()) {
                if (values.remove(entry.getKey(), entry.getValue())) deleted++;
              }
              return deleted;
            });
  }

  @Test
  void hardDeleteMarkerIsDistinctAndCannotBeDowngradedByANormalMiss() {
    UUID id = UUID.randomUUID();
    String fqn = "service.entity";

    cache.markNotFoundById("table", id);
    cache.markNotFoundByName("table", fqn);
    assertTrue(cache.isMarkedNotFoundById("table", id));
    assertFalse(cache.isMarkedHardDeletedById("table", id));

    cache.markHardDeletedById("table", id);
    cache.markHardDeletedByName("table", fqn, id);
    cache.markNotFoundById("table", id);
    cache.markNotFoundByName("table", fqn);

    assertTrue(cache.isMarkedHardDeletedById("table", id));
    assertTrue(cache.isMarkedHardDeletedByName("table", fqn));
  }

  @Test
  void entityInvalidationClearsHardDeleteMarkersForRecreation() {
    UUID id = UUID.randomUUID();
    String fqn = "service.entity";
    cache.markHardDeletedById("table", id);
    cache.markHardDeletedByName("table", fqn, id);

    cache.invalidate("table", id, fqn);

    assertFalse(cache.isMarkedNotFoundById("table", id));
    assertFalse(cache.isMarkedNotFoundByName("table", fqn));
  }

  @Test
  void knownMissingDecisionReadsEachMarkerOnce() {
    UUID id = UUID.randomUUID();
    cache.markNotFoundById("table", id);
    clearInvocations(provider);

    assertTrue(cache.isKnownMissingById("table", id, true));

    verify(provider, times(1)).get(anyString());
  }

  @Test
  void updateInvalidationCannotEraseAConcurrentHardDelete() {
    UUID id = UUID.randomUUID();
    String fqn = "service.entity";
    cache.markHardDeletedById("table", id);
    cache.markHardDeletedByName("table", fqn, id);

    assertTrue(cache.invalidatePreservingHardDelete("table", id, fqn));

    assertTrue(cache.isMarkedHardDeletedById("table", id));
    assertTrue(cache.isMarkedHardDeletedByName("table", fqn));
  }

  @Test
  void updateInvalidationClearsNormalMissesAndAReusedNameFromAnotherEntity() {
    UUID id = UUID.randomUUID();
    UUID deletedId = UUID.randomUUID();
    String fqn = "service.entity";
    cache.markNotFoundById("table", id);
    cache.markHardDeletedByName("table", fqn, deletedId);

    assertFalse(cache.invalidatePreservingHardDelete("table", id, fqn));

    assertFalse(cache.isMarkedNotFoundById("table", id));
    assertFalse(cache.isMarkedNotFoundByName("table", fqn));
  }

  @Test
  void updateInvalidationSupportsEntityWithoutFullyQualifiedName() {
    UUID id = UUID.randomUUID();
    cache.markNotFoundById("table", id);

    assertFalse(cache.invalidatePreservingHardDelete("table", id, null));

    assertFalse(cache.isMarkedNotFoundById("table", id));
  }

  @Test
  void batchCreateClearsAReusedNameWithoutErasingTheOldIdTombstone() {
    UUID deletedId = UUID.randomUUID();
    UUID createdId = UUID.randomUUID();
    String fqn = "service.entity";
    cache.markHardDeletedById("table", deletedId);
    cache.markHardDeletedByName("table", fqn, deletedId);
    cache.markNotFoundById("table", createdId);

    cache.invalidateAll("table", Map.of(createdId, fqn));

    assertTrue(cache.isMarkedHardDeletedById("table", deletedId));
    assertFalse(cache.isMarkedNotFoundById("table", createdId));
    assertFalse(cache.isMarkedNotFoundByName("table", fqn));
  }

  @Test
  void hardDeleteThatWinsDuringCompareAndDeleteIsPreserved() {
    UUID id = UUID.randomUUID();
    cache.markNotFoundById("table", id);
    when(provider.deleteIfValue(anyString(), eq("not-found")))
        .thenAnswer(
            invocation -> {
              String key = invocation.getArgument(0, String.class);
              values.put(key, "hard-deleted");
              return values.remove(key, invocation.getArgument(1, String.class));
            });

    assertTrue(cache.invalidatePreservingHardDelete("table", id, null));

    assertTrue(cache.isMarkedHardDeletedById("table", id));
  }

  @Test
  void batchCreateCannotEraseAConcurrentHardDelete() {
    UUID id = UUID.randomUUID();
    String fqn = "service.entity";
    cache.markNotFoundById("table", id);
    cache.markNotFoundByName("table", fqn);
    when(provider.deleteIfValues(anyMap()))
        .thenAnswer(
            invocation -> {
              Map<String, String> expectedValues = invocation.getArgument(0);
              expectedValues.keySet().forEach(key -> values.put(key, "hard-deleted"));
              return 0;
            });

    assertTrue(cache.invalidateAll("table", Map.of(id, fqn)).contains(id));

    assertTrue(cache.isMarkedHardDeletedById("table", id));
    assertTrue(cache.isMarkedHardDeletedByName("table", fqn));
  }

  @Test
  void legacyNormalMissIsReadAndClearedAfterBatchCreate() {
    UUID id = UUID.randomUUID();
    String fqn = "service.entity";
    values.put(keys.notFoundById("table", id), "1");
    values.put(keys.notFoundByName("table", fqn), "1");

    assertTrue(cache.isKnownMissingById("table", id, true));
    cache.invalidateAll("table", Map.of(id, fqn));

    assertFalse(cache.isMarkedNotFoundById("table", id));
    assertFalse(cache.isMarkedNotFoundByName("table", fqn));
  }
}
