package org.openmetadata.service.migration.utils.v208;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/** Encrypts legacy MLflow and Teradata connection secrets in current rows and version snapshots. */
@Slf4j
public final class ConnectionSecretsEncryptionMigration {
  public static final String STEP_NAME = "encrypt-mlflow-teradata-connection-secrets";
  private static final int BATCH_SIZE = 500;
  private static final String ID = "id";
  private static final String EXTENSION = "extension";
  private static final String JSON = "json";

  private record Service(String table, String versionPrefix) {}

  private record Snapshot(String id, String extension, String json) {}

  private static final List<Service> SERVICES =
      List.of(
          new Service("mlmodel_service_entity", "mlmodelService.version.%"),
          new Service("dbservice_entity", "databaseService.version.%"));

  private ConnectionSecretsEncryptionMigration() {}

  public static void encryptConnectionSecrets(Handle handle, ConnectionType connectionType) {
    for (Service service : SERVICES) {
      int current = encryptCurrent(handle, connectionType, service);
      int history = encryptHistory(handle, connectionType, service.versionPrefix());
      LOG.info(
          "Encrypted connection secrets in {} current rows and {} snapshots for {}",
          current,
          history,
          service.table());
    }
  }

  private static int encryptCurrent(Handle handle, ConnectionType connectionType, Service service) {
    String afterId = "";
    int encrypted = 0;
    List<Snapshot> rows;
    do {
      rows = currentBatch(handle, service.table(), afterId);
      for (Snapshot row : rows) {
        encrypted += encryptRow(handle, connectionType, service.table(), row);
        afterId = row.id();
      }
    } while (rows.size() == BATCH_SIZE);
    return encrypted;
  }

  private static List<Snapshot> currentBatch(Handle handle, String table, String afterId) {
    return handle
        .createQuery(
            "SELECT id, json FROM " + table + " WHERE id > :afterId ORDER BY id LIMIT :limit")
        .bind("afterId", afterId)
        .bind("limit", BATCH_SIZE)
        .map((row, ctx) -> new Snapshot(row.getString(ID), null, row.getString(JSON)))
        .list();
  }

  private static int encryptHistory(Handle handle, ConnectionType connectionType, String prefix) {
    Snapshot cursor = new Snapshot("", "", null);
    int encrypted = 0;
    List<Snapshot> rows;
    do {
      rows = historyBatch(handle, prefix, cursor);
      for (Snapshot row : rows) {
        encrypted += encryptRow(handle, connectionType, "entity_extension", row);
        cursor = row;
      }
    } while (rows.size() == BATCH_SIZE);
    return encrypted;
  }

  private static List<Snapshot> historyBatch(Handle handle, String prefix, Snapshot cursor) {
    return handle
        .createQuery(
            "SELECT id, extension, json FROM entity_extension WHERE extension LIKE :prefix"
                + " AND (id > :afterId OR (id = :afterId AND extension > :afterExtension))"
                + " ORDER BY id, extension LIMIT :limit")
        .bind("prefix", prefix)
        .bind("afterId", cursor.id())
        .bind("afterExtension", cursor.extension())
        .bind("limit", BATCH_SIZE)
        .map(
            (row, ctx) ->
                new Snapshot(row.getString(ID), row.getString(EXTENSION), row.getString(JSON)))
        .list();
  }

  private static int encryptRow(
      Handle handle, ConnectionType connectionType, String table, Snapshot row) {
    String encrypted = encrypted(row.json());
    if (encrypted.equals(row.json())) {
      return 0;
    }
    String value = connectionType == ConnectionType.POSTGRES ? "CAST(:json AS jsonb)" : ":json";
    var update =
        handle
            .createUpdate(
                "UPDATE "
                    + table
                    + " SET json = "
                    + value
                    + " WHERE id = :id"
                    + (row.extension() == null ? "" : " AND extension = :extension"))
            .bind(ID, row.id())
            .bind(JSON, encrypted);
    if (row.extension() != null) {
      update.bind(EXTENSION, row.extension());
    }
    return update.execute();
  }

  static String encrypted(String json) {
    JsonNode entity = JsonUtils.readTree(json);
    JsonNode config = entity.at("/connection/config");
    String field =
        switch (config.path("type").asText()) {
          case "Mlflow" -> "registryUri";
          case "Teradata" -> "logdata";
          default -> null;
        };
    if (field != null
        && config.path(field).isTextual()
        && !Fernet.isTokenized(config.path(field).asText())) {
      // History stays local: uploading an old value to the current secret id would replace it.
      ((ObjectNode) config).put(field, Fernet.getInstance().encrypt(config.path(field).asText()));
      return entity.toString();
    }
    return json;
  }
}
