package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for DataProduct operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.DataProducts.*;
 *
 * // Create
 * DataProduct dataProduct = create()
 *     .name("dataProduct_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * DataProduct dataProduct = find(dataProductId)
 *     .includeOwners()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * DataProduct updated = find(dataProductId)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find(dataProductId)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach(dataProduct -> process(dataProduct));
 * </pre>
 */
public final class DataProducts {
  private static OpenMetadataClient defaultClient;

  private DataProducts() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call DataProducts.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static DataProductCreator create() {
    return new DataProductCreator(getClient());
  }

  public static DataProduct create(CreateDataProduct request) {
    return getClient().dataProducts().create(request);
  }

  // ==================== Finding/Retrieval ====================

  public static DataProductFinder find(String id) {
    return new DataProductFinder(getClient(), id);
  }

  public static DataProductFinder find(UUID id) {
    return find(id.toString());
  }

  public static DataProductFinder findByName(String fqn) {
    return new DataProductFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static DataProductLister list() {
    return new DataProductLister(getClient());
  }

  // ==================== Creator ====================

  public static class DataProductCreator {
    private final OpenMetadataClient client;
    private final CreateDataProduct request = new CreateDataProduct();

    DataProductCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public DataProductCreator name(String name) {
      request.setName(name);
      return this;
    }

    public DataProductCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public DataProductCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public DataProductCreator in(String... domains) {
      request.setDomains(java.util.Arrays.asList(domains));
      return this;
    }

    public DataProduct execute() {
      return client.dataProducts().create(request);
    }

    public DataProduct now() {
      return execute();
    }
  }

  // ==================== Finder ====================

  public static class DataProductFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    DataProductFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    DataProductFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public DataProductFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public DataProductFinder includeTags() {
      includes.add("tags");
      return this;
    }

    public DataProductFinder includeAll() {
      includes.addAll(Arrays.asList("owners", "tags", "followers", "domains"));
      return this;
    }

    public FluentDataProduct fetch() {
      DataProduct dataProduct;
      if (includes.isEmpty()) {
        dataProduct =
            isFqn
                ? client.dataProducts().getByName(identifier)
                : client.dataProducts().get(identifier);
      } else {
        String fields = String.join(",", includes);
        dataProduct =
            isFqn
                ? client.dataProducts().getByName(identifier, fields)
                : client.dataProducts().get(identifier, fields);
      }
      return new FluentDataProduct(dataProduct, client);
    }

    public DataProductDeleter delete() {
      return new DataProductDeleter(client, identifier);
    }
  }

  // ==================== Deleter ====================

  public static class DataProductDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    DataProductDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public DataProductDeleter recursively() {
      this.recursive = true;
      return this;
    }

    public DataProductDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.dataProducts().delete(id, params);
    }
  }

  // ==================== Lister ====================

  public static class DataProductLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    DataProductLister(OpenMetadataClient client) {
      this.client = client;
    }

    public DataProductLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public DataProductLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentDataProduct> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.dataProducts().list(params);
      List<FluentDataProduct> items = new ArrayList<>();
      for (DataProduct item : response.getData()) {
        items.add(new FluentDataProduct(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentDataProduct> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentDataProduct {
    private final DataProduct dataProduct;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentDataProduct(DataProduct dataProduct, OpenMetadataClient client) {
      this.dataProduct = dataProduct;
      this.client = client;
    }

    public DataProduct get() {
      return dataProduct;
    }

    public FluentDataProduct withDescription(String description) {
      dataProduct.setDescription(description);
      modified = true;
      return this;
    }

    public FluentDataProduct withDisplayName(String displayName) {
      dataProduct.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentDataProduct save() {
      if (modified) {
        DataProduct updated =
            client.dataProducts().update(dataProduct.getId().toString(), dataProduct);
        dataProduct.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public DataProductDeleter delete() {
      return new DataProductDeleter(client, dataProduct.getId().toString());
    }
  }
}
