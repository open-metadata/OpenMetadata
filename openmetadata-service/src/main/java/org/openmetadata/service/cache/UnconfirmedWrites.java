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

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Keys whose latest write from this server may not have reached Redis: the provider skipped the
 * write while it was unavailable, or the command failed. Redis can still hold an older value for
 * such a key and nothing replaces it before its TTL, so the provider deletes these keys once Redis
 * answers again.
 *
 * <p>Bounded: past {@code maxKeys} further keys are only counted, and they keep their older value
 * until their TTL, as they did before this tracking existed.
 */
final class UnconfirmedWrites {
  private final int maxKeys;
  private final Map<String, Long> keys = new ConcurrentHashMap<>();
  private final AtomicLong recordSequence = new AtomicLong();
  private final AtomicLong untrackedKeys = new AtomicLong();

  UnconfirmedWrites(int maxKeys) {
    this.maxKeys = maxKeys;
  }

  void record(Collection<String> keysToRecord) {
    keysToRecord.stream().filter(Objects::nonNull).forEach(this::recordKey);
  }

  boolean isEmpty() {
    return keys.isEmpty();
  }

  /** Up to {@code limit} keys, each with the sequence it was last recorded at. */
  Map<String, Long> snapshot(int limit) {
    Map<String, Long> batch = new LinkedHashMap<>();
    keys.entrySet().stream().limit(limit).forEach(e -> batch.put(e.getKey(), e.getValue()));
    return batch;
  }

  /** Forgets deleted keys, except any recorded again after {@code batch} was taken. */
  void forget(Map<String, Long> batch) {
    batch.forEach(keys::remove);
  }

  /** Keys dropped for lack of room since the last call. */
  long takeUntrackedCount() {
    return untrackedKeys.getAndSet(0);
  }

  private void recordKey(String key) {
    if (hasRoomFor(key)) {
      keys.put(key, recordSequence.incrementAndGet());
    } else {
      untrackedKeys.incrementAndGet();
    }
  }

  private boolean hasRoomFor(String key) {
    return keys.size() < maxKeys || keys.containsKey(key);
  }
}
