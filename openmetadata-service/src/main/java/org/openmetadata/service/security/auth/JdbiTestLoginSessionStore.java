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

import java.time.Clock;
import java.util.Optional;
import org.openmetadata.schema.system.TestLoginProtocol;
import org.openmetadata.schema.system.TestLoginResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords;

/**
 * Keeps Test Login state in the database, as the MCP flow keeps its pending authorizations, so that
 * every server sees every test and the per-admin credential limit holds across all of them. A
 * pending test's candidate configuration carries live secrets: it is stored sealed (see {@link
 * TestLoginPendingState}), cleared as soon as the test completes, and cleared by the {@link
 * TestLoginSessionSweeper} within a minute of the test expiring.
 */
final class JdbiTestLoginSessionStore implements TestLoginSessionStore {
  private static final String PENDING = "pending";
  private static final String COMPLETED = "completed";

  private final CollectionDAO.SsoTestLoginSessionDAO dao;
  private final Clock clock;

  JdbiTestLoginSessionStore(CollectionDAO.SsoTestLoginSessionDAO dao, Clock clock) {
    this.dao = dao;
    this.clock = clock;
  }

  static JdbiTestLoginSessionStore fromCollectionDao() {
    return new JdbiTestLoginSessionStore(
        Entity.getCollectionDAO().ssoTestLoginSessionDAO(), Clock.systemUTC());
  }

  @Override
  public void put(TestLoginSessionEntry entry) {
    long now = clock.millis();
    dao.insert(
        entry.testSessionId(),
        entry.adminPrincipal(),
        entry.protocol().value(),
        entry.isCompleted() ? COMPLETED : PENDING,
        TestLoginPendingState.seal(entry),
        entry.isCompleted() ? JsonUtils.pojoToJson(entry.result()) : null,
        now + SESSION_TTL.toMillis());
  }

  @Override
  public Optional<TestLoginSessionEntry> find(String testSessionId) {
    return Optional.ofNullable(dao.findLive(testSessionId, clock.millis()))
        .map(JdbiTestLoginSessionStore::toEntry);
  }

  @Override
  public boolean complete(String testSessionId, TestLoginResult result) {
    long now = clock.millis();
    return dao.complete(
            testSessionId, JsonUtils.pojoToJson(result), now + SESSION_TTL.toMillis(), now)
        == 1;
  }

  @Override
  public boolean claimForCredentials(String testSessionId) {
    return dao.claimForCredentials(testSessionId, clock.millis()) == 1;
  }

  @Override
  public int countRecentCredentialTests(String adminPrincipal) {
    return dao.countCredentialTestsSince(
        adminPrincipal, clock.millis() - CREDENTIAL_TEST_WINDOW.toMillis());
  }

  @Override
  public int countLive(String adminPrincipal) {
    return dao.countLive(adminPrincipal, clock.millis());
  }

  /**
   * Clears the secrets of every expired test, and deletes its row once it no longer counts towards
   * the credential-test limit.
   */
  void removeExpired() {
    long now = clock.millis();
    dao.clearExpiredSecrets(now);
    dao.deleteExpired(now, now - CREDENTIAL_TEST_WINDOW.toMillis());
  }

  private static TestLoginSessionEntry toEntry(OAuthRecords.SsoTestLoginSession row) {
    TestLoginProtocol protocol = TestLoginProtocol.fromValue(row.protocol());
    if (row.result() != null) {
      return TestLoginSessionEntry.completed(
          row.testSessionId(),
          row.adminPrincipal(),
          protocol,
          JsonUtils.readValue(row.result(), TestLoginResult.class));
    }
    TestLoginPendingState pending = TestLoginPendingState.open(row.pendingState());
    return TestLoginSessionEntry.pending(
        row.testSessionId(),
        row.adminPrincipal(),
        pending.candidate(),
        protocol,
        pending.handshake());
  }
}
