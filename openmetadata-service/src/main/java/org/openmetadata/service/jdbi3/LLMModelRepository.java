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

import static org.openmetadata.schema.type.Include.NON_DELETED;

import com.google.gson.Gson;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.services.LLMService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.ai.LLMModelResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Repository
public class LLMModelRepository extends EntityRepository<LLMModel> {
  private static final String MODEL_UPDATE_FIELDS = "usedByAgents";
  private static final String MODEL_PATCH_FIELDS = "usedByAgents";

  public LLMModelRepository() {
    super(
        LLMModelResource.COLLECTION_PATH,
        Entity.LLM_MODEL,
        LLMModel.class,
        Entity.getCollectionDAO().llmModelDAO(),
        MODEL_PATCH_FIELDS,
        MODEL_UPDATE_FIELDS);
    supportsSearch = true;
  }

  @Override
  public void setFullyQualifiedName(LLMModel llmModel) {
    if (llmModel.getService() != null) {
      llmModel.setFullyQualifiedName(
          FullyQualifiedName.add(
              llmModel.getService().getFullyQualifiedName(), llmModel.getName()));
    } else {
      llmModel.setFullyQualifiedName(llmModel.getName());
    }
  }

  @Override
  public void setFields(LLMModel llmModel, Fields fields, RelationIncludes relationIncludes) {
    llmModel.setService(getContainer(llmModel.getId()));
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<LLMModel> entities) {
    fetchAndSetDefaultService(entities);
    fetchAndSetFields(entities, fields);
    setInheritedFields(entities, fields);

    for (LLMModel entity : entities) {
      clearFieldsInternal(entity, fields);
    }
  }

  private void fetchAndSetDefaultService(List<LLMModel> llmModels) {
    if (llmModels == null || llmModels.isEmpty()) {
      return;
    }

    Map<UUID, EntityReference> serviceMap = batchFetchServices(llmModels);

    for (LLMModel llmModel : llmModels) {
      llmModel.setService(serviceMap.get(llmModel.getId()));
    }
  }

  private Map<UUID, EntityReference> batchFetchServices(List<LLMModel> llmModels) {
    Map<UUID, EntityReference> serviceMap = new HashMap<>();
    if (llmModels == null || llmModels.isEmpty()) {
      return serviceMap;
    }

    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(
                entityListToStrings(llmModels),
                org.openmetadata.schema.type.Relationship.CONTAINS.ordinal());

    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID llmModelId = UUID.fromString(record.getToId());
      EntityReference serviceRef =
          Entity.getEntityReferenceById(
              Entity.LLM_SERVICE, UUID.fromString(record.getFromId()), NON_DELETED);
      serviceMap.put(llmModelId, serviceRef);
    }

    return serviceMap;
  }

  @Override
  public void clearFields(LLMModel llmModel, Fields fields) {
    // No additional fields to clear
  }

  @Override
  public void restorePatchAttributes(LLMModel original, LLMModel updated) {
    super.restorePatchAttributes(original, updated);
    updated.withService(original.getService());
  }

  @Override
  public void prepare(LLMModel llmModel, boolean update) {
    if (llmModel.getService() != null) {
      populateService(llmModel);
    }
  }

  @Override
  public void storeEntity(LLMModel llmModel, boolean update) {
    EntityReference service = llmModel.getService();
    llmModel.withService(null);
    store(llmModel, update);
    llmModel.withService(service);
  }

  @Override
  public void storeEntities(List<LLMModel> entities) {
    List<LLMModel> entitiesToStore = new ArrayList<>();
    Gson gson = new Gson();
    for (LLMModel entity : entities) {
      EntityReference service = entity.getService();
      entity.withService(null);
      String jsonCopy = gson.toJson(entity);
      entitiesToStore.add(gson.fromJson(jsonCopy, LLMModel.class));
      entity.withService(service);
    }
    storeMany(entitiesToStore);
  }

  @Override
  public void storeRelationships(LLMModel llmModel) {
    if (llmModel.getService() != null) {
      addServiceRelationship(llmModel, llmModel.getService());
    }
  }

  @Override
  public EntityRepository<LLMModel>.EntityUpdater getUpdater(
      LLMModel original, LLMModel updated, Operation operation, ChangeSource changeSource) {
    return new LLMModelUpdater(original, updated, operation);
  }

  @Override
  public EntityInterface getParentEntity(LLMModel entity, String fields) {
    if (entity.getService() == null) {
      return null;
    }
    return Entity.getEntity(entity.getService(), fields, Include.ALL);
  }

  private void populateService(LLMModel llmModel) {
    LLMService service = Entity.getEntity(llmModel.getService(), "", Include.NON_DELETED);
    llmModel.setService(service.getEntityReference());
  }

  public class LLMModelUpdater extends EntityUpdater {
    public LLMModelUpdater(LLMModel original, LLMModel updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("baseModel", original.getBaseModel(), updated.getBaseModel());
      recordChange("modelVersion", original.getModelVersion(), updated.getModelVersion());
      recordChange("modelProvider", original.getModelProvider(), updated.getModelProvider());
      recordChange(
          "modelSpecifications",
          original.getModelSpecifications(),
          updated.getModelSpecifications(),
          true);
      recordChange(
          "trainingMetadata", original.getTrainingMetadata(), updated.getTrainingMetadata(), true);
      recordChange(
          "modelEvaluation", original.getModelEvaluation(), updated.getModelEvaluation(), true);
      recordChange("costMetrics", original.getCostMetrics(), updated.getCostMetrics(), true);
      recordChange(
          "deploymentInfo", original.getDeploymentInfo(), updated.getDeploymentInfo(), true);
      recordChange(
          "governanceStatus", original.getGovernanceStatus(), updated.getGovernanceStatus());
    }
  }
}
