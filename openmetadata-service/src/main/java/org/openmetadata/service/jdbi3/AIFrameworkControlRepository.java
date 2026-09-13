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

import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.ai.AIFrameworkControl;
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
import org.openmetadata.service.resources.ai.AIFrameworkControlResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Repository
public class AIFrameworkControlRepository implements EntityPolicy<AIFrameworkControl> {

  private static final String FIELDS = "evidenceRequirements,framework";

  public AIFrameworkControlRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                AIFrameworkControlResource.COLLECTION_PATH,
                Entity.AI_FRAMEWORK_CONTROL,
                AIFrameworkControl.class,
                Entity.getCollectionDAO().aiFrameworkControlDAO()),
            new EntityPolicyContext.WriteFields(FIELDS, FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
  }

  @Override
  public void setFullyQualifiedName(AIFrameworkControl control) {
    control.setFullyQualifiedName(
        FullyQualifiedName.add(control.getFramework().getFullyQualifiedName(), control.getName()));
  }

  @Override
  public void setFields(
      AIFrameworkControl control, Fields fields, RelationIncludes relationIncludes) {}

  @Override
  public void clearFields(AIFrameworkControl control, Fields fields) {}

  @Override
  public void restorePatchAttributes(AIFrameworkControl original, AIFrameworkControl updated) {
    EntityPolicy.super.restorePatchAttributes(original, updated);
    updated.withFramework(original.getFramework());
  }

  @Override
  public void prepare(AIFrameworkControl control, boolean update) {
    control.setFramework(Entity.getEntityReference(control.getFramework(), NON_DELETED));
  }

  @Override
  public void storeEntity(AIFrameworkControl control, boolean update) {
    persistence().store(control, update);
  }

  @Override
  public void storeRelationships(AIFrameworkControl control) {}

  @Override
  public EntityUpdater<AIFrameworkControl> getUpdater(
      AIFrameworkControl original,
      AIFrameworkControl updated,
      EntityOperation operation,
      ChangeSource changeSource) {
    return new AIFrameworkControlUpdater(original, updated, operation).mutation();
  }

  public class AIFrameworkControlUpdater implements EntitySpecificMutation<AIFrameworkControl> {

    public AIFrameworkControlUpdater(
        AIFrameworkControl original, AIFrameworkControl updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Override
    public void update(
        EntityUpdater<AIFrameworkControl> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "code",
          () ->
              entityUpdate.recordChange(
                  "code",
                  entityUpdate.getOriginal().getCode(),
                  entityUpdate.getUpdated().getCode()));
      entityUpdate.compareAndUpdate(
          "category",
          () ->
              entityUpdate.recordChange(
                  "category",
                  entityUpdate.getOriginal().getCategory(),
                  entityUpdate.getUpdated().getCategory()));
      entityUpdate.compareAndUpdate(
          "framework",
          () ->
              entityUpdate.recordChange(
                  "framework",
                  entityUpdate.getOriginal().getFramework(),
                  entityUpdate.getUpdated().getFramework(),
                  true));
      entityUpdate.compareAndUpdate(
          "evidenceRequirements",
          () ->
              entityUpdate.recordChange(
                  "evidenceRequirements",
                  entityUpdate.getOriginal().getEvidenceRequirements(),
                  entityUpdate.getUpdated().getEvidenceRequirements(),
                  true));
    }

    private final EntityUpdater<AIFrameworkControl> entityUpdate;

    public EntityUpdater<AIFrameworkControl> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<AIFrameworkControl> entityContext;

  @Override
  public final EntityPolicyContext<AIFrameworkControl> context() {
    return entityContext;
  }
}
