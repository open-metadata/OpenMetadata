package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for Query operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.Queries.*;
 *
 * // Create
 * Query query = create()
 *     .name("query_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * Query query = find(queryId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * Query updated = find(queryId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(queryId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(query -> process(query));
 * </pre>
 */
public final class Queries {
  private static OpenMetadataClient defaultClient;

  private Queries() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Queries.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static QueryCreator create() {
    return new QueryCreator(getClient());
  }

  public static Query create(CreateQuery request) {
    return getClient().queries().create(request);
  }

  // ==================== Finding/Retrieval ====================

  public static QueryFinder find(String id) {
    return new QueryFinder(getClient(), id);
  }

  public static QueryFinder find(UUID id) {
    return find(id.toString());
  }

  public static QueryFinder findByName(String fqn) {
    return new QueryFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static QueryLister list() {
    return new QueryLister(getClient());
  }

  // ==================== Creator ====================

  public static class QueryCreator {
    private final OpenMetadataClient client;
    private final CreateQuery request = new CreateQuery();

    QueryCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public QueryCreator name(String name) {
      request.setName(name);
      return this;
    }

    public QueryCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public QueryCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public QueryCreator withQuery(String sql) {
      request.setQuery(sql);
      return this;
    }

    public Query execute() {
      return client.queries().create(request);
    }

    public Query now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class QueryFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    QueryFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    QueryFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public QueryFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public QueryFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public QueryFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domains"));
      return this;
    }

    public FluentQuery fetch() {
      Query query;
      if (includes.isEmpty()) {
        query = isFqn ? client.queries().getByName(identifier) : client.queries().get(identifier);
      } else {
        String fields = String.join(",", includes);
        query =
            isFqn
                ? client.queries().getByName(identifier, fields)
                : client.queries().get(identifier, fields);
      }
      return new FluentQuery(query, client);
    }

    public QueryDeleter delete() {
      return new QueryDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class QueryDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    QueryDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public QueryDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public QueryDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.queries().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class QueryLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    QueryLister(OpenMetadataClient client) {
      this.client = client;
    }

    public QueryLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public QueryLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentQuery> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.queries().list(params);
      List<FluentQuery> items = new ArrayList<>();
      for (Query item : response.getData()) {
        items.add(new FluentQuery(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentQuery> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentQuery {
    private final Query query;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentQuery(Query query, OpenMetadataClient client) {
      this.query = query;
      this.client = client;
    }

    public Query get() {
      return query;
    }

    public FluentQuery withDescription(String description) {
      query.setDescription(description);
      modified = true;
      return this;
    }

    public FluentQuery withDisplayName(String displayName) {
      query.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentQuery save() {
      if (modified) {
        Query updated = client.queries().update(query.getId().toString(), query);
        query.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public QueryDeleter delete() {
      return new QueryDeleter(client, query.getId().toString());
    }
  }
}
