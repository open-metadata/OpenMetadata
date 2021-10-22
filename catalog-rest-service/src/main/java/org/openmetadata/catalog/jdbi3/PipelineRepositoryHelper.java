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
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.entity.data.Task;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.pipelines.PipelineResource;
import org.openmetadata.catalog.resources.pipelines.PipelineResource.PipelineList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUpdater3;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.common.utils.CipherText;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public class PipelineRepositoryHelper extends EntityRepository<Pipeline> {
  private static final Fields PIPELINE_UPDATE_FIELDS = new Fields(PipelineResource.FIELD_LIST,
          "owner,service,tags,tasks");
  private static final Fields PIPELINE_PATCH_FIELDS = new Fields(PipelineResource.FIELD_LIST,
          "owner,service,tags,tasks");

  public PipelineRepositoryHelper(CollectionDAO repo3) {
    super(Pipeline.class, repo3.pipelineDAO());
    this.repo3 = repo3;
  }

  private final CollectionDAO repo3;

  public static String getFQN(Pipeline pipeline) {
    return (pipeline.getService().getName() + "." + pipeline.getName());
  }
  @Transaction
  public Pipeline create(Pipeline pipeline) throws IOException {
    validateRelationships(pipeline);
    return createInternal(pipeline);
  }

  @Transaction
  public PutResponse<Pipeline> createOrUpdate(Pipeline updated) throws IOException {
    validateRelationships(updated);
    Pipeline stored = JsonUtils.readValue(repo3.pipelineDAO().findJsonByFqn(updated.getFullyQualifiedName()),
            Pipeline.class);
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
    repo3.pipelineDAO().findEntityById(pipelineId);
    return EntityUtil.addFollower(repo3.relationshipDAO(), repo3.userDAO(), pipelineId, Entity.PIPELINE, userId,
            Entity.USER) ?
            Status.CREATED : Status.OK;
  }

  @Transaction
  public void deleteFollower(String pipelineId, String userId) {
    EntityUtil.validateUser(repo3.userDAO(), userId);
    EntityUtil.removeFollower(repo3.relationshipDAO(), pipelineId, userId);
  }

  @Transaction
  public void delete(String id) {
    if (repo3.relationshipDAO().findToCount(id, Relationship.CONTAINS.ordinal(), Entity.PIPELINE) > 0) {
      throw new IllegalArgumentException("Pipeline is not empty");
    }
    if (repo3.pipelineDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.PIPELINE, id));
    }
    repo3.relationshipDAO().deleteAll(id);
  }

  @Transaction
  public EntityReference getOwnerReference(Pipeline pipeline) throws IOException {
    return EntityUtil.populateOwner(repo3.userDAO(), repo3.teamDAO(), pipeline.getOwner());
  }

  public static List<EntityReference> toEntityReference(List<Task> tasks) {
    List<EntityReference> refList = new ArrayList<>();
    for (Task task: tasks) {
      refList.add(EntityUtil.getEntityReference(task));
    }
    return refList;
  }

  @Override
  public String getFullyQualifiedName(Pipeline entity) {
    return entity.getFullyQualifiedName();
  }

  @Override
  public Pipeline setFields(Pipeline pipeline, Fields fields) throws IOException {
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

  @Override
  public ResultList<Pipeline> getResultList(List<Pipeline> entities, String beforeCursor, String afterCursor,
                                            int total) throws GeneralSecurityException, UnsupportedEncodingException {
    return new PipelineList(entities, beforeCursor, afterCursor, total);
  }

  private List<TagLabel> getTags(String fqn) {
    return repo3.tagDAO().getTags(fqn);
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
    EntityUtil.populateOwner(repo3.userDAO(), repo3.teamDAO(), pipeline.getOwner()); // Validate owner
    getService(pipeline.getService());
    pipeline.setTags(EntityUtil.addDerivedTags(repo3.tagDAO(), pipeline.getTags()));
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
      repo3.pipelineDAO().update(pipeline.getId().toString(), JsonUtils.pojoToJson(pipeline));
    } else {
      repo3.pipelineDAO().insert(JsonUtils.pojoToJson(pipeline));
    }

    // Restore the relationships
    pipeline.withOwner(owner).withService(service).withTasks(tasks).withTags(tags);
  }

  private EntityReference getService(Pipeline pipeline) throws IOException {
    return pipeline == null ? null : getService(EntityUtil.getService(repo3.relationshipDAO(), pipeline.getId()));
  }

  private EntityReference getService(EntityReference service) throws IOException {
    String id = service.getId().toString();
    if (service.getType().equalsIgnoreCase(Entity.PIPELINE_SERVICE)) {
      PipelineService serviceInstance = repo3.pipelineServiceDAO().findEntityById(id);
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
      repo3.relationshipDAO().insert(service.getId().toString(), pipeline.getId().toString(), service.getType(),
              Entity.PIPELINE, Relationship.CONTAINS.ordinal());
      pipeline.setService(service);
    }
  }

  private void patch(Pipeline original, Pipeline updated) throws IOException {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withFullyQualifiedName(original.getFullyQualifiedName()).withName(original.getName())
            .withService(original.getService()).withId(original.getId());
    validateRelationships(updated);
    PipelineRepositoryHelper.PipelineUpdater pipelineUpdater = new PipelineRepositoryHelper.PipelineUpdater(original, updated, true);
    pipelineUpdater.updateAll();
    pipelineUpdater.store();
  }

  private EntityReference getOwner(Pipeline pipeline) throws IOException {
    return pipeline == null ? null : EntityUtil.populateOwner(pipeline.getId(), repo3.relationshipDAO(),
            repo3.userDAO(), repo3.teamDAO());
  }

  public void setOwner(Pipeline pipeline, EntityReference owner) {
    EntityUtil.setOwner(repo3.relationshipDAO(), pipeline.getId(), Entity.PIPELINE, owner);
    pipeline.setOwner(owner);
  }

  private void applyTags(Pipeline pipeline) throws IOException {
    // Add pipeline level tags by adding tag to pipeline relationship
    EntityUtil.applyTags(repo3.tagDAO(), pipeline.getTags(), pipeline.getFullyQualifiedName());
    pipeline.setTags(getTags(pipeline.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  private List<EntityReference> getFollowers(Pipeline pipeline) throws IOException {
    return pipeline == null ? null : EntityUtil.getFollowers(pipeline.getId(), repo3.relationshipDAO(), repo3.userDAO());
  }

  private List<Task> getTasks(Pipeline pipeline) throws IOException {
    if (pipeline == null) {
      return null;
    }
    String pipelineId = pipeline.getId().toString();
    List<String> taskIds = repo3.relationshipDAO().findTo(pipelineId, Relationship.CONTAINS.ordinal(), Entity.TASK);
    List<Task> tasks = new ArrayList<>();
    for (String taskId : taskIds) {
      String json = repo3.taskDAO().findJsonById(taskId);
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
        repo3.relationshipDAO().insert(pipelineId, task.getId().toString(), Entity.PIPELINE, Entity.TASK,
                Relationship.CONTAINS.ordinal());
      }
    }
    // Add owner relationship
    EntityUtil.setOwner(repo3.relationshipDAO(), pipeline.getId(), Entity.PIPELINE, pipeline.getOwner());

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
          repo3.relationshipDAO().delete(pipelineId, task.getId().toString(), Relationship.CONTAINS.ordinal());
        }
      }

      for (EntityReference task : pipeline.getTasks()) {
        repo3.relationshipDAO().insert(pipelineId, task.getId().toString(), Entity.PIPELINE, Entity.TASK,
                Relationship.CONTAINS.ordinal());
      }
    }
  }

  private Pipeline validatePipeline(String id) throws IOException {
    return repo3.pipelineDAO().findEntityById(id);
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
  public class PipelineUpdater extends EntityUpdater3 {
    final Pipeline orig;
    final Pipeline updated;

    public PipelineUpdater(Pipeline orig, Pipeline updated, boolean patchOperation) {
      super(new PipelineRepositoryHelper.PipelineEntityInterface(orig), new PipelineRepositoryHelper.PipelineEntityInterface(updated), patchOperation, repo3.relationshipDAO(),
              repo3.tagDAO());
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
