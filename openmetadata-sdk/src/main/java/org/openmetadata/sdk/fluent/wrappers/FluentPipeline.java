package org.openmetadata.sdk.fluent.wrappers;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Task;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Fluent wrapper for Pipeline entity updates.
 *
 * Usage:
 * <pre>
 * Pipeline updated = fluent(pipeline)
 *     .withDescription("Updated description")
 *     .addTask("new_task", "New processing task")
 *     .addTag("production")
 *     .save();
 * </pre>
 */
public class FluentPipeline {
  private final Pipeline pipeline;
  private final OpenMetadataClient client;
  private boolean modified = false;

  public FluentPipeline(Pipeline pipeline, OpenMetadataClient client) {
    this.pipeline = pipeline;
    this.client = client;
  }

  /**
   * Update the description.
   */
  public FluentPipeline withDescription(String description) {
    pipeline.setDescription(description);
    modified = true;
    return this;
  }

  /**
   * Update the display name.
   */
  public FluentPipeline withDisplayName(String displayName) {
    pipeline.setDisplayName(displayName);
    modified = true;
    return this;
  }

  /**
   * Add a task to the pipeline.
   */
  public FluentPipeline addTask(String name, String description) {
    if (pipeline.getTasks() == null) {
      pipeline.setTasks(new ArrayList<>());
    }
    Task task = new Task().withName(name).withDescription(description);
    pipeline.getTasks().add(task);
    modified = true;
    return this;
  }

  /**
   * Add a task with dependencies.
   */
  public FluentPipeline addTask(Task task) {
    if (pipeline.getTasks() == null) {
      pipeline.setTasks(new ArrayList<>());
    }
    pipeline.getTasks().add(task);
    modified = true;
    return this;
  }

  /**
   * Remove a task by name.
   */
  public FluentPipeline removeTask(String taskName) {
    if (pipeline.getTasks() != null) {
      pipeline.getTasks().removeIf(task -> taskName.equals(task.getName()));
      modified = true;
    }
    return this;
  }

  /**
   * Set the concurrency level.
   */
  public FluentPipeline withConcurrency(Integer concurrency) {
    pipeline.setConcurrency(concurrency);
    modified = true;
    return this;
  }

  /**
   * Set the pipeline location.
   */
  public FluentPipeline withPipelineLocation(String location) {
    pipeline.setPipelineLocation(location);
    modified = true;
    return this;
  }

  /**
   * Set the source URL.
   */
  public FluentPipeline withSourceUrl(String sourceUrl) {
    pipeline.setSourceUrl(sourceUrl);
    modified = true;
    return this;
  }

  /**
   * Add tags to the pipeline.
   */
  public FluentPipeline addTags(String... tagFQNs) {
    if (pipeline.getTags() == null) {
      pipeline.setTags(new ArrayList<>());
    }
    for (String tagFQN : tagFQNs) {
      TagLabel tag =
          new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION);
      if (!pipeline.getTags().contains(tag)) {
        pipeline.getTags().add(tag);
      }
    }
    modified = true;
    return this;
  }

  /**
   * Remove a tag from the pipeline.
   */
  public FluentPipeline removeTag(String tagFQN) {
    if (pipeline.getTags() != null) {
      pipeline.getTags().removeIf(tag -> tagFQN.equals(tag.getTagFQN()));
      modified = true;
    }
    return this;
  }

  /**
   * Set the owner as a user.
   */
  public FluentPipeline withOwner(org.openmetadata.schema.entity.teams.User user) {
    EntityReference ownerRef =
        new EntityReference()
            .withId(user.getId())
            .withType("user")
            .withName(user.getName())
            .withFullyQualifiedName(user.getFullyQualifiedName());
    // TODO: Map owner
    modified = true;
    return this;
  }

  /**
   * Set the owner as a team.
   */
  public FluentPipeline withOwner(org.openmetadata.schema.entity.teams.Team team) {
    EntityReference ownerRef =
        new EntityReference()
            .withId(team.getId())
            .withType("team")
            .withName(team.getName())
            .withFullyQualifiedName(team.getFullyQualifiedName());
    // TODO: Map owner
    modified = true;
    return this;
  }

  /**
   * Apply conditional modifications.
   */
  public FluentPipeline applyIf(boolean condition, Consumer<Pipeline> modifier) {
    if (condition) {
      modifier.accept(pipeline);
      modified = true;
    }
    return this;
  }

  /**
   * Add a single pipeline status.
   */
  public Pipeline addPipelineStatus(PipelineStatus status) {
    return client.pipelines().addPipelineStatus(pipeline.getFullyQualifiedName(), status);
  }

  /**
   * Add multiple pipeline statuses in bulk.
   */
  public Pipeline addBulkPipelineStatus(List<PipelineStatus> statuses) {
    return client.pipelines().addBulkPipelineStatus(pipeline.getFullyQualifiedName(), statuses);
  }

  /**
   * List pipeline statuses within a time range.
   */
  public ListResponse<PipelineStatus> listPipelineStatuses(Long startTs, Long endTs) {
    return client
        .pipelines()
        .listPipelineStatuses(pipeline.getFullyQualifiedName(), startTs, endTs);
  }

  /**
   * Get the underlying pipeline.
   */
  public Pipeline get() {
    return pipeline;
  }

  /**
   * Check if the pipeline has been modified.
   */
  public boolean isModified() {
    return modified;
  }

  /**
   * Save the pipeline if modified.
   */
  public Pipeline save() {
    if (!modified) {
      return pipeline;
    }
    if (pipeline.getId() == null) {
      throw new IllegalStateException("Cannot update pipeline without ID");
    }
    return client.pipelines().update(pipeline.getId().toString(), pipeline);
  }

  /**
   * Force save even if not modified.
   */
  public Pipeline forceSave() {
    if (pipeline.getId() == null) {
      throw new IllegalStateException("Cannot update pipeline without ID");
    }
    return client.pipelines().update(pipeline.getId().toString(), pipeline);
  }
}
