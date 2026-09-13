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

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.ai.PromptTemplate;
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
import org.openmetadata.service.resources.ai.PromptTemplateResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository
public class PromptTemplateRepository implements EntityPolicy<PromptTemplate> {

  private static final String TEMPLATE_UPDATE_FIELDS = "variables,examples";

  private static final String TEMPLATE_PATCH_FIELDS = "variables,examples";

  public PromptTemplateRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                PromptTemplateResource.COLLECTION_PATH,
                Entity.PROMPT_TEMPLATE,
                PromptTemplate.class,
                Entity.getCollectionDAO().promptTemplateDAO()),
            new EntityPolicyContext.WriteFields(
                TEMPLATE_PATCH_FIELDS, TEMPLATE_UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
  }

  @Override
  public void setFields(
      PromptTemplate promptTemplate, Fields fields, RelationIncludes relationIncludes) {
    // No additional fields to set beyond base entity fields
  }

  @Override
  public void clearFields(PromptTemplate promptTemplate, Fields fields) {
    // No additional fields to clear
  }

  @Override
  public void prepare(PromptTemplate promptTemplate, boolean update) {
    // Validation can be added here if needed
  }

  @Override
  public void storeEntity(PromptTemplate promptTemplate, boolean update) {
    persistence().store(promptTemplate, update);
  }

  @Override
  public void storeEntities(List<PromptTemplate> entities) {
    List<String> fqns = new ArrayList<>(entities.size());
    List<String> jsons = new ArrayList<>(entities.size());
    for (PromptTemplate entity : entities) {
      fqns.add(entity.getFullyQualifiedName());
      jsons.add(serializeForStorage(entity));
    }
    context()
        .schema()
        .dao()
        .insertMany(
            context().schema().dao().getTableName(),
            context().schema().dao().getNameHashColumn(),
            fqns,
            jsons);
  }

  @Override
  public void storeRelationships(PromptTemplate promptTemplate) {
    // Relationships are stored as part of the JSON entity
  }

  @Override
  public EntityUpdater<PromptTemplate> getUpdater(
      PromptTemplate original,
      PromptTemplate updated,
      EntityOperation operation,
      ChangeSource changeSource) {
    return new PromptTemplateUpdater(original, updated, operation).mutation();
  }

  public class PromptTemplateUpdater implements EntitySpecificMutation<PromptTemplate> {

    public PromptTemplateUpdater(
        PromptTemplate original, PromptTemplate updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Override
    public void update(EntityUpdater<PromptTemplate> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "templateContent",
          () ->
              entityUpdate.recordChange(
                  "templateContent",
                  entityUpdate.getOriginal().getTemplateContent(),
                  entityUpdate.getUpdated().getTemplateContent()));
      entityUpdate.compareAndUpdate(
          "systemPrompt",
          () ->
              entityUpdate.recordChange(
                  "systemPrompt",
                  entityUpdate.getOriginal().getSystemPrompt(),
                  entityUpdate.getUpdated().getSystemPrompt()));
      entityUpdate.compareAndUpdate(
          "variables",
          () ->
              entityUpdate.recordChange(
                  "variables",
                  entityUpdate.getOriginal().getVariables(),
                  entityUpdate.getUpdated().getVariables(),
                  true));
      entityUpdate.compareAndUpdate(
          "examples",
          () ->
              entityUpdate.recordChange(
                  "examples",
                  entityUpdate.getOriginal().getExamples(),
                  entityUpdate.getUpdated().getExamples(),
                  true));
      entityUpdate.compareAndUpdate(
          "templateType",
          () ->
              entityUpdate.recordChange(
                  "templateType",
                  entityUpdate.getOriginal().getTemplateType(),
                  entityUpdate.getUpdated().getTemplateType()));
      entityUpdate.compareAndUpdate(
          "templateVersion",
          () ->
              entityUpdate.recordChange(
                  "templateVersion",
                  entityUpdate.getOriginal().getTemplateVersion(),
                  entityUpdate.getUpdated().getTemplateVersion()));
    }

    private final EntityUpdater<PromptTemplate> entityUpdate;

    public EntityUpdater<PromptTemplate> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<PromptTemplate> entityContext;

  @Override
  public final EntityPolicyContext<PromptTemplate> context() {
    return entityContext;
  }
}
