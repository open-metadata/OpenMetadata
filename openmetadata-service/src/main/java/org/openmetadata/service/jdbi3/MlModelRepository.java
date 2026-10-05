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
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.MLMODEL;
import static org.openmetadata.service.Entity.getEntityReference;
import static org.openmetadata.service.Entity.getEntityReferenceById;
import static org.openmetadata.service.Entity.populateEntityFieldTags;
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTags;
import static org.openmetadata.service.resources.tags.TagLabelUtil.checkMutuallyExclusive;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.service.util.EntityUtil.mlFeatureMatch;
import static org.openmetadata.service.util.EntityUtil.mlHyperParameterMatch;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
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
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.mlmodels.MlModelResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class MlModelRepository extends EntityRepository<MlModel> {

  private static final String FEATURES_FIELD = "mlFeatures";
  private static final String MODEL_UPDATE_FIELDS = "dashboard";
  private static final String MODEL_PATCH_FIELDS = "dashboard";
  private static final Set<String> CHANGE_SUMMARY_FIELDS = Set.of("mlFeatures.description");

  public MlModelRepository() {
    super(
        MlModelResource.COLLECTION_PATH,
        Entity.MLMODEL,
        MlModel.class,
        Entity.getCollectionDAO().mlModelDAO(),
        MODEL_PATCH_FIELDS,
        MODEL_UPDATE_FIELDS,
        CHANGE_SUMMARY_FIELDS);
    supportsSearch = true;
    // Covered by the parent service delete cascade: search docs by service.id
    // (SearchRepository.deleteOrUpdateChildren) and field_relationship / tag_usage by
    // the root cleanup() FQN prefix. See EntityRepository#descendantsCoveredByAncestorCascade.
    descendantsCoveredByAncestorCascade = true;

    // Register bulk field fetchers for efficient database operations
    fieldFetchers.put("dashboard", this::fetchAndSetDashboards);
    fieldFetchers.put("usageSummary", this::fetchAndSetUsageSummaries);
    fieldFetchers.put(FIELD_TAGS, this::fetchAndSetFeatureTags);
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
    mlModel.setService(getContainer(mlModel.getId()));
    // Feature tags are stripped from the stored JSON, so this is what puts them back.
    populateEntityFieldTags(
        entityType,
        mlModel.getMlFeatures(),
        mlModel.getFullyQualifiedName(),
        fields.contains(FIELD_TAGS));
    mlModel.setDashboard(
        fields.contains("dashboard") ? getDashboard(mlModel) : mlModel.getDashboard());
    if (mlModel.getUsageSummary() == null) {
      mlModel.withUsageSummary(
          fields.contains("usageSummary")
              ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), mlModel.getId())
              : mlModel.getUsageSummary());
    }
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<MlModel> entities) {
    // Always set default service field for all ML models
    fetchAndSetDefaultService(entities);

    fetchAndSetFields(entities, fields);
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
    setFieldFromMap(true, mlModels, batchFetchDashboards(mlModels), MlModel::setDashboard);
  }

  /** The bulk counterpart of the setFields hydration; without it a listed model reads untagged. */
  private void fetchAndSetFeatureTags(List<MlModel> mlModels, Fields fields) {
    if (!fields.contains(FIELD_TAGS) || nullOrEmpty(mlModels)) {
      return;
    }
    for (MlModel mlModel : mlModels) {
      populateEntityFieldTags(
          entityType, mlModel.getMlFeatures(), mlModel.getFullyQualifiedName(), true);
    }
  }

  private void fetchAndSetUsageSummaries(List<MlModel> mlModels, Fields fields) {
    if (!fields.contains("usageSummary") || mlModels == null || mlModels.isEmpty()) {
      return;
    }
    setFieldFromMap(
        true,
        mlModels,
        EntityUtil.getLatestUsageForEntities(daoCollection.usageDAO(), entityListToUUID(mlModels)),
        MlModel::setUsageSummary);
  }

  private Map<UUID, EntityReference> batchFetchDashboards(List<MlModel> mlModels) {
    Map<UUID, EntityReference> dashboardMap = new HashMap<>();
    if (mlModels == null || mlModels.isEmpty()) {
      return dashboardMap;
    }

    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
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
        daoCollection
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
    super.restorePatchAttributes(original, updated);
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
  protected List<String> getFieldsStrippedFromStorageJson() {
    return List.of("service", "dashboard");
  }

  /**
   * Keeps a feature's tags out of the stored JSON, so tag_usage is their single source the way it
   * is for every other type with inline children.
   *
   * <p>Deliberately not recursive, unlike the sibling strippers. A feature source's FQN is built
   * from its dataSource - {@code <table fqn>.<source name>} - so it collides with that table's own
   * column FQN and cannot be keyed in tag_usage without writing onto another entity's tags. Those
   * tags therefore stay in the JSON, which is where they have always lived and where getAllTags
   * still reads them. Nothing hydrates them either: flattening follows getChildren(), and MlFeature
   * has none, so the tag_usage read can never reach a feature source in either direction.
   */
  @Override
  protected ObjectNode storageJsonNode(MlModel mlModel) {
    ObjectNode node = super.storageJsonNode(mlModel);
    if (node.get("mlFeatures") instanceof ArrayNode features) {
      for (JsonNode feature : features) {
        if (feature instanceof ObjectNode featureNode) {
          featureNode.remove(FIELD_TAGS);
        }
      }
    }
    return node;
  }

  /**
   * Normalises a feature's tags on the way in, the way every other type with inline children does.
   * Without it the entity a write returns carries the tag labels exactly as the client sent them,
   * while a later read carries the labels rebuilt from tag_usage. A client that diffs the two, as
   * a JSON Patch caller does, then writes a patch against fields the stored copy never had.
   */
  @Override
  public void validateTags(MlModel entity) {
    super.validateTags(entity);
    for (MlFeature feature : listOrEmpty(entity.getMlFeatures())) {
      validateTags(feature.getTags());
      feature.setTags(addDerivedTags(feature.getTags()));
      checkMutuallyExclusive(feature.getTags());
    }
  }

  @Override
  public void applyTags(MlModel mlModel) {
    super.applyTags(mlModel);
    applyFeatureTags(mlModel.getMlFeatures());
  }

  /**
   * Indexes each feature's tags under the feature's own FQN, the way every other type with inline
   * children does. The model's stored JSON stays the primary copy; tag_usage is what a reader
   * querying by FQN prefix can see, and without these rows such a reader finds nothing and
   * concludes the feature is untagged.
   *
   * <p>Feature sources are deliberately not indexed here: their FQNs hang off the source data
   * asset rather than the model, so they fall outside the model's prefix and belong to whatever
   * owns that asset.
   */
  private void applyFeatureTags(List<MlFeature> features) {
    for (MlFeature feature : listOrEmpty(features)) {
      applyTags(feature.getTags(), feature.getFullyQualifiedName());
    }
  }

  /**
   * The batched create path, which does not go through {@link #applyTags(MlModel)}. Without this a
   * model created in bulk has its feature tags stripped from the stored JSON and indexed nowhere,
   * so they are lost outright. Mirrors TableRepository, whose column tags are collected the same
   * way.
   */
  @Override
  protected void applyTagsToEntities(List<MlModel> entities) {
    super.applyTagsToEntities(entities);
    Map<String, List<TagLabel>> featureTagsByTarget = new LinkedHashMap<>();
    for (MlModel mlModel : listOrEmpty(entities)) {
      for (MlFeature feature : listOrEmpty(mlModel.getMlFeatures())) {
        if (!nullOrEmpty(feature.getTags())) {
          featureTagsByTarget.put(
              feature.getFullyQualifiedName(), new ArrayList<>(feature.getTags()));
        }
      }
    }
    applyTagsBatch(featureTagsByTarget);
  }

  @Override
  public void storeEntity(MlModel mlModel, boolean update) {
    store(mlModel, update);
  }

  @Override
  public void storeEntities(List<MlModel> entities) {
    storeMany(entities);
  }

  @Override
  protected void clearEntitySpecificRelationshipsForMany(List<MlModel> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(MlModel::getId).toList();
    deleteToMany(ids, entityType, Relationship.CONTAINS, null);
    deleteFromMany(ids, Entity.MLMODEL, Relationship.USES, Entity.DASHBOARD);
  }

  @Override
  public void storeRelationships(MlModel mlModel) {
    addServiceRelationship(mlModel, mlModel.getService());

    if (mlModel.getDashboard() != null) {
      // Add relationship from MlModel --- uses ---> Dashboard
      addRelationship(
          mlModel.getId(),
          mlModel.getDashboard().getId(),
          Entity.MLMODEL,
          Entity.DASHBOARD,
          Relationship.USES);
    }

    setMlFeatureSourcesLineage(mlModel);
  }

  @Override
  protected void storeEntitySpecificRelationshipsForMany(List<MlModel> entities) {
    List<CollectionDAO.EntityRelationshipObject> relationships = new ArrayList<>();
    for (MlModel mlModel : entities) {
      EntityReference service = mlModel.getService();
      if (service != null && service.getId() != null) {
        relationships.add(
            newRelationship(
                service.getId(),
                mlModel.getId(),
                service.getType(),
                entityType,
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
                              addRelationship(
                                  targetEntity.getId(),
                                  mlModel.getId(),
                                  targetEntity.getType(),
                                  MLMODEL,
                                  Relationship.UPSTREAM);
                            }
                          });
                }
              });
    }
  }

  @Override
  public EntityRepository<MlModel>.EntityUpdater getUpdater(
      MlModel original, MlModel updated, Operation operation, ChangeSource changeSource) {
    return new MlModelUpdater(original, updated, operation, changeSource);
  }

  @Override
  protected EntityReference getParentReference(MlModel entity) {
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
        : getToEntityRef(mlModel.getId(), Relationship.USES, DASHBOARD, false);
  }

  /** Handles entity updated from PUT and POST operation. */
  public class MlModelUpdater extends EntityUpdater {
    public MlModelUpdater(
        MlModel original, MlModel updated, Operation operation, ChangeSource changeSource) {
      super(original, updated, operation, changeSource);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      compareAndUpdate("algorithm", () -> updateAlgorithm(original, updated));
      compareAndUpdate("dashboard", () -> updateDashboard(original, updated));
      compareAndUpdate("mlFeatures", () -> updateMlFeatures(original, updated));
      compareAndUpdate("mlHyperParameters", () -> updateMlHyperParameters(original, updated));
      compareAndUpdate("mlStore", () -> updateMlStore(original, updated));
      compareAndUpdate("server", () -> updateServer(original, updated));
      compareAndUpdate("target", () -> updateTarget(original, updated));
      compareAndUpdate(
          "sourceUrl",
          () -> recordChange("sourceUrl", original.getSourceUrl(), updated.getSourceUrl()));
      compareAndUpdate(
          "sourceHash",
          () ->
              recordChange(
                  "sourceHash",
                  original.getSourceHash(),
                  updated.getSourceHash(),
                  false,
                  EntityUtil.objectMatch,
                  false));
    }

    private void updateAlgorithm(MlModel origModel, MlModel updatedModel) {
      // Updating an algorithm should be flagged for an ML Model
      // Algorithm is a required field. Cannot be null.
      if (updated.getAlgorithm() != null
          && (recordChange("algorithm", origModel.getAlgorithm(), updatedModel.getAlgorithm()))) {
        // Mark the EntityUpdater version change to major
        majorVersionChange = true;
      }
    }

    private void updateMlFeatures(MlModel origModel, MlModel updatedModel) {
      List<MlFeature> addedList = new ArrayList<>();
      List<MlFeature> deletedList = new ArrayList<>();
      recordListChange(
          "mlFeatures",
          origModel.getMlFeatures(),
          updatedModel.getMlFeatures(),
          addedList,
          deletedList,
          mlFeatureMatch);

      for (MlFeature updatedFeature : listOrEmpty(updatedModel.getMlFeatures())) {
        // Paired by name, the way every sibling type pairs its children. mlFeatureMatch is whole
        // object equality, which is right for the recordListChange above but wrong here: a
        // feature is "the same feature" across an edit precisely when its fields differ, so
        // matching on equality found nothing and skipped the per-feature updates below for any
        // feature that had actually changed.
        MlFeature storedFeature =
            listOrEmpty(origModel.getMlFeatures()).stream()
                .filter(feature -> feature.getName().equals(updatedFeature.getName()))
                .findAny()
                .orElse(null);
        if (storedFeature == null) {
          continue;
        }

        updateMlFeatureDescription(storedFeature, updatedFeature);
        // Index the feature's tags the way the pipeline updater does for a task. applyTags only
        // runs on create, so without this a tag added or removed by a patch never reaches
        // tag_usage and any reader querying by FQN prefix keeps seeing the pre-patch set.
        updatedFeature.setTags(
            updateTags(
                storedFeature.getFullyQualifiedName(),
                EntityUtil.getFieldName(FEATURES_FIELD, updatedFeature.getName(), FIELD_TAGS),
                storedFeature.getTags(),
                updatedFeature.getTags()));
      }

      indexTagsOfAddedAndRemovedFeatures(origModel, updatedModel);
    }

    /**
     * Indexes a newly added feature's tags and drops the rows of one that is gone, mirroring what
     * the pipeline updater does for tasks. The loop above only covers features on both sides, so
     * without this a feature added with tags is never indexed, and a removed feature leaves rows
     * behind that a later feature of the same name would inherit.
     *
     * <p>Membership is by name rather than the addedList/deletedList that recordListChange fills:
     * those use whole-object equality, so a feature whose tags merely changed appears in both and
     * would be deleted and re-added on every edit.
     */
    private void indexTagsOfAddedAndRemovedFeatures(MlModel origModel, MlModel updatedModel) {
      Set<String> origNames = featureNames(origModel);
      Set<String> updatedNames = featureNames(updatedModel);

      for (MlFeature feature : listOrEmpty(origModel.getMlFeatures())) {
        if (!updatedNames.contains(feature.getName())) {
          daoCollection.tagUsageDAO().deleteTagsByTarget(feature.getFullyQualifiedName());
        }
      }
      for (MlFeature feature : listOrEmpty(updatedModel.getMlFeatures())) {
        if (!origNames.contains(feature.getName())) {
          applyTags(feature.getTags(), feature.getFullyQualifiedName());
        }
      }
    }

    private Set<String> featureNames(MlModel model) {
      return listOrEmpty(model.getMlFeatures()).stream()
          .map(MlFeature::getName)
          .collect(Collectors.toSet());
    }

    private void updateMlFeatureDescription(MlFeature originalFeature, MlFeature updatedFeature) {
      if (operation.isPut() && !nullOrEmpty(originalFeature.getDescription()) && updatedByBot()) {
        updatedFeature.setDescription(originalFeature.getDescription());
        return;
      }

      recordChange(
          "mlFeatures." + originalFeature.getName() + ".description",
          originalFeature.getDescription(),
          updatedFeature.getDescription());
    }

    private void updateMlHyperParameters(MlModel origModel, MlModel updatedModel) {
      List<MlHyperParameter> addedList = new ArrayList<>();
      List<MlHyperParameter> deletedList = new ArrayList<>();
      recordListChange(
          "mlHyperParameters",
          origModel.getMlHyperParameters(),
          updatedModel.getMlHyperParameters(),
          addedList,
          deletedList,
          mlHyperParameterMatch);
    }

    private void updateMlStore(MlModel origModel, MlModel updatedModel) {
      recordChange("mlStore", origModel.getMlStore(), updatedModel.getMlStore(), true);
    }

    private void updateServer(MlModel origModel, MlModel updatedModel) {
      // Updating the server can break current integrations to the ML services or enable new
      // integrations
      if (recordChange("server", origModel.getServer(), updatedModel.getServer())) {
        // Mark the EntityUpdater version change to major
        majorVersionChange = true;
      }
    }

    private void updateTarget(MlModel origModel, MlModel updatedModel) {
      // Updating the target changes the model response
      if (recordChange("target", origModel.getTarget(), updatedModel.getTarget())) {
        majorVersionChange = true;
      }
    }

    private void updateDashboard(MlModel origModel, MlModel updatedModel) {
      EntityReference origDashboard = origModel.getDashboard();
      EntityReference updatedDashboard = updatedModel.getDashboard();
      if (recordChange("dashboard", origDashboard, updatedDashboard, true, entityReferenceMatch)) {

        // Remove the dashboard associated with the model, if any
        if (origModel.getDashboard() != null) {
          deleteTo(updatedModel.getId(), Entity.MLMODEL, Relationship.USES, Entity.DASHBOARD);
        }

        // Add relationship from model -- uses --> dashboard
        if (updatedDashboard != null) {
          addRelationship(
              updatedModel.getId(),
              updatedDashboard.getId(),
              Entity.MLMODEL,
              Entity.DASHBOARD,
              Relationship.USES);
        }
      }
    }
  }
}
