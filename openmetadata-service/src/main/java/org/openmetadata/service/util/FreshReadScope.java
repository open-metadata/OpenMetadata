/*
 *  Copyright 2024 Collate
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

/**
 * Thread-scoped marker for reads that decide what happens next: they answer from the database, never
 * from a cache that can be behind it.
 *
 * <p>Inside the scope an entity read skips the in-process entity caches, does not answer from what
 * this thread read earlier in the request, and neither trusts nor records a not-found marker, which
 * is written as a delete runs and can briefly call an existing entity missing. Relations are still
 * resolved through the shared Redis caches, which every write evicts once it commits.
 *
 * <p>Governance workflows use this. Their decisions are gates ("does this term have reviewers?"),
 * and a stale answer silently routes an entity to the wrong terminal status with no error and no
 * retry. The in-JVM L1 is invalidated on write locally and, when Redis is configured, across nodes
 * via pub/sub; but with Redis disabled a multi-node deployment has no cross-node invalidation at
 * all, so another node's L1 can answer from before the write. Alerting uses it for the stored alert,
 * whose answer can remove a job or retire an alert's records. Both read rarely, so paying for a
 * fresh read is the cheaper side of the trade.
 *
 * <p>The scope changes reads only. It must not also enter {@link
 * org.openmetadata.service.cache.EntityCacheBypass}: that scope skips the Redis evictions as well,
 * so a write made inside it would leave stale entries behind.
 *
 * <p>Scope it with try-with-resources so the marker is always restored, including on exceptions:
 *
 * <pre>{@code
 * try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
 * }
 * }</pre>
 *
 * <p>{@link #enter()} restores the previous value rather than clearing, so nesting is safe.
 */
public final class FreshReadScope {

  private static final ThreadLocal<Boolean> ACTIVE = ThreadLocal.withInitial(() -> Boolean.FALSE);

  private FreshReadScope() {}

  /** True when the calling thread is inside a fresh-read scope. */
  public static boolean isActive() {
    return Boolean.TRUE.equals(ACTIVE.get());
  }

  /** Enters a fresh-read scope. Close the returned handle to restore the previous state. */
  public static Handle enter() {
    boolean previous = ACTIVE.get();
    ACTIVE.set(Boolean.TRUE);
    return () -> ACTIVE.set(previous);
  }

  @FunctionalInterface
  public interface Handle extends AutoCloseable {
    @Override
    void close();
  }
}
