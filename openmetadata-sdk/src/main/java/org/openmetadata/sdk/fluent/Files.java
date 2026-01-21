package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.CreateFile;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FileType;
import org.openmetadata.sdk.client.OpenMetadataClient;

public final class Files {
  private static OpenMetadataClient defaultClient;

  private Files() {}

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Files.setDefaultClient() first.");
    }
    return defaultClient;
  }

  public static FileCreator create() {
    return new FileCreator(getClient());
  }

  public static File get(String id) {
    return getClient().files().get(id);
  }

  public static File getByName(String fqn) {
    return getClient().files().getByName(fqn);
  }

  public static File getByName(String fqn, String fields) {
    return getClient().files().getByName(fqn, fields);
  }

  public static void delete(String id) {
    getClient().files().delete(id);
  }

  public static FileFinder find(String id) {
    return new FileFinder(getClient(), id, false);
  }

  public static FileFinder findByName(String fqn) {
    return new FileFinder(getClient(), fqn, true);
  }

  public static class FileCreator {
    private final OpenMetadataClient client;
    private final CreateFile request = new CreateFile();

    FileCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public FileCreator name(String name) {
      request.setName(name);
      return this;
    }

    public FileCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public FileCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public FileCreator withService(String serviceFqn) {
      request.setService(serviceFqn);
      return this;
    }

    public FileCreator withOwners(List<EntityReference> owners) {
      request.setOwners(owners);
      return this;
    }

    public FileCreator withFileType(FileType fileType) {
      request.setFileType(fileType);
      return this;
    }

    public FileCreator withMimeType(String mimeType) {
      request.setMimeType(mimeType);
      return this;
    }

    public FileCreator withColumns(List<Column> columns) {
      request.setColumns(columns);
      return this;
    }

    public File execute() {
      return client.files().create(request);
    }
  }

  public static class FileFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    FileFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public FileFinder withFields(String... fields) {
      includes.addAll(Arrays.asList(fields));
      return this;
    }

    public File fetch() {
      if (includes.isEmpty()) {
        return isFqn ? client.files().getByName(identifier) : client.files().get(identifier);
      }
      String fields = String.join(",", includes);
      return isFqn
          ? client.files().getByName(identifier, fields)
          : client.files().get(identifier, fields);
    }
  }
}
