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

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.ai.AIGovernanceFramework;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.ai.AIGovernanceFrameworkResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository
public class AIGovernanceFrameworkRepository extends EntityRepository<AIGovernanceFramework> {
  private static final String FIELDS = "stewards,autoApply";

  public AIGovernanceFrameworkRepository() {
    super(
        AIGovernanceFrameworkResource.COLLECTION_PATH,
        Entity.AI_GOVERNANCE_FRAMEWORK,
        AIGovernanceFramework.class,
        Entity.getCollectionDAO().aiGovernanceFrameworkDAO(),
        FIELDS,
        FIELDS);
    supportsSearch = true;
  }

  @Override
  public void setFields(
      AIGovernanceFramework framework, Fields fields, RelationIncludes relationIncludes) {
    // Nothing extra to hydrate
  }

  @Override
  public void clearFields(AIGovernanceFramework framework, Fields fields) {
    // Nothing extra to clear
  }

  @Override
  public void prepare(AIGovernanceFramework framework, boolean update) {
    // Validation hook
  }

  @Override
  public void storeEntity(AIGovernanceFramework framework, boolean update) {
    store(framework, update);
  }

  @Override
  public void storeRelationships(AIGovernanceFramework framework) {
    // Relationships stored as part of the JSON
  }

  @Override
  public EntityRepository<AIGovernanceFramework>.EntityUpdater getUpdater(
      AIGovernanceFramework original,
      AIGovernanceFramework updated,
      Operation operation,
      ChangeSource changeSource) {
    return new AIGovernanceFrameworkUpdater(original, updated, operation);
  }

  public class AIGovernanceFrameworkUpdater extends EntityUpdater {
    public AIGovernanceFrameworkUpdater(
        AIGovernanceFramework original, AIGovernanceFramework updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      compareAndUpdate(
          "enabled", () -> recordChange("enabled", original.getEnabled(), updated.getEnabled()));
      compareAndUpdate(
          "reference",
          () -> recordChange("reference", original.getReference(), updated.getReference()));
      compareAndUpdate(
          "region", () -> recordChange("region", original.getRegion(), updated.getRegion()));
      compareAndUpdate(
          "source", () -> recordChange("source", original.getSource(), updated.getSource()));
      compareAndUpdate(
          "assessmentCadence",
          () ->
              recordChange(
                  "assessmentCadence",
                  original.getAssessmentCadence(),
                  updated.getAssessmentCadence()));
      compareAndUpdate(
          "autoApply",
          () -> recordChange("autoApply", original.getAutoApply(), updated.getAutoApply(), true));
      compareAndUpdate(
          "stewards",
          () -> recordChange("stewards", original.getStewards(), updated.getStewards(), true));
      compareAndUpdate(
          "nextDeadline",
          () ->
              recordChange("nextDeadline", original.getNextDeadline(), updated.getNextDeadline()));
    }
  }
}
