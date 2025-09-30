package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for Classification operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.Classifications.*;
 *
 * // Create
 * Classification classification = create()
 *     .name("classification_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * Classification classification = find(classificationId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * Classification updated = find(classificationId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(classificationId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(classification -> process(classification));
 * </pre>
 */
public final class Classifications {
  private static OpenMetadataClient defaultClient;

  private Classifications() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Classifications.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static ClassificationCreator create() {
    return new ClassificationCreator(getClient());
  }

  public static Classification create(CreateClassification request) {
    return getClient().classifications().create(request);
  }

  // ==================== Finding/Retrieval ====================

  public static ClassificationFinder find(String id) {
    return new ClassificationFinder(getClient(), id);
  }

  public static ClassificationFinder find(UUID id) {
    return find(id.toString());
  }

  public static ClassificationFinder findByName(String fqn) {
    return new ClassificationFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static ClassificationLister list() {
    return new ClassificationLister(getClient());
  }

  // ==================== Creator ====================

  public static class ClassificationCreator {
    private final OpenMetadataClient client;
    private final CreateClassification request = new CreateClassification();

    ClassificationCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public ClassificationCreator name(String name) {
      request.setName(name);
      return this;
    }

    public ClassificationCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public ClassificationCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public Classification execute() {
      return client.classifications().create(request);
    }

    public Classification now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class ClassificationFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    ClassificationFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    ClassificationFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public ClassificationFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public ClassificationFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public ClassificationFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domains"));
      return this;
    }

    public FluentClassification fetch() {
      Classification classification;
      if (includes.isEmpty()) {
        classification =
            isFqn
                ? client.classifications().getByName(identifier)
                : client.classifications().get(identifier);
      } else {
        String fields = String.join(",", includes);
        classification =
            isFqn
                ? client.classifications().getByName(identifier, fields)
                : client.classifications().get(identifier, fields);
      }
      return new FluentClassification(classification, client);
    }

    public ClassificationDeleter delete() {
      return new ClassificationDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class ClassificationDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    ClassificationDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public ClassificationDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public ClassificationDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.classifications().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class ClassificationLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    ClassificationLister(OpenMetadataClient client) {
      this.client = client;
    }

    public ClassificationLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public ClassificationLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentClassification> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.classifications().list(params);
      List<FluentClassification> items = new ArrayList<>();
      for (Classification item : response.getData()) {
        items.add(new FluentClassification(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentClassification> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentClassification {
    private final Classification classification;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentClassification(Classification classification, OpenMetadataClient client) {
      this.classification = classification;
      this.client = client;
    }

    public Classification get() {
      return classification;
    }

    public FluentClassification withDescription(String description) {
      classification.setDescription(description);
      modified = true;
      return this;
    }

    public FluentClassification withDisplayName(String displayName) {
      classification.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentClassification save() {
      if (modified) {
        Classification updated =
            client.classifications().update(classification.getId().toString(), classification);
        classification.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public ClassificationDeleter delete() {
      return new ClassificationDeleter(client, classification.getId().toString());
    }
  }
}
