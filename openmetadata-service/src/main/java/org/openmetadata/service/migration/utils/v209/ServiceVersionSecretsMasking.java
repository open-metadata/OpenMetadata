/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.migration.utils.v209;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Query;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Some secrets of a few connectors sat below a {@code oneOf} the secrets code could not type, so
 * they were saved without encryption. The fixed code encrypts them on the next save and {@code
 * migrate} re-saves every current service, but the copies kept in the version history stay plain
 * text. This masks those copies.
 *
 * <p>It reads only the service version rows of {@code entity_extension} and changes only a listed
 * secret that is still plain text: encrypted values, secret manager references and masked values
 * stay as they are, so running it again changes nothing. Old versions cannot be restored, so a
 * masked secret loses nothing; the version endpoints mask these fields anyway.
 */
@Slf4j
public final class ServiceVersionSecretsMasking {
  public static final String STEP_NAME = "mask-plain-text-secrets-in-service-versions";

  static final String MASK = "*********";
  private static final String FERNET_PREFIX = "fernet:";
  private static final String SECRET_REFERENCE_PREFIX = "secret:";
  private static final String VERSION_INFIX = ".version.";
  private static final String SERVICE_TYPE = "serviceType";

  private static final List<String> SUPERSET_SECRETS =
      List.of(
          "connection/sslConfig/caCertificate",
          "connection/sslConfig/sslCertificate",
          "connection/sslConfig/sslKey",
          "connection/authType/password",
          "connection/authType/gcpConfig/gcpConfig/privateKey");

  /**
   * The secrets that were left unencrypted, by service entity type and then service type, each a
   * path below {@code connection.config}.
   */
  static final Map<String, Map<String, List<String>>> SECRET_PATHS =
      Map.of(
          "pipelineService",
          Map.of(
              "DatabricksPipeline",
              List.of("authType/token", "authType/clientSecret", "authType/azureClientSecret")),
          "dashboardService",
          Map.of(
              "PowerBI",
              List.of("pbitFilesSource/securityConfig/gcpConfig/privateKey"),
              "Superset",
              SUPERSET_SECRETS),
          "databaseService",
          Map.of("Mysql", List.of("authType/password", "authType/gcpConfig/gcpConfig/privateKey")));

  /** One read of the version rows of the listed service types, by the indexed extension prefix. */
  private static final String KEYS_SQL =
      "SELECT id, extension FROM entity_extension WHERE extension LIKE :pipelineService"
          + " OR extension LIKE :dashboardService OR extension LIKE :databaseService";

  private static final String JSON_SQL =
      "SELECT json FROM entity_extension WHERE id = :id AND extension = :extension";

  private ServiceVersionSecretsMasking() {}

  record VersionKey(String id, String extension) {
    String entityType() {
      return extension.substring(0, extension.indexOf(VERSION_INFIX));
    }
  }

  public static void maskPlainTextSecrets(Handle handle, ConnectionType connectionType) {
    List<VersionKey> keys = readVersionKeys(handle);
    int masked = 0;
    for (VersionKey key : keys) {
      masked += maskVersion(handle, connectionType, key) ? 1 : 0;
    }
    LOG.info("Masked plain text secrets in {} of {} service versions", masked, keys.size());
  }

  private static List<VersionKey> readVersionKeys(Handle handle) {
    Query query = handle.createQuery(KEYS_SQL);
    SECRET_PATHS.keySet().forEach(type -> query.bind(type, type + VERSION_INFIX + "%"));
    return query
        .map((rs, ctx) -> new VersionKey(rs.getString("id"), rs.getString("extension")))
        .list();
  }

  private static boolean maskVersion(Handle handle, ConnectionType connectionType, VersionKey key) {
    JsonNode version = JsonUtils.readTree(readJson(handle, key));
    List<String> paths =
        SECRET_PATHS.get(key.entityType()).get(version.path(SERVICE_TYPE).asText());
    boolean masked = paths != null && maskSecrets(version, paths);
    if (masked) {
      update(handle, connectionType, key, JsonUtils.pojoToJson(version));
    }
    return masked;
  }

  private static String readJson(Handle handle, VersionKey key) {
    return handle
        .createQuery(JSON_SQL)
        .bind("id", key.id())
        .bind("extension", key.extension())
        .mapTo(String.class)
        .one();
  }

  /** Masks every listed secret of one stored version that is still plain text. */
  static boolean maskSecrets(JsonNode version, List<String> paths) {
    JsonNode config = version.path("connection").path("config");
    boolean changed = false;
    for (String path : paths) {
      changed |= maskSecret(config, path);
    }
    return changed;
  }

  private static boolean maskSecret(JsonNode config, String path) {
    int split = path.lastIndexOf('/');
    JsonNode parent = config.at("/" + path.substring(0, split));
    String field = path.substring(split + 1);
    boolean plainText = parent instanceof ObjectNode && isPlainText(parent.get(field));
    if (plainText) {
      ((ObjectNode) parent).put(field, MASK);
    }
    return plainText;
  }

  static boolean isPlainText(JsonNode value) {
    String text = value != null && value.isTextual() ? value.asText() : "";
    return !text.isEmpty()
        && !MASK.equals(text)
        && !text.startsWith(FERNET_PREFIX)
        && !text.startsWith(SECRET_REFERENCE_PREFIX);
  }

  private static void update(
      Handle handle, ConnectionType connectionType, VersionKey key, String json) {
    String jsonValue = connectionType == ConnectionType.POSTGRES ? "CAST(:json AS jsonb)" : ":json";
    handle
        .createUpdate(
            "UPDATE entity_extension SET json = "
                + jsonValue
                + " WHERE id = :id AND extension = :extension")
        .bind("json", json)
        .bind("id", key.id())
        .bind("extension", key.extension())
        .execute();
  }
}
