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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestOrigin;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.governance.changeRequest.DeliveryStatus;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GovernanceDAOs.ChangeRequestDAO;

class ChangeRequestDaoIT {
  @BeforeAll
  static void boot() {
    SdkClients.adminClient();
  }

  private static ChangeRequestDAO dao() {
    return Entity.getCollectionDAO().changeRequestDAO();
  }

  static ChangeRequest pending(UUID entityId, String requester) {
    long now = System.currentTimeMillis();
    return new ChangeRequest()
        .withId(UUID.randomUUID())
        .withEntityType(Entity.GLOSSARY)
        .withEntityId(entityId)
        .withEntityFullyQualifiedName("daoit.%s".formatted(entityId))
        .withRequestedBy(requester)
        .withOrigin(ChangeRequestOrigin.INTERCEPTED)
        .withWorkflowDefinitionId(UUID.randomUUID())
        .withStatus(ChangeRequestStatus.PENDING)
        .withActiveRevisionId(UUID.randomUUID())
        .withActiveRevisionNumber(1)
        .withDeliveryStatus(DeliveryStatus.PENDING)
        .withCreatedAt(now)
        .withUpdatedAt(now);
  }

  @Test
  void secondActiveInterceptedRequestForSameUserIsRejectedByIndex() {
    UUID entityId = UUID.randomUUID();
    dao().insert(pending(entityId, "alice"));
    assertThrows(
        UnableToExecuteStatementException.class, () -> dao().insert(pending(entityId, "alice")));
  }

  @Test
  void terminalRequestReleasesTheActiveKey() {
    UUID entityId = UUID.randomUUID();
    ChangeRequest first = pending(entityId, "bob");
    dao().insert(first);
    dao().update(first.withStatus(ChangeRequestStatus.WITHDRAWN));
    dao().insert(pending(entityId, "bob"));
    assertEquals(2, dao().listByEntity(entityId, 10).size());
  }

  @Test
  void deliveryClaimIsExclusiveUntilLeaseExpires() {
    ChangeRequest request = pending(UUID.randomUUID(), "carol");
    dao().insert(request);
    long now = System.currentTimeMillis();
    assertEquals(1, dao().claimForDelivery(request.getId(), "t1", now + 60_000, now));
    assertEquals(0, dao().claimForDelivery(request.getId(), "t2", now + 60_000, now));
    assertEquals(1, dao().claimForDelivery(request.getId(), "t3", now + 120_000, now + 61_000));
    assertEquals(0, dao().completeDelivery(request.getId(), "t1"));
    assertEquals(1, dao().completeDelivery(request.getId(), "t3"));
    assertEquals(DeliveryStatus.DELIVERED, dao().findById(request.getId()).getDeliveryStatus());
  }

  @Test
  void missingRowsReadAsNull() {
    assertNull(dao().findById(UUID.randomUUID()));
    assertNull(dao().findByTaskId(UUID.randomUUID()));
    assertEquals(List.of(), dao().listByEntity(UUID.randomUUID(), 10));
  }

  // Regression for the pending-changes indicator: the status-unfiltered LIMIT must not hide open
  // requests behind a wall of closed rows, and the status-filtered query must surface all open ones.
  @Test
  void openRequestsAreNotHiddenByClosedHistory() {
    UUID entityId = UUID.randomUUID();
    long base = System.currentTimeMillis();
    // 51 closed rows, each bumped on close (as update() does), so they rank newest by updatedAt.
    for (int i = 0; i < 51; i++) {
      ChangeRequest closed = pending(entityId, "closer" + i).withStatus(ChangeRequestStatus.APPLIED);
      closed.setUpdatedAt(base + 10_000L + i);
      dao().insert(closed);
      dao().update(closed.withStatus(ChangeRequestStatus.APPLIED));
    }
    // 4 pending rows older than every closed row.
    List<UUID> pendingIds = new java.util.ArrayList<>();
    for (int i = 0; i < 4; i++) {
      ChangeRequest open = pending(entityId, "open" + i);
      open.setUpdatedAt(base + 100L + i);
      dao().insert(open);
      pendingIds.add(open.getId());
    }

    // The legacy unfiltered query returns the 50 newest rows — all closed — and hides the open ones.
    List<ChangeRequest> legacyPage = dao().listByEntity(entityId, 50);
    assertEquals(50, legacyPage.size());
    assertTrue(legacyPage.stream().allMatch(r -> r.getStatus() == ChangeRequestStatus.APPLIED));

    // The status-filtered query returns exactly the 4 open rows, newest first.
    List<ChangeRequest> openPage =
        dao().listByEntityAndStatuses(
            entityId, List.of(ChangeRequestStatus.PENDING.value(), ChangeRequestStatus.APPROVED.value()), 50);
    assertEquals(4, openPage.size());
    assertEquals(pendingIds, openPage.stream().map(ChangeRequest::getId).toList());
    assertTrue(openPage.stream().allMatch(r -> r.getStatus() == ChangeRequestStatus.PENDING));
    // Ordering is newest-first by updatedAt.
    for (int i = 1; i < openPage.size(); i++) {
      assertTrue(openPage.get(i - 1).getUpdatedAt() > openPage.get(i).getUpdatedAt());
    }

    // A Pending-only filter returns the same 4.
    assertEquals(
        4,
        dao()
            .listByEntityAndStatuses(entityId, List.of(ChangeRequestStatus.PENDING.value()), 50)
            .size());
  }
}
