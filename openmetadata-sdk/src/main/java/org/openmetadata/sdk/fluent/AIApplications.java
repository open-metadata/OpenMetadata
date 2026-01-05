package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.ai.CreateAIApplication;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.ApplicationType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent API for AIApplication operations.
 *
 * <p>Usage:
 *
 * <pre>
 * // Create
 * AIApplication app = AIApplications.create()
 *     .name("my-ai-app")
 *     .withDescription("AI Application")
 *     .execute();
 *
 * // Find
 * AIApplication app = AIApplications.find(appId).fetch();
 *
 * // List
 * AIApplications.list().limit(10).forEach(app -> process(app));
 * </pre>
 */
public final class AIApplications {
  private static OpenMetadataClient defaultClient;

  private AIApplications() {}

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call AIApplications.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static AIApplicationCreator create() {
    return new AIApplicationCreator(getClient());
  }

  public static AIApplication create(CreateAIApplication request) {
    return getClient().aiApplications().create(request);
  }

  // ==================== Direct Access ====================

  public static AIApplication get(String id) {
    return getClient().aiApplications().get(id);
  }

  public static AIApplication get(String id, String fields) {
    return getClient().aiApplications().get(id, fields);
  }

  public static AIApplication getByName(String fqn) {
    return getClient().aiApplications().getByName(fqn);
  }

  public static AIApplication getByName(String fqn, String fields) {
    return getClient().aiApplications().getByName(fqn, fields);
  }

  public static AIApplication update(String id, AIApplication entity) {
    return getClient().aiApplications().update(id, entity);
  }

  public static void delete(String id) {
    getClient().aiApplications().delete(id);
  }

  public static void delete(String id, Map<String, String> params) {
    getClient().aiApplications().delete(id, params);
  }

  public static void restore(String id) {
    getClient().aiApplications().restore(id);
  }

  // ==================== Finders ====================

  public static AIApplicationFinder find(String id) {
    return new AIApplicationFinder(getClient(), id);
  }

  public static AIApplicationFinder find(UUID id) {
    return find(id.toString());
  }

  public static AIApplicationFinder findByName(String fqn) {
    return new AIApplicationFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static AIApplicationLister list() {
    return new AIApplicationLister(getClient());
  }

  // ==================== Creator ====================

  public static class AIApplicationCreator {
    private final OpenMetadataClient client;
    private final CreateAIApplication request = new CreateAIApplication();

    AIApplicationCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public AIApplicationCreator name(String name) {
      request.setName(name);
      return this;
    }

    public AIApplicationCreator withApplicationType(ApplicationType applicationType) {
      request.setApplicationType(applicationType);
      return this;
    }

    public AIApplicationCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public AIApplicationCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public AIApplicationCreator withOwners(List<EntityReference> owners) {
      request.setOwners(owners);
      return this;
    }

    public AIApplication execute() {
      return client.aiApplications().create(request);
    }

    public AIApplication now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class AIApplicationFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    AIApplicationFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    AIApplicationFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public AIApplicationFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public AIApplicationFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public AIApplicationFinder withFields(String... fields) {
      includes.addAll(Arrays.asList(fields));
      return this;
    }

    public AIApplicationFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domain"));
      return this;
    }

    public FluentAIApplication fetch() {
      AIApplication entity;
      if (includes.isEmpty()) {
        entity =
            isFqn
                ? client.aiApplications().getByName(identifier)
                : client.aiApplications().get(identifier);
      } else {
        String fields = String.join(",", includes);
        entity =
            isFqn
                ? client.aiApplications().getByName(identifier, fields)
                : client.aiApplications().get(identifier, fields);
      }
      return new FluentAIApplication(entity, client);
    }

    public AIApplication get() {
      return fetch().get();
    }

    public AIApplicationDeleter delete() {
      return new AIApplicationDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class AIApplicationDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    AIApplicationDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public AIApplicationDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public AIApplicationDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.aiApplications().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class AIApplicationLister {
    private final OpenMetadataClient client;
    private Integer limit;
    private String after;
    private final Map<String, String> filters = new HashMap<>();

    AIApplicationLister(OpenMetadataClient client) {
      this.client = client;
    }

    public AIApplicationLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public AIApplicationLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public AIApplicationLister filter(String key, String value) {
      filters.put(key, value);
      return this;
    }

    public List<FluentAIApplication> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.aiApplications().list(params);
      List<FluentAIApplication> items = new ArrayList<>();
      for (AIApplication item : response.getData()) {
        items.add(new FluentAIApplication(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentAIApplication> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentAIApplication {
    private final AIApplication entity;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentAIApplication(AIApplication entity, OpenMetadataClient client) {
      this.entity = entity;
      this.client = client;
    }

    public AIApplication get() {
      return entity;
    }

    public FluentAIApplication withDescription(String description) {
      entity.setDescription(description);
      modified = true;
      return this;
    }

    public FluentAIApplication withDisplayName(String displayName) {
      entity.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentAIApplication withOwners(List<EntityReference> owners) {
      entity.setOwners(owners);
      modified = true;
      return this;
    }

    public FluentAIApplication save() {
      if (modified) {
        AIApplication updated = client.aiApplications().update(entity.getId().toString(), entity);
        entity.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public AIApplicationDeleter delete() {
      return new AIApplicationDeleter(client, entity.getId().toString());
    }
  }
}
