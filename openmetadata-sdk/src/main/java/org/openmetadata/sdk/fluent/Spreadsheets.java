package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.CreateSpreadsheet;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;

public final class Spreadsheets {
  private static OpenMetadataClient defaultClient;

  private Spreadsheets() {}

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Spreadsheets.setDefaultClient() first.");
    }
    return defaultClient;
  }

  public static SpreadsheetCreator create() {
    return new SpreadsheetCreator(getClient());
  }

  public static Spreadsheet get(String id) {
    return getClient().spreadsheets().get(id);
  }

  public static Spreadsheet getByName(String fqn) {
    return getClient().spreadsheets().getByName(fqn);
  }

  public static Spreadsheet getByName(String fqn, String fields) {
    return getClient().spreadsheets().getByName(fqn, fields);
  }

  public static void delete(String id) {
    getClient().spreadsheets().delete(id);
  }

  public static SpreadsheetFinder find(String id) {
    return new SpreadsheetFinder(getClient(), id, false);
  }

  public static SpreadsheetFinder findByName(String fqn) {
    return new SpreadsheetFinder(getClient(), fqn, true);
  }

  public static class SpreadsheetCreator {
    private final OpenMetadataClient client;
    private final CreateSpreadsheet request = new CreateSpreadsheet();

    SpreadsheetCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public SpreadsheetCreator name(String name) {
      request.setName(name);
      return this;
    }

    public SpreadsheetCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public SpreadsheetCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public SpreadsheetCreator withService(String serviceFqn) {
      request.setService(serviceFqn);
      return this;
    }

    public SpreadsheetCreator withOwners(List<EntityReference> owners) {
      request.setOwners(owners);
      return this;
    }

    public Spreadsheet execute() {
      return client.spreadsheets().create(request);
    }
  }

  public static class SpreadsheetFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    SpreadsheetFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public SpreadsheetFinder withFields(String... fields) {
      includes.addAll(Arrays.asList(fields));
      return this;
    }

    public Spreadsheet fetch() {
      if (includes.isEmpty()) {
        return isFqn
            ? client.spreadsheets().getByName(identifier)
            : client.spreadsheets().get(identifier);
      }
      String fields = String.join(",", includes);
      return isFqn
          ? client.spreadsheets().getByName(identifier, fields)
          : client.spreadsheets().get(identifier, fields);
    }
  }
}
