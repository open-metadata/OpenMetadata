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

package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.catalog.util.EntityUtil.mlFeatureMatch;
import static org.openmetadata.catalog.util.EntityUtil.mlHyperParameterMatch;
import static org.openmetadata.catalog.util.EntityUtil.toBoolean;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.MlModel;
import org.openmetadata.catalog.resources.mlmodels.MlModelResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.MlFeature;
import org.openmetadata.catalog.type.MlFeatureSource;
import org.openmetadata.catalog.type.MlHyperParameter;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class MlModelRepository extends EntityRepository<MlModel> {
  private static final Logger LOG = LoggerFactory.getLogger(MlModelRepository.class);
  private static final Fields MODEL_UPDATE_FIELDS =
      new Fields(
          MlModelResource.FIELD_LIST, "owner,algorithm,dashboard,mlHyperParameters,mlFeatures,mlStore,server,tags");
  private static final Fields MODEL_PATCH_FIELDS =
      new Fields(MlModelResource.FIELD_LIST, "owner,algorithm,dashboard,mlHyperParameters,mlFeatures,tags");

  public MlModelRepository(CollectionDAO dao) {
    super(
        MlModelResource.COLLECTION_PATH,
        Entity.MLMODEL,
        MlModel.class,
        dao.mlModelDAO(),
        dao,
        MODEL_PATCH_FIELDS,
        MODEL_UPDATE_FIELDS,
        true,
        true,
        true);
  }

  public static String getFQN(MlModel model) {
    return (model.getName());
  }

  @Transaction
  public EntityReference getOwnerReference(MlModel mlModel) throws IOException {
    return EntityUtil.populateOwner(daoCollection.userDAO(), daoCollection.teamDAO(), mlModel.getOwner());
  }

  @Override
  public MlModel setFields(MlModel mlModel, Fields fields) throws IOException {
    mlModel.setDisplayName(mlModel.getDisplayName());
    mlModel.setOwner(fields.contains("owner") ? getOwner(mlModel) : null);
    mlModel.setDashboard(fields.contains("dashboard") ? getDashboard(mlModel) : null);
    mlModel.setMlFeatures(fields.contains("mlFeatures") ? mlModel.getMlFeatures() : null);
    mlModel.setMlHyperParameters(fields.contains("mlHyperParameters") ? mlModel.getMlHyperParameters() : null);
    mlModel.setMlStore(fields.contains("mlStore") ? mlModel.getMlStore() : null);
    mlModel.setServer(fields.contains("server") ? mlModel.getServer() : null);
    mlModel.setFollowers(fields.contains("followers") ? getFollowers(mlModel) : null);
    mlModel.setTags(fields.contains("tags") ? getTags(mlModel.getFullyQualifiedName()) : null);
    mlModel.setUsageSummary(
        fields.contains("usageSummary") ? EntityUtil.getLatestUsage(daoCollection.usageDAO(), mlModel.getId()) : null);
    return mlModel;
  }

  @Override
  public void restorePatchAttributes(MlModel original, MlModel updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated
        .withFullyQualifiedName(original.getFullyQualifiedName())
        .withName(original.getName())
        .withId(original.getId());
  }

  @Override
  public EntityInterface<MlModel> getEntityInterface(MlModel entity) {
    return new MlModelEntityInterface(entity);
  }

  private void setMlFeatureSourcesFQN(List<MlFeatureSource> mlSources) {
    mlSources.forEach(
        s -> {
          if (s.getDataSource() != null) {
            s.setFullyQualifiedName(s.getDataSource().getName() + "." + s.getName());
          } else {
            s.setFullyQualifiedName(s.getName());
          }
        });
  }

  private void setMlFeatureFQN(String parentFQN, List<MlFeature> mlFeatures) {
    mlFeatures.forEach(
        f -> {
          String featureFqn = parentFQN + "." + f.getName();
          f.setFullyQualifiedName(featureFqn);
          if (f.getFeatureSources() != null) {
            setMlFeatureSourcesFQN(f.getFeatureSources());
          }
        });
  }

  /** Make sure that all the MlFeatureSources are pointing to correct EntityReferences in tha Table DAO. */
  private void validateReferences(List<MlFeature> mlFeatures) throws IOException {
    for (MlFeature feature : mlFeatures) {
      if (feature.getFeatureSources() != null && !feature.getFeatureSources().isEmpty()) {
        for (MlFeatureSource source : feature.getFeatureSources()) {
          validateMlDataSource(source);
        }
      }
    }
  }

  private void validateMlDataSource(MlFeatureSource source) throws IOException {
    if (source.getDataSource() != null) {
      Entity.getEntityReference(source.getDataSource().getType(), source.getDataSource().getId());
    }
  }

  @Override
  public void prepare(MlModel mlModel) throws IOException {
    mlModel.setFullyQualifiedName(getFQN(mlModel));

    if (mlModel.getMlFeatures() != null && !mlModel.getMlFeatures().isEmpty()) {
      validateReferences(mlModel.getMlFeatures());
      setMlFeatureFQN(mlModel.getFullyQualifiedName(), mlModel.getMlFeatures());
    }

    // Check if owner is valid and set the relationship
    mlModel.setOwner(EntityUtil.populateOwner(daoCollection.userDAO(), daoCollection.teamDAO(), mlModel.getOwner()));

    // Check that the dashboard exists
    if (mlModel.getDashboard() != null) {
      daoCollection.dashboardDAO().findEntityReferenceById(mlModel.getDashboard().getId());
    }

    mlModel.setTags(EntityUtil.addDerivedTags(daoCollection.tagDAO(), mlModel.getTags()));
  }

  @Override
  public void storeEntity(MlModel mlModel, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = mlModel.getOwner();
    List<TagLabel> tags = mlModel.getTags();
    EntityReference dashboard = mlModel.getDashboard();

    // Don't store owner, dashboard, href and tags as JSON. Build it on the fly based on relationships
    mlModel.withOwner(null).withDashboard(null).withHref(null).withTags(null);

    store(mlModel.getId(), mlModel, update);

    // Restore the relationships
    mlModel.withOwner(owner).withDashboard(dashboard).withTags(tags);
  }

  @Override
  public void storeRelationships(MlModel mlModel) {

    EntityUtil.setOwner(daoCollection.relationshipDAO(), mlModel.getId(), Entity.MLMODEL, mlModel.getOwner());

    setDashboard(mlModel, mlModel.getDashboard());

    if (mlModel.getDashboard() != null) {
      // Add relationship from MlModel to Dashboard
      String dashboardId = mlModel.getDashboard().getId().toString();
      daoCollection
          .relationshipDAO()
          .insert(
              dashboardId, mlModel.getId().toString(), Entity.MLMODEL, Entity.DASHBOARD, Relationship.USES.ordinal());
    }

    applyTags(mlModel);
  }

  @Override
  public EntityUpdater getUpdater(MlModel original, MlModel updated, boolean patchOperation) {
    return new MlModelUpdater(original, updated, patchOperation);
  }

  private EntityReference getDashboard(MlModel mlModel) throws IOException {
    if (mlModel != null) {
      List<EntityReference> ids =
          daoCollection
              .relationshipDAO()
              .findTo(
                  mlModel.getId().toString(),
                  Entity.MLMODEL,
                  Relationship.USES.ordinal(),
                  toBoolean(toInclude(mlModel)));
      if (ids.size() > 1) {
        LOG.warn("Possible database issues - multiple dashboards {} found for model {}", ids, mlModel.getId());
      }
      if (!ids.isEmpty()) {
        UUID dashboardId = ids.get(0).getId();
        return daoCollection.dashboardDAO().findEntityReferenceById(dashboardId);
      }
    }
    return null;
  }

  public void setDashboard(MlModel mlModel, EntityReference dashboard) {
    if (dashboard != null) {
      daoCollection
          .relationshipDAO()
          .insert(
              mlModel.getId().toString(),
              mlModel.getDashboard().getId().toString(),
              Entity.MLMODEL,
              Entity.DASHBOARD,
              Relationship.USES.ordinal());
    }
  }

  public void removeDashboard(MlModel mlModel) {
    daoCollection
        .relationshipDAO()
        .deleteFrom(mlModel.getId().toString(), Entity.MLMODEL, Relationship.USES.ordinal(), Entity.DASHBOARD);
  }

  public static class MlModelEntityInterface implements EntityInterface<MlModel> {
    private final MlModel entity;

    public MlModelEntityInterface(MlModel entity) {
      this.entity = entity;
    }

    @Override
    public UUID getId() {
      return entity.getId();
    }

    @Override
    public String getDescription() {
      return entity.getDescription();
    }

    @Override
    public String getDisplayName() {
      return entity.getDisplayName();
    }

    @Override
    public Boolean isDeleted() {
      return entity.getDeleted();
    }

    @Override
    public EntityReference getOwner() {
      return entity.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getFullyQualifiedName();
    }

    @Override
    public List<TagLabel> getTags() {
      return entity.getTags();
    }

    @Override
    public Double getVersion() {
      return entity.getVersion();
    }

    @Override
    public String getUpdatedBy() {
      return entity.getUpdatedBy();
    }

    @Override
    public long getUpdatedAt() {
      return entity.getUpdatedAt();
    }

    @Override
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public List<EntityReference> getFollowers() {
      return entity.getFollowers();
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference()
          .withId(getId())
          .withName(getFullyQualifiedName())
          .withDescription(getDescription())
          .withDisplayName(getDisplayName())
          .withType(Entity.MLMODEL);
    }

    @Override
    public MlModel getEntity() {
      return entity;
    }

    @Override
    public EntityReference getContainer() {
      return null;
    }

    @Override
    public void setId(UUID id) {
      entity.setId(id);
    }

    @Override
    public void setDescription(String description) {
      entity.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      entity.setDisplayName(displayName);
    }

    @Override
    public void setUpdateDetails(String updatedBy, long updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setOwner(EntityReference owner) {
      entity.setOwner(owner);
    }

    @Override
    public void setDeleted(boolean flag) {
      entity.setDeleted(flag);
    }

    @Override
    public MlModel withHref(URI href) {
      return entity.withHref(href);
    }

    @Override
    public void setTags(List<TagLabel> tags) {
      entity.setTags(tags);
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class MlModelUpdater extends EntityUpdater {
    public MlModelUpdater(MlModel original, MlModel updated, boolean patchOperation) {
      super(original, updated, patchOperation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      MlModel origMlModel = original.getEntity();
      MlModel updatedMlModel = updated.getEntity();
      updateAlgorithm(origMlModel, updatedMlModel);
      updateDashboard(origMlModel, updatedMlModel);
      updateMlFeatures(origMlModel, updatedMlModel);
      updateMlHyperParameters(origMlModel, updatedMlModel);
      updateMlStore(origMlModel, updatedMlModel);
      updateServer(origMlModel, updatedMlModel);
    }

    private void updateAlgorithm(MlModel origModel, MlModel updatedModel) throws JsonProcessingException {
      // Updating an algorithm should be flagged for an ML Model
      if (recordChange("algorithm", origModel.getAlgorithm(), updatedModel.getAlgorithm())) {
        // Mark the EntityUpdater version change to major
        majorVersionChange = true;
      }
    }

    private void updateMlFeatures(MlModel origModel, MlModel updatedModel) throws JsonProcessingException {
      List<MlFeature> addedList = new ArrayList<>();
      List<MlFeature> deletedList = new ArrayList<>();
      recordListChange(
          "mlFeatures",
          origModel.getMlFeatures(),
          updatedModel.getMlFeatures(),
          addedList,
          deletedList,
          mlFeatureMatch);
    }

    private void updateMlHyperParameters(MlModel origModel, MlModel updatedModel) throws JsonProcessingException {
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

    private void updateMlStore(MlModel origModel, MlModel updatedModel) throws JsonProcessingException {
      recordChange("mlStore", origModel.getMlStore(), updatedModel.getMlStore(), true);
    }

    private void updateServer(MlModel origModel, MlModel updatedModel) throws JsonProcessingException {
      // Updating the server can break current integrations to the ML services or enable new integrations
      if (recordChange("server", origModel.getServer(), updatedModel.getServer())) {
        // Mark the EntityUpdater version change to major
        majorVersionChange = true;
      }
    }

    private void updateDashboard(MlModel origModel, MlModel updatedModel) throws JsonProcessingException {
      EntityReference origDashboard = origModel.getDashboard();
      EntityReference updatedDashboard = updatedModel.getDashboard();
      if (recordChange("dashboard", origDashboard, updatedDashboard, true, entityReferenceMatch)) {

        // Remove the dashboard associated with the model, if any
        String modelId = updatedModel.getId().toString();
        if (origModel.getDashboard() != null) {
          daoCollection.relationshipDAO().deleteFrom(modelId, Entity.MLMODEL, Relationship.USES.ordinal(), "dashboard");
        }

        // Add relationship from model to dashboard
        if (updatedDashboard != null) {
          daoCollection
              .relationshipDAO()
              .insert(
                  modelId,
                  updatedDashboard.getId().toString(),
                  Entity.MLMODEL,
                  Entity.DASHBOARD,
                  Relationship.USES.ordinal());
        }
      }
    }
  }
}
