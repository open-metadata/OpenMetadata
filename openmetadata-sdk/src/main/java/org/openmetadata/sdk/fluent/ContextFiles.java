package org.openmetadata.sdk.fluent;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.api.data.CreateContextFile;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.entity.data.ContextFileType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Pure Fluent API for Context Center File ({@code ContextFile}) operations.
 *
 * <pre>
 * import static org.openmetadata.sdk.fluent.ContextFiles.*;
 *
 * ContextFile file = find(fileId)
 *     .withFields("folder")
 *     .fetch();
 *
 * ContextFile moved = moveToFolder(fileId, targetFolderId);
 *
 * ContextFile movedToRoot = moveToRoot(fileId);
 * </pre>
 *
 * <p>Multipart upload and binary download are not exposed through this fluent API — callers should
 * hit the corresponding {@code /upload} and {@code /{id}/download} endpoints directly. Use the
 * raw service ({@link org.openmetadata.sdk.services.drives.ContextFileService}) for metadata-only
 * file entries.
 */
public final class ContextFiles {
  private static OpenMetadataClient defaultClient;

  private ContextFiles() {}

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call ContextFiles.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static ContextFileCreator create() {
    return new ContextFileCreator(getClient());
  }

  public static ContextFile create(CreateContextFile request) {
    return getClient().contextFiles().create(request);
  }

  // ==================== Direct access ====================

  public static ContextFile get(String id) {
    return getClient().contextFiles().get(id);
  }

  public static ContextFile get(String id, String fields) {
    return getClient().contextFiles().get(id, fields);
  }

  public static ContextFile getByName(String fqn) {
    return getClient().contextFiles().getByName(fqn);
  }

  public static ContextFile getByName(String fqn, String fields) {
    return getClient().contextFiles().getByName(fqn, fields);
  }

  public static ContextFile update(String id, ContextFile entity) {
    return getClient().contextFiles().update(id, entity);
  }

  public static void delete(String id) {
    getClient().contextFiles().delete(id);
  }

  public static void delete(String id, java.util.Map<String, String> params) {
    getClient().contextFiles().delete(id, params);
  }

  public static ContextFile restore(String id) {
    return getClient().contextFiles().restore(id);
  }

  /** Move a file into a folder. */
  public static ContextFile moveToFolder(String fileId, String folderId) {
    EntityReference folder =
        new EntityReference().withId(UUID.fromString(folderId)).withType("folder");
    return getClient().contextFiles().move(fileId, folder);
  }

  /** Move a file to the drive root (no parent folder). */
  public static ContextFile moveToRoot(String fileId) {
    return getClient().contextFiles().move(fileId, null);
  }

  // ==================== Finders ====================

  public static ContextFileFinder find(String id) {
    return new ContextFileFinder(getClient(), id, false);
  }

  public static ContextFileFinder findByName(String fqn) {
    return new ContextFileFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static ListResponse<ContextFile> list() {
    return getClient().contextFiles().list();
  }

  public static ListResponse<ContextFile> list(ListParams params) {
    return getClient().contextFiles().list(params);
  }

  // ==================== Builders ====================

  public static class ContextFileCreator {
    private final OpenMetadataClient client;
    private final CreateContextFile request = new CreateContextFile();

    ContextFileCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public ContextFileCreator name(String name) {
      request.setName(name);
      return this;
    }

    public ContextFileCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public ContextFileCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public ContextFileCreator withFileType(ContextFileType fileType) {
      request.setFileType(fileType);
      return this;
    }

    public ContextFileCreator withFolder(String folderFqn) {
      request.setFolder(folderFqn);
      return this;
    }

    public ContextFileCreator withOwners(List<EntityReference> owners) {
      request.setOwners(owners);
      return this;
    }

    public ContextFile execute() {
      return client.contextFiles().create(request);
    }
  }

  public static class ContextFileFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    ContextFileFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public ContextFileFinder withFields(String... fields) {
      includes.addAll(Arrays.asList(fields));
      return this;
    }

    public ContextFile fetch() {
      if (includes.isEmpty()) {
        return isFqn
            ? client.contextFiles().getByName(identifier)
            : client.contextFiles().get(identifier);
      }
      String fields = String.join(",", includes);
      return isFqn
          ? client.contextFiles().getByName(identifier, fields)
          : client.contextFiles().get(identifier, fields);
    }
  }
}
