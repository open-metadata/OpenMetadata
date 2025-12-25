package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for MlModel operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.MlModels.*;
 *
 * // Create
 * MlModel mlModel = create()
 *     .name("mlModel_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * MlModel mlModel = find(mlModelId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * MlModel updated = find(mlModelId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(mlModelId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(mlModel -> process(mlModel));
 * </pre>
 */
public final class MlModels {
  private static OpenMetadataClient defaultClient;

  private MlModels() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call MlModels.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static MlModelCreator create() {
    return new MlModelCreator(getClient());
  }

  public static MlModel create(CreateMlModel request) {
    return getClient().mlModels().create(request);
  }

  // ==================== Finding/Retrieval ====================

  public static MlModelFinder find(String id) {
    return new MlModelFinder(getClient(), id);
  }

  public static MlModelFinder find(UUID id) {
    return find(id.toString());
  }

  public static MlModelFinder findByName(String fqn) {
    return new MlModelFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static MlModelLister list() {
    return new MlModelLister(getClient());
  }

  // ==================== Creator ====================

  public static class MlModelCreator {
    private final OpenMetadataClient client;
    private final CreateMlModel request = new CreateMlModel();

    MlModelCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public MlModelCreator name(String name) {
      request.setName(name);
      return this;
    }

    public MlModelCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public MlModelCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public MlModelCreator in(String service) {
      request.setService(service);
      return this;
    }

    public MlModel execute() {
      return client.mlModels().create(request);
    }

    public MlModel now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class MlModelFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    MlModelFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    MlModelFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public MlModelFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public MlModelFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public MlModelFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domains"));
      return this;
    }

    public FluentMlModel fetch() {
      MlModel mlModel;
      if (includes.isEmpty()) {
        mlModel =
            isFqn ? client.mlModels().getByName(identifier) : client.mlModels().get(identifier);
      } else {
        String fields = String.join(",", includes);
        mlModel =
            isFqn
                ? client.mlModels().getByName(identifier, fields)
                : client.mlModels().get(identifier, fields);
      }
      return new FluentMlModel(mlModel, client);
    }

    public MlModelDeleter delete() {
      return new MlModelDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class MlModelDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    MlModelDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public MlModelDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public MlModelDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.mlModels().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class MlModelLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    MlModelLister(OpenMetadataClient client) {
      this.client = client;
    }

    public MlModelLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public MlModelLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentMlModel> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.mlModels().list(params);
      List<FluentMlModel> items = new ArrayList<>();
      for (MlModel item : response.getData()) {
        items.add(new FluentMlModel(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentMlModel> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentMlModel {
    private final MlModel mlModel;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentMlModel(MlModel mlModel, OpenMetadataClient client) {
      this.mlModel = mlModel;
      this.client = client;
    }

    public MlModel get() {
      return mlModel;
    }

    public FluentMlModel withDescription(String description) {
      mlModel.setDescription(description);
      modified = true;
      return this;
    }

    public FluentMlModel withDisplayName(String displayName) {
      mlModel.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentMlModel save() {
      if (modified) {
        MlModel updated = client.mlModels().update(mlModel.getId().toString(), mlModel);
        mlModel.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public MlModelDeleter delete() {
      return new MlModelDeleter(client, mlModel.getId().toString());
    }
  }
}
