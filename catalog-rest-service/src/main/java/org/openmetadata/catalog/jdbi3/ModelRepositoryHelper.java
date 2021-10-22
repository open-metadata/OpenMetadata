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
import org.openmetadata.catalog.util.EntityUpdater3;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.common.utils.CipherText;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public class ModelRepositoryHelper extends EntityRepository<Model> {
  private static final Logger LOG = LoggerFactory.getLogger(ModelRepositoryHelper.class);
  private static final Fields MODEL_UPDATE_FIELDS = new Fields(ModelResource.FIELD_LIST,
          "owner,dashboard,tags");
  private static final Fields MODEL_PATCH_FIELDS = new Fields(ModelResource.FIELD_LIST,
          "owner,dashboard,tags");

  public ModelRepositoryHelper(ModelRepository3 repo3) {
    super(repo3.modelDAO());
    this.repo3 = repo3;
  }

  private final ModelRepository3 repo3;

  public static String getFQN(Model model) {
    return (model.getName());
  }

  @Transaction
  public ModelList listAfter(Fields fields, int limitParam, String after) throws IOException,
          GeneralSecurityException {
    // forward scrolling, if after == null then first page is being asked being asked
    List<String> jsons =repo3.modelDAO().listAfter(limitParam + 1, after == null ? "" :
            CipherText.instance().decrypt(after));

    List<Model> models = new ArrayList<>();
    for (String json : jsons) {
      models.add(setFields(JsonUtils.readValue(json, Model.class), fields));
    }
    int total =repo3.modelDAO().listCount();

    String beforeCursor, afterCursor = null;
    beforeCursor = after == null ? null : models.get(0).getFullyQualifiedName();
    if (models.size() > limitParam) { // If extra result exists, then next page exists - return after cursor
      models.remove(limitParam);
      afterCursor = models.get(limitParam - 1).getFullyQualifiedName();
    }
    return new ModelList(models, beforeCursor, afterCursor, total);
  }

  @Transaction
  public ModelList listBefore(Fields fields, int limitParam, String before)
          throws IOException, GeneralSecurityException {
    // Reverse scrolling - Get one extra result used for computing before cursor
    List<String> jsons =repo3.modelDAO().listBefore(limitParam + 1, CipherText.instance().decrypt(before));
    List<Model> models = new ArrayList<>();
    for (String json : jsons) {
      models.add(setFields(JsonUtils.readValue(json, Model.class), fields));
    }
    int total =repo3.modelDAO().listCount();

    String beforeCursor = null, afterCursor;
    if (models.size() > limitParam) { // If extra result exists, then previous page exists - return before cursor
      models.remove(0);
      beforeCursor = models.get(0).getFullyQualifiedName();
    }
    afterCursor = models.get(models.size() - 1).getFullyQualifiedName();
    return new ModelList(models, beforeCursor, afterCursor, total);
  }

  @Transaction
  public Model getByName(String fqn, Fields fields) throws IOException {
    Model model = repo3.modelDAO().findEntityByName(fqn);
    return setFields(model, fields);
  }

  @Transaction
  public Model create(Model model) throws IOException {
    validateRelationships(model);
    return createInternal(model);
  }

  @Transaction
  public PutResponse<Model> createOrUpdate(Model updated) throws IOException {
    validateRelationships(updated);
    Model stored = JsonUtils.readValue(repo3.modelDAO().findJsonByFqn(updated.getFullyQualifiedName()), Model.class);
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
    repo3.modelDAO().findEntityById(modelId);
    return EntityUtil.addFollower(repo3.relationshipDAO(), repo3.userDAO(), modelId, Entity.MODEL, userId,
            Entity.USER) ?
            Status.CREATED : Status.OK;
  }

  @Transaction
  public void deleteFollower(String modelId, String userId) {
    EntityUtil.validateUser(repo3.userDAO(), userId);
    EntityUtil.removeFollower(repo3.relationshipDAO(), modelId, userId);
  }

  @Transaction
  public void delete(String id) {
    if (repo3.relationshipDAO().findToCount(id, Relationship.CONTAINS.ordinal(), Entity.MODEL) > 0) {
      throw new IllegalArgumentException("Model is not empty");
    }
    if (repo3.modelDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.MODEL, id));
    }
    repo3.relationshipDAO().deleteAll(id);
  }

  @Transaction
  public EntityReference getOwnerReference(Model model) throws IOException {
    return EntityUtil.populateOwner(repo3.userDAO(), repo3.teamDAO(), model.getOwner());
  }

  public Model get(String id, Fields fields) throws IOException {
    return setFields(repo3.modelDAO().findEntityById(id), fields);
  }

  @Override
  public String getFullyQualifiedName(Model entity) {
    return null;
  }

  @Override
  public Model setFields(Model model, Fields fields) throws IOException {
    model.setDisplayName(model.getDisplayName());
    model.setOwner(fields.contains("owner") ? getOwner(model) : null);
    model.setDashboard(fields.contains("dashboard") ? getDashboard(model) : null);
    model.setFollowers(fields.contains("followers") ? getFollowers(model) : null);
    model.setTags(fields.contains("tags") ? getTags(model.getFullyQualifiedName()) : null);
    model.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(repo3.usageDAO(),
            model.getId()) : null);
    return model;
  }

  @Override
  public ResultList<Model> getResultList(List<Model> entities, String beforeCursor, String afterCursor, int total) throws GeneralSecurityException, UnsupportedEncodingException {
    return null;
  }

  private List<TagLabel> getTags(String fqn) {
    return repo3.tagDAO().getTags(fqn);
  }


  private Model createInternal(Model model) throws IOException {
    storeModel(model, false);
    addRelationships(model);
    return model;
  }

  private void validateRelationships(Model model) throws IOException {
    model.setFullyQualifiedName(getFQN(model));
    EntityUtil.populateOwner(repo3.userDAO(), repo3.teamDAO(), model.getOwner()); // Validate owner
    if (model.getDashboard() != null) {
      String dashboardId = model.getDashboard().getId().toString();
      model.setDashboard(EntityUtil.getEntityReference(repo3.dashboardDAO().findEntityById(dashboardId)));
    }
    model.setTags(EntityUtil.addDerivedTags(repo3.tagDAO(), model.getTags()));
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
     repo3.modelDAO().update(model.getId().toString(), JsonUtils.pojoToJson(model));
    } else {
     repo3.modelDAO().insert(JsonUtils.pojoToJson(model));
    }

    // Restore the relationships
    model.withOwner(owner).withDashboard(dashboard).withTags(tags);
  }

  private void patch(Model original, Model updated) throws IOException {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withFullyQualifiedName(original.getFullyQualifiedName()).withName(original.getName())
            .withId(original.getId());
    validateRelationships(updated);
    ModelRepositoryHelper.ModelUpdater modelUpdater = new ModelRepositoryHelper.ModelUpdater(original, updated, true);
    modelUpdater.updateAll();
    modelUpdater.store();
  }

  private EntityReference getOwner(Model model) throws IOException {
    return model == null ? null : EntityUtil.populateOwner(model.getId(), repo3.relationshipDAO(),
            repo3.userDAO(), repo3.teamDAO());
  }

  public void setOwner(Model model, EntityReference owner) {
    EntityUtil.setOwner(repo3.relationshipDAO(), model.getId(), Entity.MODEL, owner);
    model.setOwner(owner);
  }

  private EntityReference getDashboard(Model model) throws IOException {
    if (model != null) {
      List<EntityReference> ids = repo3.relationshipDAO().findTo(model.getId().toString(), Relationship.USES.ordinal());
      if (ids.size() > 1) {
        LOG.warn("Possible database issues - multiple dashboards {} found for model {}", ids, model.getId());
      }
      if (!ids.isEmpty()) {
        String dashboardId = ids.get(0).getId().toString();
        return EntityUtil.getEntityReference(repo3.dashboardDAO().findEntityById(dashboardId));
      }
    }
    return null;
  }

  public void setDashboard(Model model, EntityReference dashboard) {
    if (dashboard != null) {
      repo3.relationshipDAO().insert(model.getId().toString(), model.getDashboard().getId().toString(),
              Entity.MODEL, Entity.DASHBOARD, Relationship.USES.ordinal());
    }
  }

  public void removeDashboard(Model model) {
    repo3.relationshipDAO().deleteFrom(model.getId().toString(), Relationship.USES.ordinal(), Entity.DASHBOARD);
  }

  private void applyTags(Model model) throws IOException {
    // Add model level tags by adding tag to model relationship
    EntityUtil.applyTags(repo3.tagDAO(), model.getTags(), model.getFullyQualifiedName());
    model.setTags(getTags(model.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  private List<EntityReference> getFollowers(Model model) throws IOException {
    return model == null ? null : EntityUtil.getFollowers(model.getId(), repo3.relationshipDAO(), repo3.userDAO());
  }

  private Model validateModel(String id) throws IOException {
    return repo3.modelDAO().findEntityById(id);
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
  public class ModelUpdater extends EntityUpdater3 {
    final Model orig;
    final Model updated;

    public ModelUpdater(Model orig, Model updated, boolean patchOperation) {
      super(new ModelRepositoryHelper.ModelEntityInterface(orig), new ModelRepositoryHelper.ModelEntityInterface(updated), patchOperation, repo3.relationshipDAO(),
              repo3.tagDAO());
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
