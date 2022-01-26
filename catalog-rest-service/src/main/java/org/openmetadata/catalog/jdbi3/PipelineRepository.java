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

package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.Entity.PIPELINE_SERVICE;
import static org.openmetadata.catalog.Entity.helper;
import static org.openmetadata.catalog.util.EntityUtil.taskMatch;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.PipelineServiceRepository.PipelineServiceEntityInterface;
import org.openmetadata.catalog.resources.pipelines.PipelineResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.Task;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;

public class PipelineRepository extends EntityRepository<Pipeline> {
  private static final Fields PIPELINE_UPDATE_FIELDS = new Fields(PipelineResource.FIELD_LIST, "owner,tags,tasks");
  private static final Fields PIPELINE_PATCH_FIELDS = new Fields(PipelineResource.FIELD_LIST, "owner,tags,tasks");

  public PipelineRepository(CollectionDAO dao) {
    super(
        PipelineResource.COLLECTION_PATH,
        Entity.PIPELINE,
        Pipeline.class,
        dao.pipelineDAO(),
        dao,
        PIPELINE_PATCH_FIELDS,
        PIPELINE_UPDATE_FIELDS,
        true,
        true,
        true);
  }

  public static String getFQN(Pipeline pipeline) {
    return (pipeline.getService().getName() + "." + pipeline.getName());
  }

  @Transaction
  public EntityReference getOwnerReference(Pipeline pipeline) throws IOException {
    return EntityUtil.populateOwner(daoCollection.userDAO(), daoCollection.teamDAO(), pipeline.getOwner());
  }

