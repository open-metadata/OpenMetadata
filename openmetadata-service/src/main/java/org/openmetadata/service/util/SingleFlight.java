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

package org.openmetadata.service.util;

import com.google.common.util.concurrent.Uninterruptibles;
import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;

/**
 * Runs at most one task per key at a time, on the caller's thread and outside any monitor; concurrent
 * callers for the same key wait for that task's result.
 *
 * <p>Use it for cache misses that do I/O. Guava's {@code LoadingCache.get}, Caffeine's {@code get}
 * and {@code ConcurrentHashMap.compute} all run the loader inside {@code synchronized}, and on JDK 21
 * a virtual thread that blocks there keeps its carrier thread. Enough of them and the virtual-thread
 * scheduler stops. Waiting on a {@link CompletableFuture} unmounts instead.
 *
 * <p>Entries live only while their task runs, so the map is bounded by the number of concurrent
 * misses rather than by the key space. See
 * ADR:2026-10-14-cache-misses-that-do-io-load-outside-the-cache-lock.
 */
public final class SingleFlight<K, V> {

  private record Flight<V>(Thread leader, CompletableFuture<V> result) {}

  private final ConcurrentHashMap<K, Flight<V>> inFlight = new ConcurrentHashMap<>();

  /**
   * Returns the result of {@code task} for {@code key}, running it here unless another thread already
   * is. A task failure surfaces as an {@link ExecutionException} carrying the task's exception, the
   * same shape {@code LoadingCache.get} throws.
   */
  public V run(K key, Callable<V> task) throws ExecutionException {
    Flight<V> ownFlight = new Flight<>(Thread.currentThread(), new CompletableFuture<>());
    Flight<V> runningFlight = inFlight.putIfAbsent(key, ownFlight);
    if (runningFlight == null) {
      lead(key, ownFlight, task);
      runningFlight = ownFlight;
    } else if (runningFlight.leader() == Thread.currentThread()) {
      throw new IllegalStateException("Recursive load of key %s".formatted(key));
    }
    return Uninterruptibles.getUninterruptibly(runningFlight.result());
  }

  private void lead(K key, Flight<V> flight, Callable<V> task) {
    try {
      flight.result().complete(task.call());
    } catch (Exception e) {
      flight.result().completeExceptionally(e);
    } finally {
      // An Error skips the catch; settle the future anyway or every later caller for this key
      // would wait on it forever.
      flight
          .result()
          .completeExceptionally(
              new IllegalStateException("Load of key %s ended without a result".formatted(key)));
      inFlight.remove(key, flight);
    }
  }
}
