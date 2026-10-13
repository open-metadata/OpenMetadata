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

import java.util.Optional;
import org.openmetadata.schema.system.TestLoginResult;
import org.openmetadata.service.exception.EntityNotFoundException;

/**
 * Where a Test Login is kept between the requests it spans: start, the identity provider's
 * callback, the result polls and, for LDAP/Basic, the credentials. With more than one server those
 * requests can reach different ones, so the store is shared by all of them ({@link
 * JdbiTestLoginSessionStore}), and every change of state is atomic across them.
 */
interface TestLoginSessionStore {
  /** Stores a new test. A test that could not even start is stored already completed. */
  void put(TestLoginSessionEntry entry);

  /** A test that has not expired, whatever its state. */
  Optional<TestLoginSessionEntry> find(String testSessionId);

  /**
   * Records the outcome. The first completion wins: a replayed or forged callback for a finished
   * test cannot overwrite the result the admin is about to be shown.
   *
   * @return whether this call completed the test
   */
  boolean complete(String testSessionId, TestLoginResult result);

  /**
   * Takes a pending credentials test for verification. Only one request can, so two concurrent
   * submissions for the same test cannot both have their password checked.
   *
   * @return whether this call claimed the test
   */
  boolean claimForCredentials(String testSessionId);

  /**
   * The credential tests this admin claimed within {@link TestLoginSessions#CREDENTIAL_TEST_WINDOW},
   * on any server.
   */
  int countRecentCredentialTests(String adminPrincipal);

  /** The tests this admin has that have not expired. */
  int countLive(String adminPrincipal);

  /** The test a callback may complete: one that exists and has not completed yet. */
  default Optional<TestLoginSessionEntry> findPending(String testSessionId) {
    return find(testSessionId).filter(entry -> !entry.isCompleted());
  }

  /**
   * The test the given admin started. Another admin's test answers exactly like an unknown id, so a
   * session id's existence cannot be probed.
   */
  default TestLoginSessionEntry requireOwnedBy(String testSessionId, String adminPrincipal) {
    return find(testSessionId)
        .filter(entry -> entry.isOwnedBy(adminPrincipal))
        .orElseThrow(
            () ->
                new EntityNotFoundException(
                    "Test login session not found or expired. Start a new test login."));
  }
}
