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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DASHBOARD;
import static org.openmetadata.service.Entity.MLMODEL;
import static org.openmetadata.service.Entity.getEntityReference;
import static org.openmetadata.service.Entity.getEntityReferenceById;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkMutuallyExclusive;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.service.util.EntityUtil.mlFeatureMatch;
import static org.openmetadata.service.util.EntityUtil.mlHyperParameterMatch;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.MlFeatureSource;
import org.openmetadata.schema.type.MlHyperParameter;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityBatchFields;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.mlmodels.MlModelResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Repository()
public class MlModelRepository implements EntityPolicy<MlModel> {

  private static final String MODEL_UPDATE_FIELDS = "dashboard";

  private static final String MODEL_PATCH_FIELDS = "dashboard";

  private static final Set<String> CHANGE_SUMMARY_FIELDS = Set.of("mlFeatures.description");

  public MlModelRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                MlModelResource.COLLECTION_PATH,
                Entity.MLMODEL,
                MlModel.class,
                Entity.getCollectionDAO().mlModelDAO()),
            new EntityPolicyContext.WriteFields(
                MODEL_PATCH_FIELDS, MODEL_UPDATE_FIELDS, CHANGE_SUMMARY_FIELDS),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
    // Covered by the parent service delete cascade: search docs by service.id
    // (SearchRepository.deleteOrUpdateChildren) and field_relationship / tag_usage by
    // the root cleanup() FQN prefix. See EntityRepository#descendantsCoveredByAncestorCascade.
    context().options().setDescendantsCoveredByAncestorCascade(true);
    // Register bulk field fetchers for efficient database operations
    fieldLoading().register("dashboard", this::fetchAndSetDashboards);
    fieldLoading().register("usageSummary", this::fetchAndSetUsageSummaries);
  }

  public static MlFeature findMlFeature(List<MlFeature> features, String featureName) {
    return features.stream()
        .filter(c -> c.getName().equals(featureName))
        .findFirst()
        .orElseThrow(
            () ->
                new IllegalArgumentException(
                    CatalogExceptionMessage.invalidFieldName("mlFeature", featureName)));
  }

  @Override
  public void setFullyQualifiedName(MlModel mlModel) {
    mlModel.setFullyQualifiedName(
        FullyQualifiedName.add(mlModel.getService().getFullyQualifiedName(), mlModel.getName()));
    if (!nullOrEmpty(mlModel.getMlFeatures())) {
      setMlFeatureFQN(mlModel.getFullyQualifiedName(), mlModel.getMlFeatures());
    }
  }

  @Override
  public void setFields(MlModel mlModel, Fields fields, RelationIncludes relationIncludes) {
    mlModel.setService(relationships().container(mlModel.getId(), null));
    mlModel.setDashboard(
        fields.contains("dashboard") ? getDashboard(mlModel) : mlModel.getDashboard());
    if (mlModel.getUsageSummary() == null) {
      mlModel.withUsageSummary(
          fields.contains("usageSummary")
              ? EntityUtil.getLatestUsage(
                  context().dependencies().daos().usageDAO(), mlModel.getId())
              : mlModel.getUsageSummary());
    }
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<MlModel> entities) {
    // Always set default service field for all ML models
    fetchAndSetDefaultService(entities);
    fieldLoading().populate(entities, fields);
    setInheritedFields(entities, fields);
    for (MlModel entity : entities) {
      clearFieldsInternal(entity, fields);
    }
  }

  // Individual field fetchers registered in constructor
  private void fetchAndSetDashboards(List<MlModel> mlModels, Fields fields) {
    if (!fields.contains("dashboard") || mlModels == null || mlModels.isEmpty()) {
      return;
    }
    EntityBatchFields.assign(true, mlModels, batchFetchDashboards(mlModels), MlModel::setDashboard);
  }

  private void fetchAndSetUsageSummaries(List<MlModel> mlModels, Fields fields) {
    if (!fields.contains("usageSummary") || mlModels == null || mlModels.isEmpty()) {
      return;
    }
    EntityBatchFields.assign(
        true,
        mlModels,
        EntityUtil.getLatestUsageForEntities(
            context().dependencies().daos().usageDAO(), EntityBatchFields.ids(mlModels)),
        MlModel::setUsageSummary);
  }

  private Map<UUID, EntityReference> batchFetchDashboards(List<MlModel> mlModels) {
    Map<UUID, EntityReference> dashboardMap = new HashMap<>();
    if (mlModels == null || mlModels.isEmpty()) {
      return dashboardMap;
    }
    List<CollectionDAO.EntityRelationshipObject> records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findToBatch(
                entityListToStrings(mlModels), Relationship.HAS.ordinal(), Entity.DASHBOARD);
    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID mlModelId = UUID.fromString(record.getFromId());
      EntityReference dashboardRef =
          getEntityReferenceById(Entity.DASHBOARD, UUID.fromString(record.getToId()), NON_DELETED);
      dashboardMap.put(mlModelId, dashboardRef);
    }
    return dashboardMap;
  }

  private void fetchAndSetDefaultService(List<MlModel> mlModels) {
    if (mlModels == null || mlModels.isEmpty()) {
      return;
    }
    // Batch fetch service references for all ML models
    Map<UUID, EntityReference> serviceMap = batchFetchServices(mlModels);
    // Set service for all ML models
    for (MlModel mlModel : mlModels) {
      mlModel.setService(serviceMap.get(mlModel.getId()));
    }
  }

  private Map<UUID, EntityReference> batchFetchServices(List<MlModel> mlModels) {
    Map<UUID, EntityReference> serviceMap = new HashMap<>();
    if (mlModels == null || mlModels.isEmpty()) {
      return serviceMap;
    }
    // Single batch query to get all services for all ML models
    List<CollectionDAO.EntityRelationshipObject> records =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findFromBatch(entityListToStrings(mlModels), Relationship.CONTAINS.ordinal());
    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID mlModelId = UUID.fromString(record.getToId());
      EntityReference serviceRef = resolveServiceRefLeniently(UUID.fromString(record.getFromId()));
      if (serviceRef != null) {
        serviceMap.put(mlModelId, serviceRef);
      }
    }
    return serviceMap;
  }

  private EntityReference resolveServiceRefLeniently(UUID serviceId) {
    EntityReference serviceRef = null;
    try {
      serviceRef = Entity.getEntityReferenceById(Entity.MLMODEL_SERVICE, serviceId, NON_DELETED);
    } catch (EntityNotFoundException e) {
      // The parent service can be hard-deleted concurrently (e.g. a sibling test's cascade delete)
      // between the relationship lookup above and this resolution. The ml model row is mid-cascade
      // and about to be removed, so tolerate the missing service rather than failing the read.
      LOG.debug("MlModel service {} not found (concurrent delete); skipping", serviceId);
    }
    return serviceRef;
  }

  @Override
  public void clearFields(MlModel mlModel, Fields fields) {
    mlModel.setDashboard(fields.contains("dashboard") ? mlModel.getDashboard() : null);
    mlModel.withUsageSummary(fields.contains("usageSummary") ? mlModel.getUsageSummary() : null);
  }

  @Override
  public void restorePatchAttributes(MlModel original, MlModel updated) {
    // Patch can't make changes to following fields. Ignore the changes
    EntityPolicy.super.restorePatchAttributes(original, updated);
    updated.withService(original.getService());
  }

  private void setMlFeatureSourcesFQN(List<MlFeatureSource> mlSources) {
    mlSources.forEach(
        s -> {
          FullyQualifiedName.validateFqnName(s.getName());
          if (s.getDataSource() != null) {
            s.setFullyQualifiedName(
                FullyQualifiedName.add(s.getDataSource().getFullyQualifiedName(), s.getName()));
          } else {
            s.setFullyQualifiedName(s.getName());
          }
        });
  }

  private void setMlFeatureFQN(String parentFQN, List<MlFeature> mlFeatures) {
    mlFeatures.forEach(
        f -> {
          FullyQualifiedName.validateFqnName(f.getName());
          String featureFqn = FullyQualifiedName.add(parentFQN, f.getName());
          f.setFullyQualifiedName(featureFqn);
          if (f.getFeatureSources() != null) {
            setMlFeatureSourcesFQN(f.getFeatureSources());
          }
        });
  }

  /**
   * Make sure that all the MlFeatureSources are pointing to correct EntityReferences in tha Table
   * DAO.
   */
  private void validateReferences(List<MlFeature> mlFeatures) {
    for (MlFeature feature : mlFeatures) {
      if (!nullOrEmpty(feature.getFeatureSources())) {
        for (MlFeatureSource source : feature.getFeatureSources()) {
          validateMlDataSource(source);
        }
      }
    }
  }

  private void validateMlDataSource(MlFeatureSource source) {
    if (source.getDataSource() != null) {
      Entity.getEntityReference(source.getDataSource(), Include.NON_DELETED);
    }
  }

  @Override
  public void prepare(MlModel mlModel, boolean update) {
    populateService(mlModel);
    if (!nullOrEmpty(mlModel.getMlFeatures())) {
      validateReferences(mlModel.getMlFeatures());
      mlModel.getMlFeatures().forEach(feature -> checkMutuallyExclusive(feature.getTags()));
    }
    // Check that the dashboard exists
    if (mlModel.getDashboard() != null) {
      mlModel.setDashboard(Entity.getEntityReference(mlModel.getDashboard(), Include.NON_DELETED));
    }
  }

  @Override
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("service", "dashboard");
  }

  @Override
  public void storeEntity(MlModel mlModel, boolean update) {
    persistence().store(mlModel, update);
  }

  @Override
  public void storeEntities(List<MlModel> entities) {
    persistence().insertMany(entities);
  }

  @Override
  public void clearEntitySpecificRelationshipsForMany(List<MlModel> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(MlModel::getId).toList();
    deleteToMany(ids, context().schema().entityType(), Relationship.CONTAINS, null);
    deleteFromMany(ids, Entity.MLMODEL, Relationship.USES, Entity.DASHBOARD);
  }

  @Override
  public void storeRelationships(MlModel mlModel) {
    addServiceRelationship(mlModel, mlModel.getService());
    if (mlModel.getDashboard() != null) {
      // Add relationship from MlModel --- uses ---> Dashboard
      relationshipWrites()
          .add(
              new EntityRelationshipWriter.Edge(
                  mlModel.getId(),
                  mlModel.getDashboard().getId(),
                  Entity.MLMODEL,
                  Entity.DASHBOARD,
                  Relationship.USES),
              EntityRelationshipWriter.Value.EMPTY,
              false);
    }
    setMlFeatureSourcesLineage(mlModel);
  }

  @Override
  public void storeEntitySpecificRelationshipsForMany(List<MlModel> entities) {
    List<CollectionDAO.EntityRelationshipObject> relationships = new ArrayList<>();
    for (MlModel mlModel : entities) {
      EntityReference service = mlModel.getService();
      if (service != null && service.getId() != null) {
        relationships.add(
            newRelationship(
                service.getId(),
                mlModel.getId(),
                service.getType(),
                context().schema().entityType(),
                Relationship.CONTAINS));
      }
      if (mlModel.getDashboard() != null && mlModel.getDashboard().getId() != null) {
        relationships.add(
            newRelationship(
                mlModel.getId(),
                mlModel.getDashboard().getId(),
                Entity.MLMODEL,
                Entity.DASHBOARD,
                Relationship.USES));
      }
      setMlFeatureSourcesLineage(mlModel);
    }
    bulkInsertRelationships(relationships);
  }

  /**
   * If we have the properties MLFeatures -> MlFeatureSources and the feature sources have properly
   * informed the Data Source EntityRef, then we will automatically build the lineage between tables
   * and ML Model.
   */
  private void setMlFeatureSourcesLineage(MlModel mlModel) {
    if (mlModel.getMlFeatures() != null) {
      mlModel
          .getMlFeatures()
          .forEach(
              mlFeature -> {
                if (mlFeature.getFeatureSources() != null) {
                  mlFeature
                      .getFeatureSources()
                      .forEach(
                          mlFeatureSource -> {
                            EntityReference targetEntity =
                                getEntityReference(mlFeatureSource.getDataSource(), Include.ALL);
                            if (targetEntity != null) {
                              relationshipWrites()
                                  .add(
                                      new EntityRelationshipWriter.Edge(
                                          targetEntity.getId(),
                                          mlModel.getId(),
                                          targetEntity.getType(),
                                          MLMODEL,
                                          Relationship.UPSTREAM),
                                      EntityRelationshipWriter.Value.EMPTY,
                                      false);
                            }
                          });
                }
              });
    }
  }

  @Override
  public EntityUpdater<MlModel> getUpdater(
      MlModel original, MlModel updated, EntityOperation operation, ChangeSource changeSource) {
    return new MlModelUpdater(original, updated, operation).mutation();
  }

  @Override
  public EntityReference getParentReference(MlModel entity) {
    return entity.getService();
  }

  @Override
  public EntityInterface getParentEntity(MlModel entity, String fields) {
    if (entity.getService() == null) {
      return null;
    }
    return Entity.getEntity(entity.getService(), fields, Include.ALL);
  }

  @Override
  public List<TagLabel> getAllTags(EntityInterface entity) {
    List<TagLabel> allTags = new ArrayList<>();
    MlModel mlModel = (MlModel) entity;
    EntityUtil.mergeTags(allTags, mlModel.getTags());
    for (MlFeature feature : listOrEmpty(mlModel.getMlFeatures())) {
      EntityUtil.mergeTags(allTags, feature.getTags());
      for (MlFeatureSource source : listOrEmpty(feature.getFeatureSources())) {
        EntityUtil.mergeTags(allTags, source.getTags());
      }
    }
    return allTags;
  }

  private void populateService(MlModel mlModel) {
    var service =
        (MlModelService) getCachedParentOrLoad(mlModel.getService(), "", Include.NON_DELETED);
    mlModel.setService(service.getEntityReference());
    mlModel.setServiceType(service.getServiceType());
  }

  private EntityReference getDashboard(MlModel mlModel) {
    return mlModel == null
        ? null
        : relationships().singleTo(mlModel.getId(), Relationship.USES, DASHBOARD, false);
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class MlModelUpdater implements EntitySpecificMutation<MlModel> {

    public MlModelUpdater(MlModel original, MlModel updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Transaction
    @Override
    public void update(EntityUpdater<MlModel> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "algorithm",
          () -> updateAlgorithm(entityUpdate.getOriginal(), entityUpdate.getUpdated()));
      entityUpdate.compareAndUpdate(
          "dashboard",
          () -> updateDashboard(entityUpdate.getOriginal(), entityUpdate.getUpdated()));
      entityUpdate.compareAndUpdate(
          "mlFeatures",
          () -> updateMlFeatures(entityUpdate.getOriginal(), entityUpdate.getUpdated()));
      entityUpdate.compareAndUpdate(
          "mlHyperParameters",
          () -> updateMlHyperParameters(entityUpdate.getOriginal(), entityUpdate.getUpdated()));
      entityUpdate.compareAndUpdate(
          "mlStore", () -> updateMlStore(entityUpdate.getOriginal(), entityUpdate.getUpdated()));
      entityUpdate.compareAndUpdate(
          "server", () -> updateServer(entityUpdate.getOriginal(), entityUpdate.getUpdated()));
      entityUpdate.compareAndUpdate(
          "target", () -> updateTarget(entityUpdate.getOriginal(), entityUpdate.getUpdated()));
      entityUpdate.compareAndUpdate(
          "sourceUrl",
          () ->
              entityUpdate.recordChange(
                  "sourceUrl",
                  entityUpdate.getOriginal().getSourceUrl(),
                  entityUpdate.getUpdated().getSourceUrl()));
      entityUpdate.compareAndUpdate(
          "sourceHash",
          () ->
              entityUpdate.recordChange(
                  "sourceHash",
                  entityUpdate.getOriginal().getSourceHash(),
                  entityUpdate.getUpdated().getSourceHash(),
                  false,
                  EntityUtil.objectMatch,
                  false));
    }

    private void updateAlgorithm(MlModel origModel, MlModel updatedModel) {
      // Updating an algorithm should be flagged for an ML Model
      // Algorithm is a required field. Cannot be null.
      if (entityUpdate.getUpdated().getAlgorithm() != null
          && (entityUpdate.recordChange(
              "algorithm", origModel.getAlgorithm(), updatedModel.getAlgorithm()))) {
        // Mark the EntityUpdater version change to major
        entityUpdate.setMajorVersionChange(true);
      }
    }

    private void updateMlFeatures(MlModel origModel, MlModel updatedModel) {
      List<MlFeature> addedList = new ArrayList<>();
      List<MlFeature> deletedList = new ArrayList<>();
      entityUpdate.recordListChange(
          "mlFeatures",
          origModel.getMlFeatures(),
          updatedModel.getMlFeatures(),
          addedList,
          deletedList,
          mlFeatureMatch);
      for (MlFeature updatedFeature : listOrEmpty(updatedModel.getMlFeatures())) {
        MlFeature storedFeature =
            listOrEmpty(origModel.getMlFeatures()).stream()
                .filter(feature -> mlFeatureMatch.test(feature, updatedFeature))
                .findAny()
                .orElse(null);
        if (storedFeature == null) {
          continue;
        }
        updateMlFeatureDescription(storedFeature, updatedFeature);
      }
    }

    private void updateMlFeatureDescription(MlFeature originalFeature, MlFeature updatedFeature) {
      if (entityUpdate.getOperation().isPut()
          && !nullOrEmpty(originalFeature.getDescription())
          && entityUpdate.updatedByBot()) {
        updatedFeature.setDescription(originalFeature.getDescription());
        return;
      }
      entityUpdate.recordChange(
          "mlFeatures." + originalFeature.getName() + ".description",
          originalFeature.getDescription(),
          updatedFeature.getDescription());
    }

    private void updateMlHyperParameters(MlModel origModel, MlModel updatedModel) {
      List<MlHyperParameter> addedList = new ArrayList<>();
      List<MlHyperParameter> deletedList = new ArrayList<>();
      entityUpdate.recordListChange(
          "mlHyperParameters",
          origModel.getMlHyperParameters(),
          updatedModel.getMlHyperParameters(),
          addedList,
          deletedList,
          mlHyperParameterMatch);
    }

    private void updateMlStore(MlModel origModel, MlModel updatedModel) {
      entityUpdate.recordChange("mlStore", origModel.getMlStore(), updatedModel.getMlStore(), true);
    }

    private void updateServer(MlModel origModel, MlModel updatedModel) {
      // Updating the server can break current integrations to the ML services or enable new
      // integrations
      if (entityUpdate.recordChange("server", origModel.getServer(), updatedModel.getServer())) {
        // Mark the EntityUpdater version change to major
        entityUpdate.setMajorVersionChange(true);
      }
    }

    private void updateTarget(MlModel origModel, MlModel updatedModel) {
      // Updating the target changes the model response
      if (entityUpdate.recordChange("target", origModel.getTarget(), updatedModel.getTarget())) {
        entityUpdate.setMajorVersionChange(true);
      }
    }

    private void updateDashboard(MlModel origModel, MlModel updatedModel) {
      EntityReference origDashboard = origModel.getDashboard();
      EntityReference updatedDashboard = updatedModel.getDashboard();
      if (entityUpdate.recordChange(
          "dashboard", origDashboard, updatedDashboard, true, entityReferenceMatch)) {
        // Remove the dashboard associated with the model, if any
        if (origModel.getDashboard() != null) {
          relationshipWrites()
              .deleteIncoming(
                  new EntityRelationshipWriter.Selection(
                      updatedModel.getId(), Entity.MLMODEL, Relationship.USES, Entity.DASHBOARD));
        }
        // Add relationship from model -- uses --> dashboard
        if (updatedDashboard != null) {
          relationshipWrites()
              .add(
                  new EntityRelationshipWriter.Edge(
                      updatedModel.getId(),
                      updatedDashboard.getId(),
                      Entity.MLMODEL,
                      Entity.DASHBOARD,
                      Relationship.USES),
                  EntityRelationshipWriter.Value.EMPTY,
                  false);
        }
      }
    }

    private final EntityUpdater<MlModel> entityUpdate;

    public EntityUpdater<MlModel> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<MlModel> entityContext;

  @Override
  public final EntityPolicyContext<MlModel> context() {
    return entityContext;
  }
}
