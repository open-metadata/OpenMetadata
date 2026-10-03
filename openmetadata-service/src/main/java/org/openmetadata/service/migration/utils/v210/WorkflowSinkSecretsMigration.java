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
import java.util.List;
import java.util.Optional;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Stream;
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
import org.openmetadata.service.secrets.masker.WorkflowDefinitionMasker;
import org.openmetadata.service.util.EntityUtil;

/**
 * Fernet-encrypts plaintext sink secrets of stored workflow definitions: the current definition,
 * its change descriptions and every version snapshot. Every active definition with a sink secret is
 * then redeployed so its Flowable BPMN carries the ciphertext, including one an earlier run
 * encrypted but could not redeploy. Values already encrypted are left as they are, so running it
 * again changes no stored row. A redeploy that fails is logged and does not fail the upgrade.
 */
@Slf4j
public final class WorkflowSinkSecretsMigration {
  static final int PAGE_SIZE = 500;
  static final String REDEPLOY_ENDPOINT = "/v1/governance/workflowDefinitions/{id}/redeploy";

  private static final String REDEPLOY_ABORTED_MESSAGE =
      """
      v210: could not redeploy the workflow definitions with sink secrets; each keeps its \
      previous deployment until it is redeployed with POST {}\
      """;
  private static final String REDEPLOY_FAILED_MESSAGE =
      """
      v210: {} workflow definition(s) with sink secrets could not be redeployed and keep their \
      previous deployment until each is redeployed with POST {}: {}\
      """;
  private static final StoredRow FIRST_PAGE = new StoredRow("", "", null);
  private static final String SELECT_DEFINITIONS =
      """
      SELECT id, %s AS json FROM workflow_definition_entity
      WHERE id > :id ORDER BY id LIMIT :pageSize
      """;
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
      int definitions = encryptDefinitions(handle, connectionType);
      int versions = encryptVersions(handle, connectionType);
      LOG.info(
          "v210: encrypted the sink secrets of {} workflow definition(s) and {} version(s)",
          definitions,
          versions);
      redeploySinkWorkflows(
          cursor -> definitionPage(handle, connectionType, cursor),
          initializeWorkflowHandler,
          WorkflowSinkSecretsMigration::deploy);
    } else {
      LOG.info("v210: no Fernet key is configured; workflow sink secrets are left as stored");
    }
  }

  static int encryptDefinitions(Handle handle, ConnectionType connectionType) {
    String update =
        connectionType == ConnectionType.MYSQL
            ? UPDATE_DEFINITION_MYSQL
            : UPDATE_DEFINITION_POSTGRES;
    return foldPages(
        cursor -> definitionPage(handle, connectionType, cursor),
        0,
        (encrypted, page) -> encrypted + encryptPage(handle, update, page));
  }

  static int encryptVersions(Handle handle, ConnectionType connectionType) {
    boolean mysql = connectionType == ConnectionType.MYSQL;
    String select = SELECT_VERSIONS.formatted(mysql ? "json" : "json::text");
    String update = mysql ? UPDATE_VERSION_MYSQL : UPDATE_VERSION_POSTGRES;
    return foldPages(
        cursor -> versionPage(handle, select, cursor),
        0,
        (encrypted, page) -> encrypted + encryptPage(handle, update, page));
  }

  /**
   * Redeploys, page by page, every stored definition that is not deleted and holds a sink secret.
   * The workflow handler is initialized before the first redeploy only, so an installation without
   * sink workflows never starts it. Neither a failed initialization nor a failed redeploy is
   * thrown: both are logged with the endpoint that redeploys a definition by hand.
   *
   * @return the definitions that could not be redeployed, as {@code name (id): cause}
   */
  static List<String> redeploySinkWorkflows(
      Function<StoredRow, List<StoredRow>> pageAfter,
      Runnable initializeWorkflowHandler,
      Consumer<WorkflowDefinition> deployer) {
    OnceRunnable initializeOnce = new OnceRunnable(initializeWorkflowHandler);
    List<String> failed = List.of();
    try {
      failed =
          foldPages(
              pageAfter,
              List.of(),
              (failedSoFar, page) ->
                  Stream.concat(failedSoFar.stream(), redeployPage(page, initializeOnce, deployer))
                      .toList());
      logFailedRedeploys(failed);
    } catch (RuntimeException e) {
      LOG.error(REDEPLOY_ABORTED_MESSAGE, REDEPLOY_ENDPOINT, e);
    }
    return failed;
  }

  private static Stream<String> redeployPage(
      List<StoredRow> page, Runnable initializeOnce, Consumer<WorkflowDefinition> deployer) {
    List<WorkflowDefinition> candidates =
        page.stream()
            .map(WorkflowSinkSecretsMigration::redeployCandidate)
            .flatMap(Optional::stream)
            .toList();
    if (!candidates.isEmpty()) {
      initializeOnce.run();
    }
    return candidates.stream()
        .map(definition -> redeployFailure(definition, deployer))
        .flatMap(Optional::stream);
  }

  /** The stored definition when it is not deleted and holds a sink secret. */
  static Optional<WorkflowDefinition> redeployCandidate(StoredRow row) {
    Optional<WorkflowDefinition> candidate = Optional.empty();
    try {
      WorkflowDefinition definition = JsonUtils.readValue(row.json(), WorkflowDefinition.class);
      // A soft-deleted definition has no deployment, and deploying it would revive its trigger.
      boolean isActive = !Boolean.TRUE.equals(definition.getDeleted());
      candidate =
          Optional.of(definition)
              .filter(stored -> isActive && WorkflowDefinitionMasker.hasSinkSecrets(stored));
    } catch (JsonParsingException e) {
      LOG.warn(
          "v210: not redeploying workflow definition row id={} that could not be read: {}",
          row.id(),
          e.getMessage());
    }
    return candidate;
  }

  /** Redeploys {@code definition}; returns {@code name (id): cause} when that fails. */
  private static Optional<String> redeployFailure(
      WorkflowDefinition definition, Consumer<WorkflowDefinition> deployer) {
    Optional<String> failure = Optional.empty();
    try {
      deployer.accept(definition);
    } catch (RuntimeException e) {
      LOG.debug("v210: failed to redeploy workflow definition '{}'", definition.getName(), e);
      failure =
          Optional.of(
              "%s (%s): %s".formatted(definition.getName(), definition.getId(), e.getMessage()));
    }
    return failure;
  }

  private static void logFailedRedeploys(List<String> failed) {
    if (!failed.isEmpty()) {
      LOG.warn(REDEPLOY_FAILED_MESSAGE, failed.size(), REDEPLOY_ENDPOINT, failed);
    }
  }

  private static void deploy(WorkflowDefinition definition) {
    WorkflowHandler.getInstance().deploy(new Workflow(definition));
  }

  /**
   * Folds {@code step} over the keyset pages {@code pageAfter} returns: each page starts after the
   * last row of the one before, and a page shorter than {@link #PAGE_SIZE} is the last.
   */
  static <R> R foldPages(
      Function<StoredRow, List<StoredRow>> pageAfter,
      R initial,
      BiFunction<R, List<StoredRow>, R> step) {
    R folded = initial;
    StoredRow cursor = FIRST_PAGE;
    List<StoredRow> page;
    do {
      page = pageAfter.apply(cursor);
      folded = step.apply(folded, page);
      cursor = page.isEmpty() ? cursor : page.getLast();
    } while (page.size() == PAGE_SIZE);
    return folded;
  }

  private static List<StoredRow> definitionPage(
      Handle handle, ConnectionType connectionType, StoredRow cursor) {
    String json = connectionType == ConnectionType.MYSQL ? "json" : "json::text";
    return handle
        .createQuery(SELECT_DEFINITIONS.formatted(json))
        .bind("id", cursor.id())
        .bind("pageSize", PAGE_SIZE)
        .map(StoredRow::read)
        .list();
  }

  private static List<StoredRow> versionPage(Handle handle, String select, StoredRow cursor) {
    return handle
        .createQuery(select)
        .bind("id", cursor.id())
        .bind("extension", cursor.extension())
        .bind("extensionPattern", VERSION_EXTENSION_PATTERN)
        .bind("pageSize", PAGE_SIZE)
        .map(StoredRow::readVersion)
        .list();
  }

  private static int encryptPage(Handle handle, String update, List<StoredRow> page) {
    PreparedBatch batch = handle.prepareBatch(update);
    int encrypted = 0;
    for (StoredRow row : page) {
      JsonNode json = encryptedOrNull(row);
      if (json != null) {
        bindRow(batch, row, json).add();
        encrypted++;
      }
    }
    if (encrypted > 0) {
      batch.execute();
    }
    return encrypted;
  }

  private static PreparedBatch bindRow(PreparedBatch batch, StoredRow row, JsonNode json) {
    batch.bind("id", row.id()).bind("json", json.toString());
    // A definition row has no extension; only its version snapshots are keyed by one.
    if (row.extension() != null) {
      batch.bind("extension", row.extension());
    }
    return batch;
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

  /** A stored JSON row: a definition (no extension) or one of its version snapshots. */
  record StoredRow(String id, String extension, String json) {
    private static StoredRow read(ResultSet rs, StatementContext ctx) throws SQLException {
      return new StoredRow(rs.getString("id"), null, rs.getString("json"));
    }

    private static StoredRow readVersion(ResultSet rs, StatementContext ctx) throws SQLException {
      return new StoredRow(rs.getString("id"), rs.getString("extension"), rs.getString("json"));
    }
  }

  /** Runs its action the first time it is run and does nothing after that. */
  private static final class OnceRunnable implements Runnable {
    private final Runnable action;
    private boolean hasRun;

    OnceRunnable(Runnable action) {
      this.action = action;
    }

    @Override
    public void run() {
      if (!hasRun) {
        action.run();
        hasRun = true;
      }
    }
  }
}
