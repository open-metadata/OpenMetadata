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

import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.system.TestLoginProtocol;
import org.openmetadata.schema.system.TestLoginResult;

/**
 * One Test Login. While pending it carries the candidate configuration — including its client
 * secret or LDAP bind password — so it lives only in {@link TestLoginSessionCache}, is never
 * persisted, and its {@link #toString()} omits the candidate and the handshake. Once completed only
 * the result is kept: the secrets are dropped as soon as they are no longer needed.
 *
 * @param candidate {@code null} once completed
 * @param handshake {@code null} once completed
 * @param result {@code null} until the round-trip completes
 */
public record TestLoginSessionEntry(
    String testSessionId,
    String adminPrincipal,
    SecurityConfiguration candidate,
    TestLoginProtocol protocol,
    TestLoginHandshake handshake,
    TestLoginResult result) {

  public static TestLoginSessionEntry pending(
      String testSessionId,
      String adminPrincipal,
      SecurityConfiguration candidate,
      TestLoginProtocol protocol,
      TestLoginHandshake handshake) {
    return new TestLoginSessionEntry(
        testSessionId, adminPrincipal, candidate, protocol, handshake, null);
  }

  /** A test that is already decided, e.g. one that could not even start against the candidate. */
  public static TestLoginSessionEntry completed(
      String testSessionId,
      String adminPrincipal,
      TestLoginProtocol protocol,
      TestLoginResult result) {
    return new TestLoginSessionEntry(testSessionId, adminPrincipal, null, protocol, null, result);
  }

  public boolean isCompleted() {
    return result != null;
  }

  public boolean isOwnedBy(String principal) {
    return adminPrincipal.equals(principal);
  }

  TestLoginSessionEntry withResult(TestLoginResult completedResult) {
    return completed(testSessionId, adminPrincipal, protocol, completedResult);
  }

  @Override
  public String toString() {
    return String.format(
        "TestLoginSessionEntry[testSessionId=%s, adminPrincipal=%s, protocol=%s, completed=%s]",
        testSessionId, adminPrincipal, protocol, isCompleted());
  }
}
