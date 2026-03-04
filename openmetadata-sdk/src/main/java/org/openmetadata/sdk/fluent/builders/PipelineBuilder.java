package org.openmetadata.sdk.fluent.builders;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.type.Task;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Builder for creating Pipeline entities with fluent API.
 *
 * Usage:
 * <pre>
 * Pipeline pipeline = new PipelineBuilder(client)
 *     .name("daily_etl")
 *     .service(pipelineService)
 *     .description("Daily ETL pipeline")
 *     .tasks(
 *         task("extract_data", "Extract from source"),
 *         task("transform_data", "Transform and clean"),
 *         task("load_data", "Load to warehouse")
 *     )
 *     .concurrency(5)
 *     .create();
 * </pre>
 */
public class PipelineBuilder {
  private final OpenMetadataClient client;
  private final CreatePipeline request = new CreatePipeline();
  private final List<Task> tasks = new ArrayList<>();
  private EntityReference serviceRef;

  public PipelineBuilder(OpenMetadataClient client) {
    this.client = client;
  }

  /**
   * Set the pipeline name (required).
   */
  public PipelineBuilder name(String name) {
    request.setName(name);
    return this;
  }

  /**
   * Set the display name.
   */
  public PipelineBuilder displayName(String displayName) {
    request.setDisplayName(displayName);
    return this;
  }

  /**
   * Set the description.
   */
  public PipelineBuilder description(String description) {
    request.setDescription(description);
    return this;
  }

  /**
   * Set the pipeline service reference directly.
   */
  public PipelineBuilder service(PipelineService service) {
    this.serviceRef =
        new EntityReference()
            .withId(service.getId())
            .withType("pipelineService")
            .withName(service.getName())
            .withFullyQualifiedName(service.getFullyQualifiedName());
    request.setService(
        serviceRef.getFullyQualifiedName() != null
            ? serviceRef.getFullyQualifiedName()
            : serviceRef.getName());
    return this;
  }

  /**
   * Set the pipeline service by ID.
   */
  public PipelineBuilder service(UUID serviceId) {
    this.serviceRef = new EntityReference().withId(serviceId).withType("pipelineService");
    request.setService(
        serviceRef.getFullyQualifiedName() != null
            ? serviceRef.getFullyQualifiedName()
            : serviceRef.getName());
    return this;
  }

  /**
   * Set the pipeline service by fully qualified name.
   */
  public PipelineBuilder serviceFQN(String serviceFQN) {
    this.serviceRef =
        new EntityReference().withType("pipelineService").withFullyQualifiedName(serviceFQN);
    request.setService(
        serviceRef.getFullyQualifiedName() != null
            ? serviceRef.getFullyQualifiedName()
            : serviceRef.getName());
    return this;
  }

  /**
   * Add tasks to the pipeline.
   */
  public PipelineBuilder tasks(Task... tasks) {
    this.tasks.addAll(Arrays.asList(tasks));
    return this;
  }

  /**
   * Add a single task.
   */
  public PipelineBuilder addTask(Task task) {
    this.tasks.add(task);
    return this;
  }

  /**
   * Create a task and add it.
   */
  public PipelineBuilder addTask(String name, String description) {
    Task task = new Task().withName(name).withDescription(description);
    this.tasks.add(task);
    return this;
  }

  /**
   * Set the pipeline URL location.
   */
  public PipelineBuilder pipelineLocation(String location) {
    request.setPipelineLocation(location);
    return this;
  }

  /**
   * Set the source URL.
   */
  public PipelineBuilder sourceUrl(String sourceUrl) {
    request.setSourceUrl(sourceUrl);
    return this;
  }

  /**
   * Set the concurrency level.
   */
  public PipelineBuilder concurrency(Integer concurrency) {
    request.setConcurrency(concurrency);
    return this;
  }

  /**
   * Set the start date.
   */
  public PipelineBuilder startDate(String startDate) {
    // TODO: Convert string to Date
    // request.setStartDate(DateUtils.parseDate(startDate));
    return this;
  }

