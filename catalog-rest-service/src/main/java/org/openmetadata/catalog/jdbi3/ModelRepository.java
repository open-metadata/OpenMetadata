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

import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Model;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamDAO;
import org.openmetadata.catalog.jdbi3.UserRepository.UserDAO;
import org.openmetadata.catalog.jdbi3.UsageRepository.UsageDAO;
import org.openmetadata.catalog.resources.models.ModelResource;
import org.openmetadata.catalog.resources.models.ModelResource.ModelList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.common.utils.CipherText;
import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.CreateSqlObject;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;
import org.skife.jdbi.v2.sqlobject.Transaction;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public abstract class ModelRepository {
  private static final Fields MODEL_UPDATE_FIELDS = new Fields(ModelResource.FIELD_LIST,
          "owner,dashboard,tags");
  private static final Fields MODEL_PATCH_FIELDS = new Fields(ModelResource.FIELD_LIST,
          "owner,dashboard,tags");

  public static String getFQN(Model model) {
    return (model.getName());
  }

  @CreateSqlObject
  abstract ModelDAO modelDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  abstract UserDAO userDAO();

  @CreateSqlObject
  abstract TeamDAO teamDAO();

  @CreateSqlObject
  abstract UsageDAO usageDAO();

  @CreateSqlObject
  abstract TagRepository.TagDAO tagDAO();


  @Transaction
  public ModelList listAfter(Fields fields, int limitParam, String after) throws IOException,
          GeneralSecurityException {
    // forward scrolling, if after == null then first page is being asked being asked
    List<String> jsons = modelDAO().listAfter(limitParam + 1, after == null ? "" :
            CipherText.instance().decrypt(after));

    List<Model> models = new ArrayList<>();
    for (String json : jsons) {
      models.add(setFields(JsonUtils.readValue(json, Model.class), fields));
    }
    int total = modelDAO().listCount();

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
    List<String> jsons = modelDAO().listBefore(limitParam + 1, CipherText.instance().decrypt(before));
    List<Model> models = new ArrayList<>();
    for (String json : jsons) {
      models.add(setFields(JsonUtils.readValue(json, Model.class), fields));
    }
    int total = modelDAO().listCount();

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
    Model model = EntityUtil.validate(fqn, modelDAO().findByFQN(fqn), Model.class);
    return setFields(model, fields);
  }

  @Transaction
  public Model create(Model model, EntityReference owner) throws IOException {
    return createInternal(model, owner);
  }

  @Transaction
  public PutResponse<Model> createOrUpdate(Model updatedModel,
                                               EntityReference newOwner) throws IOException {
    String fqn = getFQN(updatedModel);
    Model storedModel = JsonUtils.readValue(modelDAO().findByFQN(fqn), Model.class);
    if (storedModel == null) {
      return new PutResponse<>(Status.CREATED, createInternal(updatedModel, newOwner));
    }
    // Update existing model
    EntityUtil.populateOwner(userDAO(), teamDAO(), newOwner); // Validate new owner
    if (storedModel.getDescription() == null || storedModel.getDescription().isEmpty()) {
      storedModel.withDescription(updatedModel.getDescription());
    }
    //update the display name from source
    if (updatedModel.getDisplayName() != null && !updatedModel.getDisplayName().isEmpty()) {
      storedModel.withDisplayName(updatedModel.getDisplayName());
    }

    modelDAO().update(storedModel.getId().toString(), JsonUtils.pojoToJson(storedModel));

    // Update owner relationship
    setFields(storedModel, MODEL_UPDATE_FIELDS); // First get the ownership information
    updateOwner(storedModel, storedModel.getOwner(), newOwner);

    return new PutResponse<>(Status.OK, storedModel);
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
    EntityUtil.validate(modelId, modelDAO().findById(modelId), Model.class);
    return EntityUtil.addFollower(relationshipDAO(), userDAO(), modelId, Entity.MODEL, userId, Entity.USER) ?
            Status.CREATED : Status.OK;
  }

  @Transaction
  public void deleteFollower(String modelId, String userId) {
    EntityUtil.validateUser(userDAO(), userId);
    EntityUtil.removeFollower(relationshipDAO(), modelId, userId);
  }

  @Transaction
  public void delete(String id) {
    if (relationshipDAO().findToCount(id, Relationship.CONTAINS.ordinal(), Entity.MODEL) > 0) {
      throw new IllegalArgumentException("Model is not empty");
    }
    if (modelDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.MODEL, id));
    }
    relationshipDAO().deleteAll(id);
  }

  @Transaction
  public EntityReference getOwnerReference(Model model) throws IOException {
    return EntityUtil.populateOwner(userDAO(), teamDAO(), model.getOwner());
  }

  public Model get(String id, Fields fields) throws IOException {
    return setFields(EntityUtil.validate(id, modelDAO().findById(id), Model.class), fields);
  }

  private Model setFields(Model model, Fields fields) throws IOException {
    model.setDisplayName(model.getDisplayName());
    model.setOwner(fields.contains("owner") ? getOwner(model) : null);
    model.setFollowers(fields.contains("followers") ? getFollowers(model) : null);
    model.setTags(fields.contains("tags") ? getTags(model.getFullyQualifiedName()) : null);
    model.setUsageSummary(fields.contains("usageSummary") ? EntityUtil.getLatestUsage(usageDAO(),
            model.getId()) : null);
    return model;
  }

  private List<TagLabel> getTags(String fqn) {
    return tagDAO().getTags(fqn);
  }


  private Model createInternal(Model model, EntityReference owner)
          throws IOException {
    String fqn = model.getName();
    model.setFullyQualifiedName(fqn);

    EntityUtil.populateOwner(userDAO(), teamDAO(), owner); // Validate owner

    modelDAO().insert(JsonUtils.pojoToJson(model));
    addRelationships(model);
    return model;
  }

  private void patch(Model original, Model updated) throws IOException {
    String modelId = original.getId().toString();
    if (!original.getId().equals(updated.getId())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(Entity.MODEL, "id"));
    }
    if (!original.getName().equals(updated.getName())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute(Entity.MODEL, "name"));
    }
    // Validate new owner
    EntityReference newOwner = EntityUtil.populateOwner(userDAO(), teamDAO(), updated.getOwner());

    // Remove previous tags. Merge tags from the update and the existing tags
    EntityUtil.removeTags(tagDAO(), original.getFullyQualifiedName());

    updated.setHref(null);
    updated.setOwner(null);
    modelDAO().update(modelId, JsonUtils.pojoToJson(updated));
    updateOwner(updated, original.getOwner(), newOwner);
    applyTags(updated);
  }

  private EntityReference getOwner(Model model) throws IOException {
    return model == null ? null : EntityUtil.populateOwner(model.getId(), relationshipDAO(),
            userDAO(), teamDAO());
  }

  public void setOwner(Model model, EntityReference owner) {
    EntityUtil.setOwner(relationshipDAO(), model.getId(), Entity.MODEL, owner);
    model.setOwner(owner);
  }

  private void updateOwner(Model model, EntityReference origOwner, EntityReference newOwner) {
    EntityUtil.updateOwner(relationshipDAO(), origOwner, newOwner, model.getId(), Entity.MODEL);
    model.setOwner(newOwner);
  }

  private void applyTags(Model model) throws IOException {
    // Add model level tags by adding tag to model relationship
    EntityUtil.applyTags(tagDAO(), model.getTags(), model.getFullyQualifiedName());
    model.setTags(getTags(model.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  private void addRelationships(Model model) throws IOException {
    // Add owner relationship
    EntityUtil.setOwner(relationshipDAO(), model.getId(), Entity.MODEL, model.getOwner());
    // Add tag to model relationship
    applyTags(model);
  }

  private List<EntityReference> getFollowers(Model model) throws IOException {
    return model == null ? null : EntityUtil.getFollowers(model.getId(), relationshipDAO(), userDAO());
  }

  private Model validateModel(String id) throws IOException {
    return EntityUtil.validate(id, modelDAO().findById(id), Model.class);
  }

  public interface ModelDAO {
    @SqlUpdate("INSERT INTO model_entity(json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlUpdate("UPDATE model_entity SET json = :json where id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM model_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT json FROM model_entity WHERE fullyQualifiedName = :name")
    String findByFQN(@Bind("name") String name);

    @SqlQuery("SELECT count(*) FROM model_entity")
    int listCount();

    @SqlQuery(
            "SELECT json FROM (" +
                    "SELECT fullyQualifiedName, json FROM model_entity WHERE " +
                    "fullyQualifiedName < :before " + // Pagination by model fullyQualifiedName
                    "ORDER BY fullyQualifiedName DESC " +
                    "LIMIT :limit" +
                    ") last_rows_subquery ORDER BY fullyQualifiedName")
    List<String> listBefore(@Bind("limit") int limit,
                            @Bind("before") String before);

    @SqlQuery("SELECT json FROM model_entity WHERE " +
            "fullyQualifiedName > :after " +
            "ORDER BY fullyQualifiedName " +
            "LIMIT :limit")
    List<String> listAfter(@Bind("limit") int limit,
                           @Bind("after") String after);

    @SqlUpdate("DELETE FROM model_entity WHERE id = :id")
    int delete(@Bind("id") String id);
  }
}
