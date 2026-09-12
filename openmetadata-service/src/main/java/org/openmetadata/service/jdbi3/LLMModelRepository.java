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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.schema.entity.services.LLMService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityReadService;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.ai.LLMModelResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Repository
public class LLMModelRepository implements EntityPolicy<LLMModel> {

  private static final String FIELD_CAPABILITIES = "capabilities";

  private static final String FIELD_CERTIFICATIONS = "certifications";

  private static final String FIELD_DETECTION = "detection";

  private static final String FIELD_EVIDENCE = "evidence";

  private static final String FIELD_MODEL_TYPE = "modelType";

  private static final String FIELD_PROVIDER_MODEL_ID = "providerModelId";

  private static final String FIELD_REGULATORY_COMPLIANCE = "regulatoryCompliance";

  private static final String FIELD_REMEDIATION_ACTIONS = "remediationActions";

  private static final String MODEL_UPDATE_FIELDS = "usedByAgents,reviewers";

  private static final String MODEL_PATCH_FIELDS = "usedByAgents,reviewers";

  public LLMModelRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                LLMModelResource.COLLECTION_PATH,
                Entity.LLM_MODEL,
                LLMModel.class,
                Entity.getCollectionDAO().llmModelDAO()),
            new EntityPolicyContext.WriteFields(MODEL_PATCH_FIELDS, MODEL_UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
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
    llmModel.setService(relationships().container(llmModel.getId(), null));
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<LLMModel> entities) {
    fetchAndSetDefaultService(entities);
    fieldLoading().populate(entities, fields);
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
        context()
            .dependencies()
            .daos()
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
    EntityPolicy.super.restorePatchAttributes(original, updated);
    updated.withService(original.getService());
  }

  @Override
  public void prepare(LLMModel llmModel, boolean update) {
    if (llmModel.getService() != null) {
      populateService(llmModel);
    }
    AIAssetStatusSync.sync(llmModel);
  }

  @Override
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("service");
  }

  @Override
  public void storeEntity(LLMModel llmModel, boolean update) {
    persistence().store(llmModel, update);
  }

  @Override
  public void storeEntities(List<LLMModel> entities) {
    persistence().insertMany(entities);
  }

  @Override
  public void storeRelationships(LLMModel llmModel) {
    if (llmModel.getService() != null) {
      addServiceRelationship(llmModel, llmModel.getService());
    }
  }

  @Override
  public EntityUpdater<LLMModel> getUpdater(
      LLMModel original, LLMModel updated, EntityOperation operation, ChangeSource changeSource) {
    return new LLMModelUpdater(original, updated, operation).mutation();
  }

  @Override
  public EntityReference getParentReference(LLMModel entity) {
    return entity.getService();
  }

  @Override
  public EntityInterface getParentEntity(LLMModel entity, String fields) {
    if (entity.getService() == null) {
      return null;
    }
    EntityReference service = entity.getService();
    EntityPolicy<?> serviceRepository = Entity.getEntityRepository(service.getType());
    Fields parentFields = serviceRepository.fieldPolicy().supported(fields);
    return service.getId() != null
        ? serviceRepository
            .reads()
            .byId(
                service.getId(),
                new EntityReadService.Query(
                    null, parentFields, RelationIncludes.fromInclude(Include.ALL), true))
        : serviceRepository
            .reads()
            .byName(
                service.getFullyQualifiedName(),
                new EntityReadService.Query(
                    null, parentFields, RelationIncludes.fromInclude(Include.ALL), true));
  }

  private void populateService(LLMModel llmModel) {
    var service =
        (LLMService) getCachedParentOrLoad(llmModel.getService(), "", Include.NON_DELETED);
    llmModel.setService(service.getEntityReference());
  }

  public class LLMModelUpdater implements EntitySpecificMutation<LLMModel> {

    public LLMModelUpdater(LLMModel original, LLMModel updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Override
    public void update(EntityUpdater<LLMModel> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "baseModel",
          () ->
              entityUpdate.recordChange(
                  "baseModel",
                  entityUpdate.getOriginal().getBaseModel(),
                  entityUpdate.getUpdated().getBaseModel()));
      updateModelIdentity();
      updateCapabilities();
      entityUpdate.compareAndUpdate(
          "modelVersion",
          () ->
              entityUpdate.recordChange(
                  "modelVersion",
                  entityUpdate.getOriginal().getModelVersion(),
                  entityUpdate.getUpdated().getModelVersion()));
      entityUpdate.compareAndUpdate(
          "modelProvider",
          () ->
              entityUpdate.recordChange(
                  "modelProvider",
                  entityUpdate.getOriginal().getModelProvider(),
                  entityUpdate.getUpdated().getModelProvider()));
      entityUpdate.compareAndUpdate(
          "modelSpecifications",
          () ->
              entityUpdate.recordChange(
                  "modelSpecifications",
                  entityUpdate.getOriginal().getModelSpecifications(),
                  entityUpdate.getUpdated().getModelSpecifications(),
                  true));
      entityUpdate.compareAndUpdate(
          "trainingMetadata",
          () ->
              entityUpdate.recordChange(
                  "trainingMetadata",
                  entityUpdate.getOriginal().getTrainingMetadata(),
                  entityUpdate.getUpdated().getTrainingMetadata(),
                  true));
      entityUpdate.compareAndUpdate(
          "modelEvaluation",
          () ->
              entityUpdate.recordChange(
                  "modelEvaluation",
                  entityUpdate.getOriginal().getModelEvaluation(),
                  entityUpdate.getUpdated().getModelEvaluation(),
                  true));
      entityUpdate.compareAndUpdate(
          "costMetrics",
          () ->
              entityUpdate.recordChange(
                  "costMetrics",
                  entityUpdate.getOriginal().getCostMetrics(),
                  entityUpdate.getUpdated().getCostMetrics(),
                  true));
      entityUpdate.compareAndUpdate(
          "deploymentInfo",
          () ->
              entityUpdate.recordChange(
                  "deploymentInfo",
                  entityUpdate.getOriginal().getDeploymentInfo(),
                  entityUpdate.getUpdated().getDeploymentInfo(),
                  true));
      entityUpdate.compareAndUpdate(
          "governanceStatus",
          () ->
              entityUpdate.recordChange(
                  "governanceStatus",
                  entityUpdate.getOriginal().getGovernanceStatus(),
                  entityUpdate.getUpdated().getGovernanceStatus()));
      updateGovernanceEvidence();
      updateCompliance();
    }

    private void updateModelIdentity() {
      entityUpdate.compareAndUpdate(
          FIELD_MODEL_TYPE,
          () ->
              entityUpdate.recordChange(
                  FIELD_MODEL_TYPE,
                  entityUpdate.getOriginal().getModelType(),
                  entityUpdate.getUpdated().getModelType()));
      entityUpdate.compareAndUpdate(
          FIELD_PROVIDER_MODEL_ID,
          () ->
              entityUpdate.recordChange(
                  FIELD_PROVIDER_MODEL_ID,
                  entityUpdate.getOriginal().getProviderModelId(),
                  entityUpdate.getUpdated().getProviderModelId()));
    }

    private void updateCapabilities() {
      entityUpdate.compareAndUpdate(
          FIELD_CAPABILITIES,
          () ->
              entityUpdate.recordChange(
                  FIELD_CAPABILITIES,
                  entityUpdate.getOriginal().getCapabilities(),
                  entityUpdate.getUpdated().getCapabilities(),
                  true));
    }

    private void updateGovernanceEvidence() {
      entityUpdate.compareAndUpdate(
          FIELD_DETECTION,
          () ->
              entityUpdate.recordChange(
                  FIELD_DETECTION,
                  entityUpdate.getOriginal().getDetection(),
                  entityUpdate.getUpdated().getDetection(),
                  true));
      entityUpdate.compareAndUpdate(
          FIELD_EVIDENCE,
          () ->
              entityUpdate.recordChange(
                  FIELD_EVIDENCE,
                  entityUpdate.getOriginal().getEvidence(),
                  entityUpdate.getUpdated().getEvidence(),
                  true));
      entityUpdate.compareAndUpdate(
          FIELD_REMEDIATION_ACTIONS,
          () ->
              entityUpdate.recordChange(
                  FIELD_REMEDIATION_ACTIONS,
                  entityUpdate.getOriginal().getRemediationActions(),
                  entityUpdate.getUpdated().getRemediationActions(),
                  true));
    }

    private void updateCompliance() {
      entityUpdate.compareAndUpdate(
          FIELD_CERTIFICATIONS,
          () ->
              entityUpdate.recordChange(
                  FIELD_CERTIFICATIONS,
                  entityUpdate.getOriginal().getCertifications(),
                  entityUpdate.getUpdated().getCertifications(),
                  true));
      entityUpdate.compareAndUpdate(
          FIELD_REGULATORY_COMPLIANCE,
          () ->
              entityUpdate.recordChange(
                  FIELD_REGULATORY_COMPLIANCE,
                  entityUpdate.getOriginal().getRegulatoryCompliance(),
                  entityUpdate.getUpdated().getRegulatoryCompliance(),
                  true));
    }

    private final EntityUpdater<LLMModel> entityUpdate;

    public EntityUpdater<LLMModel> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<LLMModel> entityContext;

  @Override
  public final EntityPolicyContext<LLMModel> context() {
    return entityContext;
  }
}
