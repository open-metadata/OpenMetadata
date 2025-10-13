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

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.ai.AIGovernancePolicyResource;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
@Repository
public class AIGovernancePolicyRepository extends EntityRepository<AIGovernancePolicy> {
  private static final String POLICY_UPDATE_FIELDS = "rules,appliesTo";
  private static final String POLICY_PATCH_FIELDS = "rules,appliesTo";

  public AIGovernancePolicyRepository() {
    super(
        AIGovernancePolicyResource.COLLECTION_PATH,
        Entity.AI_GOVERNANCE_POLICY,
        AIGovernancePolicy.class,
        Entity.getCollectionDAO().aiGovernancePolicyDAO(),
        POLICY_PATCH_FIELDS,
        POLICY_UPDATE_FIELDS);
    supportsSearch = true;
  }

  @Override
  public void setFields(AIGovernancePolicy policy, Fields fields) {
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
    store(policy, update);
  }

  @Override
  public void storeRelationships(AIGovernancePolicy policy) {
    // Relationships are stored as part of the JSON entity
  }

  @Override
  public EntityRepository<AIGovernancePolicy>.EntityUpdater getUpdater(
      AIGovernancePolicy original,
      AIGovernancePolicy updated,
      Operation operation,
      ChangeSource changeSource) {
    return new AIGovernancePolicyUpdater(original, updated, operation);
  }

  public class AIGovernancePolicyUpdater extends EntityUpdater {
    public AIGovernancePolicyUpdater(
        AIGovernancePolicy original, AIGovernancePolicy updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("policyType", original.getPolicyType(), updated.getPolicyType());
      recordChange("rules", original.getRules(), updated.getRules(), true);
      recordChange(
          "biasThresholds", original.getBiasThresholds(), updated.getBiasThresholds(), true);
      recordChange(
          "dataAccessControls",
          original.getDataAccessControls(),
          updated.getDataAccessControls(),
          true);
      recordChange("costControls", original.getCostControls(), updated.getCostControls(), true);
      recordChange(
          "complianceRequirements",
          original.getComplianceRequirements(),
          updated.getComplianceRequirements(),
          true);
      recordChange(
          "performanceStandards",
          original.getPerformanceStandards(),
          updated.getPerformanceStandards(),
          true);
      recordChange("appliesTo", original.getAppliesTo(), updated.getAppliesTo(), true);
      recordChange(
          "enforcementLevel", original.getEnforcementLevel(), updated.getEnforcementLevel());
      recordChange("enabled", original.getEnabled(), updated.getEnabled());
    }
  }
}
