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
import org.openmetadata.catalog.resources.models.ModelResource.ModelList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUpdater;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public class ModelRepository extends EntityRepository<Model> {
  private static final Logger LOG = LoggerFactory.getLogger(ModelRepository.class);
  private static final Fields MODEL_UPDATE_FIELDS = new Fields(ModelResource.FIELD_LIST,
          "owner,dashboard,tags");
  private static final Fields MODEL_PATCH_FIELDS = new Fields(ModelResource.FIELD_LIST,
          "owner,dashboard,tags");
  private final CollectionDAO dao;

  public ModelRepository(CollectionDAO dao) {
    super(Model.class, dao.modelDAO());
    this.dao = dao;
  }


  public static String getFQN(Model model) {
    return (model.getName());
  }

  @Transaction
  public Model create(Model model) throws IOException {
    validateRelationships(model);
    return createInternal(model);
  }

  @Transaction
  public PutResponse<Model> createOrUpdate(Model updated) throws IOException {
    validateRelationships(updated);
    Model stored = JsonUtils.readValue(dao.modelDAO().findJsonByFqn(updated.getFullyQualifiedName()), Model.class);
    if (stored == null) {
      return new PutResponse<>(Status.CREATED, createInternal(updated));
    }
    setFields(stored, MODEL_UPDATE_FIELDS);
    updated.setId(stored.getId());

    ModelUpdater modelUpdater = new ModelUpdater(stored, updated, false);
    modelUpdater.updateAll();
    modelUpdater.store();
    return new PutResponse<>(Status.OK, updated);
  }

  @Transaction
  public Model patch(String id, String user, JsonPatch patch) throws IOException {
    Model original = setFields(validateModel(id), MODEL_PATCH_FIELDS);
    Model updated = JsonUtils.applyPatch(original, patch, Model.class);
    updated.withUpdatedBy(user).withUpdatedAt(new Date());
    patch(original, updated);
    return updated;
  }

  @Transaction
  public Status addFollower(String modelId, String userId) throws IOException {
    dao.modelDAO().findEntityById(modelId);
    return EntityUtil.addFollower(dao.relationshipDAO(), dao.userDAO(), modelId, Entity.MODEL, userId,
            Entity.USER) ?
            Status.CREATED : Status.OK;
  }

  @Transaction
  public void deleteFollower(String modelId, String userId) {
    EntityUtil.validateUser(dao.userDAO(), userId);
    EntityUtil.removeFollower(dao.relationshipDAO(), modelId, userId);
  }

  @Transaction
  public void delete(String id) {
    if (dao.relationshipDAO().findToCount(id, Relationship.CONTAINS.ordinal(), Entity.MODEL) > 0) {
      throw new IllegalArgumentException("Model is not empty");
    }
    if (dao.modelDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.MODEL, id));
    }
    dao.relationshipDAO().deleteAll(id);
  }

  @Transaction
  public EntityReference getOwnerReference(Model model) throws IOException {
    return EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), model.getOwner());
  }

  @Override
  public String getFullyQualifiedName(Model entity) {
    return entity.getFullyQualifiedName();
  }

  @Override
  public Model setFields(Model model, Fields fields) throws IOException {
    model.setDisplayName(model.getDisplayName());
    model.setOwner(fields.contains("owner") ? getOwner(model) : null);
    model.setDashboard(fields.contains("dashboard") ? getDashboard(model) : null);
    model.setFollowers(fields.contains("followers") ? getFollowers(model) : null);
    model.setTags(fields.contains("tags") ? getTags(model.getFullyQualifiedName()) : null);
    model.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(dao.usageDAO(),
            model.getId()) : null);
    return model;
  }

  @Override
  public ResultList<Model> getResultList(List<Model> entities, String beforeCursor, String afterCursor, int total)
          throws GeneralSecurityException, UnsupportedEncodingException {
    return new ModelList(entities, beforeCursor, afterCursor, total);
  }

  private List<TagLabel> getTags(String fqn) {
    return dao.tagDAO().getTags(fqn);
  }


  private Model createInternal(Model model) throws IOException {
    storeModel(model, false);
    addRelationships(model);
    return model;
  }

  private void validateRelationships(Model model) throws IOException {
    model.setFullyQualifiedName(getFQN(model));
    EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), model.getOwner()); // Validate owner
    if (model.getDashboard() != null) {
      String dashboardId = model.getDashboard().getId().toString();
      model.setDashboard(EntityUtil.getEntityReference(dao.dashboardDAO().findEntityById(dashboardId)));
    }
    model.setTags(EntityUtil.addDerivedTags(dao.tagDAO(), model.getTags()));
  }

  private void addRelationships(Model model) throws IOException {
    setOwner(model, model.getOwner());
    setDashboard(model, model.getDashboard());
    applyTags(model);
  }

  private void storeModel(Model model, boolean update) throws JsonProcessingException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = model.getOwner();
    List<TagLabel> tags = model.getTags();
    EntityReference dashboard = model.getDashboard();

    // Don't store owner, dashboard, href and tags as JSON. Build it on the fly based on relationships
    model.withOwner(null).withDashboard(null).withHref(null).withTags(null);

    if (update) {
      dao.modelDAO().update(model.getId().toString(), JsonUtils.pojoToJson(model));
    } else {
      dao.modelDAO().insert(JsonUtils.pojoToJson(model));
    }

    // Restore the relationships
    model.withOwner(owner).withDashboard(dashboard).withTags(tags);
  }

  private void patch(Model original, Model updated) throws IOException {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withFullyQualifiedName(original.getFullyQualifiedName()).withName(original.getName())
            .withId(original.getId());
    validateRelationships(updated);
    ModelRepository.ModelUpdater modelUpdater = new ModelRepository.ModelUpdater(original, updated, true);
    modelUpdater.updateAll();
    modelUpdater.store();
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
        String dashboardId = ids.get(0).getId().toString();
        return EntityUtil.getEntityReference(dao.dashboardDAO().findEntityById(dashboardId));
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

  private Model validateModel(String id) throws IOException {
    return dao.modelDAO().findEntityById(id);
  }

  static class ModelEntityInterface implements EntityInterface {
    private final Model model;

    ModelEntityInterface(Model Model) {
      this.model = Model;
    }

    @Override
    public UUID getId() {
      return model.getId();
    }

    @Override
    public String getDescription() {
      return model.getDescription();
    }

    @Override
    public String getDisplayName() {
      return model.getDisplayName();
    }

    @Override
    public EntityReference getOwner() {
      return model.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return model.getFullyQualifiedName();
    }

    @Override
    public List<TagLabel> getTags() {
      return model.getTags();
    }

    @Override
    public void setDescription(String description) {
      model.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      model.setDisplayName(displayName);
    }

    @Override
    public void setTags(List<TagLabel> tags) {
      model.setTags(tags);
    }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class ModelUpdater extends EntityUpdater {
    final Model orig;
    final Model updated;

    public ModelUpdater(Model orig, Model updated, boolean patchOperation) {
      super(new ModelRepository.ModelEntityInterface(orig), new ModelRepository.ModelEntityInterface(updated),
              patchOperation, dao.relationshipDAO(),
              dao.tagDAO());
      this.orig = orig;
      this.updated = updated;
    }

    public void updateAll() throws IOException {
      super.updateAll();
      updateAlgorithm();
      updateDashboard();
    }

    private void updateAlgorithm() {
      update("algorithm", orig.getAlgorithm(), updated.getAlgorithm());
    }

    private void updateDashboard() {
      // Remove existing dashboards
      removeDashboard(orig);

      EntityReference origOwner = orig.getDashboard();
      EntityReference updatedOwner = updated.getDashboard();
      if (update("owner", origOwner == null ? null : origOwner.getId(),
              updatedOwner == null ? null : updatedOwner.getId())) {
        setDashboard(updated, updated.getDashboard());
      }
    }

    public void store() throws IOException {
      updated.setVersion(getNewVersion(orig.getVersion()));
      storeModel(updated, true);
    }
  }
}
