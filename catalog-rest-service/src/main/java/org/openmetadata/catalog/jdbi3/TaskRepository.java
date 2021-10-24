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

import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Task;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.tasks.TaskResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;

import java.io.IOException;
import java.text.ParseException;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public class TaskRepository extends EntityRepository<Task> {
  private static final Fields TASK_UPDATE_FIELDS = new Fields(TaskResource.FIELD_LIST, "owner," +
          "taskConfig,tags,downstreamTasks");
  private static final Fields TASK_PATCH_FIELDS = new Fields(TaskResource.FIELD_LIST, "owner,service,tags");
  private final CollectionDAO dao;

  public static String getFQN(Task task) {
    return (task.getService().getName() + "." + task.getName());
  }

  public TaskRepository(CollectionDAO dao) {
    super(Task.class, dao.taskDAO(), dao, TASK_PATCH_FIELDS, TASK_UPDATE_FIELDS);
    this.dao = dao;
  }

  @Transaction
  public void delete(UUID id) {
    if (dao.relationshipDAO().findToCount(id.toString(), Relationship.CONTAINS.ordinal(), Entity.TASK) > 0) {
      throw new IllegalArgumentException("Task is not empty");
    }
    if (dao.taskDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.TASK, id));
    }
    dao.relationshipDAO().deleteAll(id.toString());
  }

  @Override
  public void validate(Task task) throws IOException {
    EntityReference pipelineService = getService(task.getService());
    task.setService(pipelineService);
    task.setFullyQualifiedName(getFQN(task));
    EntityUtil.populateOwner(dao.userDAO(), dao.teamDAO(), task.getOwner()); // Validate owner
    getService(task.getService());
    task.setTags(EntityUtil.addDerivedTags(dao.tagDAO(), task.getTags()));
  }

  @Override
  public void store(Task task, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = task.getOwner();
    List<TagLabel> tags = task.getTags();
    EntityReference service = task.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    task.withOwner(null).withService(null).withHref(null).withTags(null);

    if (update) {
      dao.taskDAO().update(task.getId(), JsonUtils.pojoToJson(task));
    } else {
      dao.taskDAO().insert(task);
    }

    // Restore the relationships
    task.withOwner(owner).withService(service).withTags(tags);
  }

  @Override
  public void storeRelationships(Task task) throws IOException {
    setService(task, task.getService());
    setOwner(task, task.getOwner());
    applyTags(task);
  }

  private void applyTags(Task task) throws IOException {
    // Add task level tags by adding tag to task relationship
    EntityUtil.applyTags(dao.tagDAO(), task.getTags(), task.getFullyQualifiedName());
    task.setTags(getTags(task.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  public EntityReference getOwner(Task task) throws IOException {
    return task != null ?
            EntityUtil.populateOwner(task.getId(), dao.relationshipDAO(), dao.userDAO(), dao.teamDAO()) : null;
  }

  private void setOwner(Task task, EntityReference owner) {
    EntityUtil.setOwner(dao.relationshipDAO(), task.getId(), Entity.TASK, owner);
    task.setOwner(owner);
  }

  @Override
  public Task setFields(Task task, Fields fields) throws IOException {
    task.setTaskUrl(task.getTaskUrl());
    task.setTaskSQL(task.getTaskSQL());
    task.setStartDate(task.getStartDate());
    task.setEndDate(task.getEndDate());
    task.setService(getService(task));
    task.setOwner(fields.contains("owner") ? getOwner(task) : null);
    task.setTags(fields.contains("tags") ? getTags(task.getFullyQualifiedName()) : null);
    task.setDownstreamTasks(fields.contains("downstreamTasks") ? task.getDownstreamTasks() : null);
    return task;
  }

  @Override
  public void restorePatchAttributes(Task original, Task updated) throws IOException, ParseException {

  }

  @Override
  public EntityInterface<Task> getEntityInterface(Task entity) {
    return new TaskEntityInterface(entity);
  }


  private List<TagLabel> getTags(String fqn) {
    return dao.tagDAO().getTags(fqn);
  }

  private EntityReference getService(Task task) throws IOException {
    return task == null ? null : getService(Objects.requireNonNull(EntityUtil.getService(dao.relationshipDAO(),
            task.getId(), Entity.PIPELINE_SERVICE)));
  }

  private EntityReference getService(EntityReference service) throws IOException {
    if (service.getType().equalsIgnoreCase(Entity.PIPELINE_SERVICE)) {
      PipelineService serviceInstance = dao.pipelineServiceDAO().findEntityById(service.getId());
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

  public static class TaskEntityInterface implements EntityInterface<Task> {
    private final Task entity;

    public TaskEntityInterface(Task entity) {
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
    public EntityReference getEntityReference() {
      return new EntityReference().withId(getId()).withName(getFullyQualifiedName()).withDescription(getDescription())
              .withDisplayName(getDisplayName()).withType(Entity.TASK);
    }

    @Override
    public Task getEntity() { return entity; }

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
    public void setTags(List<TagLabel> tags) {
      entity.setTags(tags);
    }
  }
}
