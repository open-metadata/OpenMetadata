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
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestOrigin;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;

/** Stable identifiers derived from a change request. */
public final class ChangeRequestKeys {
  private static final String SUBMITTED_SIGNAL = "%s-changeRequestSubmitted";

  private ChangeRequestKeys() {}

  /** Unique while an intercepted request is pending; null otherwise so the unique index ignores it. */
  public static String activeInterceptKey(ChangeRequest request) {
    boolean active =
        request.getStatus() == ChangeRequestStatus.PENDING
            && request.getOrigin() == ChangeRequestOrigin.INTERCEPTED;
    return active ? activeInterceptKey(request.getEntityId(), request.getRequestedBy()) : null;
  }

  public static String activeInterceptKey(UUID entityId, String requestedBy) {
    return "%s:%s".formatted(entityId, requestedBy);
  }

  /** Flowable signal that starts hook workflows for one entity type. */
  public static String submittedSignalId(String entityType) {
    return SUBMITTED_SIGNAL.formatted(entityType);
  }
}
