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
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.entity.data.Task;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamDAO;
import org.openmetadata.catalog.jdbi3.UserRepository.UserDAO;
import org.openmetadata.catalog.resources.pipelines.PipelineResource;
import org.openmetadata.catalog.resources.pipelines.PipelineResource.PipelineList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUpdater;
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
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public abstract class PipelineRepository {
  private static final Fields PIPELINE_UPDATE_FIELDS = new Fields(PipelineResource.FIELD_LIST,
          "owner,service,tags,tasks");
  private static final Fields PIPELINE_PATCH_FIELDS = new Fields(PipelineResource.FIELD_LIST,
          "owner,service,tags,tasks");

  public static String getFQN(Pipeline pipeline) {
    return (pipeline.getService().getName() + "." + pipeline.getName());
  }

  @CreateSqlObject
  abstract PipelineDAO pipelineDAO();

  @CreateSqlObject
  abstract TaskRepository.TaskDAO taskDAO();

  @CreateSqlObject
  abstract PipelineServiceRepository.PipelineServiceDAO pipelineServiceDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  abstract UserDAO userDAO();

  @CreateSqlObject
  abstract TeamDAO teamDAO();

  @CreateSqlObject
  abstract TagRepository.TagDAO tagDAO();


  @Transaction
  public PipelineList listAfter(Fields fields, String serviceName, int limitParam, String after) throws IOException,
          GeneralSecurityException {
    // forward scrolling, if after == null then first page is being asked being asked
    List<String> jsons = pipelineDAO().listAfter(serviceName, limitParam + 1, after == null ? "" :
            CipherText.instance().decrypt(after));

    List<Pipeline> pipelines = new ArrayList<>();
    for (String json : jsons) {
      pipelines.add(setFields(JsonUtils.readValue(json, Pipeline.class), fields));
    }
    int total = pipelineDAO().listCount(serviceName);

    String beforeCursor, afterCursor = null;
    beforeCursor = after == null ? null : pipelines.get(0).getFullyQualifiedName();
    if (pipelines.size() > limitParam) { // If extra result exists, then next page exists - return after cursor
      pipelines.remove(limitParam);
      afterCursor = pipelines.get(limitParam - 1).getFullyQualifiedName();
    }
    return new PipelineList(pipelines, beforeCursor, afterCursor, total);
  }

  @Transaction
  public PipelineList listBefore(Fields fields, String serviceName, int limitParam, String before)
          throws IOException, GeneralSecurityException {
    // Reverse scrolling - Get one extra result used for computing before cursor
    List<String> jsons = pipelineDAO().listBefore(serviceName, limitParam + 1, CipherText.instance().decrypt(before));
    List<Pipeline> pipelines = new ArrayList<>();
    for (String json : jsons) {
      pipelines.add(setFields(JsonUtils.readValue(json, Pipeline.class), fields));
    }
    int total = pipelineDAO().listCount(serviceName);

    String beforeCursor = null, afterCursor;
    if (pipelines.size() > limitParam) { // If extra result exists, then previous page exists - return before cursor
      pipelines.remove(0);
      beforeCursor = pipelines.get(0).getFullyQualifiedName();
    }
    afterCursor = pipelines.get(pipelines.size() - 1).getFullyQualifiedName();
    return new PipelineList(pipelines, beforeCursor, afterCursor, total);
  }

  @Transaction
  public Pipeline getByName(String fqn, Fields fields) throws IOException {
    Pipeline pipeline = EntityUtil.validate(fqn, pipelineDAO().findByFQN(fqn), Pipeline.class);
    return setFields(pipeline, fields);
  }

  @Transaction
  public Pipeline create(Pipeline pipeline) throws IOException {
    validateRelationships(pipeline);
    return createInternal(pipeline);
  }

  @Transaction
  public PutResponse<Pipeline> createOrUpdate(Pipeline updated) throws IOException {
    validateRelationships(updated);
    Pipeline stored = JsonUtils.readValue(pipelineDAO().findByFQN(updated.getFullyQualifiedName()), Pipeline.class);
    if (stored == null) {
      return new PutResponse<>(Status.CREATED, createInternal(updated));
    }
    setFields(stored, PIPELINE_UPDATE_FIELDS);
    updated.setId(stored.getId());

    PipelineUpdater pipelineUpdater = new PipelineUpdater(stored, updated, false);
    pipelineUpdater.updateAll();
    pipelineUpdater.store();
    return new PutResponse<>(Status.OK, updated);
  }

  @Transaction
  public Pipeline patch(String id, String user, JsonPatch patch) throws IOException {
    Pipeline original = setFields(validatePipeline(id), PIPELINE_PATCH_FIELDS);
    Pipeline updated = JsonUtils.applyPatch(original, patch, Pipeline.class);
    updated.withUpdatedBy(user).withUpdatedAt(new Date());
    patch(original, updated);
    return updated;
  }

  @Transaction
  public Status addFollower(String pipelineId, String userId) throws IOException {
    EntityUtil.validate(pipelineId, pipelineDAO().findById(pipelineId), Pipeline.class);
    return EntityUtil.addFollower(relationshipDAO(), userDAO(), pipelineId, Entity.PIPELINE, userId, Entity.USER) ?
            Status.CREATED : Status.OK;
  }

  @Transaction
  public void deleteFollower(String pipelineId, String userId) {
    EntityUtil.validateUser(userDAO(), userId);
    EntityUtil.removeFollower(relationshipDAO(), pipelineId, userId);
  }

  @Transaction
  public void delete(String id) {
    if (relationshipDAO().findToCount(id, Relationship.CONTAINS.ordinal(), Entity.PIPELINE) > 0) {
      throw new IllegalArgumentException("Pipeline is not empty");
    }
    if (pipelineDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.PIPELINE, id));
    }
    relationshipDAO().deleteAll(id);
  }

  @Transaction
  public EntityReference getOwnerReference(Pipeline pipeline) throws IOException {
    return EntityUtil.populateOwner(userDAO(), teamDAO(), pipeline.getOwner());
  }

  public static List<EntityReference> toEntityReference(List<Task> tasks) {
    List<EntityReference> refList = new ArrayList<>();
    for (Task task: tasks) {
      refList.add(EntityUtil.getEntityReference(task));
    }
    return refList;
  }

  public Pipeline get(String id, Fields fields) throws IOException {
    return setFields(EntityUtil.validate(id, pipelineDAO().findById(id), Pipeline.class), fields);
  }

  private Pipeline setFields(Pipeline pipeline, Fields fields) throws IOException {
    pipeline.setDisplayName(pipeline.getDisplayName());
    pipeline.setPipelineUrl(pipeline.getPipelineUrl());
    pipeline.setStartDate(pipeline.getStartDate());
    pipeline.setConcurrency(pipeline.getConcurrency());
    pipeline.setOwner(fields.contains("owner") ? getOwner(pipeline) : null);
    pipeline.setService(fields.contains("service") ? getService(pipeline) : null);
    pipeline.setFollowers(fields.contains("followers") ? getFollowers(pipeline) : null);
    pipeline.setTasks(fields.contains("tasks") ? toEntityReference(getTasks(pipeline)) : null);
    pipeline.setTags(fields.contains("tags") ? getTags(pipeline.getFullyQualifiedName()) : null);
    return pipeline;
  }

  private List<TagLabel> getTags(String fqn) {
    return tagDAO().getTags(fqn);
  }


  private Pipeline createInternal(Pipeline pipeline) throws IOException {
    storePipeline(pipeline, false);
    addRelationships(pipeline);
    return pipeline;
  }

  private void validateRelationships(Pipeline pipeline) throws IOException {
    EntityReference pipelineService = getService(pipeline.getService());
    pipeline.setService(pipelineService);
    pipeline.setFullyQualifiedName(getFQN(pipeline));
    EntityUtil.populateOwner(userDAO(), teamDAO(), pipeline.getOwner()); // Validate owner
    pipeline.setTags(EntityUtil.addDerivedTags(tagDAO(), pipeline.getTags()));
  }

  private void storePipeline(Pipeline pipeline, boolean update) throws JsonProcessingException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = pipeline.getOwner();
    List<TagLabel> tags = pipeline.getTags();
    EntityReference service = pipeline.getService();
    List<EntityReference> tasks = pipeline.getTasks();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    pipeline.withOwner(null).withService(null).withTasks(null).withHref(null).withTags(null);

    if (update) {
      pipelineDAO().update(pipeline.getId().toString(), JsonUtils.pojoToJson(pipeline));
    } else {
      pipelineDAO().insert(JsonUtils.pojoToJson(pipeline));
    }

    // Restore the relationships
    pipeline.withOwner(owner).withService(service).withTasks(tasks).withTags(tags);
  }

  private EntityReference getService(Pipeline pipeline) throws IOException {
    return pipeline == null ? null : getService(EntityUtil.getService(relationshipDAO(), pipeline.getId()));
  }

  private EntityReference getService(EntityReference service) throws IOException {
    String id = service.getId().toString();
    if (service.getType().equalsIgnoreCase(Entity.PIPELINE_SERVICE)) {
      PipelineService serviceInstance = EntityUtil.validate(id, pipelineServiceDAO().findById(id),
              PipelineService.class);
      service.setDescription(serviceInstance.getDescription());
      service.setName(serviceInstance.getName());
    } else {
      throw new IllegalArgumentException(String.format("Invalid service type %s for the pipeline", service.getType()));
    }
    return service;
  }

  public void setService(Pipeline pipeline, EntityReference service) throws IOException {
    if (service != null && pipeline != null) {
      getService(service); // Populate service details
      relationshipDAO().insert(service.getId().toString(), pipeline.getId().toString(), service.getType(),
              Entity.PIPELINE, Relationship.CONTAINS.ordinal());
      pipeline.setService(service);
    }
  }

  private void patch(Pipeline original, Pipeline updated) throws IOException {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withFullyQualifiedName(original.getFullyQualifiedName()).withName(original.getName())
            .withService(original.getService()).withId(original.getId());
    validateRelationships(updated);
    PipelineRepository.PipelineUpdater pipelineUpdater = new PipelineRepository.PipelineUpdater(original, updated, true);
    pipelineUpdater.updateAll();
    pipelineUpdater.store();
  }

  private EntityReference getOwner(Pipeline pipeline) throws IOException {
    return pipeline == null ? null : EntityUtil.populateOwner(pipeline.getId(), relationshipDAO(),
            userDAO(), teamDAO());
  }

  public void setOwner(Pipeline pipeline, EntityReference owner) {
    EntityUtil.setOwner(relationshipDAO(), pipeline.getId(), Entity.PIPELINE, owner);
    pipeline.setOwner(owner);
  }

  private void applyTags(Pipeline pipeline) throws IOException {
    // Add pipeline level tags by adding tag to pipeline relationship
    EntityUtil.applyTags(tagDAO(), pipeline.getTags(), pipeline.getFullyQualifiedName());
    pipeline.setTags(getTags(pipeline.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  private List<EntityReference> getFollowers(Pipeline pipeline) throws IOException {
    return pipeline == null ? null : EntityUtil.getFollowers(pipeline.getId(), relationshipDAO(), userDAO());
  }

  private List<Task> getTasks(Pipeline pipeline) throws IOException {
    if (pipeline == null) {
      return null;
    }
    String pipelineId = pipeline.getId().toString();
    List<String> taskIds = relationshipDAO().findTo(pipelineId, Relationship.CONTAINS.ordinal(), Entity.TASK);
    List<Task> tasks = new ArrayList<>();
    for (String taskId : taskIds) {
      String json = taskDAO().findById(taskId);
      Task task = JsonUtils.readValue(json, Task.class);
      tasks.add(task);
    }
    return tasks;
  }

  private void addRelationships(Pipeline pipeline) throws IOException {
    setService(pipeline, pipeline.getService());

    // Add relationship from pipeline to task
    String pipelineId = pipeline.getId().toString();
    if (pipeline.getTasks() != null) {
      for (EntityReference task : pipeline.getTasks()) {
        relationshipDAO().insert(pipelineId, task.getId().toString(), Entity.PIPELINE, Entity.TASK,
                Relationship.CONTAINS.ordinal());
      }
    }
    // Add owner relationship
    EntityUtil.setOwner(relationshipDAO(), pipeline.getId(), Entity.PIPELINE, pipeline.getOwner());

    // Add tag to pipeline relationship
    applyTags(pipeline);
  }

  private void updateTaskRelationships(Pipeline pipeline) throws IOException  {
    String pipelineId = pipeline.getId().toString();

    // Add relationship from pipeline to task
    if (pipeline.getTasks() != null) {
      // Remove any existing tasks associated with this pipeline
      List<Task> existingTasks = getTasks(pipeline);
      if (existingTasks != null) {
        for (Task task: existingTasks) {
          relationshipDAO().delete(pipelineId, task.getId().toString(), Relationship.CONTAINS.ordinal());
        }
      }

      for (EntityReference task : pipeline.getTasks()) {
        relationshipDAO().insert(pipelineId, task.getId().toString(), Entity.PIPELINE, Entity.TASK,
                Relationship.CONTAINS.ordinal());
      }
    }
  }

  private Pipeline validatePipeline(String id) throws IOException {
    return EntityUtil.validate(id, pipelineDAO().findById(id), Pipeline.class);
  }

  public interface PipelineDAO {
    @SqlUpdate("INSERT INTO pipeline_entity(json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlUpdate("UPDATE pipeline_entity SET  json = :json where id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM pipeline_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT json FROM pipeline_entity WHERE fullyQualifiedName = :name")
    String findByFQN(@Bind("name") String name);

    @SqlQuery("SELECT count(*) FROM pipeline_entity WHERE " +
            "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL)")
    int listCount(@Bind("fqnPrefix") String fqnPrefix);

    @SqlQuery(
            "SELECT json FROM (" +
                    "SELECT fullyQualifiedName, json FROM pipeline_entity WHERE " +
                    "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +// Filter by
                    // service name
                    "fullyQualifiedName < :before " + // Pagination by pipeline fullyQualifiedName
                    "ORDER BY fullyQualifiedName DESC " + // Pagination ordering by  fullyQualifiedName
                    "LIMIT :limit" +
                    ") last_rows_subquery ORDER BY fullyQualifiedName")
    List<String> listBefore(@Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                            @Bind("before") String before);

    @SqlQuery("SELECT json FROM pipeline_entity WHERE " +
            "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +
            "fullyQualifiedName > :after " +
            "ORDER BY fullyQualifiedName " +
            "LIMIT :limit")
    List<String> listAfter(@Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                           @Bind("after") String after);

    @SqlUpdate("DELETE FROM pipeline_entity WHERE id = :id")
    int delete(@Bind("id") String id);
  }

  static class PipelineEntityInterface implements EntityInterface {
    private final Pipeline pipeline;

    PipelineEntityInterface(Pipeline Pipeline) {
      this.pipeline = Pipeline;
    }

    @Override
    public UUID getId() {
      return pipeline.getId();
    }

    @Override
    public String getDescription() {
      return pipeline.getDescription();
    }

    @Override
    public String getDisplayName() {
      return pipeline.getDisplayName();
    }

    @Override
    public EntityReference getOwner() {
      return pipeline.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return pipeline.getFullyQualifiedName();
    }

    @Override
    public List<TagLabel> getTags() {
      return pipeline.getTags();
    }

    @Override
    public void setDescription(String description) {
      pipeline.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      pipeline.setDisplayName(displayName);
    }

    @Override
    public void setTags(List<TagLabel> tags) {
      pipeline.setTags(tags);
    }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class PipelineUpdater extends EntityUpdater {
    final Pipeline orig;
    final Pipeline updated;

    public PipelineUpdater(Pipeline orig, Pipeline updated, boolean patchOperation) {
      super(new PipelineRepository.PipelineEntityInterface(orig), new PipelineRepository.PipelineEntityInterface(updated), patchOperation, relationshipDAO(),
              tagDAO());
      this.orig = orig;
      this.updated = updated;
    }

    public void updateAll() throws IOException {
      super.updateAll();
      updateTasks();
    }

    private void updateTasks() throws IOException {
      // Airflow lineage backend gets executed per task in a DAG. This means we will not a get full picture of the
      // pipeline in each call. Hence we may create a pipeline and add a single task when one task finishes in a pipeline
      // in the next task run we may have to update. To take care of this we will merge the tasks
      if (updated.getTasks() == null) {
        updated.setTasks(orig.getTasks());
      } else {
        updated.getTasks().addAll(orig.getTasks()); // TODO remove duplicates
      }

      // Add relationship from pipeline to task
      updateTaskRelationships(updated);
      update("tasks", EntityUtil.getIDList(updated.getTasks()), EntityUtil.getIDList(orig.getTasks()));
    }

    public void store() throws IOException {
      updated.setVersion(getNewVersion(orig.getVersion()));
      storePipeline(updated, true);
    }
  }
}
