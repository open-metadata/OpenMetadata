/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.service.csv;

import jakarta.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.policyevaluator.DomainAccessFilter;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * The version bump a completed bulk CSV import records on the entity the import targeted, shared by
 * the synchronous resource path and the asynchronous job handler.
 */
@Slf4j
public final class BulkImportVersioning {

  private BulkImportVersioning() {}

  /**
   * Records the bulk import against {@code targetFqn}, skipping the entity when the importer may not
   * write to it.
   *
   * <p>Both the target FQN and the repository it is resolved against come straight from the request,
   * so a caller picks the type and the name of the entity that gets a version bump, a {@code
   * bulkImport} ChangeDescription and a ChangeEvent — all writes, and all of which a target outside
   * the caller's domains must not receive.
   *
   * <p>A missing target and an inaccessible one are both skipped rather than failing: by this point
   * the rows are already written, so failing would misreport the import, and treating the two alike
   * keeps the outcome from becoming a cross-domain existence oracle.
   */
  public static void recordVersion(
      EntityRepository<EntityInterface> versioningRepo,
      UriInfo uriInfo,
      String targetFqn,
      String updatedBy,
      CsvImportResult result) {
    EntityInterface target = resolveAccessibleTarget(versioningRepo, uriInfo, targetFqn, updatedBy);
    if (target == null) {
      LOG.info("Skipping bulk import versioning for target '{}'", targetFqn);
    } else {
      versioningRepo.createChangeEventForBulkOperation(target, result, updatedBy);
    }
  }

  private static EntityInterface resolveAccessibleTarget(
      EntityRepository<EntityInterface> versioningRepo,
      UriInfo uriInfo,
      String targetFqn,
      String updatedBy) {
    // Resolved before the lookup so an unresolvable principal is not mistaken for a missing target.
    SubjectContext subjectContext = SubjectContext.getSubjectContext(updatedBy);
    EntityInterface target = null;
    try {
      String fields = versioningRepo.isSupportsDomains() ? Entity.FIELD_DOMAINS : "";
      EntityInterface candidate =
          versioningRepo.getByName(
              uriInfo,
              targetFqn,
              new Fields(versioningRepo.getAllowedFields(), fields),
              Include.NON_DELETED,
              false);
      if (DomainAccessFilter.isAccessible(subjectContext, candidate.getDomains())) {
        target = candidate;
      }
    } catch (EntityNotFoundException e) {
      LOG.debug("Bulk import versioning target '{}' no longer exists", targetFqn);
    }
    return target;
  }
}
