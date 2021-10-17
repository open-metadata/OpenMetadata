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
import org.openmetadata.catalog.entity.data.Task;
import org.openmetadata.catalog.entity.data.Task;
import org.openmetadata.catalog.entity.data.Task;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.ChartRepository.ChartUpdater;
import org.openmetadata.catalog.jdbi3.TaskRepository.TaskEntityInterface;
import org.openmetadata.catalog.jdbi3.PipelineServiceRepository.PipelineServiceDAO;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamDAO;
import org.openmetadata.catalog.jdbi3.UserRepository.UserDAO;
import org.openmetadata.catalog.resources.tasks.TaskResource;
import org.openmetadata.catalog.resources.tasks.TaskResource.TaskList;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;

public abstract class TaskRepository {
  private static final Logger LOG = LoggerFactory.getLogger(TaskRepository.class);
  private static final Fields TASK_UPDATE_FIELDS = new Fields(TaskResource.FIELD_LIST, "owner," +
          "taskConfig,tags");
  private static final Fields TASK_PATCH_FIELDS = new Fields(TaskResource.FIELD_LIST, "owner,service,tags");

  public static String getFQN(EntityReference service, Task task) {
    return (service.getName() + "." + task.getName());
  }

  @CreateSqlObject
  abstract TaskDAO taskDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  abstract UserDAO userDAO();

  @CreateSqlObject
  abstract TeamDAO teamDAO();

  @CreateSqlObject
  abstract PipelineServiceDAO pipelineServiceDAO();

  @CreateSqlObject
  abstract TagRepository.TagDAO tagDAO();


  @Transaction
  public TaskList listAfter(Fields fields, String serviceName, int limitParam, String after) throws IOException,
          GeneralSecurityException {
    // forward scrolling, if after == null then first page is being asked being asked
    List<String> jsons = taskDAO().listAfter(serviceName, limitParam + 1, after == null ? "" :
            CipherText.instance().decrypt(after));

    List<Task> tasks = new ArrayList<>();
    for (String json : jsons) {
      tasks.add(setFields(JsonUtils.readValue(json, Task.class), fields));
    }
    int total = taskDAO().listCount(serviceName);

    String beforeCursor, afterCursor = null;
    beforeCursor = after == null ? null : tasks.get(0).getFullyQualifiedName();
    if (tasks.size() > limitParam) { // If extra result exists, then next page exists - return after cursor
      tasks.remove(limitParam);
      afterCursor = tasks.get(limitParam - 1).getFullyQualifiedName();
    }
    return new TaskList(tasks, beforeCursor, afterCursor, total);
  }

  @Transaction
  public TaskList listBefore(Fields fields, String serviceName, int limitParam, String before) throws IOException,
          GeneralSecurityException {
    // Reverse scrolling - Get one extra result used for computing before cursor
    List<String> jsons = taskDAO().listBefore(serviceName, limitParam + 1, CipherText.instance().decrypt(before));
    List<Task> tasks = new ArrayList<>();
    for (String json : jsons) {
      tasks.add(setFields(JsonUtils.readValue(json, Task.class), fields));
    }
    int total = taskDAO().listCount(serviceName);

    String beforeCursor = null, afterCursor;
    if (tasks.size() > limitParam) { // If extra result exists, then previous page exists - return before cursor
      tasks.remove(0);
      beforeCursor = tasks.get(0).getFullyQualifiedName();
    }
    afterCursor = tasks.get(tasks.size() - 1).getFullyQualifiedName();
    return new TaskList(tasks, beforeCursor, afterCursor, total);
  }

  @Transaction
  public Task get(String id, Fields fields) throws IOException {
    return setFields(validateTask(id), fields);
  }

  @Transaction
  public Task getByName(String fqn, Fields fields) throws IOException {
    Task task = EntityUtil.validate(fqn, taskDAO().findByFQN(fqn), Task.class);
    return setFields(task, fields);
  }

  @Transaction
  public Task create(Task task, EntityReference service, EntityReference owner) throws IOException {
    getService(service); // Validate service
    return createInternal(task, service, owner);
  }

  @Transaction
  public void delete(String id) {
    if (relationshipDAO().findToCount(id, Relationship.CONTAINS.ordinal(), Entity.TASK) > 0) {
      throw new IllegalArgumentException("Task is not empty");
    }
    if (taskDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(entityNotFound(Entity.TASK, id));
    }
    relationshipDAO().deleteAll(id);
  }

  @Transaction
  public PutResponse<Task> createOrUpdate(Task updated, EntityReference service, EntityReference newOwner)
          throws IOException {
    getService(service); // Validate service

    String fqn = getFQN(service, updated);
    Task stored = JsonUtils.readValue(taskDAO().findByFQN(fqn), Task.class);
    if (stored == null) {  // Task does not exist. Create a new one
      return new PutResponse<>(Status.CREATED, createInternal(updated, service, newOwner));
    }
    setFields(stored, TASK_UPDATE_FIELDS);
    updated.setId(stored.getId());
    validateRelationships(updated, service, newOwner);

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

  public Task createInternal(Task task, EntityReference service, EntityReference owner) throws IOException {
    validateRelationships(task, service, owner);
    storeTask(task, false);
    addRelationships(task);
    return task;
  }

  private void validateRelationships(Task task, EntityReference service, EntityReference owner) throws IOException {
    task.setFullyQualifiedName(getFQN(service, task));
    EntityUtil.populateOwner(userDAO(), teamDAO(), owner); // Validate owner
    getService(service);
    task.setTags(EntityUtil.addDerivedTags(tagDAO(), task.getTags()));
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
      taskDAO().update(task.getId().toString(), JsonUtils.pojoToJson(task));
    } else {
      taskDAO().insert(JsonUtils.pojoToJson(task));
    }

    // Restore the relationships
    task.withOwner(owner).withService(service).withTags(tags);
  }


