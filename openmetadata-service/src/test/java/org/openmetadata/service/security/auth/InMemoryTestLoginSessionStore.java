/*
 *  Copyright 2025 Collate.
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

import static org.openmetadata.service.security.auth.TestLoginSessions.CREDENTIAL_TEST_WINDOW;
import static org.openmetadata.service.security.auth.TestLoginSessions.SESSION_TTL;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import org.openmetadata.schema.system.TestLoginResult;

/**
 * The database store's semantics in memory: the same states and the same conditional transitions,
 * on a clock the test controls. One instance shared by several {@link TestLoginRoundTrip}s stands
 * for several servers sharing the database.
 */
final class InMemoryTestLoginSessionStore implements TestLoginSessionStore {
  private enum State {
    PENDING,
    CLAIMED,
    COMPLETED
  }

  private record Row(
      TestLoginSessionEntry entry, State state, Long credentialsSubmittedAt, long expiresAt) {}

  private final Map<String, Row> rows = new ConcurrentHashMap<>();
  private final AtomicLong now = new AtomicLong(1_000_000L);

  void advance(Duration duration) {
    now.addAndGet(duration.toMillis());
  }

  @Override
  public void put(TestLoginSessionEntry entry) {
    State state = entry.isCompleted() ? State.COMPLETED : State.PENDING;
    rows.put(entry.testSessionId(), new Row(entry, state, null, expiry()));
  }

  @Override
  public Optional<TestLoginSessionEntry> find(String testSessionId) {
    return Optional.ofNullable(rows.get(testSessionId)).filter(this::isLive).map(Row::entry);
  }

  @Override
  public boolean complete(String testSessionId, TestLoginResult result) {
    AtomicBoolean completed = new AtomicBoolean();
    rows.computeIfPresent(
        testSessionId,
        (id, row) -> {
          if (!isLive(row) || row.state() == State.COMPLETED) {
            return row;
          }
          completed.set(true);
          return new Row(
              row.entry().withResult(result),
              State.COMPLETED,
              row.credentialsSubmittedAt(),
              expiry());
        });
    return completed.get();
  }

  @Override
  public boolean claimForCredentials(String testSessionId) {
    AtomicBoolean claimed = new AtomicBoolean();
    rows.computeIfPresent(
        testSessionId,
        (id, row) -> {
          if (!isLive(row) || row.state() != State.PENDING) {
            return row;
          }
          claimed.set(true);
          return new Row(row.entry(), State.CLAIMED, now.get(), row.expiresAt());
        });
    return claimed.get();
  }

  @Override
  public int countRecentCredentialTests(String adminPrincipal) {
    long windowStart = now.get() - CREDENTIAL_TEST_WINDOW.toMillis();
    return (int)
        rows.values().stream()
            .filter(row -> row.entry().isOwnedBy(adminPrincipal))
            .filter(
                row ->
                    row.credentialsSubmittedAt() != null
                        && row.credentialsSubmittedAt() > windowStart)
            .count();
  }

  @Override
  public int countLive(String adminPrincipal) {
    return (int)
        rows.values().stream()
            .filter(row -> row.entry().isOwnedBy(adminPrincipal))
            .filter(this::isLive)
            .count();
  }

  private boolean isLive(Row row) {
    return row.expiresAt() > now.get();
  }

  private long expiry() {
    return now.get() + SESSION_TTL.toMillis();
  }
}
