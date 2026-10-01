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

package org.openmetadata.service.migration.utils.v210;

import com.fasterxml.jackson.databind.JsonNode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.PreparedBatch;
import org.jdbi.v3.core.statement.StatementContext;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.secrets.WorkflowSinkSecrets;
import org.openmetadata.service.util.EntityUtil;

/**
 * Fernet-encrypts plaintext sink secrets of stored workflow definitions: the current definition,
 * its change descriptions and every version snapshot. The definitions that changed are
 * redeployed so their Flowable BPMN carries the ciphertext too. Values already encrypted are left
 * as they are, so running it again changes nothing.
 */
@Slf4j
public final class WorkflowSinkSecretsMigration {
  static final int VERSION_PAGE_SIZE = 500;

  private static final String DELETED = "deleted";
  private static final String FULLY_QUALIFIED_NAME = "fullyQualifiedName";

  private static final String SELECT_DEFINITIONS_MYSQL =
      "SELECT id, json FROM workflow_definition_entity";
  private static final String SELECT_DEFINITIONS_POSTGRES =
      "SELECT id, json::text AS json FROM workflow_definition_entity";
  private static final String UPDATE_DEFINITION_MYSQL =
      "UPDATE workflow_definition_entity SET json = :json WHERE id = :id";
  private static final String UPDATE_DEFINITION_POSTGRES =
      "UPDATE workflow_definition_entity SET json = :json::jsonb WHERE id = :id";
  private static final String VERSION_EXTENSION_PATTERN =
      "%s.%%".formatted(EntityUtil.getVersionExtensionPrefix(Entity.WORKFLOW_DEFINITION));
  private static final String SELECT_VERSIONS =
      """
      SELECT id, extension, %s AS json FROM entity_extension
      WHERE extension LIKE :extensionPattern
        AND (id > :id OR (id = :id AND extension > :extension))
      ORDER BY id, extension LIMIT :pageSize
      """;
  private static final String UPDATE_VERSION_MYSQL =
      "UPDATE entity_extension SET json = :json WHERE id = :id AND extension = :extension";
  private static final String UPDATE_VERSION_POSTGRES =
      "UPDATE entity_extension SET json = :json::jsonb WHERE id = :id AND extension = :extension";

  private WorkflowSinkSecretsMigration() {}

  public static void encryptSinkSecrets(
      Handle handle, ConnectionType connectionType, Runnable initializeWorkflowHandler) {
    if (Fernet.getInstance().isKeyDefined()) {
      List<JsonNode> encrypted = encryptDefinitions(handle, connectionType);
      int versions = encryptVersions(handle, connectionType);
      LOG.info(
          "v210: encrypted the sink secrets of {} workflow definition(s) and {} version(s)",
          encrypted.size(),
          versions);
      redeployActive(encrypted, initializeWorkflowHandler);
    } else {
      LOG.info("v210: no Fernet key is configured; workflow sink secrets are left as stored");
    }
  }

  private static void redeployActive(
      List<JsonNode> definitions, Runnable initializeWorkflowHandler) {
    // A soft-deleted definition has no deployment, and deploying it would revive its trigger.
    List<JsonNode> active =
        definitions.stream().filter(definition -> !definition.path(DELETED).asBoolean()).toList();
    if (!active.isEmpty()) {
      initializeWorkflowHandler.run();
      active.forEach(WorkflowSinkSecretsMigration::redeploy);
    }
  }

  /** Encrypts the stored definitions and returns the JSON of those that held a plaintext secret. */
  static List<JsonNode> encryptDefinitions(Handle handle, ConnectionType connectionType) {
    boolean mysql = connectionType == ConnectionType.MYSQL;
    String select = mysql ? SELECT_DEFINITIONS_MYSQL : SELECT_DEFINITIONS_POSTGRES;
    String update = mysql ? UPDATE_DEFINITION_MYSQL : UPDATE_DEFINITION_POSTGRES;
    List<JsonNode> encrypted = new ArrayList<>();
    for (StoredRow row : handle.createQuery(select).map(StoredRow::read).list()) {
      JsonNode definition = encryptedOrNull(row);
      if (definition != null) {
        handle
            .createUpdate(update)
            .bind("id", row.id())
            .bind("json", definition.toString())
            .execute();
        encrypted.add(definition);
      }
    }
    return encrypted;
  }

  static int encryptVersions(Handle handle, ConnectionType connectionType) {
    boolean mysql = connectionType == ConnectionType.MYSQL;
    String select = SELECT_VERSIONS.formatted(mysql ? "json" : "json::text");
    String update = mysql ? UPDATE_VERSION_MYSQL : UPDATE_VERSION_POSTGRES;
    StoredRow cursor = new StoredRow("", "", null);
    int encrypted = 0;
    List<StoredRow> page;
    do {
      page = versionPage(handle, select, cursor);
      encrypted += encryptPage(handle, update, page);
      cursor = page.isEmpty() ? cursor : page.getLast();
    } while (page.size() == VERSION_PAGE_SIZE);
    return encrypted;
  }

  private static List<StoredRow> versionPage(Handle handle, String select, StoredRow cursor) {
    return handle
        .createQuery(select)
        .bind("id", cursor.id())
        .bind("extension", cursor.extension())
        .bind("extensionPattern", VERSION_EXTENSION_PATTERN)
        .bind("pageSize", VERSION_PAGE_SIZE)
        .map(StoredRow::readVersion)
        .list();
  }

  private static int encryptPage(Handle handle, String update, List<StoredRow> page) {
    PreparedBatch batch = handle.prepareBatch(update);
    int encrypted = 0;
    for (StoredRow row : page) {
      JsonNode version = encryptedOrNull(row);
      if (version != null) {
        batch
            .bind("id", row.id())
            .bind("extension", row.extension())
            .bind("json", version.toString())
            .add();
        encrypted++;
      }
    }
    if (encrypted > 0) {
      batch.execute();
    }
    return encrypted;
  }

  /** The row's JSON with its sink secrets encrypted, or null when it held no plaintext secret. */
  static JsonNode encryptedOrNull(StoredRow row) {
    JsonNode encrypted = null;
    try {
      JsonNode json = JsonUtils.readTree(row.json());
      encrypted = WorkflowSinkSecrets.encrypt(json) ? json : null;
    } catch (JsonParsingException e) {
      LOG.warn(
          "v210: skipping workflow definition row id={} extension={} that could not be read: {}",
          row.id(),
          row.extension(),
          e.getMessage());
    }
    return encrypted;
  }

  private static void redeploy(JsonNode definition) {
    try {
      WorkflowHandler.getInstance()
          .deploy(new Workflow(JsonUtils.treeToValue(definition, WorkflowDefinition.class)));
    } catch (Exception e) {
      LOG.warn(
          "v210: failed to redeploy workflow definition '{}' with encrypted sink secrets",
          definition.path(FULLY_QUALIFIED_NAME).asText(),
          e);
    }
  }

  /** A stored JSON row: a definition (no extension) or one of its version snapshots. */
  record StoredRow(String id, String extension, String json) {
    private static StoredRow read(ResultSet rs, StatementContext ctx) throws SQLException {
      return new StoredRow(rs.getString("id"), null, rs.getString("json"));
    }

    private static StoredRow readVersion(ResultSet rs, StatementContext ctx) throws SQLException {
      return new StoredRow(rs.getString("id"), rs.getString("extension"), rs.getString("json"));
    }
  }
}
