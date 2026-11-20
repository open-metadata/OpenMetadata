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

import static org.openmetadata.service.migration.utils.v209.ServiceSecretPaths.SECRET_PATHS;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Query;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Released versions saved many connection secrets without encryption, mostly the ones below a
 * {@code oneOf} the secrets code could not type. The fixed code encrypts them on the next save and
 * {@code migrate} re-saves every current service, but the copies kept in the version history stay
 * plain text. This masks those copies, in the versions of every service and of every Test
 * Connection workflow.
 *
 * <p>It reads only those version rows of {@code entity_extension}, by extension prefix, and changes
 * only a listed secret ({@link ServiceSecretPaths}) that is still plain text: encrypted and masked
 * values stay as they are, so running it again changes nothing. A {@code secret:} value is masked
 * too: the database secrets manager reads it as part of a password, and a secret manager reference
 * in an old version is never resolved. Old versions cannot be restored, so a masked secret loses
 * nothing; the version endpoints mask these fields anyway.
 *
 * <p>It runs from 2.0.9 and again from 2.1.0, because a database that recorded 2.1.0 before this
 * step existed never runs the 2.0.9 data migration again.
 */
@Slf4j
public final class ServiceVersionSecretsMasking {
  public static final String STEP_NAME = "mask-plain-text-secrets-in-service-versions";

  static final String MASK = "*********";
  private static final String FERNET_PREFIX = "fernet:";
  private static final String VERSION_INFIX = ".version.";
  private static final String WORKFLOW = "workflow";
  private static final String EVERY_ELEMENT = "[]";
  private static final String EVERY_VALUE = "{}";

  /** The service entity type of a Test Connection request, by its {@code serviceType}. */
  private static final Map<String, String> SERVICE_ENTITY_BY_TYPE =
      Map.ofEntries(
          Map.entry("Api", "apiService"),
          Map.entry("Dashboard", "dashboardService"),
          Map.entry("Database", "databaseService"),
          Map.entry("Drive", "driveService"),
          Map.entry("LLM", "llmService"),
          Map.entry("Mcp", "mcpService"),
          Map.entry("Messaging", "messagingService"),
          Map.entry("Metadata", "metadataService"),
          Map.entry("MlModel", "mlmodelService"),
          Map.entry("Pipeline", "pipelineService"),
          Map.entry("Search", "searchService"),
          Map.entry("Security", "securityService"),
          Map.entry("Storage", "storageService"));

  private static final List<String> VERSIONED_TYPES =
      Stream.concat(SECRET_PATHS.keySet().stream(), Stream.of(WORKFLOW)).sorted().toList();

  /** One read of the version rows of every listed type, each filtered on its extension prefix. */
  private static final String KEYS_SQL =
      "SELECT id, extension FROM entity_extension WHERE "
          + VERSIONED_TYPES.stream()
              .map(type -> "extension LIKE :" + type)
              .collect(Collectors.joining(" OR "));

  private static final String JSON_SQL =
      "SELECT json FROM entity_extension WHERE id = :id AND extension = :extension";

  private ServiceVersionSecretsMasking() {}

  record VersionKey(String id, String extension) {
    String entityType() {
      return extension.substring(0, extension.indexOf(VERSION_INFIX));
    }
  }

  /** A stored connection config and the secret paths of its connection type. */
  private record Connection(JsonNode config, List<String> paths) {}

  public static void maskPlainTextSecrets(
      final Handle handle, final ConnectionType connectionType) {
    final List<VersionKey> keys = readVersionKeys(handle);
    int masked = 0;
    for (final VersionKey key : keys) {
      masked += maskVersion(handle, connectionType, key) ? 1 : 0;
    }
    LOG.info("Masked plain text secrets in {} of {} versions", masked, keys.size());
  }

  private static List<VersionKey> readVersionKeys(final Handle handle) {
    final Query query = handle.createQuery(KEYS_SQL);
    VERSIONED_TYPES.forEach(type -> query.bind(type, type + VERSION_INFIX + "%"));
    return query
        .map((rs, ctx) -> new VersionKey(rs.getString("id"), rs.getString("extension")))
        .list();
  }