  @Override
  public Pipeline setFields(Pipeline pipeline, Fields fields) throws IOException, ParseException {
    pipeline.setDisplayName(pipeline.getDisplayName());
    pipeline.setService(getService(pipeline));
    pipeline.setPipelineUrl(pipeline.getPipelineUrl());
    pipeline.setStartDate(pipeline.getStartDate());
    pipeline.setConcurrency(pipeline.getConcurrency());
    pipeline.setOwner(fields.contains("owner") ? getOwner(pipeline) : null);
    pipeline.setFollowers(fields.contains("followers") ? getFollowers(pipeline) : null);
    if (!fields.contains("tasks")) {
      pipeline.withTasks(null);
    }
    pipeline.setTags(fields.contains("tags") ? getTags(pipeline.getFullyQualifiedName()) : null);
    return pipeline;
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
  public EntityInterface<Pipeline> getEntityInterface(Pipeline entity) {
    return new PipelineEntityInterface(entity);
  }

  @Override
  public void prepare(Pipeline pipeline) throws IOException {
    populateService(pipeline);
    pipeline.setFullyQualifiedName(getFQN(pipeline));
    EntityUtil.populateOwner(daoCollection.userDAO(), daoCollection.teamDAO(), pipeline.getOwner()); // Validate owner
    pipeline.setTags(EntityUtil.addDerivedTags(daoCollection.tagDAO(), pipeline.getTags()));
  }

  @Override
  public void storeEntity(Pipeline pipeline, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = pipeline.getOwner();
    List<TagLabel> tags = pipeline.getTags();
    EntityReference service = pipeline.getService();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    pipeline.withOwner(null).withService(null).withHref(null).withTags(null);

    store(pipeline.getId(), pipeline, update);

    // Restore the relationships
    pipeline.withOwner(owner).withService(service).withTags(tags);
  }

  @Override
  public void storeRelationships(Pipeline pipeline) {
    EntityReference service = pipeline.getService();
    daoCollection
        .relationshipDAO()
        .insert(
            service.getId().toString(),
            pipeline.getId().toString(),
            service.getType(),
            Entity.PIPELINE,
            Relationship.CONTAINS.ordinal());

    // Add owner relationship
    EntityUtil.setOwner(daoCollection.relationshipDAO(), pipeline.getId(), Entity.PIPELINE, pipeline.getOwner());

    // Add tag to pipeline relationship
    applyTags(pipeline);
  }

  @Override
  public EntityUpdater getUpdater(Pipeline original, Pipeline updated, Operation operation) {
    return new PipelineUpdater(original, updated, operation);
  }

  private EntityReference getService(Pipeline pipeline) throws IOException, ParseException {
    return helper(pipeline).getContainer(PIPELINE_SERVICE);
  }

  private void populateService(Pipeline pipeline) throws IOException {
    PipelineService service = getService(pipeline.getService().getId(), pipeline.getService().getType());
    pipeline.setService(new PipelineServiceEntityInterface(service).getEntityReference());
    pipeline.setServiceType(service.getServiceType());
  }

  private PipelineService getService(UUID serviceId, String entityType) throws IOException {
    if (entityType.equalsIgnoreCase(Entity.PIPELINE_SERVICE)) {
      return daoCollection.pipelineServiceDAO().findEntityById(serviceId);
    }
    throw new IllegalArgumentException(CatalogExceptionMessage.invalidServiceEntity(entityType, Entity.PIPELINE));
  }

  public static class PipelineEntityInterface implements EntityInterface<Pipeline> {
    private final Pipeline entity;

    public PipelineEntityInterface(Pipeline entity) {
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
    public Boolean isDeleted() {
      return entity.getDeleted();
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
    public Double getVersion() {
      return entity.getVersion();
    }

    @Override
    public String getUpdatedBy() {
      return entity.getUpdatedBy();
    }

    @Override
    public long getUpdatedAt() {
      return entity.getUpdatedAt();
    }

    @Override
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public List<EntityReference> getFollowers() {
      return entity.getFollowers();
    }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference()
          .withId(getId())
          .withName(getFullyQualifiedName())
          .withDescription(getDescription())
          .withDisplayName(getDisplayName())
          .withType(Entity.PIPELINE);
    }

    @Override
    public Pipeline getEntity() {
      return entity;
    }

    @Override
    public EntityReference getContainer() {
      return entity.getService();
    }

    @Override
    public void setId(UUID id) {
      entity.setId(id);
    }

    @Override
    public void setDescription(String description) {
      entity.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      entity.setDisplayName(displayName);
    }

    @Override
    public void setUpdateDetails(String updatedBy, long updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setOwner(EntityReference owner) {
      entity.setOwner(owner);
    }

    @Override
    public void setDeleted(boolean flag) {
      entity.setDeleted(flag);
    }

    @Override
    public Pipeline withHref(URI href) {
      return entity.withHref(href);
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }

    @Override
    public void setTags(List<TagLabel> tags) {
      entity.setTags(tags);
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class PipelineUpdater extends EntityUpdater {
    public PipelineUpdater(Pipeline original, Pipeline updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      Pipeline origPipeline = original.getEntity();
      Pipeline updatedPipeline = updated.getEntity();
      updateTasks(origPipeline, updatedPipeline);
      recordChange("pipelineUrl", origPipeline.getPipelineUrl(), updatedPipeline.getPipelineUrl());
      recordChange("concurrency", origPipeline.getConcurrency(), updatedPipeline.getConcurrency());
      recordChange("pipelineLocation", origPipeline.getPipelineLocation(), updatedPipeline.getPipelineLocation());
      recordChange("startDate", origPipeline.getStartDate(), updatedPipeline.getStartDate());
    }

    private void updateTasks(Pipeline origPipeline, Pipeline updatedPipeline) throws JsonProcessingException {
      // Airflow lineage backend gets executed per task in a DAG. This means we will not a get full picture of the
      // pipeline in each call. Hence, we may create a pipeline and add a single task when one task finishes in a
      // pipeline in the next task run we may have to update. To take care of this we will merge the tasks
      List<Task> updatedTasks = Optional.ofNullable(updatedPipeline.getTasks()).orElse(Collections.emptyList());
      List<Task> origTasks = Optional.ofNullable(origPipeline.getTasks()).orElse(Collections.emptyList());

      // Merge the tasks
      updatedTasks =
          new ArrayList<>(
              Stream.concat(origTasks.stream(), updatedTasks.stream())
                  .collect(Collectors.groupingBy(Task::getName, Collectors.reducing(null, (t1, t2) -> t2)))
                  .values());

      List<Task> added = new ArrayList<>();
      List<Task> deleted = new ArrayList<>();
      recordListChange("tasks", origTasks, updatedTasks, added, deleted, taskMatch);

      // Update the task descriptions
      for (Task updated : updatedTasks) {
        Task stored = origTasks.stream().filter(c -> taskMatch.test(c, updated)).findAny().orElse(null);
        if (stored == null) { // New task added
          continue;
        }

        updateTaskDescription(stored, updated);
      }
    }

    private void updateTaskDescription(Task origTask, Task updatedTask) throws JsonProcessingException {
      if (operation.isPut() && origTask.getDescription() != null && !origTask.getDescription().isEmpty()) {
        // Update description only when stored is empty to retain user authored descriptions
        updatedTask.setDescription(origTask.getDescription());
        return;
      }
      // Don't record a change if descriptions are the same
      if (!origTask.getDescription().equals(updatedTask.getDescription())) {
        recordChange(
            "tasks." + origTask.getName() + ".description", origTask.getDescription(), updatedTask.getDescription());
      }
    }
  }
}
