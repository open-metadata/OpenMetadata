/*
 *  Copyright 2021 Collate
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
package org.openmetadata.service.security.session;

import java.util.List;
import java.util.Optional;

/**
 * Storage backend for {@link UserSession}. Implementations exist for the JDBC-backed
 * {@code user_session} table ({@code JdbcSessionStore} — default) and for Redis
 * ({@code RedisSessionStore} — used when Redis is configured via {@code cache.provider: redis}).
 *
 * <p>All operations are safe to call concurrently from any thread. {@link #updateIfVersion}
 * provides the optimistic-locking primitive that {@link SessionService} layers its refresh,
 * revoke, and session-limit enforcement on.
 */
public interface SessionStore {

  Optional<UserSession> findById(String sessionId);

  /**
   * Status filter used by per-user session-cap enforcement. Returns up to {@code limit} sessions
   * ordered by {@code lastAccessedAt ASC} so the oldest sessions are evicted first when the cap is
   * exceeded.
   */
  List<UserSession> findByUserIdAndStatus(String userId, SessionStatus status, int limit);

  /**
   * Returns sessions whose absolute-or-idle timeout has passed and that are still in a non-terminal
   * status. The {@link SessionService} cleanup loop calls this to mark them {@code EXPIRED}.
   *
   * <p>Implementations backed by an external store with intrinsic TTL (e.g. Redis) MAY return an
   * empty list — the store-side TTL already removes those rows and there is nothing the service
   * needs to do.
   */
  List<UserSession> findSessionsToExpire(long now, int limit);

  /**
   * Returns terminal-status sessions older than {@code cutoff} that should be physically deleted.
   * Implementations with intrinsic TTL MAY return an empty list.
   */
  List<UserSession> findSessionsToPrune(long cutoff, int limit);

  void create(UserSession session);

  /**
   * Atomic compare-and-set on the {@code version} field. Returns {@code true} when the stored
   * version matched {@code expectedVersion} and the row was overwritten with {@code session};
   * {@code false} when the version did not match (caller must reload and retry).
   */
  boolean updateIfVersion(UserSession session, long expectedVersion);

  void delete(String sessionId);

  int deleteByIds(List<String> sessionIds);
}
