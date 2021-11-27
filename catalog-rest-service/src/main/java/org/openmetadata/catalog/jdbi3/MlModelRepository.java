/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.jdbi3;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.MlModel;
import org.openmetadata.catalog.resources.mlmodels.MlModelResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.MlFeature;
import org.openmetadata.catalog.type.MlFeatureSource;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.Date;
import java.util.List;
import java.util.UUID;

public class MlModelRepository extends EntityRepository<MlModel> {
  private static final Logger LOG = LoggerFactory.getLogger(MlModelRepository.class);
  private static final Fields MODEL_UPDATE_FIELDS = new Fields(MlModelResource.FIELD_LIST,
          "owner,algorithm,dashboard,mlHyperParameters,mlFeatures,tags");
  private static final Fields MODEL_PATCH_FIELDS = new Fields(MlModelResource.FIELD_LIST,
          "owner,algorithm,dashboard,mlHyperParameters,mlFeatures,tags");
  private final CollectionDAO dao;

  public MlModelRepository(CollectionDAO dao) {
    super(MlModelResource.COLLECTION_PATH, Entity.MLMODEL, MlModel.class, dao.mlModelDAO(), dao,
            MODEL_PATCH_FIELDS, MODEL_UPDATE_FIELDS);
    this.dao = dao;
  }


  public static String getFQN(MlModel model) {
    return (model.getName());
  }

  @Transaction
  public void delete(UUID id) {
    dao.mlModelDAO().delete(id);
    dao.relationshipDAO().deleteAll(id.toString());
  }

