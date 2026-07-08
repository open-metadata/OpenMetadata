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
import org.openmetadata.schema.entity.ai.AIFrameworkControl;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.ai.AIFrameworkControlResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository
public class AIFrameworkControlRepository extends EntityRepository<AIFrameworkControl> {
  private static final String FIELDS = "evidenceRequirements,framework";

  public AIFrameworkControlRepository() {
    super(
        AIFrameworkControlResource.COLLECTION_PATH,
        Entity.AI_FRAMEWORK_CONTROL,
        AIFrameworkControl.class,
        Entity.getCollectionDAO().aiFrameworkControlDAO(),
        FIELDS,
        FIELDS);
    supportsSearch = true;
  }

  @Override
  public void setFields(
      AIFrameworkControl control, Fields fields, RelationIncludes relationIncludes) {}

  @Override
  public void clearFields(AIFrameworkControl control, Fields fields) {}

  @Override
  public void prepare(AIFrameworkControl control, boolean update) {}

  @Override
  public void storeEntity(AIFrameworkControl control, boolean update) {
    store(control, update);
  }

  @Override
  public void storeRelationships(AIFrameworkControl control) {}

  @Override
  public EntityRepository<AIFrameworkControl>.EntityUpdater getUpdater(
      AIFrameworkControl original,
      AIFrameworkControl updated,
      Operation operation,
      ChangeSource changeSource) {
    return new AIFrameworkControlUpdater(original, updated, operation);
  }

  public class AIFrameworkControlUpdater extends EntityUpdater {
    public AIFrameworkControlUpdater(
        AIFrameworkControl original, AIFrameworkControl updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      compareAndUpdate("code", () -> recordChange("code", original.getCode(), updated.getCode()));
      compareAndUpdate(
          "category",
          () -> recordChange("category", original.getCategory(), updated.getCategory()));
      compareAndUpdate(
          "framework",
          () -> recordChange("framework", original.getFramework(), updated.getFramework(), true));
      compareAndUpdate(
          "evidenceRequirements",
          () ->
              recordChange(
                  "evidenceRequirements",
                  original.getEvidenceRequirements(),
                  updated.getEvidenceRequirements(),
                  true));
    }
  }
}
