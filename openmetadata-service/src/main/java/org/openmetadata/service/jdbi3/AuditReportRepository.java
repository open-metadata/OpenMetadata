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

import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.ai.AuditReport;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.ai.AuditReportResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository
public class AuditReportRepository implements EntityPolicy<AuditReport> {

  private static final String FIELDS = "owners,tags,extension,domains";

  public AuditReportRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                AuditReportResource.COLLECTION_PATH,
                Entity.AUDIT_REPORT,
                AuditReport.class,
                Entity.getCollectionDAO().auditReportDAO()),
            new EntityPolicyContext.WriteFields(FIELDS, FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
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
    persistence().store(report, update);
  }

  @Override
  public void storeRelationships(AuditReport report) {
    // Relationships stored as part of the JSON
  }

  @Override
  public EntityUpdater<AuditReport> getUpdater(
      AuditReport original,
      AuditReport updated,
      EntityOperation operation,
      ChangeSource changeSource) {
    return new AuditReportUpdater(original, updated, operation).mutation();
  }

  public class AuditReportUpdater implements EntitySpecificMutation<AuditReport> {

    public AuditReportUpdater(
        AuditReport original, AuditReport updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Override
    public void update(EntityUpdater<AuditReport> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "status",
          () ->
              entityUpdate.recordChange(
                  "status",
                  entityUpdate.getOriginal().getStatus(),
                  entityUpdate.getUpdated().getStatus()));
      entityUpdate.compareAndUpdate(
          "startedAt",
          () ->
              entityUpdate.recordChange(
                  "startedAt",
                  entityUpdate.getOriginal().getStartedAt(),
                  entityUpdate.getUpdated().getStartedAt()));
      entityUpdate.compareAndUpdate(
          "completedAt",
          () ->
              entityUpdate.recordChange(
                  "completedAt",
                  entityUpdate.getOriginal().getCompletedAt(),
                  entityUpdate.getUpdated().getCompletedAt()));
      entityUpdate.compareAndUpdate(
          "failureReason",
          () ->
              entityUpdate.recordChange(
                  "failureReason",
                  entityUpdate.getOriginal().getFailureReason(),
                  entityUpdate.getUpdated().getFailureReason()));
      entityUpdate.compareAndUpdate(
          "runningOn",
          () ->
              entityUpdate.recordChange(
                  "runningOn",
                  entityUpdate.getOriginal().getRunningOn(),
                  entityUpdate.getUpdated().getRunningOn()));
      entityUpdate.compareAndUpdate(
          "artifacts",
          () ->
              entityUpdate.recordChange(
                  "artifacts",
                  entityUpdate.getOriginal().getArtifacts(),
                  entityUpdate.getUpdated().getArtifacts(),
                  true));
      entityUpdate.compareAndUpdate(
          "manifest",
          () ->
              entityUpdate.recordChange(
                  "manifest",
                  entityUpdate.getOriginal().getManifest(),
                  entityUpdate.getUpdated().getManifest(),
                  true));
    }

    private final EntityUpdater<AuditReport> entityUpdate;

    public EntityUpdater<AuditReport> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<AuditReport> entityContext;

  @Override
  public final EntityPolicyContext<AuditReport> context() {
    return entityContext;
  }
}
