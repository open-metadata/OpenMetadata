package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.CreateWorksheet;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;

public final class Worksheets {
  private static OpenMetadataClient defaultClient;

  private Worksheets() {}

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Worksheets.setDefaultClient() first.");
    }
    return defaultClient;
  }

  public static WorksheetCreator create() {
    return new WorksheetCreator(getClient());
  }

  public static Worksheet get(String id) {
    return getClient().worksheets().get(id);
  }

  public static Worksheet getByName(String fqn) {
    return getClient().worksheets().getByName(fqn);
  }

  public static Worksheet getByName(String fqn, String fields) {
    return getClient().worksheets().getByName(fqn, fields);
  }

  public static void delete(String id) {
    getClient().worksheets().delete(id);
  }

  public static WorksheetFinder find(String id) {
    return new WorksheetFinder(getClient(), id, false);
  }

  public static WorksheetFinder findByName(String fqn) {
    return new WorksheetFinder(getClient(), fqn, true);
  }

  public static class WorksheetCreator {
    private final OpenMetadataClient client;
    private final CreateWorksheet request = new CreateWorksheet();

    WorksheetCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public WorksheetCreator name(String name) {
      request.setName(name);
      return this;
    }

    public WorksheetCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public WorksheetCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public WorksheetCreator withSpreadsheet(String spreadsheetFqn) {
      request.setSpreadsheet(spreadsheetFqn);
      return this;
    }

    public WorksheetCreator withOwners(List<EntityReference> owners) {
      request.setOwners(owners);
      return this;
    }

    public Worksheet execute() {
      return client.worksheets().create(request);
    }
  }

  public static class WorksheetFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    WorksheetFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public WorksheetFinder withFields(String... fields) {
      includes.addAll(Arrays.asList(fields));
      return this;
    }

    public Worksheet fetch() {
      if (includes.isEmpty()) {
        return isFqn
            ? client.worksheets().getByName(identifier)
            : client.worksheets().get(identifier);
      }
      String fields = String.join(",", includes);
      return isFqn
          ? client.worksheets().getByName(identifier, fields)
          : client.worksheets().get(identifier, fields);
    }
  }
}
