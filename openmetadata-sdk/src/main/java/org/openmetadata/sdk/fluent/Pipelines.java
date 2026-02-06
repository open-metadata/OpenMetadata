package org.openmetadata.sdk.fluent;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Pure Fluent API for Pipeline operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.Pipelines.*;
 *
 * // Create
 * Pipeline pipeline = create()
 *     .name("pipeline_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * Pipeline pipeline = find(pipelineId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * Pipeline updated = find(pipelineId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(pipelineId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(pipeline -> process(pipeline));
 * </pre>
 */
public final class Pipelines {
  private static OpenMetadataClient defaultClient;

  private Pipelines() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Pipelines.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static PipelineCreator create() {
    return new PipelineCreator(getClient());
  }

  public static Pipeline create(CreatePipeline request) {
    return getClient().pipelines().create(request);
  }

  // ==================== Direct Access Methods ====================

  public static Pipeline get(String id) {
    return getClient().pipelines().get(id);
  }

  public static Pipeline get(String id, String fields) {
    return getClient().pipelines().get(id, fields);
  }

  public static Pipeline get(String id, String fields, String include) {
    return getClient().pipelines().get(id, fields, include);
  }

  public static Pipeline getByName(String fqn) {
    return getClient().pipelines().getByName(fqn);
  }

  public static Pipeline getByName(String fqn, String fields) {
    return getClient().pipelines().getByName(fqn, fields);
  }

  public static Pipeline update(String id, Pipeline entity) {
    return getClient().pipelines().update(id, entity);
  }

  public static void delete(String id) {
    getClient().pipelines().delete(id);
  }

  public static void delete(String id, java.util.Map<String, String> params) {
    getClient().pipelines().delete(id, params);
  }

  public static void restore(String id) {
    getClient().pipelines().restore(id);
  }

  public static org.openmetadata.sdk.models.ListResponse<Pipeline> list(
      org.openmetadata.sdk.models.ListParams params) {
    return getClient().pipelines().list(params);
  }

  public static org.openmetadata.schema.type.EntityHistory getVersionList(java.util.UUID id) {
    return getClient().pipelines().getVersionList(id);
  }

  public static Pipeline getVersion(String id, Double version) {
    return getClient().pipelines().getVersion(id, version);
  }

  // ==================== Pipeline Status ====================

  public static Pipeline addPipelineStatus(String fqn, PipelineStatus status) {
    return getClient().pipelines().addPipelineStatus(fqn, status);
  }

  public static Pipeline addBulkPipelineStatus(String fqn, List<PipelineStatus> statuses) {
    return getClient().pipelines().addBulkPipelineStatus(fqn, statuses);
  }

  public static ListResponse<PipelineStatus> listPipelineStatuses(
      String fqn, Long startTs, Long endTs) {
    return getClient().pipelines().listPipelineStatuses(fqn, startTs, endTs);
  }

  // ==================== Finding/Retrieval ====================

  public static PipelineFinder find(String id) {
    return new PipelineFinder(getClient(), id);
  }

  public static PipelineFinder find(UUID id) {
    return find(id.toString());
  }

  public static PipelineFinder findByName(String fqn) {
    return new PipelineFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static PipelineLister list() {
    return new PipelineLister(getClient());
  }

  // ==================== Creator ====================

  public static class PipelineCreator {
    private final OpenMetadataClient client;
    private final CreatePipeline request = new CreatePipeline();

    PipelineCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public PipelineCreator name(String name) {
      request.setName(name);
      return this;
    }

    public PipelineCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public PipelineCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public PipelineCreator in(String service) {
      request.setService(service);
      return this;
    }

    public Pipeline execute() {
      return client.pipelines().create(request);
    }

    public Pipeline now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class PipelineFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    PipelineFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    PipelineFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public PipelineFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public PipelineFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public PipelineFinder includeAll() {
      includes.addAll(Arrays.asList("owner", "tags", "followers", "domain"));
      return this;
    }

    public FluentPipeline fetch() {
      Pipeline pipeline;
      if (includes.isEmpty()) {
        pipeline =
            isFqn ? client.pipelines().getByName(identifier) : client.pipelines().get(identifier);
      } else {
        String fields = String.join(",", includes);
        pipeline =
            isFqn
                ? client.pipelines().getByName(identifier, fields)
                : client.pipelines().get(identifier, fields);
      }
      return new FluentPipeline(pipeline, client);
    }

    public PipelineDeleter delete() {
      return new PipelineDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class PipelineDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    PipelineDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public PipelineDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public PipelineDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.pipelines().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class PipelineLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    PipelineLister(OpenMetadataClient client) {
      this.client = client;
    }

    public PipelineLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public PipelineLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentPipeline> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.pipelines().list(params);
      List<FluentPipeline> items = new ArrayList<>();
      for (Pipeline item : response.getData()) {
        items.add(new FluentPipeline(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentPipeline> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentPipeline {
    private final Pipeline pipeline;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentPipeline(Pipeline pipeline, OpenMetadataClient client) {
      this.pipeline = pipeline;
      this.client = client;
    }

    public Pipeline get() {
      return pipeline;
    }

    public FluentPipeline withDescription(String description) {
      pipeline.setDescription(description);
      modified = true;
      return this;
    }

    public FluentPipeline withDisplayName(String displayName) {
      pipeline.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public Pipeline addPipelineStatus(PipelineStatus status) {
      return client.pipelines().addPipelineStatus(pipeline.getFullyQualifiedName(), status);
    }

    public Pipeline addBulkPipelineStatus(List<PipelineStatus> statuses) {
      return client.pipelines().addBulkPipelineStatus(pipeline.getFullyQualifiedName(), statuses);
    }

    public ListResponse<PipelineStatus> listPipelineStatuses(Long startTs, Long endTs) {
      return client
          .pipelines()
          .listPipelineStatuses(pipeline.getFullyQualifiedName(), startTs, endTs);
    }

    public FluentPipeline save() {
      if (modified) {
        Pipeline updated = client.pipelines().update(pipeline.getId().toString(), pipeline);
        pipeline.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public PipelineDeleter delete() {
      return new PipelineDeleter(client, pipeline.getId().toString());
    }
  }
}
