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
package org.openmetadata.service.governance.approval;

import java.util.UUID;
import org.openmetadata.schema.governance.changeRequest.ChangeLifecycleEvent;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.governance.changeRequest.LifecycleEventType;
import org.openmetadata.service.jdbi3.GovernanceDAOs.ChangeLifecycleEventDAO;
import org.openmetadata.service.util.PostCommitActionQueue;

/**
 * Records each step of a change request as an ordered lifecycle event. Callers hold the request row
 * lock in the same transaction as the status change, so sequences are assigned without gaps or
 * duplicates.
 */
public final class ChangeRequestLifecycle {
  private ChangeRequestLifecycle() {}

  public static void record(
      ChangeRequest request,
      LifecycleEventType eventType,
      ChangeRequestStatus fromStatus,
      String actor,
      String reason) {
    ChangeLifecycleEventDAO events = ChangeRequestService.dao().changeLifecycleEventDAO();
    events.insert(
        new ChangeLifecycleEvent()
            .withId(UUID.randomUUID())
            .withChangeRequestId(request.getId())
            .withSequence(events.lastSequence(request.getId()) + 1)
            .withEventType(eventType)
            .withFromStatus(fromStatus)
            .withToStatus(request.getStatus())
            .withRevisionNumber(request.getActiveRevisionNumber())
            .withActor(actor)
            .withReason(reason)
            .withTimestamp(System.currentTimeMillis()));
    String entityType = request.getEntityType();
    // Counted once the transaction commits, so a rolled-back step is not reported.
    PostCommitActionQueue.runOrDefer(() -> ChangeRequestMetrics.lifecycle(entityType, eventType));
  }

  /** The lifecycle event that ending a request with {@code status} records. */
  public static LifecycleEventType endedAs(ChangeRequestStatus status) {
    return switch (status) {
      case REJECTED -> LifecycleEventType.REJECTED;
      case CONFLICTED -> LifecycleEventType.CONFLICTED;
      case WITHDRAWN -> LifecycleEventType.WITHDRAWN;
      case CANCELLED -> LifecycleEventType.CANCELLED;
      case SUPERSEDED -> LifecycleEventType.SUPERSEDED;
      case APPROVED -> LifecycleEventType.APPROVED;
      case APPLIED -> LifecycleEventType.APPLIED;
      case PENDING -> LifecycleEventType.SUBMITTED;
    };
  }
}
