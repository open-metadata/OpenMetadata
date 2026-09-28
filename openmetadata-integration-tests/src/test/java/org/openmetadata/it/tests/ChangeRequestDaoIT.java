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
}
