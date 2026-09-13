/*
 *  Copyright 2021 Collate
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
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
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
import org.openmetadata.service.resources.ai.AIGovernancePolicyResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository
public class AIGovernancePolicyRepository implements EntityPolicy<AIGovernancePolicy> {

  private static final String POLICY_UPDATE_FIELDS = "rules,appliesTo";

  private static final String POLICY_PATCH_FIELDS = "rules,appliesTo";

  public AIGovernancePolicyRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                AIGovernancePolicyResource.COLLECTION_PATH,
                Entity.AI_GOVERNANCE_POLICY,
                AIGovernancePolicy.class,
                Entity.getCollectionDAO().aiGovernancePolicyDAO()),
            new EntityPolicyContext.WriteFields(
                POLICY_PATCH_FIELDS, POLICY_UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
  }

  @Override
  public void setFields(
      AIGovernancePolicy policy, Fields fields, RelationIncludes relationIncludes) {
    // No additional fields to set beyond base entity fields
  }

  @Override
  public void clearFields(AIGovernancePolicy policy, Fields fields) {
    // No additional fields to clear
  }

  @Override
  public void prepare(AIGovernancePolicy policy, boolean update) {
    // Validation can be added here if needed
  }

  @Override
  public void storeEntity(AIGovernancePolicy policy, boolean update) {
    persistence().store(policy, update);
  }

  @Override
  public void storeRelationships(AIGovernancePolicy policy) {
    // Relationships are stored as part of the JSON entity
  }

  @Override
  public EntityUpdater<AIGovernancePolicy> getUpdater(
      AIGovernancePolicy original,
      AIGovernancePolicy updated,
      EntityOperation operation,
      ChangeSource changeSource) {
    return new AIGovernancePolicyUpdater(original, updated, operation).mutation();
  }

  public class AIGovernancePolicyUpdater implements EntitySpecificMutation<AIGovernancePolicy> {

    public AIGovernancePolicyUpdater(
        AIGovernancePolicy original, AIGovernancePolicy updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Override
    public void update(
        EntityUpdater<AIGovernancePolicy> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "policyType",
          () ->
              entityUpdate.recordChange(
                  "policyType",
                  entityUpdate.getOriginal().getPolicyType(),
                  entityUpdate.getUpdated().getPolicyType()));
      entityUpdate.compareAndUpdate(
          "rules",
          () ->
              entityUpdate.recordChange(
                  "rules",
                  entityUpdate.getOriginal().getRules(),
                  entityUpdate.getUpdated().getRules(),
                  true));
      entityUpdate.compareAndUpdate(
          "biasThresholds",
          () ->
              entityUpdate.recordChange(
                  "biasThresholds",
                  entityUpdate.getOriginal().getBiasThresholds(),
                  entityUpdate.getUpdated().getBiasThresholds(),
                  true));
      entityUpdate.compareAndUpdate(
          "dataAccessControls",
          () ->
              entityUpdate.recordChange(
                  "dataAccessControls",
                  entityUpdate.getOriginal().getDataAccessControls(),
                  entityUpdate.getUpdated().getDataAccessControls(),
                  true));
      entityUpdate.compareAndUpdate(
          "costControls",
          () ->
              entityUpdate.recordChange(
                  "costControls",
                  entityUpdate.getOriginal().getCostControls(),
                  entityUpdate.getUpdated().getCostControls(),
                  true));
      entityUpdate.compareAndUpdate(
          "complianceRequirements",
          () ->
              entityUpdate.recordChange(
                  "complianceRequirements",
                  entityUpdate.getOriginal().getComplianceRequirements(),
                  entityUpdate.getUpdated().getComplianceRequirements(),
                  true));
      entityUpdate.compareAndUpdate(
          "performanceStandards",
          () ->
              entityUpdate.recordChange(
                  "performanceStandards",
                  entityUpdate.getOriginal().getPerformanceStandards(),
                  entityUpdate.getUpdated().getPerformanceStandards(),
                  true));
      entityUpdate.compareAndUpdate(
          "appliesTo",
          () ->
              entityUpdate.recordChange(
                  "appliesTo",
                  entityUpdate.getOriginal().getAppliesTo(),
                  entityUpdate.getUpdated().getAppliesTo(),
                  true));
      entityUpdate.compareAndUpdate(
          "enforcementLevel",
          () ->
              entityUpdate.recordChange(
                  "enforcementLevel",
                  entityUpdate.getOriginal().getEnforcementLevel(),
                  entityUpdate.getUpdated().getEnforcementLevel()));
      entityUpdate.compareAndUpdate(
          "enabled",
          () ->
              entityUpdate.recordChange(
                  "enabled",
                  entityUpdate.getOriginal().getEnabled(),
                  entityUpdate.getUpdated().getEnabled()));
    }

    private final EntityUpdater<AIGovernancePolicy> entityUpdate;

    public EntityUpdater<AIGovernancePolicy> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<AIGovernancePolicy> entityContext;

  @Override
  public final EntityPolicyContext<AIGovernancePolicy> context() {
    return entityContext;
  }
}
