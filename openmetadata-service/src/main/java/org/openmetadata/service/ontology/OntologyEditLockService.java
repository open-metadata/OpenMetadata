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

import jakarta.ws.rs.NotFoundException;
import java.time.Clock;
import java.util.UUID;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.api.data.AcquireOntologyEditLock;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyEditLock;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.OntologyEditLockDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.OntologyEditLockRow;
import org.openmetadata.service.ontology.OntologyEditLeasePolicy.LeaseIdentity;
import org.openmetadata.service.ontology.OntologyEditLeasePolicy.LeaseRequest;

public final class OntologyEditLockService {
  private static final int DEFAULT_LEASE_SECONDS = 60;
  private final Jdbi jdbi;
  private final Clock clock;
  private final OntologyEditLeasePolicy leasePolicy;

  public OntologyEditLockService(
      final Jdbi jdbi, final Clock clock, final OntologyEditLeasePolicy leasePolicy) {
    this.jdbi = jdbi;
    this.clock = clock;
    this.leasePolicy = leasePolicy;
  }

  public OntologyEditLock acquire(final AcquireOntologyEditLock request, final String userName) {
    Entity.getEntityReferenceById(request.getResourceType(), request.getResourceId(), Include.ALL);
    final EntityReference holder =
        Entity.getEntityReferenceByName(Entity.USER, userName, Include.NON_DELETED);
    final LeaseRequest leaseRequest = toLeaseRequest(request, holder.getId());
    final OntologyEditLockRow row =
        jdbi.inTransaction(
            handle -> acquire(handle.attach(OntologyEditLockDAO.class), leaseRequest));
    return toLock(row, holder);
  }

  private OntologyEditLockRow acquire(final OntologyEditLockDAO dao, final LeaseRequest request) {
    final OntologyEditLockRow current =
        dao.findForUpdate(request.resourceType(), request.resourceId());
    final OntologyEditLockRow updated = leasePolicy.acquire(current, request);
    if (current == null) {
      dao.insert(updated);
    } else {
      dao.update(updated);
    }
    return updated;
  }

  private LeaseRequest toLeaseRequest(final AcquireOntologyEditLock request, final UUID holderId) {
    final int leaseSeconds =
        request.getLeaseSeconds() == null ? DEFAULT_LEASE_SECONDS : request.getLeaseSeconds();
    return new LeaseRequest(
        request.getResourceType(),
        request.getResourceId(),
        holderId,
        request.getSessionId(),
        request.getExpectedVersion(),
        leaseSeconds * 1_000L,
        clock.millis());
  }

  public OntologyEditLock get(final String resourceType, final UUID resourceId) {
    final OntologyEditLockDAO dao = jdbi.onDemand(OntologyEditLockDAO.class);
    final OntologyEditLockRow row = requireActive(dao, resourceType, resourceId);
    final EntityReference holder =
        Entity.getEntityReferenceById(Entity.USER, row.holderId(), Include.ALL);
    return toLock(row, holder);
  }

  public void requireOwned(
      final String resourceType,
      final UUID resourceId,
      final String sessionId,
      final long version,
      final String userName) {
    final EntityReference holder =
        Entity.getEntityReferenceByName(Entity.USER, userName, Include.NON_DELETED);
    final OntologyEditLockRow current =
        jdbi.onDemand(OntologyEditLockDAO.class).find(resourceType, resourceId);
    final LeaseIdentity identity =
        new LeaseIdentity(holder.getId(), sessionId, version, clock.millis());
    leasePolicy.requireOwned(current, identity);
  }

  private OntologyEditLockRow requireActive(
      final OntologyEditLockDAO dao, final String resourceType, final UUID resourceId) {
    final OntologyEditLockRow row = dao.find(resourceType, resourceId);
    final boolean isExpired = row != null && row.expiresAt() < clock.millis();
    if (isExpired) {
      dao.deleteExpired(clock.millis());
    }
    if (row == null || isExpired) {
      throw new NotFoundException(
          "No active ontology edit lease for resource '" + resourceType + ':' + resourceId + "'");
    }
    return row;
  }

  public void release(
      final String resourceType,
      final UUID resourceId,
      final String sessionId,
      final String userName) {
    final EntityReference holder =
        Entity.getEntityReferenceByName(Entity.USER, userName, Include.NON_DELETED);
    final int deleted =
        jdbi.onDemand(OntologyEditLockDAO.class)
            .delete(resourceType, resourceId, holder.getId(), sessionId);
    if (deleted == 0) {
      throw new NotFoundException(
          "No ontology edit lease owned by session '" + sessionId + "' was found");
    }
  }

  private static OntologyEditLock toLock(
      final OntologyEditLockRow row, final EntityReference holder) {
    return new OntologyEditLock()
        .withResourceType(row.resourceType())
        .withResourceId(row.resourceId())
        .withHolder(holder)
        .withSessionId(row.sessionId())
        .withVersion(Math.toIntExact(row.version()))
        .withAcquiredAt(row.acquiredAt())
        .withRenewedAt(row.renewedAt())
        .withExpiresAt(row.expiresAt());
  }
}