  @Transaction
  public EntityReference getOwnerReference(MlModel mlModel) throws IOException {
    return EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), mlModel.getOwner());
  }

  @Override
  public MlModel setFields(MlModel mlModel, Fields fields) throws IOException {
    mlModel.setDisplayName(mlModel.getDisplayName());
    mlModel.setOwner(fields.contains("owner") ? getOwner(mlModel) : null);
    mlModel.setDashboard(fields.contains("dashboard") ? getDashboard(mlModel) : null);
    mlModel.setMlFeatures(fields.contains("mlFeatures") ? mlModel.getMlFeatures(): null);
    mlModel.setMlHyperParameters(fields.contains("mlHyperParameters") ? mlModel.getMlHyperParameters(): null);
    mlModel.setFollowers(fields.contains("followers") ? getFollowers(mlModel) : null);
    mlModel.setTags(fields.contains("tags") ? getTags(mlModel.getFullyQualifiedName()) : null);
    mlModel.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(dao.usageDAO(),
            mlModel.getId()) : null);
    return mlModel;
  }

  @Override
  public void restorePatchAttributes(MlModel original, MlModel updated) throws IOException, ParseException {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withFullyQualifiedName(original.getFullyQualifiedName())
            .withName(original.getName()).withId(original.getId());
  }

  @Override
  public EntityInterface<MlModel> getEntityInterface(MlModel entity) {
    return new MlModelEntityInterface(entity);
  }

  private List<TagLabel> getTags(String fqn) {
    return dao.tagDAO().getTags(fqn);
  }

  private void setMlFeatureSourcesFQN(String parentFQN, List<MlFeatureSource> mlSources) {
    mlSources.forEach(s -> {
      String sourceFqn = parentFQN + "." + s.getName();
      s.setFullyQualifiedName(sourceFqn);
    });
  }

  private void setMlFeatureFQN(String parentFQN, List<MlFeature> mlFeatures) {
    mlFeatures.forEach(f -> {
      String featureFqn = parentFQN + "." + f.getName();
      f.setFullyQualifiedName(featureFqn);
      if (f.getFeatureSources() != null) {
        setMlFeatureSourcesFQN(featureFqn, f.getFeatureSources());
      }
    });
  }


  @Override
  public void validate(MlModel mlModel) throws IOException {
    mlModel.setFullyQualifiedName(getFQN(mlModel));
    setMlFeatureFQN(mlModel.getFullyQualifiedName(), mlModel.getMlFeatures());

    // Check if owner is valid and set the relationship
    mlModel.setOwner(EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), mlModel.getOwner()));

    setDashboard(mlModel, mlModel.getDashboard());
    if (mlModel.getDashboard() != null) {
      // Add relationship from MlModel to Dashboard
      String dashboardId = mlModel.getDashboard().getId().toString();
      dao.relationshipDAO().insert(dashboardId, mlModel.getId().toString(), Entity.MLMODEL, Entity.DASHBOARD,
              Relationship.USES.ordinal());
    }
    mlModel.setTags(EntityUtil.addDerivedTags(dao.tagDAO(), mlModel.getTags()));
  }

  @Override
  public void store(MlModel mlModel, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = mlModel.getOwner();
    List<TagLabel> tags = mlModel.getTags();
    EntityReference dashboard = mlModel.getDashboard();

    // Don't store owner, dashboard, href and tags as JSON. Build it on the fly based on relationships
    mlModel.withOwner(null).withDashboard(null).withHref(null).withTags(null);

    if (update) {
      dao.mlModelDAO().update(mlModel.getId(), JsonUtils.pojoToJson(mlModel));
    } else {
      dao.mlModelDAO().insert(mlModel);
    }

    // Restore the relationships
    mlModel.withOwner(owner).withDashboard(dashboard).withTags(tags);
  }

  @Override
  public void storeRelationships(MlModel mlModel) throws IOException {

    EntityUtil.setOwner(dao.relationshipDAO(), mlModel.getId(), Entity.MLMODEL, mlModel.getOwner());

    setDashboard(mlModel, mlModel.getDashboard());

    if (mlModel.getDashboard() != null) {
      // Add relationship from MlModel to Dashboard
      String dashboardId = mlModel.getDashboard().getId().toString();
      dao.relationshipDAO().insert(dashboardId, mlModel.getId().toString(), Entity.MLMODEL, Entity.DASHBOARD,
              Relationship.USES.ordinal());
    }

    applyTags(mlModel);
  }

  @Override
  public EntityUpdater getUpdater(MlModel original, MlModel updated, boolean patchOperation) throws IOException {
    return new MlModelUpdater(original, updated, patchOperation);
  }

  private EntityReference getOwner(MlModel mlModel) throws IOException {
    return mlModel == null ? null : EntityUtil.populateOwner(mlModel.getId(), dao.relationshipDAO(),
            dao.userDAO(), dao.teamDAO());
  }

  private EntityReference getDashboard(MlModel mlModel) throws IOException {
    if (mlModel != null) {
      List<EntityReference> ids = dao.relationshipDAO().findTo(mlModel.getId().toString(), Relationship.USES.ordinal());
      if (ids.size() > 1) {
        LOG.warn("Possible database issues - multiple dashboards {} found for model {}", ids, mlModel.getId());
      }
      if (!ids.isEmpty()) {
        UUID dashboardId = ids.get(0).getId();
        return dao.dashboardDAO().findEntityReferenceById(dashboardId);
      }
    }
    return null;
  }

  public void setDashboard(MlModel mlModel, EntityReference dashboard) {
    if (dashboard != null) {
      dao.relationshipDAO().insert(mlModel.getId().toString(), mlModel.getDashboard().getId().toString(),
              Entity.MLMODEL, Entity.DASHBOARD, Relationship.USES.ordinal());
    }
  }

  public void removeDashboard(MlModel mlModel) {
    dao.relationshipDAO().deleteFrom(mlModel.getId().toString(), Relationship.USES.ordinal(), Entity.DASHBOARD);
  }

  private void applyTags(MlModel mlModel) throws IOException {
    // Add model level tags by adding tag to model relationship
    EntityUtil.applyTags(dao.tagDAO(), mlModel.getTags(), mlModel.getFullyQualifiedName());
    mlModel.setTags(getTags(mlModel.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  private List<EntityReference> getFollowers(MlModel model) throws IOException {
    return model == null ? null : EntityUtil.getFollowers(model.getId(), dao.relationshipDAO(), dao.userDAO());
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
    public Double getVersion() { return entity.getVersion(); }

    @Override
    public String getUpdatedBy() { return entity.getUpdatedBy(); }

    @Override
    public Date getUpdatedAt() { return entity.getUpdatedAt(); }

    @Override
    public URI getHref() { return entity.getHref(); }

    @Override
    public List<EntityReference> getFollowers() { return entity.getFollowers(); }

    @Override
    public ChangeDescription getChangeDescription() { return entity.getChangeDescription(); }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(getId()).withName(getFullyQualifiedName()).withDescription(getDescription())
              .withDisplayName(getDisplayName()).withType(Entity.MLMODEL);
    }

    @Override
    public MlModel getEntity() { return entity; }

    @Override
    public void setId(UUID id) { entity.setId(id); }

    @Override
    public void setDescription(String description) {
      entity.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      entity.setDisplayName(displayName);
    }

    @Override
    public void setUpdateDetails(String updatedBy, Date updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setOwner(EntityReference owner) { entity.setOwner(owner); }

    @Override
    public MlModel withHref(URI href) { return entity.withHref(href); }

    @Override
    public void setTags(List<TagLabel> tags) {
      entity.setTags(tags);
    }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
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
    }

    private void updateAlgorithm(MlModel origModel, MlModel updatedModel) throws JsonProcessingException {
      recordChange("algorithm", origModel.getAlgorithm(), updatedModel.getAlgorithm());
    }

    private void updateMlFeatures(MlModel origModel, MlModel updatedModel) throws JsonProcessingException {
      recordChange("mlFeatures", origModel.getMlFeatures(), updatedModel.getMlFeatures());
    }

    private void updateMlHyperParameters(MlModel origModel, MlModel updatedModel) throws JsonProcessingException {
      recordChange("mlHyperParameters", origModel.getMlHyperParameters(), updatedModel.getMlHyperParameters());
    }

    private void updateDashboard(MlModel origModel, MlModel updatedModel) throws JsonProcessingException {
      String modelId = updatedModel.getId().toString();

      // Remove the dashboard associated with the model, if any
      if (origModel.getDashboard() != null) {
        dao.relationshipDAO().deleteFrom(modelId, Relationship.USES.ordinal(), "dashboard");
      }

      // Add relationship from model to dashboard
      EntityReference updatedDashboard = updatedModel.getDashboard();
      if (updatedDashboard != null) {
        dao.relationshipDAO().insert(modelId, updatedDashboard.getId().toString(),
                Entity.MLMODEL, Entity.DASHBOARD, Relationship.USES.ordinal());
      }
      recordChange("dashboard", origModel.getDashboard(), updatedDashboard, true);

    }
  }
}
