package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for Domain operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.Domains.*;
 *
 * // Create
 * Domain domain = create()
 *     .name("domain_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * Domain domain = find(domainId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * Domain updated = find(domainId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(domainId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(domain -> process(domain));
 * </pre>
 */
public final class Domains {
  private static OpenMetadataClient defaultClient;

  private Domains() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Domains.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static DomainCreator create() {
    return new DomainCreator(getClient());
  }

  public static Domain create(CreateDomain request) {
    return getClient().domains().create(request);
  }

  // ==================== Direct Access Methods ====================

  public static Domain get(String id) {
    return getClient().domains().get(id);
  }

  public static Domain get(String id, String fields) {
    return getClient().domains().get(id, fields);
  }

  public static Domain get(String id, String fields, String include) {
    return getClient().domains().get(id, fields, include);
  }

  public static Domain getByName(String fqn) {
    return getClient().domains().getByName(fqn);
  }

  public static Domain getByName(String fqn, String fields) {
    return getClient().domains().getByName(fqn, fields);
  }

  public static Domain update(String id, Domain entity) {
    return getClient().domains().update(id, entity);
  }

  public static void delete(String id) {
    getClient().domains().delete(id);
  }

  public static void delete(String id, java.util.Map<String, String> params) {
    getClient().domains().delete(id, params);
  }

  public static void restore(String id) {
    getClient().domains().restore(id);
  }

  public static org.openmetadata.sdk.models.ListResponse<Domain> list(
      org.openmetadata.sdk.models.ListParams params) {
    return getClient().domains().list(params);
  }

  public static org.openmetadata.schema.type.EntityHistory getVersionList(java.util.UUID id) {
    return getClient().domains().getVersionList(id);
  }

  public static Domain getVersion(String id, Double version) {
    return getClient().domains().getVersion(id, version);
  }

  // ==================== Finding/Retrieval ====================

  public static DomainFinder find(String id) {
    return new DomainFinder(getClient(), id);
  }

  public static DomainFinder find(UUID id) {
    return find(id.toString());
  }

  public static DomainFinder findByName(String fqn) {
    return new DomainFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static DomainLister list() {
    return new DomainLister(getClient());
  }

  // ==================== Creator ====================

  public static class DomainCreator {
    private final OpenMetadataClient client;
    private final CreateDomain request = new CreateDomain();

    DomainCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public DomainCreator name(String name) {
      request.setName(name);
      return this;
    }

    public DomainCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public DomainCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public Domain execute() {
      return client.domains().create(request);
    }

    public Domain now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class DomainFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    DomainFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    DomainFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public DomainFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public DomainFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public DomainFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domains"));
      return this;
    }

    public FluentDomain fetch() {
      Domain domain;
      if (includes.isEmpty()) {
        domain = isFqn ? client.domains().getByName(identifier) : client.domains().get(identifier);
      } else {
        String fields = String.join(",", includes);
        domain =
            isFqn
                ? client.domains().getByName(identifier, fields)
                : client.domains().get(identifier, fields);
      }
      return new FluentDomain(domain, client);
    }

    public DomainDeleter delete() {
      return new DomainDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class DomainDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    DomainDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public DomainDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public DomainDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.domains().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class DomainLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    DomainLister(OpenMetadataClient client) {
      this.client = client;
    }

    public DomainLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public DomainLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentDomain> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.domains().list(params);
      List<FluentDomain> items = new ArrayList<>();
      for (Domain item : response.getData()) {
        items.add(new FluentDomain(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentDomain> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentDomain {
    private final Domain domain;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentDomain(Domain domain, OpenMetadataClient client) {
      this.domain = domain;
      this.client = client;
    }

    public Domain get() {
      return domain;
    }

    public FluentDomain withDescription(String description) {
      domain.setDescription(description);
      modified = true;
      return this;
    }

    public FluentDomain withDisplayName(String displayName) {
      domain.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentDomain save() {
      if (modified) {
        Domain updated = client.domains().update(domain.getId().toString(), domain);
        domain.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public DomainDeleter delete() {
      return new DomainDeleter(client, domain.getId().toString());
    }
  }
}