  private static boolean maskVersion(
      final Handle handle, final ConnectionType connectionType, final VersionKey key) {
    final JsonNode version = JsonUtils.readTree(readJson(handle, key));
    final Connection connection = connection(key.entityType(), version);
    final boolean isMasked =
        connection != null && maskSecrets(connection.config(), connection.paths());
    if (isMasked) {
      update(handle, connectionType, key, JsonUtils.pojoToJson(version));
    }
    return isMasked;
  }

  /**
   * The connection config of a service version, or of a Test Connection workflow's request, with
   * the secret paths of its type. The type is the config's own {@code type}: the paths come from
   * the same schema, while the service type can name a different one.
   */
  private static Connection connection(final String entityType, final JsonNode version) {
    final boolean isWorkflow = WORKFLOW.equals(entityType);
    final JsonNode holder = isWorkflow ? version.path("request") : version;
    final String serviceEntity =
        isWorkflow ? SERVICE_ENTITY_BY_TYPE.get(holder.path("serviceType").asText()) : entityType;
    final JsonNode config = holder.path("connection").path("config");
    final String fallbackType = holder.path(isWorkflow ? "connectionType" : "serviceType").asText();
    final String type = config.path("type").asText(fallbackType);
    // Only Test Connection requests name a service type; any other workflow (e.g. a query runner
    // request) or an unknown type has no listed paths, so it is left as it is.
    final Map<String, List<String>> pathsByType =
        serviceEntity == null ? Map.of() : SECRET_PATHS.getOrDefault(serviceEntity, Map.of());
    final List<String> paths = pathsByType.get(type);
    return paths == null ? null : new Connection(config, paths);
  }

  private static String readJson(final Handle handle, final VersionKey key) {
    return handle
        .createQuery(JSON_SQL)
        .bind("id", key.id())
        .bind("extension", key.extension())
        .mapTo(String.class)
        .one();
  }

  /** Masks every listed secret of one stored connection config that is still plain text. */
  static boolean maskSecrets(final JsonNode config, final List<String> paths) {
    boolean isChanged = false;
    for (final String path : paths) {
      isChanged |= maskPath(config, path.split("/"), 0);
    }
    return isChanged;
  }

  private static boolean maskPath(final JsonNode node, final String[] segments, final int index) {
    boolean isChanged = false;
    final boolean isLeaf = index == segments.length - 1;
    for (final Child child : children(node, segments[index])) {
      isChanged |= isLeaf ? child.maskIfPlainText() : maskPath(child.value(), segments, index + 1);
    }
    return isChanged;
  }

  /** The values a path segment names below {@code node}, each with the container holding it. */
  private static List<Child> children(final JsonNode node, final String segment) {
    final List<Child> children = new ArrayList<>();
    if (EVERY_ELEMENT.equals(segment) && node instanceof ArrayNode array) {
      for (int i = 0; i < array.size(); i++) {
        children.add(new Child(array, null, i));
      }
    } else if (node instanceof ObjectNode object) {
      final List<String> fields =
          EVERY_VALUE.equals(segment)
              ? object.properties().stream().map(Map.Entry::getKey).toList()
              : List.of(segment);
      fields.stream()
          .filter(object::has)
          .forEach(field -> children.add(new Child(object, field, -1)));
    }
    return children;
  }

  /** A value held either by an object under {@code field} or by an array at {@code index}. */
  private record Child(JsonNode container, String field, int index) {
    JsonNode value() {
      return field != null ? container.get(field) : container.get(index);
    }

    boolean maskIfPlainText() {
      final boolean isPlain = isPlainText(value());
      if (isPlain && field != null) {
        ((ObjectNode) container).put(field, MASK);
      } else if (isPlain) {
        ((ArrayNode) container).set(index, MASK);
      }
      return isPlain;
    }
  }

  static boolean isPlainText(final JsonNode value) {
    final String text = value != null && value.isTextual() ? value.asText() : "";
    return !text.isEmpty() && !MASK.equals(text) && !text.startsWith(FERNET_PREFIX);
  }

  private static void update(
      final Handle handle,
      final ConnectionType connectionType,
      final VersionKey key,
      final String json) {
    final String jsonValue =
        connectionType == ConnectionType.POSTGRES ? "CAST(:json AS jsonb)" : ":json";
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
