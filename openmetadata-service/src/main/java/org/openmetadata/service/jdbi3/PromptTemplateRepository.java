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

import com.google.gson.Gson;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.ai.PromptTemplate;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.ai.PromptTemplateResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository
public class PromptTemplateRepository extends EntityRepository<PromptTemplate> {
  private static final String TEMPLATE_UPDATE_FIELDS = "variables,examples";
  private static final String TEMPLATE_PATCH_FIELDS = "variables,examples";

  public PromptTemplateRepository() {
    super(
        PromptTemplateResource.COLLECTION_PATH,
        Entity.PROMPT_TEMPLATE,
        PromptTemplate.class,
        Entity.getCollectionDAO().promptTemplateDAO(),
        TEMPLATE_PATCH_FIELDS,
        TEMPLATE_UPDATE_FIELDS);
    supportsSearch = true;
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
    store(promptTemplate, update);
  }

  @Override
  public void storeEntities(List<PromptTemplate> entities) {
    List<PromptTemplate> entitiesToStore = new ArrayList<>();
    Gson gson = new Gson();
    for (PromptTemplate entity : entities) {
      String jsonCopy = gson.toJson(entity);
      entitiesToStore.add(gson.fromJson(jsonCopy, PromptTemplate.class));
    }
    storeMany(entitiesToStore);
  }

  @Override
  public void storeRelationships(PromptTemplate promptTemplate) {
    // Relationships are stored as part of the JSON entity
  }

  @Override
  public EntityRepository<PromptTemplate>.EntityUpdater getUpdater(
      PromptTemplate original,
      PromptTemplate updated,
      Operation operation,
      ChangeSource changeSource) {
    return new PromptTemplateUpdater(original, updated, operation);
  }

  public class PromptTemplateUpdater extends EntityUpdater {
    public PromptTemplateUpdater(
        PromptTemplate original, PromptTemplate updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("templateContent", original.getTemplateContent(), updated.getTemplateContent());
      recordChange("systemPrompt", original.getSystemPrompt(), updated.getSystemPrompt());
      recordChange("variables", original.getVariables(), updated.getVariables(), true);
      recordChange("examples", original.getExamples(), updated.getExamples(), true);
      recordChange("templateType", original.getTemplateType(), updated.getTemplateType());
      recordChange("templateVersion", original.getTemplateVersion(), updated.getTemplateVersion());
    }
  }
}
