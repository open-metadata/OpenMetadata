package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.ai.CreatePromptTemplate;
import org.openmetadata.schema.entity.ai.PromptTemplate;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent API for PromptTemplate operations.
 *
 * <p>Usage:
 *
 * <pre>
 * // Create
 * PromptTemplate template = PromptTemplates.create()
 *     .name("summarization-prompt")
 *     .withDescription("Summarization prompt template")
 *     .execute();
 *
 * // Find
 * PromptTemplate template = PromptTemplates.find(templateId).fetch();
 *
 * // List
 * PromptTemplates.list().limit(10).forEach(t -> process(t));
 * </pre>
 */
public final class PromptTemplates {
  private static OpenMetadataClient defaultClient;

  private PromptTemplates() {}

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call PromptTemplates.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static PromptTemplateCreator create() {
    return new PromptTemplateCreator(getClient());
  }

  public static PromptTemplate create(CreatePromptTemplate request) {
    return getClient().promptTemplates().create(request);
  }

  // ==================== Direct Access ====================

  public static PromptTemplate get(String id) {
    return getClient().promptTemplates().get(id);
  }

  public static PromptTemplate get(String id, String fields) {
    return getClient().promptTemplates().get(id, fields);
  }

  public static PromptTemplate getByName(String fqn) {
    return getClient().promptTemplates().getByName(fqn);
  }

  public static PromptTemplate getByName(String fqn, String fields) {
    return getClient().promptTemplates().getByName(fqn, fields);
  }

  public static PromptTemplate update(String id, PromptTemplate entity) {
    return getClient().promptTemplates().update(id, entity);
  }

  public static void delete(String id) {
    getClient().promptTemplates().delete(id);
  }

  public static void delete(String id, Map<String, String> params) {
    getClient().promptTemplates().delete(id, params);
  }

  public static void restore(String id) {
    getClient().promptTemplates().restore(id);
  }

  // ==================== Finders ====================

  public static PromptTemplateFinder find(String id) {
    return new PromptTemplateFinder(getClient(), id);
  }

  public static PromptTemplateFinder find(UUID id) {
    return find(id.toString());
  }

  public static PromptTemplateFinder findByName(String fqn) {
    return new PromptTemplateFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static PromptTemplateLister list() {
    return new PromptTemplateLister(getClient());
  }

  // ==================== Creator ====================

  public static class PromptTemplateCreator {
    private final OpenMetadataClient client;
    private final CreatePromptTemplate request = new CreatePromptTemplate();

    PromptTemplateCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public PromptTemplateCreator name(String name) {
      request.setName(name);
      return this;
    }

    public PromptTemplateCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public PromptTemplateCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public PromptTemplateCreator withOwners(List<EntityReference> owners) {
      request.setOwners(owners);
      return this;
    }

    public PromptTemplate execute() {
      return client.promptTemplates().create(request);
    }

    public PromptTemplate now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class PromptTemplateFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    PromptTemplateFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    PromptTemplateFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public PromptTemplateFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public PromptTemplateFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public PromptTemplateFinder withFields(String... fields) {
      includes.addAll(Arrays.asList(fields));
      return this;
    }

    public PromptTemplateFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "domain"));
      return this;
    }

    public FluentPromptTemplate fetch() {
      PromptTemplate entity;
      if (includes.isEmpty()) {
        entity =
            isFqn
                ? client.promptTemplates().getByName(identifier)
                : client.promptTemplates().get(identifier);
      } else {
        String fields = String.join(",", includes);
        entity =
            isFqn
                ? client.promptTemplates().getByName(identifier, fields)
                : client.promptTemplates().get(identifier, fields);
      }
      return new FluentPromptTemplate(entity, client);
    }

    public PromptTemplate get() {
      return fetch().get();
    }

    public PromptTemplateDeleter delete() {
      return new PromptTemplateDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class PromptTemplateDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean hardDelete = false;

    PromptTemplateDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public PromptTemplateDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (hardDelete) params.put("hardDelete", "true");
      client.promptTemplates().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class PromptTemplateLister {
    private final OpenMetadataClient client;
    private Integer limit;
    private String after;
    private final Map<String, String> filters = new HashMap<>();

    PromptTemplateLister(OpenMetadataClient client) {
      this.client = client;
    }

    public PromptTemplateLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public PromptTemplateLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public PromptTemplateLister filter(String key, String value) {
      filters.put(key, value);
      return this;
    }

    public List<FluentPromptTemplate> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.promptTemplates().list(params);
      List<FluentPromptTemplate> items = new ArrayList<>();
      for (PromptTemplate item : response.getData()) {
        items.add(new FluentPromptTemplate(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentPromptTemplate> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentPromptTemplate {
    private final PromptTemplate entity;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentPromptTemplate(PromptTemplate entity, OpenMetadataClient client) {
      this.entity = entity;
      this.client = client;
    }

    public PromptTemplate get() {
      return entity;
    }

    public FluentPromptTemplate withDescription(String description) {
      entity.setDescription(description);
      modified = true;
      return this;
    }

    public FluentPromptTemplate withDisplayName(String displayName) {
      entity.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentPromptTemplate withOwners(List<EntityReference> owners) {
      entity.setOwners(owners);
      modified = true;
      return this;
    }

    public FluentPromptTemplate save() {
      if (modified) {
        PromptTemplate updated = client.promptTemplates().update(entity.getId().toString(), entity);
        entity.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public PromptTemplateDeleter delete() {
      return new PromptTemplateDeleter(client, entity.getId().toString());
    }
  }
}
