package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.services.CreateLLMService;
import org.openmetadata.schema.entity.services.LLMService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent API for LLMService operations.
 *
 * <p>Usage:
 *
 * <pre>
 * // Create
 * LLMService service = LLMServices.create()
 *     .name("openai-service")
 *     .withDescription("OpenAI LLM Service")
 *     .withServiceType(LLMServiceType.OpenAI)
 *     .withConnection(connection)
 *     .execute();
 *
 * // Find
 * LLMService service = LLMServices.find(serviceId).fetch();
 *
 * // List
 * LLMServices.list().limit(10).forEach(svc -> process(svc));
 * </pre>
 */
public final class LLMServices {
  private static OpenMetadataClient defaultClient;

  private LLMServices() {}

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call LLMServices.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static LLMServiceCreator create() {
    return new LLMServiceCreator(getClient());
  }

  public static LLMService create(CreateLLMService request) {
    return getClient().llmServices().create(request);
  }

  // ==================== Direct Access ====================

  public static LLMService get(String id) {
    return getClient().llmServices().get(id);
  }

  public static LLMService get(String id, String fields) {
    return getClient().llmServices().get(id, fields);
  }

  public static LLMService getByName(String fqn) {
    return getClient().llmServices().getByName(fqn);
  }

  public static LLMService getByName(String fqn, String fields) {
    return getClient().llmServices().getByName(fqn, fields);
  }

  public static LLMService update(String id, LLMService entity) {
    return getClient().llmServices().update(id, entity);
  }

  public static void delete(String id) {
    getClient().llmServices().delete(id);
  }

  public static void delete(String id, Map<String, String> params) {
    getClient().llmServices().delete(id, params);
  }

  public static void restore(String id) {
    getClient().llmServices().restore(id);
  }

  // ==================== Finders ====================

  public static LLMServiceFinder find(String id) {
    return new LLMServiceFinder(getClient(), id);
  }

  public static LLMServiceFinder find(UUID id) {
    return find(id.toString());
  }

  public static LLMServiceFinder findByName(String fqn) {
    return new LLMServiceFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static LLMServiceLister list() {
    return new LLMServiceLister(getClient());
  }

  // ==================== Creator ====================

  public static class LLMServiceCreator {
    private final OpenMetadataClient client;
    private final CreateLLMService request = new CreateLLMService();

    LLMServiceCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public LLMServiceCreator name(String name) {
      request.setName(name);
      return this;
    }

    public LLMServiceCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public LLMServiceCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public LLMServiceCreator withServiceType(CreateLLMService.LlmServiceType serviceType) {
      request.setServiceType(serviceType);
      return this;
    }

    public LLMServiceCreator withConnection(org.openmetadata.schema.type.LLMConnection connection) {
      request.setConnection(connection);
      return this;
    }

    public LLMServiceCreator withOwners(List<EntityReference> owners) {
      request.setOwners(owners);
      return this;
    }

    public LLMService execute() {
      return client.llmServices().create(request);
    }

    public LLMService now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class LLMServiceFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    LLMServiceFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    LLMServiceFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public LLMServiceFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public LLMServiceFinder withFields(String... fields) {
      includes.addAll(Arrays.asList(fields));
      return this;
    }

    public LLMServiceFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "domain"));
      return this;
    }

    public FluentLLMService fetch() {
      LLMService entity;
      if (includes.isEmpty()) {
        entity =
            isFqn
                ? client.llmServices().getByName(identifier)
                : client.llmServices().get(identifier);
      } else {
        String fields = String.join(",", includes);
        entity =
            isFqn
                ? client.llmServices().getByName(identifier, fields)
                : client.llmServices().get(identifier, fields);
      }
      return new FluentLLMService(entity, client);
    }

    public LLMService get() {
      return fetch().get();
    }

    public LLMServiceDeleter delete() {
      return new LLMServiceDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class LLMServiceDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    LLMServiceDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public LLMServiceDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public LLMServiceDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.llmServices().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class LLMServiceLister {
    private final OpenMetadataClient client;
    private Integer limit;
    private String after;
    private final Map<String, String> filters = new HashMap<>();

    LLMServiceLister(OpenMetadataClient client) {
      this.client = client;
    }

    public LLMServiceLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public LLMServiceLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public LLMServiceLister filter(String key, String value) {
      filters.put(key, value);
      return this;
    }

    public List<FluentLLMService> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.llmServices().list(params);
      List<FluentLLMService> items = new ArrayList<>();
      for (LLMService item : response.getData()) {
        items.add(new FluentLLMService(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentLLMService> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentLLMService {
    private final LLMService entity;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentLLMService(LLMService entity, OpenMetadataClient client) {
      this.entity = entity;
      this.client = client;
    }

    public LLMService get() {
      return entity;
    }

    public FluentLLMService withDescription(String description) {
      entity.setDescription(description);
      modified = true;
      return this;
    }

    public FluentLLMService withDisplayName(String displayName) {
      entity.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentLLMService withOwners(List<EntityReference> owners) {
      entity.setOwners(owners);
      modified = true;
      return this;
    }

    public FluentLLMService save() {
      if (modified) {
        LLMService updated = client.llmServices().update(entity.getId().toString(), entity);
        entity.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public LLMServiceDeleter delete() {
      return new LLMServiceDeleter(client, entity.getId().toString());
    }
  }
}
