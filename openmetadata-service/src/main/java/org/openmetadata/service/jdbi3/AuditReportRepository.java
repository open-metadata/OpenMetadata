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
package org.openmetadata.service.jdbi3;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.ai.AuditReportResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository
public class AuditReportRepository extends EntityRepository<AuditReport> {
  private static final String FIELDS = "owners,tags,extension,domains";

  public AuditReportRepository() {
    super(
        AuditReportResource.COLLECTION_PATH,
        Entity.AUDIT_REPORT,
        AuditReport.class,
        Entity.getCollectionDAO().auditReportDAO(),
        FIELDS,
        FIELDS);
    supportsSearch = true;
  }

  @Override
  protected List<String> getFieldsHiddenFromHistory() {
    // The pack bytes are the requester's private view of the estate (see
    // ADR:2026-10-31-audit-pack-artifacts-belong-to-the-requester): no stored version and no
    // version read may carry them, however a report row was patched.
    return List.of("artifacts");
  }

  @Override
  public void setFields(AuditReport report, Fields fields, RelationIncludes relationIncludes) {
    // Nothing extra to hydrate
  }

  @Override
  public void clearFields(AuditReport report, Fields fields) {
    // Nothing to clear
  }

  @Override
  public void prepare(AuditReport report, boolean update) {
    // No validation
  }

  @Override
  public void storeEntity(AuditReport report, boolean update) {
    store(report, update);
  }

  @Override
  public void storeRelationships(AuditReport report) {
    // Relationships stored as part of the JSON
  }

  @Override
  public EntityRepository<AuditReport>.EntityUpdater getUpdater(
      AuditReport original, AuditReport updated, Operation operation, ChangeSource changeSource) {
    return new AuditReportUpdater(original, updated, operation);
  }

  public class AuditReportUpdater extends EntityUpdater {
    public AuditReportUpdater(AuditReport original, AuditReport updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      compareAndUpdate(
          "status", () -> recordChange("status", original.getStatus(), updated.getStatus()));
      compareAndUpdate(
          "startedAt",
          () -> recordChange("startedAt", original.getStartedAt(), updated.getStartedAt()));
      compareAndUpdate(
          "completedAt",
          () -> recordChange("completedAt", original.getCompletedAt(), updated.getCompletedAt()));
      compareAndUpdate(
          "failureReason",
          () ->
              recordChange(
                  "failureReason", original.getFailureReason(), updated.getFailureReason()));
      compareAndUpdate(
          "runningOn",
          () -> recordChange("runningOn", original.getRunningOn(), updated.getRunningOn()));
      // Artifacts are deliberately not recorded: change events and alerts fan out to readers who
      // are not the pack's requester, and the bytes stay out of stored versions (see
      // getFieldsHiddenFromHistory). The async worker writes them through the DAO, not here.
      compareAndUpdate(
          "manifest",
          () -> recordChange("manifest", original.getManifest(), updated.getManifest(), true));
    }
  }
}
