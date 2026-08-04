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

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.ClientErrorException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.CollectionDAO.OntologyEditLockRow;
import org.openmetadata.service.ontology.OntologyEditLeasePolicy.LeaseIdentity;
import org.openmetadata.service.ontology.OntologyEditLeasePolicy.LeaseRequest;

class OntologyEditLeasePolicyTest {
  private static final UUID RESOURCE_ID = UUID.fromString("1fdab79e-04b0-432d-9d33-8a0a0b49f4ba");
  private static final UUID FIRST_HOLDER = UUID.fromString("8a30a2ab-74d7-411e-abca-c406f55fba74");
  private static final UUID SECOND_HOLDER = UUID.fromString("3745e5b3-8c38-4bb1-8641-207da1d29f28");
  private static final long NOW = 100_000L;
  private final OntologyEditLeasePolicy policy = new OntologyEditLeasePolicy();

  @Test
  void acquiresNewLease() {
    OntologyEditLockRow acquired = policy.acquire(null, request(FIRST_HOLDER, "first", null));

    assertEquals(1, acquired.version());
    assertEquals(NOW + 30_000, acquired.expiresAt());
  }

  @Test
  void renewsOwnedLeaseWithOptimisticVersion() {
    OntologyEditLockRow current = active(FIRST_HOLDER, "first", 4);

    OntologyEditLockRow renewed = policy.acquire(current, request(FIRST_HOLDER, "first", 4));

    assertEquals(5, renewed.version());
    assertEquals(current.acquiredAt(), renewed.acquiredAt());
  }

  @Test
  void rejectsForeignActiveLease() {
    OntologyEditLockRow current = active(FIRST_HOLDER, "first", 2);

    assertThrows(
        ClientErrorException.class,
        () -> policy.acquire(current, request(SECOND_HOLDER, "second", null)));
  }

  @Test
  void allowsTakeoverAfterExpiry() {
    OntologyEditLockRow expired =
        new OntologyEditLockRow(
            "glossary", RESOURCE_ID, FIRST_HOLDER, "first", 3, 10L, 10L, NOW - 1);

    OntologyEditLockRow acquired = policy.acquire(expired, request(SECOND_HOLDER, "second", null));

    assertEquals(4, acquired.version());
    assertEquals(SECOND_HOLDER, acquired.holderId());
    assertEquals(NOW, acquired.acquiredAt());
  }

  @Test
  void acceptsCurrentOwnedLeaseToken() {
    final OntologyEditLockRow current = active(FIRST_HOLDER, "first", 7);

    policy.requireOwned(current, new LeaseIdentity(FIRST_HOLDER, "first", 7, NOW));
  }

  @Test
  void rejectsStaleLeaseToken() {
    final OntologyEditLockRow current = active(FIRST_HOLDER, "first", 8);

    assertThrows(
        ClientErrorException.class,
        () -> policy.requireOwned(current, new LeaseIdentity(FIRST_HOLDER, "first", 7, NOW)));
  }

  private static LeaseRequest request(
      final UUID holderId, final String sessionId, final Integer expectedVersion) {
    return new LeaseRequest(
        "glossary", RESOURCE_ID, holderId, sessionId, expectedVersion, 30_000, NOW);
  }

  private static OntologyEditLockRow active(
      final UUID holderId, final String sessionId, final long version) {
    return new OntologyEditLockRow(
        "glossary",
        RESOURCE_ID,
        holderId,
        sessionId,
        version,
        NOW - 10_000,
        NOW - 5_000,
        NOW + 20_000);
  }
}
