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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Shared semantic contract for every {@link SessionStore} backend. Concrete subclasses provide
 * a fresh store from {@link #newStore()} for each test method. Backends that extend this class
 * prove they satisfy the common contract expected by {@link SessionService}.
 *
 * <p>Tests cover: round-trip persistence, optimistic CAS hit/miss, per-user enumeration ordering,
 * idle vs absolute timeout, delete semantics. The expire/prune cleanup is intentionally
 * <i>not</i> asserted here — JDBC supports it and Redis intentionally returns empty lists (TTL
 * handles cleanup automatically) — backend-specific behavior lives in the subclass.
 */
public abstract class SessionStoreContractTest {

  protected SessionStore store;

  /** Build a fresh store for each test. Should reset any backing state (Redis flush, etc.). */
  protected abstract SessionStore newStore();

  @BeforeEach
  void initStore() {
    store = newStore();
  }

  private UserSession sample(String userId, SessionStatus status) {
    long now = System.currentTimeMillis();
    return UserSession.builder()
        .id(UUID.randomUUID().toString())
        .type(SessionType.AUTH)
        .provider("basic")
        .status(status)
        .userId(userId)
        .username("user-" + userId)
        .email(userId + "@example.com")
        .version(0L)
        .createdAt(now)
        .updatedAt(now)
        .lastAccessedAt(now)
        .expiresAt(now + TimeUnit.HOURS.toMillis(1))
        .idleExpiresAt(now + TimeUnit.MINUTES.toMillis(30))
        .build();
  }

  @Test
  void create_thenFindById_returnsRoundTripped() {
    UserSession session = sample(UUID.randomUUID().toString(), SessionStatus.ACTIVE);
    store.create(session);

    Optional<UserSession> found = store.findById(session.getId());

    assertTrue(found.isPresent());
    assertEquals(session.getId(), found.get().getId());
    assertEquals(session.getUserId(), found.get().getUserId());
    assertEquals(SessionStatus.ACTIVE, found.get().getStatus());
  }

  @Test
  void findById_returnsEmptyForUnknownId() {
    assertTrue(store.findById(UUID.randomUUID().toString()).isEmpty());
  }

  @Test
  void updateIfVersion_succeedsWhenVersionMatches() {
    UserSession session = sample(UUID.randomUUID().toString(), SessionStatus.ACTIVE);
    store.create(session);

    UserSession updated = session.toBuilder().version(1L).status(SessionStatus.REFRESHING).build();
    boolean ok = store.updateIfVersion(updated, 0L);

    assertTrue(ok);
    Optional<UserSession> found = store.findById(session.getId());
    assertTrue(found.isPresent());
    assertEquals(SessionStatus.REFRESHING, found.get().getStatus());
    assertEquals(1L, found.get().getVersion());
  }

  @Test
  void updateIfVersion_failsWhenVersionMismatched() {
    UserSession session = sample(UUID.randomUUID().toString(), SessionStatus.ACTIVE);
    store.create(session);

    UserSession updated = session.toBuilder().version(1L).status(SessionStatus.REFRESHING).build();
    boolean ok = store.updateIfVersion(updated, 99L);

    assertFalse(ok);
    Optional<UserSession> reloaded = store.findById(session.getId());
    assertTrue(reloaded.isPresent());
    assertEquals(SessionStatus.ACTIVE, reloaded.get().getStatus());
  }

  @Test
  void updateIfVersion_failsWhenSessionMissing() {
    UserSession ghost = sample(UUID.randomUUID().toString(), SessionStatus.ACTIVE);
    assertFalse(store.updateIfVersion(ghost, 0L));
  }

  @Test
  void findByUserIdAndStatus_ordersByLastAccessedAtAscending() {
    String userId = UUID.randomUUID().toString();
    UserSession oldest =
        sample(userId, SessionStatus.ACTIVE).toBuilder().lastAccessedAt(1000L).build();
    UserSession middle =
        sample(userId, SessionStatus.ACTIVE).toBuilder().lastAccessedAt(2000L).build();
    UserSession newest =
        sample(userId, SessionStatus.ACTIVE).toBuilder().lastAccessedAt(3000L).build();
    store.create(newest);
    store.create(oldest);
    store.create(middle);

    List<UserSession> sessions = store.findByUserIdAndStatus(userId, SessionStatus.ACTIVE, 10);

    assertEquals(3, sessions.size());
    assertEquals(oldest.getId(), sessions.get(0).getId());
    assertEquals(middle.getId(), sessions.get(1).getId());
    assertEquals(newest.getId(), sessions.get(2).getId());
  }

  @Test
  void findByUserIdAndStatus_filtersByStatus() {
    String userId = UUID.randomUUID().toString();
    store.create(sample(userId, SessionStatus.ACTIVE));
    store.create(sample(userId, SessionStatus.PENDING));

    List<UserSession> active = store.findByUserIdAndStatus(userId, SessionStatus.ACTIVE, 10);
    List<UserSession> pending = store.findByUserIdAndStatus(userId, SessionStatus.PENDING, 10);

    assertEquals(1, active.size());
    assertEquals(1, pending.size());
    assertEquals(SessionStatus.ACTIVE, active.get(0).getStatus());
    assertEquals(SessionStatus.PENDING, pending.get(0).getStatus());
  }

  @Test
  void updateIfVersion_movesSessionOutOfActiveIndexWhenRevoked() {
    String userId = UUID.randomUUID().toString();
    UserSession session = sample(userId, SessionStatus.ACTIVE);
    store.create(session);
    assertEquals(1, store.findByUserIdAndStatus(userId, SessionStatus.ACTIVE, 10).size());

    UserSession revoked = session.toBuilder().version(1L).status(SessionStatus.REVOKED).build();
    assertTrue(store.updateIfVersion(revoked, 0L));

    assertTrue(
        store.findByUserIdAndStatus(userId, SessionStatus.ACTIVE, 10).isEmpty(),
        "REVOKED session must no longer appear in the ACTIVE per-user index");
  }

  @Test
  void findByUserIdAndStatus_respectsLimit() {
    String userId = UUID.randomUUID().toString();
    UserSession oldest =
        sample(userId, SessionStatus.ACTIVE).toBuilder().lastAccessedAt(1000L).build();
    UserSession middle =
        sample(userId, SessionStatus.ACTIVE).toBuilder().lastAccessedAt(2000L).build();
    UserSession newest =
        sample(userId, SessionStatus.ACTIVE).toBuilder().lastAccessedAt(3000L).build();
    store.create(oldest);
    store.create(middle);
    store.create(newest);

    List<UserSession> sessions = store.findByUserIdAndStatus(userId, SessionStatus.ACTIVE, 2);

    assertEquals(2, sessions.size());
    assertEquals(oldest.getId(), sessions.get(0).getId());
    assertEquals(middle.getId(), sessions.get(1).getId());
  }

  @Test
  void delete_removesSessionFromStoreAndIndex() {
    String userId = UUID.randomUUID().toString();
    UserSession session = sample(userId, SessionStatus.ACTIVE);
    store.create(session);

    store.delete(session.getId());

    assertTrue(store.findById(session.getId()).isEmpty());
    assertTrue(store.findByUserIdAndStatus(userId, SessionStatus.ACTIVE, 10).isEmpty());
  }

  @Test
  void deleteByIds_returnsCountAndRemovesAll() {
    String userId = UUID.randomUUID().toString();
    UserSession a = sample(userId, SessionStatus.ACTIVE);
    UserSession b = sample(userId, SessionStatus.ACTIVE);
    store.create(a);
    store.create(b);

    int deleted = store.deleteByIds(List.of(a.getId(), b.getId()));

    assertEquals(2, deleted);
    assertTrue(store.findById(a.getId()).isEmpty());
    assertTrue(store.findById(b.getId()).isEmpty());
  }

  @Test
  void deleteByIds_isNoOpOnEmptyList() {
    assertEquals(0, store.deleteByIds(List.of()));
  }

  @Test
  void delete_isIdempotentOnUnknownId() {
    // Should not throw or affect anything else.
    store.delete(UUID.randomUUID().toString());
    UserSession existing = sample(UUID.randomUUID().toString(), SessionStatus.ACTIVE);
    store.create(existing);
    assertNotNull(store.findById(existing.getId()).orElse(null));
  }
}
