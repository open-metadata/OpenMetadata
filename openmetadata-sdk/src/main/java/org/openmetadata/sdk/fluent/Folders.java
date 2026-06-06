package org.openmetadata.sdk.fluent;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.api.data.CreateFolder;
import org.openmetadata.schema.entity.data.Folder;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Pure Fluent API for Context Center Folder operations.
 *
 * <pre>
 * import static org.openmetadata.sdk.fluent.Folders.*;
 *
 * Folder f = create()
 *     .name("design-docs")
 *     .withDescription("Design documents for Q1")
 *     .execute();
 *
 * Folder fetched = find(f.getId().toString())
 *     .withFields("parent", "children")
 *     .fetch();
 *
 * JsonNode contents = getContents(f.getId().toString());
 * </pre>
 */
public final class Folders {
  private static OpenMetadataClient defaultClient;

  private Folders() {}

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Folders.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static FolderCreator create() {
    return new FolderCreator(getClient());
  }

  public static Folder create(CreateFolder request) {
    return getClient().folders().create(request);
  }

  // ==================== Direct access ====================

  public static Folder get(String id) {
    return getClient().folders().get(id);
  }

  public static Folder get(String id, String fields) {
    return getClient().folders().get(id, fields);
  }

  public static Folder getByName(String fqn) {
    return getClient().folders().getByName(fqn);
  }

  public static Folder getByName(String fqn, String fields) {
    return getClient().folders().getByName(fqn, fields);
  }

  public static Folder update(String id, Folder entity) {
    return getClient().folders().update(id, entity);
  }

  public static void delete(String id) {
    getClient().folders().delete(id);
  }

  public static void delete(String id, java.util.Map<String, String> params) {
    getClient().folders().delete(id, params);
  }

  public static Folder restore(String id) {
    return getClient().folders().restore(id);
  }

  public static JsonNode getContents(String id) {
    return getClient().folders().getContents(id);
  }

  public static JsonNode getContents(String id, String fields) {
    return getClient().folders().getContents(id, fields);
  }

  // ==================== Finders ====================

  public static FolderFinder find(String id) {
    return new FolderFinder(getClient(), id, false);
  }

  public static FolderFinder findByName(String fqn) {
    return new FolderFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static ListResponse<Folder> list() {
    return getClient().folders().list();
  }

  public static ListResponse<Folder> list(ListParams params) {
    return getClient().folders().list(params);
  }

  // ==================== Builders ====================

  public static class FolderCreator {
    private final OpenMetadataClient client;
    private final CreateFolder request = new CreateFolder();

    FolderCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public FolderCreator name(String name) {
      request.setName(name);
      return this;
    }

    public FolderCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public FolderCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public FolderCreator withParent(String parentFqn) {
      request.setParent(parentFqn);
      return this;
    }

    public FolderCreator withOwners(List<EntityReference> owners) {
      request.setOwners(owners);
      return this;
    }

    public Folder execute() {
      return client.folders().create(request);
    }
  }

  public static class FolderFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    FolderFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public FolderFinder withFields(String... fields) {
      includes.addAll(Arrays.asList(fields));
      return this;
    }

    public Folder fetch() {
      if (includes.isEmpty()) {
        return isFqn ? client.folders().getByName(identifier) : client.folders().get(identifier);
      }
      String fields = String.join(",", includes);
      return isFqn
          ? client.folders().getByName(identifier, fields)
          : client.folders().get(identifier, fields);
    }
  }
}
