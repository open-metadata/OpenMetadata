package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for Tag operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.Tags.*;
 *
 * // Create
 * Tag tag = create()
 *     .name("tag_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * Tag tag = find(tagId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * Tag updated = find(tagId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(tagId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(tag -> process(tag));
 * </pre>
 */
public final class Tags {
  private static OpenMetadataClient defaultClient;

  private Tags() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Tags.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static TagCreator create() {
    return new TagCreator(getClient());
  }

  public static Tag create(CreateTag request) {
    return getClient().tags().create(request);
  }

  // ==================== Finding/Retrieval ====================

  public static TagFinder find(String id) {
    return new TagFinder(getClient(), id);
  }

  public static TagFinder find(UUID id) {
    return find(id.toString());
  }

  public static TagFinder findByName(String fqn) {
    return new TagFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static TagLister list() {
    return new TagLister(getClient());
  }

  // ==================== Creator ====================

  public static class TagCreator {
    private final OpenMetadataClient client;
    private final CreateTag request = new CreateTag();

    TagCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public TagCreator name(String name) {
      request.setName(name);
      return this;
    }

    public TagCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public TagCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public TagCreator in(String classification) {
      request.setClassification(classification);
      return this;
    }

    public Tag execute() {
      return client.tags().create(request);
    }

    public Tag now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class TagFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    TagFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    TagFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public TagFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public TagFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public TagFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domain"));
      return this;
    }

    public FluentTag fetch() {
      Tag tag;
      if (includes.isEmpty()) {
        tag = isFqn ? client.tags().getByName(identifier) : client.tags().get(identifier);
      } else {
        String fields = String.join(",", includes);
        tag =
            isFqn
                ? client.tags().getByName(identifier, fields)
                : client.tags().get(identifier, fields);
      }
      return new FluentTag(tag, client);
    }

    public TagDeleter delete() {
      return new TagDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class TagDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    TagDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public TagDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public TagDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.tags().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class TagLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    TagLister(OpenMetadataClient client) {
      this.client = client;
    }

    public TagLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public TagLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentTag> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.tags().list(params);
      List<FluentTag> items = new ArrayList<>();
      for (Tag item : response.getData()) {
        items.add(new FluentTag(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentTag> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentTag {
    private final Tag tag;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentTag(Tag tag, OpenMetadataClient client) {
      this.tag = tag;
      this.client = client;
    }

    public Tag get() {
      return tag;
    }

    public FluentTag withDescription(String description) {
      tag.setDescription(description);
      modified = true;
      return this;
    }

    public FluentTag withDisplayName(String displayName) {
      tag.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentTag save() {
      if (modified) {
        Tag updated = client.tags().update(tag.getId().toString(), tag);
        tag.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public TagDeleter delete() {
      return new TagDeleter(client, tag.getId().toString());
    }
  }
}
