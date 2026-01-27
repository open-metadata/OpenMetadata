package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for SearchIndex operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.SearchIndexes.*;
 *
 * // Create
 * SearchIndex searchIndex = create()
 *     .name("searchIndex_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * SearchIndex searchIndex = find(searchIndexId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * SearchIndex updated = find(searchIndexId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(searchIndexId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(searchIndex -> process(searchIndex));
 * </pre>
 */
public final class SearchIndexes {
  private static OpenMetadataClient defaultClient;

  private SearchIndexes() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call SearchIndexes.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static SearchIndexCreator create() {
    return new SearchIndexCreator(getClient());
  }

  public static SearchIndex create(CreateSearchIndex request) {
    return getClient().searchIndexes().create(request);
  }

  // ==================== Finding/Retrieval ====================

  public static SearchIndexFinder find(String id) {
    return new SearchIndexFinder(getClient(), id);
  }

  public static SearchIndexFinder find(UUID id) {
    return find(id.toString());
  }

  public static SearchIndexFinder findByName(String fqn) {
    return new SearchIndexFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static SearchIndexLister list() {
    return new SearchIndexLister(getClient());
  }

  // ==================== Creator ====================

  public static class SearchIndexCreator {
    private final OpenMetadataClient client;
    private final CreateSearchIndex request = new CreateSearchIndex();

    SearchIndexCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public SearchIndexCreator name(String name) {
      request.setName(name);
      return this;
    }

    public SearchIndexCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public SearchIndexCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public SearchIndexCreator in(String service) {
      request.setService(service);
      return this;
    }

    public SearchIndex execute() {
      return client.searchIndexes().create(request);
    }

    public SearchIndex now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class SearchIndexFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    SearchIndexFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    SearchIndexFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public SearchIndexFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public SearchIndexFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public SearchIndexFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domains"));
      return this;
    }

    public FluentSearchIndex fetch() {
      SearchIndex searchIndex;
      if (includes.isEmpty()) {
        searchIndex =
            isFqn
                ? client.searchIndexes().getByName(identifier)
                : client.searchIndexes().get(identifier);
      } else {
        String fields = String.join(",", includes);
        searchIndex =
            isFqn
                ? client.searchIndexes().getByName(identifier, fields)
                : client.searchIndexes().get(identifier, fields);
      }
      return new FluentSearchIndex(searchIndex, client);
    }

    public SearchIndexDeleter delete() {
      return new SearchIndexDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class SearchIndexDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    SearchIndexDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public SearchIndexDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public SearchIndexDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.searchIndexes().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class SearchIndexLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    SearchIndexLister(OpenMetadataClient client) {
      this.client = client;
    }

    public SearchIndexLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public SearchIndexLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentSearchIndex> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.searchIndexes().list(params);
      List<FluentSearchIndex> items = new ArrayList<>();
      for (SearchIndex item : response.getData()) {
        items.add(new FluentSearchIndex(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentSearchIndex> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentSearchIndex {
    private final SearchIndex searchIndex;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentSearchIndex(SearchIndex searchIndex, OpenMetadataClient client) {
      this.searchIndex = searchIndex;
      this.client = client;
    }

    public SearchIndex get() {
      return searchIndex;
    }

    public FluentSearchIndex withDescription(String description) {
      searchIndex.setDescription(description);
      modified = true;
      return this;
    }

    public FluentSearchIndex withDisplayName(String displayName) {
      searchIndex.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentSearchIndex save() {
      if (modified) {
        SearchIndex updated =
            client.searchIndexes().update(searchIndex.getId().toString(), searchIndex);
        searchIndex.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public SearchIndexDeleter delete() {
      return new SearchIndexDeleter(client, searchIndex.getId().toString());
    }
  }
}
