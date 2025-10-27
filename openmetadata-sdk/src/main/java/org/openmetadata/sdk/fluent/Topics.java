package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for Topic operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.Topics.*;
 *
 * // Create
 * Topic topic = create()
 *     .name("topic_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * Topic topic = find(topicId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * Topic updated = find(topicId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(topicId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(topic -> process(topic));
 * </pre>
 */
public final class Topics {
  private static OpenMetadataClient defaultClient;

  private Topics() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Topics.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static TopicCreator create() {
    return new TopicCreator(getClient());
  }

  public static Topic create(CreateTopic request) {
    return getClient().topics().create(request);
  }

  // ==================== Finding/Retrieval ====================

  public static TopicFinder find(String id) {
    return new TopicFinder(getClient(), id);
  }

  public static TopicFinder find(UUID id) {
    return find(id.toString());
  }

  public static TopicFinder findByName(String fqn) {
    return new TopicFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static TopicLister list() {
    return new TopicLister(getClient());
  }

  // ==================== Creator ====================

  public static class TopicCreator {
    private final OpenMetadataClient client;
    private final CreateTopic request = new CreateTopic();

    TopicCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public TopicCreator name(String name) {
      request.setName(name);
      return this;
    }

    public TopicCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public TopicCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public TopicCreator in(String service) {
      request.setService(service);
      return this;
    }

    public TopicCreator withPartitions(int partitions) {
      request.setPartitions(partitions);
      return this;
    }

    public TopicCreator withReplicationFactor(int factor) {
      request.setReplicationFactor(factor);
      return this;
    }

    public Topic execute() {
      return client.topics().create(request);
    }

    public Topic now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class TopicFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    TopicFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    TopicFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public TopicFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public TopicFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public TopicFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domains"));
      return this;
    }

    public FluentTopic fetch() {
      Topic topic;
      if (includes.isEmpty()) {
        topic = isFqn ? client.topics().getByName(identifier) : client.topics().get(identifier);
      } else {
        String fields = String.join(",", includes);
        topic =
            isFqn
                ? client.topics().getByName(identifier, fields)
                : client.topics().get(identifier, fields);
      }
      return new FluentTopic(topic, client);
    }

    public TopicDeleter delete() {
      return new TopicDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class TopicDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    TopicDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public TopicDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public TopicDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.topics().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class TopicLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    TopicLister(OpenMetadataClient client) {
      this.client = client;
    }

    public TopicLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public TopicLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentTopic> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.topics().list(params);
      List<FluentTopic> items = new ArrayList<>();
      for (Topic item : response.getData()) {
        items.add(new FluentTopic(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentTopic> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentTopic {
    private final Topic topic;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentTopic(Topic topic, OpenMetadataClient client) {
      this.topic = topic;
      this.client = client;
    }

    public Topic get() {
      return topic;
    }

    public FluentTopic withDescription(String description) {
      topic.setDescription(description);
      modified = true;
      return this;
    }

    public FluentTopic withDisplayName(String displayName) {
      topic.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentTopic save() {
      if (modified) {
        Topic updated = client.topics().update(topic.getId().toString(), topic);
        topic.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public TopicDeleter delete() {
      return new TopicDeleter(client, topic.getId().toString());
    }
  }
}