  /**
   * Set the lifecycle state.
   */
  public PipelineBuilder lifeCycle(LifeCycle lifeCycle) {
    request.setLifeCycle(lifeCycle);
    return this;
  }

  /**
   * Set the source hash.
   */
  public PipelineBuilder sourceHash(String sourceHash) {
    request.setSourceHash(sourceHash);
    return this;
  }

  /**
   * Set extension properties.
   */
  public PipelineBuilder extension(Object extension) {
    return this;
  }

  /**
   * Set the owner as a user.
   */
  public PipelineBuilder owner(org.openmetadata.schema.entity.teams.User user) {
    EntityReference ownerRef =
        new EntityReference()
            .withId(user.getId())
            .withType("user")
            .withName(user.getName())
            .withFullyQualifiedName(user.getFullyQualifiedName());
    // TODO: Map owner
    return this;
  }

  /**
   * Set the owner as a team.
   */
  public PipelineBuilder owner(org.openmetadata.schema.entity.teams.Team team) {
    EntityReference ownerRef =
        new EntityReference()
            .withId(team.getId())
            .withType("team")
            .withName(team.getName())
            .withFullyQualifiedName(team.getFullyQualifiedName());
    // TODO: Map owner
    return this;
  }

  /**
   * Add tags to the pipeline.
   */
  public PipelineBuilder tags(String... tagFQNs) {
    List<org.openmetadata.schema.type.TagLabel> tagLabels = new ArrayList<>();
    for (String tagFQN : tagFQNs) {
      tagLabels.add(
          new org.openmetadata.schema.type.TagLabel()
              .withTagFQN(tagFQN)
              .withSource(org.openmetadata.schema.type.TagLabel.TagSource.CLASSIFICATION));
    }
    request.setTags(tagLabels);
    return this;
  }

  /**
   * Build the CreatePipeline request.
   */
  public CreatePipeline build() {
    validate();
    if (!tasks.isEmpty()) {
      request.setTasks(tasks);
    }
    return request;
  }

  /**
   * Create the pipeline.
   */
  public Pipeline create() {
    CreatePipeline createRequest = build();
    // Convert CreatePipeline to Pipeline
    Pipeline entity = new Pipeline();
    entity.setName(createRequest.getName());
    if (createRequest.getDisplayName() != null)
      entity.setDisplayName(createRequest.getDisplayName());
    if (createRequest.getDescription() != null)
      entity.setDescription(createRequest.getDescription());
    // TODO: Map other fields as needed
    return client.pipelines().create(entity);
  }

  /**
   * Create or update the pipeline.
   */
  public Pipeline createOrUpdate() {
    CreatePipeline createRequest = build();
    try {
      // Convert CreatePipeline to Pipeline
      Pipeline entity = new Pipeline();
      entity.setName(createRequest.getName());
      if (createRequest.getDisplayName() != null)
        entity.setDisplayName(createRequest.getDisplayName());
      if (createRequest.getDescription() != null)
        entity.setDescription(createRequest.getDescription());
      // TODO: Map other fields as needed
      return client.pipelines().create(entity);
    } catch (Exception e) {
      if (e.getMessage() != null && e.getMessage().contains("already exists")) {
        Pipeline existing =
            client
                .pipelines()
                .getByName(serviceRef.getFullyQualifiedName() + "." + request.getName());
        return client.pipelines().update(existing.getId().toString(), existing);
      }
      throw e;
    }
  }

  /**
   * Validate the builder state.
   */
  private void validate() {
    if (request.getName() == null || request.getName().isEmpty()) {
      throw new IllegalStateException("Pipeline name is required");
    }
    if (request.getService() == null) {
      throw new IllegalStateException("Pipeline service is required");
    }
  }

  // ==================== Static Helpers ====================

  /**
   * Create a task helper.
   */
  public static Task task(String name, String description) {
    return new Task().withName(name).withDescription(description);
  }

  /**
   * Create a task with downstream tasks.
   */
  public static Task task(String name, String description, String... downstreamTasks) {
    return new Task()
        .withName(name)
        .withDescription(description)
        .withDownstreamTasks(Arrays.asList(downstreamTasks));
  }
}
