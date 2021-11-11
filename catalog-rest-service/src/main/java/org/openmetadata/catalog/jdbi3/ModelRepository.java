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
import org.openmetadata.catalog.entity.data.Model;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.models.ModelResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
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

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public class ModelRepository extends EntityRepository<Model> {
  private static final Logger LOG = LoggerFactory.getLogger(ModelRepository.class);
  private static final Fields MODEL_UPDATE_FIELDS = new Fields(ModelResource.FIELD_LIST,
          "owner,dashboard,mlHyperParameters,mlFeatures,tags");
  private static final Fields MODEL_PATCH_FIELDS = new Fields(ModelResource.FIELD_LIST,
          "owner,dashboard,mlHyperParameters,mlFeatures,tags");
  private final CollectionDAO dao;

  public ModelRepository(CollectionDAO dao) {
    super(ModelResource.COLLECTION_PATH, Model.class, dao.modelDAO(), dao, MODEL_PATCH_FIELDS, MODEL_UPDATE_FIELDS);
    this.dao = dao;
  }


  public static String getFQN(Model model) {
    return (model.getName());
  }

  @Transaction
  public void delete(UUID id) {
    if (dao.relationshipDAO().findToCount(id.toString(), Relationship.CONTAINS.ordinal(), Entity.MODEL) > 0) {
      throw new IllegalArgumentException("Model is not empty");
    }
    if (dao.modelDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.MODEL, id));
    }
    dao.relationshipDAO().deleteAll(id.toString());
  }

  @Transaction
  public EntityReference getOwnerReference(Model model) throws IOException {
    return EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), model.getOwner());
  }

  @Override
  public Model setFields(Model model, Fields fields) throws IOException {
    model.setDisplayName(model.getDisplayName());
    model.setOwner(fields.contains("owner") ? getOwner(model) : null);
    model.setDashboard(fields.contains("dashboard") ? getDashboard(model) : null);
    model.setMlFeatures(fields.contains("mlFeatures") ? model.getMlFeatures(): null);
    model.setMlHyperParameters(fields.contains("mlHyperParameters") ? model.getMlHyperParameters(): null);
    model.setFollowers(fields.contains("followers") ? getFollowers(model) : null);
    model.setTags(fields.contains("tags") ? getTags(model.getFullyQualifiedName()) : null);
    model.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(dao.usageDAO(),
            model.getId()) : null);
    return model;
  }

  @Override
  public void restorePatchAttributes(Model original, Model updated) throws IOException, ParseException {

  }

  @Override
  public EntityInterface<Model> getEntityInterface(Model entity) {
    return new ModelEntityInterface(entity);
  }

  private List<TagLabel> getTags(String fqn) {
    return dao.tagDAO().getTags(fqn);
  }


  @Override
  public void validate(Model model) throws IOException {
    model.setFullyQualifiedName(getFQN(model));
    EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), model.getOwner()); // Validate owner
    if (model.getDashboard() != null) {
      UUID dashboardId = model.getDashboard().getId();
      model.setDashboard(dao.dashboardDAO().findEntityReferenceById(dashboardId));
    }
    model.setTags(EntityUtil.addDerivedTags(dao.tagDAO(), model.getTags()));
  }

  @Override
  public void store(Model model, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = model.getOwner();
    List<TagLabel> tags = model.getTags();
    EntityReference dashboard = model.getDashboard();

    // Don't store owner, dashboard, href and tags as JSON. Build it on the fly based on relationships
    model.withOwner(null).withDashboard(null).withHref(null).withTags(null);

    if (update) {
      dao.modelDAO().update(model.getId(), JsonUtils.pojoToJson(model));
    } else {
      dao.modelDAO().insert(model);
    }

    // Restore the relationships
    model.withOwner(owner).withDashboard(dashboard).withTags(tags);
  }

  @Override
  public void storeRelationships(Model model) throws IOException {
    setOwner(model, model.getOwner());
    setDashboard(model, model.getDashboard());
    applyTags(model);
  }

  @Override
  public EntityUpdater getUpdater(Model original, Model updated, boolean patchOperation) throws IOException {
    return new ModelUpdater(original, updated, patchOperation);
  }

  private EntityReference getOwner(Model model) throws IOException {
    return model == null ? null : EntityUtil.populateOwner(model.getId(), dao.relationshipDAO(),
            dao.userDAO(), dao.teamDAO());
  }

  public void setOwner(Model model, EntityReference owner) {
    EntityUtil.setOwner(dao.relationshipDAO(), model.getId(), Entity.MODEL, owner);
    model.setOwner(owner);
  }

  private EntityReference getDashboard(Model model) throws IOException {
    if (model != null) {
      List<EntityReference> ids = dao.relationshipDAO().findTo(model.getId().toString(), Relationship.USES.ordinal());
      if (ids.size() > 1) {
        LOG.warn("Possible database issues - multiple dashboards {} found for model {}", ids, model.getId());
      }
      if (!ids.isEmpty()) {
        UUID dashboardId = ids.get(0).getId();
        return dao.dashboardDAO().findEntityReferenceById(dashboardId);
      }
    }
    return null;
  }

  public void setDashboard(Model model, EntityReference dashboard) {
    if (dashboard != null) {
      dao.relationshipDAO().insert(model.getId().toString(), model.getDashboard().getId().toString(),
              Entity.MODEL, Entity.DASHBOARD, Relationship.USES.ordinal());
    }
  }

  public void removeDashboard(Model model) {
    dao.relationshipDAO().deleteFrom(model.getId().toString(), Relationship.USES.ordinal(), Entity.DASHBOARD);
  }

  private void applyTags(Model model) throws IOException {
    // Add model level tags by adding tag to model relationship
    EntityUtil.applyTags(dao.tagDAO(), model.getTags(), model.getFullyQualifiedName());
    model.setTags(getTags(model.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  private List<EntityReference> getFollowers(Model model) throws IOException {
    return model == null ? null : EntityUtil.getFollowers(model.getId(), dao.relationshipDAO(), dao.userDAO());
  }

  static class ModelEntityInterface implements EntityInterface<Model> {
    private final Model entity;

    ModelEntityInterface(Model entity) {
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
              .withDisplayName(getDisplayName()).withType(Entity.MODEL);
    }

    @Override
    public Model getEntity() { return entity; }

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
    public Model withHref(URI href) { return entity.withHref(href); }

    @Override
    public void setTags(List<TagLabel> tags) {
      entity.setTags(tags);
    }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class ModelUpdater extends EntityUpdater {
    public ModelUpdater(Model original, Model updated, boolean patchOperation) {
      super(original, updated, patchOperation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateAlgorithm(original.getEntity(), updated.getEntity());
      updateDashboard(original.getEntity(), updated.getEntity());
      updateMlFeatures(original.getEntity(), updated.getEntity());
      updateMlHyperParameters(original.getEntity(), updated.getEntity());
    }

    private void updateAlgorithm(Model origModel, Model updatedModel) throws JsonProcessingException {
      recordChange("algorithm", origModel.getAlgorithm(), updatedModel.getAlgorithm());
    }

    private void updateMlFeatures(Model origModel, Model updatedModel) throws JsonProcessingException {
      recordChange("mlFeatures", origModel.getMlFeatures(), updatedModel.getMlFeatures());
    }

    private void updateMlHyperParameters(Model origModel, Model updatedModel) throws JsonProcessingException {
      recordChange("mlHyperParameters", origModel.getMlHyperParameters(), updatedModel.getMlHyperParameters());
    }

    private void updateDashboard(Model origModel, Model updatedModel) throws JsonProcessingException {
      // Remove existing dashboards
      removeDashboard(origModel);

      EntityReference origOwner = origModel.getDashboard();
      EntityReference updatedOwner = updatedModel.getDashboard();
      if (recordChange("owner", origOwner == null ? null : origOwner.getId(),
              updatedOwner == null ? null : updatedOwner.getId())) {
        setDashboard(updatedModel, updatedModel.getDashboard());
      }
    }
  }
}
