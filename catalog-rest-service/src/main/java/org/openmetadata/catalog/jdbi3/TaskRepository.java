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
import org.openmetadata.catalog.entity.data.Task;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.tasks.TaskResource;
import org.openmetadata.catalog.resources.tasks.TaskResource.TaskList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUpdater3;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil.PutResponse;
import org.openmetadata.catalog.util.ResultList;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public class TaskRepository extends EntityRepository<Task>{
  private static final Fields TASK_UPDATE_FIELDS = new Fields(TaskResource.FIELD_LIST, "owner," +
          "taskConfig,tags,downstreamTasks");
  private static final Fields TASK_PATCH_FIELDS = new Fields(TaskResource.FIELD_LIST, "owner,service,tags");
  private final CollectionDAO dao;

  public static String getFQN(Task task) {
    return (task.getService().getName() + "." + task.getName());
  }

  public TaskRepository(CollectionDAO dao) {
    super(Task.class,dao.taskDAO());
    this.dao = dao;
  }

  @Transaction
  public Task create(Task task) throws IOException {
    validateRelationships(task);
    return createInternal(task);
  }

  @Transaction
  public void delete(String id) {
    if (dao.relationshipDAO().findToCount(id, Relationship.CONTAINS.ordinal(), Entity.TASK) > 0) {
      throw new IllegalArgumentException("Task is not empty");
    }
    if (dao.taskDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.TASK, id));
    }
    dao.relationshipDAO().deleteAll(id);
  }

  @Transaction
  public PutResponse<Task> createOrUpdate(Task updated) throws IOException {
    validateRelationships(updated);
    Task stored = JsonUtils.readValue(dao.taskDAO().findJsonByFqn(updated.getFullyQualifiedName()), Task.class);
    if (stored == null) {  // Task does not exist. Create a new one
      return new PutResponse<>(Status.CREATED, createInternal(updated));
    }
    setFields(stored, TASK_UPDATE_FIELDS);
    updated.setId(stored.getId());

    TaskUpdater taskUpdater = new TaskUpdater(stored, updated, false);
    taskUpdater.updateAll();
    taskUpdater.store();
    return new PutResponse<>(Status.OK, updated);
  }

  @Transaction
  public Task patch(String id, String user, JsonPatch patch) throws IOException {
    Task original = setFields(validateTask(id), TASK_PATCH_FIELDS);
    Task updated = JsonUtils.applyPatch(original, patch, Task.class);
    updated.withUpdatedBy(user).withUpdatedAt(new Date());
    patch(original, updated);
    return updated;
  }

  public Task createInternal(Task task) throws IOException {
    storeTask(task, false);
    addRelationships(task);
    return task;
  }

  private void validateRelationships(Task task) throws IOException {
    EntityReference pipelineService = getService(task.getService());
    task.setService(pipelineService);
    task.setFullyQualifiedName(getFQN(task));
    EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), task.getOwner()); // Validate owner
    getService(task.getService());
    task.setTags(EntityUtil.addDerivedTags(dao.tagDAO(), task.getTags()));
  }

  private void addRelationships(Task task) throws IOException {
    setService(task, task.getService());
    setOwner(task, task.getOwner());
    applyTags(task);
  }

  private void storeTask(Task task, boolean update) throws JsonProcessingException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = task.getOwner();
    List<TagLabel> tags = task.getTags();
    EntityReference service = task.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    task.withOwner(null).withService(null).withHref(null).withTags(null);

    if (update) {
      dao.taskDAO().update(task.getId().toString(), JsonUtils.pojoToJson(task));
    } else {
      dao.taskDAO().insert(JsonUtils.pojoToJson(task));
    }

    // Restore the relationships
    task.withOwner(owner).withService(service).withTags(tags);
  }


  private void applyTags(Task task) throws IOException {
    // Add task level tags by adding tag to task relationship
    EntityUtil.applyTags(dao.tagDAO(), task.getTags(), task.getFullyQualifiedName());
    task.setTags(getTags(task.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  private void patch(Task original, Task updated) throws IOException {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withFullyQualifiedName(original.getFullyQualifiedName()).withName(original.getName())
            .withService(original.getService()).withId(original.getId());
    validateRelationships(updated);
    TaskUpdater taskUpdater = new TaskUpdater(original, updated, true);
    taskUpdater.updateAll();
    taskUpdater.store();
  }

  public EntityReference getOwner(Task task) throws IOException {
    return task != null ? EntityUtil.populateOwner(task.getId(), dao.relationshipDAO(), dao.userDAO(), dao.teamDAO()) : null;
  }

  private void setOwner(Task task, EntityReference owner) {
    EntityUtil.setOwner(dao.relationshipDAO(), task.getId(), Entity.TASK, owner);
    task.setOwner(owner);
  }

  private Task validateTask(String id) throws IOException {
    return dao.taskDAO().findEntityById(id);
  }

  @Override
  public String getFullyQualifiedName(Task entity) {
    return entity.getFullyQualifiedName();
  }

  @Override
  public Task setFields(Task task, Fields fields) throws IOException {
    task.setTaskUrl(task.getTaskUrl());
    task.setTaskSQL(task.getTaskSQL());
    task.setStartDate(task.getStartDate());
    task.setEndDate(task.getEndDate());
    task.setOwner(fields.contains("owner") ? getOwner(task) : null);
    task.setService(fields.contains("service") ? getService(task) : null);
    task.setTags(fields.contains("tags") ? getTags(task.getFullyQualifiedName()) : null);
    task.setDownstreamTasks(fields.contains("downstreamTasks") ? task.getDownstreamTasks() : null);
    return task;
  }

  @Override
  public ResultList<Task> getResultList(List<Task> entities, String beforeCursor, String afterCursor, int total) throws GeneralSecurityException, UnsupportedEncodingException {
    return new TaskList(entities, beforeCursor, afterCursor, total);
  }


  private List<TagLabel> getTags(String fqn) {
    return dao.tagDAO().getTags(fqn);
  }

  private EntityReference getService(Task task) throws IOException {
    return task == null ? null : getService(Objects.requireNonNull(EntityUtil.getService(dao.relationshipDAO(),
            task.getId(), Entity.PIPELINE_SERVICE)));
  }

  private EntityReference getService(EntityReference service) throws IOException {
    String id = service.getId().toString();
    if (service.getType().equalsIgnoreCase(Entity.PIPELINE_SERVICE)) {
      PipelineService serviceInstance = dao.pipelineServiceDAO().findEntityById(id);
      service.setDescription(serviceInstance.getDescription());
      service.setName(serviceInstance.getName());
    } else {
      throw new IllegalArgumentException(String.format("Invalid service type %s for the task", service.getType()));
    }
    return service;
  }

  public void setService(Task task, EntityReference service) throws IOException {
    if (service != null && task != null) {
      getService(service); // Populate service details
      dao.relationshipDAO().insert(service.getId().toString(), task.getId().toString(), service.getType(),
              Entity.TASK, Relationship.CONTAINS.ordinal());
      task.setService(service);
    }
  }

  static class TaskEntityInterface implements EntityInterface {
    private final Task task;

    TaskEntityInterface(Task Task) {
      this.task = Task;
    }

    @Override
    public UUID getId() {
      return task.getId();
    }

    @Override
    public String getDescription() {
      return task.getDescription();
    }

    @Override
    public String getDisplayName() {
      return task.getDisplayName();
    }

    @Override
    public EntityReference getOwner() {
      return task.getOwner();
    }

    @Override
    public String getFullyQualifiedName() {
      return task.getFullyQualifiedName();
    }

    @Override
    public List<TagLabel> getTags() {
      return task.getTags();
    }

    @Override
    public void setDescription(String description) {
      task.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      task.setDisplayName(displayName);
    }

    @Override
    public void setTags(List<TagLabel> tags) {
      task.setTags(tags);
    }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class TaskUpdater extends EntityUpdater3 {
    final Task orig;
    final Task updated;

    public TaskUpdater(Task orig, Task updated, boolean patchOperation) {
      super(new TaskRepository.TaskEntityInterface(orig), new TaskRepository.TaskEntityInterface(updated), patchOperation, dao.relationshipDAO(),
              dao.tagDAO());
      this.orig = orig;
      this.updated = updated;
    }

    public void updateAll() throws IOException {
      super.updateAll();
    }

    public void store() throws IOException {
      updated.setVersion(getNewVersion(orig.getVersion()));
      storeTask(updated, true);
    }
  }
}
