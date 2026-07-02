package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for Container operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.Containers.*;
 *
 * // Create
 * Container container = create()
 *     .name("container_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * Container container = find(containerId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * Container updated = find(containerId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(containerId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(container -> process(container));
 *
 * // Page through immediate children of a container (slim projection — no
 * // dataModel/tags/owners) via the dedicated endpoint
 * List&lt;Container&gt; kids = listChildren(parentFqn).limit(50).offset(0).fetch();
 *
 * // Walk the ancestor chain (root → immediate parent) in one call
 * List&lt;EntityReference&gt; chain = listAncestors(parentFqn);
 * </pre>
 */
public final class Containers {
  private static OpenMetadataClient defaultClient;

  private Containers() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Containers.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static ContainerCreator create() {
    return new ContainerCreator(getClient());
  }

  public static Container create(CreateContainer request) {
    return getClient().containers().create(request);
  }

  // ==================== Finding/Retrieval ====================

  public static ContainerFinder find(String id) {
    return new ContainerFinder(getClient(), id);
  }

  public static ContainerFinder find(UUID id) {
    return find(id.toString());
  }

  public static ContainerFinder findByName(String fqn) {
    return new ContainerFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static ContainerLister list() {
    return new ContainerLister(getClient());
  }

  // ==================== Children / Ancestors ====================

  /**
   * Page through the immediate children of a container via the dedicated
   * {@code /v1/containers/name/{fqn}/children} endpoint. Use this instead of fetching the
   * parent with {@code fields=children} — that field is no longer served because the inline
   * payload is unbounded for buckets with many objects.
   */
  public static ContainerChildrenLister listChildren(String parentFqn) {
    return new ContainerChildrenLister(getClient(), parentFqn);
  }

  /**
   * Resolve the full ancestor chain for a container in a single call. Returns
   * {@link EntityReference}s ordered from the root container (immediate child of the storage
   * service) down to the immediate parent of {@code fqn}. Empty list when the container is at
   * the top level.
   */
  public static List<EntityReference> listAncestors(String fqn) {
    return getClient().containers().listAncestors(fqn);
  }

  // ==================== Creator ====================

  public static class ContainerCreator {
    private final OpenMetadataClient client;
    private final CreateContainer request = new CreateContainer();

    ContainerCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public ContainerCreator name(String name) {
      request.setName(name);
      return this;
    }

    public ContainerCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public ContainerCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public ContainerCreator in(String service) {
      request.setService(service);
      return this;
    }

    /**
     * Create the container as a child of {@code parent}. Mirrors {@code GlossaryTerms.under(...)}.
     * The parent must belong to the same StorageService as set via {@link #in(String)}.
     */
    public ContainerCreator under(Container parent) {
      if (parent == null) {
        request.setParent(null);
        return this;
      }
      return under(
          new EntityReference()
              .withId(parent.getId())
              .withType("container")
              .withFullyQualifiedName(parent.getFullyQualifiedName()));
    }

    public ContainerCreator under(EntityReference parentRef) {
      request.setParent(parentRef);
      return this;
    }

    public ContainerCreator underFqn(String parentFqn) {
      request.setParent(
          new EntityReference().withType("container").withFullyQualifiedName(parentFqn));
      return this;
    }

    public Container execute() {
      return client.containers().create(request);
    }

    public Container now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class ContainerFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    ContainerFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    ContainerFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public ContainerFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public ContainerFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public ContainerFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domains"));
      return this;
    }

    public FluentContainer fetch() {
      Container container;
      if (includes.isEmpty()) {
        container =
            isFqn ? client.containers().getByName(identifier) : client.containers().get(identifier);
      } else {
        String fields = String.join(",", includes);
        container =
            isFqn
                ? client.containers().getByName(identifier, fields)
                : client.containers().get(identifier, fields);
      }
      return new FluentContainer(container, client);
    }

    public ContainerDeleter delete() {
      return new ContainerDeleter(client, identifier);
    }

    public org.openmetadata.sdk.fluent.common.EntityRestorer<Container> restore() {
      return new org.openmetadata.sdk.fluent.common.EntityRestorer<>(
          client.containers(), identifier);
    }
  }

  // ==================== Deleter ====================

  public static class ContainerDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    ContainerDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public ContainerDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public ContainerDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.containers().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class ContainerLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    ContainerLister(OpenMetadataClient client) {
      this.client = client;
    }

    public ContainerLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public ContainerLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentContainer> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.containers().list(params);
      List<FluentContainer> items = new ArrayList<>();
      for (Container item : response.getData()) {
        items.add(new FluentContainer(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentContainer> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Children / Ancestors Lister ====================

  public static class ContainerChildrenLister {
    private final OpenMetadataClient client;
    private final String parentFqn;
    private Integer limit;
    private Integer offset;

    ContainerChildrenLister(OpenMetadataClient client, String parentFqn) {
      this.client = client;
      this.parentFqn = parentFqn;
    }

    public ContainerChildrenLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public ContainerChildrenLister offset(int offset) {
      this.offset = offset;
      return this;
    }

    public List<Container> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (offset != null) params.setOffset(offset);
      return client.containers().listChildren(parentFqn, params).getData();
    }

    public void forEach(java.util.function.Consumer<Container> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentContainer {
    private final Container container;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentContainer(Container container, OpenMetadataClient client) {
      this.container = container;
      this.client = client;
    }

    public Container get() {
      return container;
    }

    public FluentContainer withDescription(String description) {
      container.setDescription(description);
      modified = true;
      return this;
    }

    public FluentContainer withDisplayName(String displayName) {
      container.setDisplayName(displayName);
      modified = true;
      return this;
    }

    /**
     * Re-parent this container under {@code parent}. The {@link #save()} call routes through the
     * service update, which generates a JSON Patch and issues PATCH — the backend (see issue
     * #24294) cascades the FQN change to descendants, column FQNs, tags, and the search index.
     * The new parent must belong to the same StorageService.
     */
    public FluentContainer withParent(Container parent) {
      if (parent == null) {
        return withoutParent();
      }
      return withParent(
          new EntityReference()
              .withId(parent.getId())
              .withType("container")
              .withFullyQualifiedName(parent.getFullyQualifiedName()));
    }

    public FluentContainer withParent(EntityReference parentRef) {
      container.setParent(parentRef);
      modified = true;
      return this;
    }

    public FluentContainer withParentFqn(String parentFqn) {
      container.setParent(
          new EntityReference().withType("container").withFullyQualifiedName(parentFqn));
      modified = true;
      return this;
    }

    /** Promote this container to be a direct child of its StorageService. */
    public FluentContainer withoutParent() {
      container.setParent(null);
      modified = true;
      return this;
    }

    public FluentContainer save() {
      if (modified) {
        Container updated = client.containers().update(container.getId().toString(), container);
        container.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    /**
     * Page this container's immediate children via the dedicated paginated endpoint, using
     * the parent's FQN. Returned containers are slim projections; re-fetch via
     * {@link Containers#findByName(String)} for full details.
     */
    public ContainerChildrenLister children() {
      return new ContainerChildrenLister(client, container.getFullyQualifiedName());
    }

    /** Walk this container's ancestor chain (root → immediate parent) in one server call. */
    public List<EntityReference> ancestors() {
      return client.containers().listAncestors(container.getFullyQualifiedName());
    }

    public ContainerDeleter delete() {
      return new ContainerDeleter(client, container.getId().toString());
    }
  }
}
