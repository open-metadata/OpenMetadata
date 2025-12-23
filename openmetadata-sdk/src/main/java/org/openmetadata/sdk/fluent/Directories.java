package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.CreateDirectory;
import org.openmetadata.schema.entity.data.Directory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;

public final class Directories {
  private static OpenMetadataClient defaultClient;

  private Directories() {}

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Directories.setDefaultClient() first.");
    }
    return defaultClient;
  }

  public static DirectoryCreator create() {
    return new DirectoryCreator(getClient());
  }

  public static Directory get(String id) {
    return getClient().directories().get(id);
  }

  public static Directory getByName(String fqn) {
    return getClient().directories().getByName(fqn);
  }

  public static Directory getByName(String fqn, String fields) {
    return getClient().directories().getByName(fqn, fields);
  }

  public static void delete(String id) {
    getClient().directories().delete(id);
  }

  public static DirectoryFinder find(String id) {
    return new DirectoryFinder(getClient(), id, false);
  }

  public static DirectoryFinder findByName(String fqn) {
    return new DirectoryFinder(getClient(), fqn, true);
  }

  public static class DirectoryCreator {
    private final OpenMetadataClient client;
    private final CreateDirectory request = new CreateDirectory();

    DirectoryCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public DirectoryCreator name(String name) {
      request.setName(name);
      return this;
    }

    public DirectoryCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public DirectoryCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public DirectoryCreator withService(String serviceFqn) {
      request.setService(serviceFqn);
      return this;
    }

    public DirectoryCreator withOwners(List<EntityReference> owners) {
      request.setOwners(owners);
      return this;
    }

    public Directory execute() {
      return client.directories().create(request);
    }
  }

  public static class DirectoryFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    DirectoryFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public DirectoryFinder withFields(String... fields) {
      includes.addAll(Arrays.asList(fields));
      return this;
    }

    public Directory fetch() {
      if (includes.isEmpty()) {
        return isFqn
            ? client.directories().getByName(identifier)
            : client.directories().get(identifier);
      }
      String fields = String.join(",", includes);
      return isFqn
          ? client.directories().getByName(identifier, fields)
          : client.directories().get(identifier, fields);
    }
  }
}
