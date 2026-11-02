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
  private static final String MLFLOW = "Mlflow";
  private static final String TERADATA = "Teradata";
  private static final String ID = "id";
  private static final String EXTENSION = "extension";
  private static final String JSON = "json";

  private record Service(String table, String versionPrefix, String connectionType) {}

  private record Snapshot(String id, String extension, String json) {}

  private static final List<Service> SERVICES =
      List.of(
          new Service("mlmodel_service_entity", "mlmodelService.version.%", MLFLOW),
          new Service("dbservice_entity", "databaseService.version.%", TERADATA));

  private ConnectionSecretsEncryptionMigration() {}

  public static void encryptConnectionSecrets(
      final Handle handle, final ConnectionType connectionType) {
    if (!Fernet.getInstance().isKeyDefined()) {
      LOG.info("No Fernet key is configured; connection secrets stay as stored");
      return;
    }
    for (final Service service : SERVICES) {
      final int current = encryptCurrent(handle, connectionType, service);
      final int history = encryptHistory(handle, connectionType, service);
      LOG.info(
          "Encrypted connection secrets in {} current rows and {} snapshots for {}",
          current,
          history,
          service.table());
    }
  }

  private static int encryptCurrent(
      final Handle handle, final ConnectionType connectionType, final Service service) {
    String afterId = "";
    int encrypted = 0;
    List<Snapshot> rows;
    do {
      rows = currentBatch(handle, connectionType, service, afterId);
      for (final Snapshot row : rows) {
        encrypted += encryptRow(handle, connectionType, service.table(), row);
        afterId = row.id();
      }
    } while (rows.size() == BATCH_SIZE);
    return encrypted;
  }

  private static List<Snapshot> currentBatch(
      final Handle handle,
      final ConnectionType connectionType,
      final Service service,
      final String afterId) {
    return handle
        .createQuery(
            "SELECT id, json FROM "
                + service.table()
                + " WHERE "
                + connectorFilter(connectionType)
                + " AND id > :afterId ORDER BY id LIMIT :limit")
        .bind("connectionType", service.connectionType())
        .bind("afterId", afterId)
        .bind("limit", BATCH_SIZE)
        .map((row, ctx) -> new Snapshot(row.getString(ID), null, row.getString(JSON)))
        .list();
  }

  private static int encryptHistory(
      final Handle handle, final ConnectionType connectionType, final Service service) {
    Snapshot cursor = new Snapshot("", "", null);
    int encrypted = 0;
    List<Snapshot> rows;
    do {
      rows = historyBatch(handle, connectionType, service, cursor);
      for (final Snapshot row : rows) {
        encrypted += encryptRow(handle, connectionType, "entity_extension", row);
        cursor = row;
      }
    } while (rows.size() == BATCH_SIZE);
    return encrypted;
  }

  private static List<Snapshot> historyBatch(
      final Handle handle,
      final ConnectionType connectionType,
      final Service service,
      final Snapshot cursor) {
    return handle
        .createQuery(
            "SELECT id, extension, json FROM entity_extension WHERE extension LIKE :prefix"
                + " AND "
                + connectorFilter(connectionType)
                + " AND (id > :afterId OR (id = :afterId AND extension > :afterExtension))"
                + " ORDER BY id, extension LIMIT :limit")
        .bind("prefix", service.versionPrefix())
        .bind("connectionType", service.connectionType())
        .bind("afterId", cursor.id())
        .bind("afterExtension", cursor.extension())
        .bind("limit", BATCH_SIZE)
        .map(
            (row, ctx) ->
                new Snapshot(row.getString(ID), row.getString(EXTENSION), row.getString(JSON)))
        .list();
  }

  private static String connectorFilter(final ConnectionType connectionType) {
    return connectionType == ConnectionType.POSTGRES
        ? "json #>> '{connection,config,type}' = :connectionType"
        : "JSON_UNQUOTE(JSON_EXTRACT(json, '$.connection.config.type')) = :connectionType";
  }

  private static int encryptRow(
      final Handle handle,
      final ConnectionType connectionType,
      final String table,
      final Snapshot row) {
    final String encrypted = encrypted(row.json());
    if (encrypted.equals(row.json())) {
      return 0;
    }
    final String value =
        connectionType == ConnectionType.POSTGRES ? "CAST(:json AS jsonb)" : ":json";
    final var update =
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

  static String encrypted(final String json) {
    final JsonNode entity = JsonUtils.readTree(json);
    final JsonNode config = entity.at("/connection/config");
    final String field =
        switch (config.path("type").asText()) {
          case MLFLOW -> "registryUri";
          case TERADATA -> "logdata";
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
