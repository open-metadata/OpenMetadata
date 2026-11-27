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

package org.openmetadata.service.migration.utils.v211;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.stream.StreamSupport;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * Gives the stored SuggestionTaskWorkflow, which seeding never updates once it exists, the 2.1.1
 * owner fallback: a suggestion on an asset nobody owns goes to its service's owners, then its
 * domains' owners, then the admins
 * (ADR:2026-11-20-suggestion-tasks-fall-back-through-every-owner-to-the-admins). The row is
 * changed as a tree; the server deploys the changed workflow when it starts
 * (ADR:2026-11-23-a-changed-workflow-is-deployed-when-the-server-starts).
 */
@Slf4j
public final class SuggestionTaskOwnerFallbackMigration {
  public static final String STEP_NAME = "suggestionTaskOwnerFallback";
  private static final String WORKFLOW_NAME = "SuggestionTaskWorkflow";
  private static final String REVIEW_NODE = "TaskReview";
  private static final String NODES = "nodes";
  private static final String NAME = "name";
  private static final String CONFIG = "config";
  private static final String ASSIGNEES = "assignees";
  private static final String CASCADE_OWNERS = "cascadeOwners";
  private static final String EMPTY_ASSIGNEE_STRATEGY = "emptyAssigneeStrategy";
  private static final String NONE = "none";
  private static final String ASSIGN_ADMINS = "assignAdmins";
  private static final String SELECT_WORKFLOW =
      "SELECT json FROM workflow_definition_entity WHERE name = :name AND deleted = FALSE";
  private static final String UPDATE_MYSQL =
      "UPDATE workflow_definition_entity SET json = :json WHERE name = :name";
  private static final String UPDATE_POSTGRES =
      "UPDATE workflow_definition_entity SET json = CAST(:json AS jsonb) WHERE name = :name";

  private SuggestionTaskOwnerFallbackMigration() {}

  /** A database without the workflow gets it, settings included, from the seed on startup. */
  public static void routeUnownedSuggestionsToOwnersThenAdmins(
      final Handle handle, final ConnectionType connectionType) {
    handle
        .createQuery(SELECT_WORKFLOW)
        .bind(NAME, WORKFLOW_NAME)
        .mapTo(String.class)
        .findOne()
        .map(JsonUtils::readTree)
        .ifPresent(stored -> store(handle, connectionType, stored));
  }

  private static void store(
      final Handle handle, final ConnectionType connectionType, final JsonNode stored) {
    final ObjectNode updated = withOwnerFallback(stored);
    if (!updated.equals(stored)) {
      handle
          .createUpdate(connectionType == ConnectionType.MYSQL ? UPDATE_MYSQL : UPDATE_POSTGRES)
          .bind("json", JsonUtils.pojoToJson(updated))
          .bind(NAME, WORKFLOW_NAME)
          .execute();
      LOG.info("[v211] {} now falls back through every owner to the admins", WORKFLOW_NAME);
    }
  }

  /** {@code stored} with the owner cascade on, and the admin fallback unless an admin chose one. */
  static ObjectNode withOwnerFallback(final JsonNode stored) {
    final ObjectNode workflow = stored.deepCopy();
    final ObjectNode assignees = reviewAssignees(workflow);
    assignees.put(CASCADE_OWNERS, true);
    if (NONE.equals(assignees.path(EMPTY_ASSIGNEE_STRATEGY).asText(NONE))) {
      assignees.put(EMPTY_ASSIGNEE_STRATEGY, ASSIGN_ADMINS);
    }
    return workflow;
  }

  private static ObjectNode reviewAssignees(final ObjectNode workflow) {
    return StreamSupport.stream(workflow.path(NODES).spliterator(), false)
        .filter(node -> REVIEW_NODE.equals(node.path(NAME).asText()))
        .map(node -> node.path(CONFIG).path(ASSIGNEES))
        .filter(JsonNode::isObject)
        .map(ObjectNode.class::cast)
        .findFirst()
        .orElseThrow(
            () ->
                new IllegalStateException(
                    "%s has no %s node with assignees, so its owner fallback cannot be set. Restore %s and run the migration again."
                        .formatted(WORKFLOW_NAME, REVIEW_NODE, REVIEW_NODE)));
  }
}
