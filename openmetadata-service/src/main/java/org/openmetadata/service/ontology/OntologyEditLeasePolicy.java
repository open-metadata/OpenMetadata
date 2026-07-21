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

import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.core.Response;
import java.util.UUID;
import org.openmetadata.service.jdbi3.CollectionDAO.OntologyEditLockRow;
import org.openmetadata.service.monitoring.OntologyMetrics;

public final class OntologyEditLeasePolicy {
  public OntologyEditLockRow acquire(
      final OntologyEditLockRow current, final LeaseRequest request) {
    validateLeaseDuration(request.leaseMillis());
    rejectActiveForeignLease(current, request);
    validateRenewalVersion(current, request);
    final long version = current == null ? 1 : current.version() + 1;
    final long acquiredAt = isRenewal(current, request) ? current.acquiredAt() : request.now();
    return new OntologyEditLockRow(
        request.resourceType(),
        request.resourceId(),
        request.holderId(),
        request.sessionId(),
        version,
        acquiredAt,
        request.now(),
        request.now() + request.leaseMillis());
  }

  public void requireOwned(final OntologyEditLockRow current, final LeaseIdentity identity) {
    final boolean isOwned =
        current != null
            && current.expiresAt() >= identity.now()
            && current.holderId().equals(identity.holderId())
            && current.sessionId().equals(identity.sessionId())
            && current.version() == identity.version();
    if (!isOwned) {
      throw conflict(
          "The ontology edit lease is missing, expired, or no longer owned by this session");
    }
  }

  private static void validateLeaseDuration(final long leaseMillis) {
    if (leaseMillis < 10_000 || leaseMillis > 300_000) {
      throw conflict("Ontology edit leases must be between 10 and 300 seconds");
    }
  }

  private static void rejectActiveForeignLease(
      final OntologyEditLockRow current, final LeaseRequest request) {
    final boolean isForeignLease =
        current != null && current.expiresAt() >= request.now() && !isSameSession(current, request);
    if (isForeignLease) {
      OntologyMetrics.recordLockContention();
      throw conflict(
          "Ontology resource '"
              + request.resourceType()
              + ':'
              + request.resourceId()
              + "' is being edited by another session");
    }
  }

  private static void validateRenewalVersion(
      final OntologyEditLockRow current, final LeaseRequest request) {
    if (isRenewal(current, request)
        && !Integer.valueOf(Math.toIntExact(current.version())).equals(request.expectedVersion())) {
      throw conflict(
          "Ontology edit lease version mismatch: expected "
              + current.version()
              + " but received "
              + request.expectedVersion());
    }
  }

  private static boolean isRenewal(final OntologyEditLockRow current, final LeaseRequest request) {
    return current != null
        && current.expiresAt() >= request.now()
        && isSameSession(current, request);
  }

  private static boolean isSameSession(
      final OntologyEditLockRow current, final LeaseRequest request) {
    return current.holderId().equals(request.holderId())
        && current.sessionId().equals(request.sessionId());
  }

  private static ClientErrorException conflict(final String message) {
    return new ClientErrorException(message, Response.Status.CONFLICT);
  }

  public record LeaseRequest(
      String resourceType,
      UUID resourceId,
      UUID holderId,
      String sessionId,
      Integer expectedVersion,
      long leaseMillis,
      long now) {}

  public record LeaseIdentity(UUID holderId, String sessionId, long version, long now) {}
}