  private void applyTags(Task task) throws IOException {
    // Add task level tags by adding tag to task relationship
    EntityUtil.applyTags(tagDAO(), task.getTags(), task.getFullyQualifiedName());
    task.setTags(getTags(task.getFullyQualifiedName())); // Update tag to handle additional derived tags
  }

  private void patch(Task original, Task updated) throws IOException {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withFullyQualifiedName(original.getFullyQualifiedName()).withName(original.getName())
            .withService(original.getService()).withId(original.getId());
    validateRelationships(updated, updated.getService(), updated.getOwner());
    TaskUpdater taskUpdater = new TaskUpdater(original, updated, true);
    taskUpdater.updateAll();
    taskUpdater.store();
  }

  public EntityReference getOwner(Task task) throws IOException {
    return task != null ? EntityUtil.populateOwner(task.getId(), relationshipDAO(), userDAO(), teamDAO()) : null;
  }

  private void setOwner(Task task, EntityReference owner) {
    EntityUtil.setOwner(relationshipDAO(), task.getId(), Entity.TASK, owner);
    task.setOwner(owner);
  }

  private void updateOwner(Task task, EntityReference origOwner, EntityReference newOwner) {
    EntityUtil.updateOwner(relationshipDAO(), origOwner, newOwner, task.getId(), Entity.TASK);
    task.setOwner(newOwner);
  }

  private Task validateTask(String id) throws IOException {
    return EntityUtil.validate(id, taskDAO().findById(id), Task.class);
  }

  private Task setFields(Task task, Fields fields) throws IOException {
    task.setOwner(fields.contains("owner") ? getOwner(task) : null);
    task.setService(fields.contains("service") ? getService(task) : null);
    task.setTags(fields.contains("tags") ? getTags(task.getFullyQualifiedName()) : null);
    return task;
  }


  private List<TagLabel> getTags(String fqn) {
    return tagDAO().getTags(fqn);
  }

  private EntityReference getService(Task task) throws IOException {
    return task == null ? null : getService(Objects.requireNonNull(EntityUtil.getService(relationshipDAO(),
            task.getId(), Entity.PIPELINE_SERVICE)));
  }

  private EntityReference getService(EntityReference service) throws IOException {
    String id = service.getId().toString();
    if (service.getType().equalsIgnoreCase(Entity.PIPELINE_SERVICE)) {
      PipelineService serviceInstance = EntityUtil.validate(id, pipelineServiceDAO().findById(id),
              PipelineService.class);
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
      relationshipDAO().insert(service.getId().toString(), task.getId().toString(), service.getType(),
              Entity.TASK, Relationship.CONTAINS.ordinal());
      task.setService(service);
    }
  }

  public interface TaskDAO {
    @SqlUpdate("INSERT INTO task_entity (json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlUpdate("UPDATE task_entity SET  json = :json where id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery("SELECT json FROM task_entity WHERE fullyQualifiedName = :name")
    String findByFQN(@Bind("name") String name);

    @SqlQuery("SELECT json FROM task_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT count(*) FROM task_entity WHERE " +
            "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL)")
    int listCount(@Bind("fqnPrefix") String fqnPrefix);

    @SqlQuery(
            "SELECT json FROM (" +
                    "SELECT fullyQualifiedName, json FROM task_entity WHERE " +
                    "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +// Filter by
                    // service name
                    "fullyQualifiedName < :before " + // Pagination by task fullyQualifiedName
                    "ORDER BY fullyQualifiedName DESC " + // Pagination ordering by task fullyQualifiedName
                    "LIMIT :limit" +
                    ") last_rows_subquery ORDER BY fullyQualifiedName")
    List<String> listBefore(@Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                            @Bind("before") String before);

    @SqlQuery("SELECT json FROM task_entity WHERE " +
            "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +
            "fullyQualifiedName > :after " +
            "ORDER BY fullyQualifiedName " +
            "LIMIT :limit")
    List<String> listAfter(@Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                           @Bind("after") String after);

    @SqlQuery("SELECT EXISTS (SELECT * FROM task_entity WHERE id = :id)")
    boolean exists(@Bind("id") String id);

    @SqlUpdate("DELETE FROM task_entity WHERE id = :id")
    int delete(@Bind("id") String id);
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
  public class TaskUpdater extends EntityUpdater {
    final Task orig;
    final Task updated;

    public TaskUpdater(Task orig, Task updated, boolean patchOperation) {
      super(new TaskRepository.TaskEntityInterface(orig), new TaskRepository.TaskEntityInterface(updated), patchOperation, relationshipDAO(),
              tagDAO());
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
