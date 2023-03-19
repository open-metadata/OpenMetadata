/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.util.EntityUtil.taskMatch;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.Status;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Task;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.pipelines.PipelineResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

public class PipelineRepository extends EntityRepository<Pipeline> {
  private static final String PIPELINE_UPDATE_FIELDS = "owner,tags,tasks,extension,followers";
  private static final String PIPELINE_PATCH_FIELDS = "owner,tags,tasks,extension,followers";
  public static final String PIPELINE_STATUS_EXTENSION = "pipeline.pipelineStatus";

  public PipelineRepository(CollectionDAO dao) {
    super(
        PipelineResource.COLLECTION_PATH,
        Entity.PIPELINE,
        Pipeline.class,
        dao.pipelineDAO(),
        dao,
        PIPELINE_PATCH_FIELDS,
        PIPELINE_UPDATE_FIELDS);
  }

  @Override
  public void setFullyQualifiedName(Pipeline pipeline) {
    pipeline.setFullyQualifiedName(FullyQualifiedName.add(pipeline.getService().getName(), pipeline.getName()));
    setTaskFQN(pipeline.getFullyQualifiedName(), pipeline.getTasks());
  }

  @Override
  public Pipeline setFields(Pipeline pipeline, Fields fields) throws IOException {
    pipeline.setService(getContainer(pipeline.getId()));
    pipeline.setFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(pipeline) : null);
    getTaskTags(fields.contains(FIELD_TAGS), pipeline.getTasks());
    if (!fields.contains("tasks")) {
      pipeline.withTasks(null);
    }
    return pipeline.withPipelineStatus(fields.contains("pipelineStatus") ? getPipelineStatus(pipeline) : null);
  }

  private PipelineStatus getPipelineStatus(Pipeline pipeline) throws IOException {
    return JsonUtils.readValue(
        daoCollection
            .entityExtensionTimeSeriesDao()
            .getLatestExtension(pipeline.getFullyQualifiedName(), PIPELINE_STATUS_EXTENSION),
        PipelineStatus.class);
  }

  @Transaction
  public Pipeline addPipelineStatus(String fqn, PipelineStatus pipelineStatus) throws IOException {
    // Validate the request content
    Pipeline pipeline = daoCollection.pipelineDAO().findEntityByName(fqn);
    pipeline.setService(getContainer(pipeline.getId()));

    // validate all the Tasks
    for (Status taskStatus : pipelineStatus.getTaskStatus()) {
      validateTask(pipeline, taskStatus.getName());
    }

    PipelineStatus storedPipelineStatus =
        JsonUtils.readValue(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .getExtensionAtTimestamp(fqn, PIPELINE_STATUS_EXTENSION, pipelineStatus.getTimestamp()),
            PipelineStatus.class);
    if (storedPipelineStatus != null) {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .update(
              pipeline.getFullyQualifiedName(),
              PIPELINE_STATUS_EXTENSION,
              JsonUtils.pojoToJson(pipelineStatus),
              pipelineStatus.getTimestamp());
    } else {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .insert(
              pipeline.getFullyQualifiedName(),
              PIPELINE_STATUS_EXTENSION,
              "pipelineStatus",
              JsonUtils.pojoToJson(pipelineStatus));
    }
    return pipeline.withPipelineStatus(pipelineStatus);
  }

  @Transaction
  public Pipeline deletePipelineStatus(String fqn, Long timestamp) throws IOException {
    // Validate the request content
    Pipeline pipeline = dao.findEntityByName(fqn);
    pipeline.setService(getContainer(pipeline.getId()));
    PipelineStatus storedPipelineStatus =
        JsonUtils.readValue(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .getExtensionAtTimestamp(fqn, PIPELINE_STATUS_EXTENSION, timestamp),
            PipelineStatus.class);
    if (storedPipelineStatus != null) {
      daoCollection.entityExtensionTimeSeriesDao().deleteAtTimestamp(fqn, PIPELINE_STATUS_EXTENSION, timestamp);
      pipeline.setPipelineStatus(storedPipelineStatus);
      return pipeline;
    }
    throw new EntityNotFoundException(
        String.format("Failed to find pipeline status for %s at %s", pipeline.getName(), timestamp));
  }

  public ResultList<PipelineStatus> getPipelineStatuses(String fqn, Long starTs, Long endTs) throws IOException {
    List<PipelineStatus> pipelineStatuses;
    pipelineStatuses =
        JsonUtils.readObjects(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .listBetweenTimestamps(fqn, PIPELINE_STATUS_EXTENSION, starTs, endTs),
            PipelineStatus.class);

    return new ResultList<>(pipelineStatuses, starTs.toString(), endTs.toString(), pipelineStatuses.size());
  }

  // Validate if a given task exists in the pipeline
  private void validateTask(Pipeline pipeline, String taskName) {
    boolean validTask = pipeline.getTasks().stream().anyMatch(task -> task.getName().equals(taskName));
    if (!validTask) {
      throw new IllegalArgumentException("Invalid task name " + taskName);
    }
  }

  @Override
  public void restorePatchAttributes(Pipeline original, Pipeline updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated
        .withFullyQualifiedName(original.getFullyQualifiedName())
        .withName(original.getName())
        .withService(original.getService())
        .withId(original.getId());
  }

  @Override
  public void prepare(Pipeline pipeline) throws IOException {
    populateService(pipeline);
  }

  @Override
  public void storeEntity(Pipeline pipeline, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = pipeline.getOwner();
    List<TagLabel> tags = pipeline.getTags();
    EntityReference service = pipeline.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    pipeline.withOwner(null).withService(null).withHref(null).withTags(null);

    // Don't store column tags as JSON but build it on the fly based on relationships
    List<Task> taskWithTags = pipeline.getTasks();
    pipeline.setTasks(cloneWithoutTags(taskWithTags));
    store(pipeline, update);

    // Restore the relationships
    pipeline.withOwner(owner).withService(service).withTags(tags).withTasks(taskWithTags);
  }

  @Override
  public void storeRelationships(Pipeline pipeline) {
    EntityReference service = pipeline.getService();
    addRelationship(service.getId(), pipeline.getId(), service.getType(), Entity.PIPELINE, Relationship.CONTAINS);

    // Add owner relationship
    storeOwner(pipeline, pipeline.getOwner());

    // Add tag to pipeline relationship
    applyTags(pipeline);
  }

  @Override
  public void applyTags(Pipeline pipeline) {
    // Add table level tags by adding tag to table relationship
    super.applyTags(pipeline);
    applyTags(pipeline.getTasks());
  }

  private void applyTags(List<Task> tasks) {
    if (tasks != null) {
      for (Task task : tasks) {
        applyTags(task.getTags(), task.getFullyQualifiedName());
      }
    }
  }

  private void getTaskTags(boolean setTags, List<Task> tasks) {
    for (Task t : listOrEmpty(tasks)) {
      t.setTags(setTags ? getTags(t.getFullyQualifiedName()) : null);
    }
  }

  private void setTaskFQN(String parentFQN, List<Task> tasks) {
    if (tasks != null) {
      tasks.forEach(
          t -> {
            String taskFqn = FullyQualifiedName.add(parentFQN, t.getName());
            t.setFullyQualifiedName(taskFqn);
          });
    }
  }

  @Override
  public EntityUpdater getUpdater(Pipeline original, Pipeline updated, Operation operation) {
    return new PipelineUpdater(original, updated, operation);
  }

  @Override
  public List<TagLabel> getAllTags(EntityInterface entity) {
    List<TagLabel> allTags = new ArrayList<>();
    Pipeline pipeline = (Pipeline) entity;
    EntityUtil.mergeTags(allTags, pipeline.getTags());
    for (Task task : listOrEmpty(pipeline.getTasks())) {
      EntityUtil.mergeTags(allTags, task.getTags());
    }
    return allTags;
  }

  private void populateService(Pipeline pipeline) throws IOException {
    PipelineService service = Entity.getEntity(pipeline.getService(), "", Include.NON_DELETED);
    pipeline.setService(service.getEntityReference());
    pipeline.setServiceType(service.getServiceType());
  }

  private static List<Task> cloneWithoutTags(List<Task> tasks) {
    if (nullOrEmpty(tasks)) {
      return tasks;
    }
    List<Task> copy = new ArrayList<>();
    tasks.forEach(t -> copy.add(t.withTags(null)));
    return copy;
  }

  /** Handles entity updated from PUT and POST operation. */
  public class PipelineUpdater extends EntityUpdater {
    public PipelineUpdater(Pipeline original, Pipeline updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateTasks(original, updated);
      recordChange("pipelineUrl", original.getPipelineUrl(), updated.getPipelineUrl());
      recordChange("concurrency", original.getConcurrency(), updated.getConcurrency());
      recordChange("pipelineLocation", original.getPipelineLocation(), updated.getPipelineLocation());
    }

    private void updateTasks(Pipeline original, Pipeline updated) throws JsonProcessingException {
      // While the Airflow lineage only gets executed for one Task at a time, we will consider the
      // client Task information as the source of truth. This means that at each update, we will
      // expect to receive all the tasks known until that point.

      // The lineage backend will take care of controlling new & deleted tasks, while passing to the
      // API the full list of Tasks to consider for a given Pipeline. Having a single point of control
      // of the Tasks and their status, simplifies the logic on how to add/delete tasks.

      // The API will only take care of marking tasks as added/updated/deleted based on the original
      // and incoming changes.

      List<Task> updatedTasks = listOrEmpty(updated.getTasks());
      List<Task> origTasks = listOrEmpty(original.getTasks());

      boolean newTasks = false;
      // Update the task descriptions
      for (Task updatedTask : updatedTasks) {
        Task stored = origTasks.stream().filter(c -> taskMatch.test(c, updatedTask)).findAny().orElse(null);
        if (stored == null || updatedTask == null) { // New task added
          newTasks = true;
          continue;
        }
        updateTaskDescription(stored, updatedTask);
      }
      applyTags(updatedTasks);

      boolean removedTasks = updatedTasks.size() < origTasks.size();

      if (newTasks || removedTasks) {
        List<Task> added = new ArrayList<>();
        List<Task> deleted = new ArrayList<>();
        recordListChange("tasks", origTasks, updatedTasks, added, deleted, taskMatch);
      }
    }

    private void updateTaskDescription(Task origTask, Task updatedTask) throws JsonProcessingException {
      if (operation.isPut() && !nullOrEmpty(origTask.getDescription()) && updatedByBot()) {
        // Revert the non-empty task description if being updated by a bot
        updatedTask.setDescription(origTask.getDescription());
        return;
      }
      // Don't record a change if descriptions are the same
      if (origTask != null
          && ((origTask.getDescription() != null && !origTask.getDescription().equals(updatedTask.getDescription()))
              || updatedTask.getDescription() != null)) {
        recordChange(
            "tasks." + origTask.getName() + ".description", origTask.getDescription(), updatedTask.getDescription());
      }
    }
  }
}
