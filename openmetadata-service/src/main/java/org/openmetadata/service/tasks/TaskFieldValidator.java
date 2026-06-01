/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.tasks;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.DataAccessRequestPayload;
import org.openmetadata.schema.type.DataAccessType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskAvailableTransition;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

/**
 * Validation helpers for {@link Task} fields. Centralizes assignee/reviewer type checks and
 * payload schema validation so {@link org.openmetadata.service.jdbi3.TaskRepository} stays focused
 * on persistence orchestration.
 */
public final class TaskFieldValidator {

  private static final String POLICY_AGENT_CONFIG_KEY = "policyAgentConfig";
  private static final String POLICY_AGENT_ENABLED = "enabled";
  private static final String SUPPORTS_FULL_ACCESS = "supportsFullAccess";
  private static final String SUPPORTS_COLUMN_ACCESS = "supportsColumnAccess";
  private static final String SUPPORTS_MASKED_ACCESS = "supportsMaskedAccess";

  private TaskFieldValidator() {}

  /**
   * Verify every assignee is a user or team. Throws {@link IllegalArgumentException} otherwise.
   */
  public static void validateAssignees(List<EntityReference> assignees) {
    validateUsersOrTeams(assignees, "Task can only be assigned to users or teams. Found: ");
  }

  /**
   * Verify every reviewer is a user or team. Throws {@link IllegalArgumentException} otherwise.
   */
  public static void validateReviewers(List<EntityReference> reviewers) {
    validateUsersOrTeams(reviewers, "Task reviewers must be users or teams. Found: ");
  }

  private static void validateUsersOrTeams(List<EntityReference> refs, String errorPrefix) {
    for (EntityReference ref : listOrEmpty(refs)) {
      String type = ref.getType();
      if (!Entity.USER.equals(type) && !Entity.TEAM.equals(type)) {
        throw new IllegalArgumentException(errorPrefix + type);
      }
    }
  }

  /**
   * Validate the task's creation-time payload against the form schema bound to its type.
   * No-op when the task has no type or no schema is configured.
   */
  public static void validatePayloadAgainstFormSchema(Task task) {
    if (task.getType() == null) {
      return;
    }
    TaskWorkflowLifecycleResolver.resolveBinding(task)
        .ifPresent(
            binding ->
                TaskFormSchemaValidator.validatePayload(
                    binding.createFormSchema(), task.getPayload()));
  }

  /**
   * Enforce the connector-advertised access-policy capabilities for a Data Access Request.
   *
   * <p>For database-family targets (table, databaseSchema, database, storedProcedure) the request's
   * accessType is checked against the owning service's {@code policyAgentConfig}: if the agent is
   * enabled, the matching support flag ({@code supportsFullAccess}, {@code supportsColumnAccess},
   * {@code supportsMaskedAccess}) must be true. Services with no {@code policyAgentConfig}
   * configured (or {@code enabled=false}) allow every access type so legacy services keep working.
   *
   * <p>For Data Product targets the catalog cannot resolve a single backing service, so column-
   * level access is rejected up front; Full and Masked are accepted and any masking gap surfaces
   * during ingestion-time policy extraction.
   *
   * <p>Non-data assets (dashboard, topic, container, ...) are not validated here.
   */
  public static void validateDataAccessCapabilities(Task task) {
    if (task.getType() != TaskEntityType.DataAccessRequest) {
      return;
    }
    EntityReference about = task.getAbout();
    if (about == null || nullOrEmpty(about.getType())) {
      return;
    }
    DataAccessRequestPayload payload = readDataAccessPayload(task.getPayload());
    if (payload == null || payload.getAccessType() == null) {
      return;
    }
    DataAccessType accessType = payload.getAccessType();
    String aboutType = about.getType();

    if (Entity.DATA_PRODUCT.equals(aboutType)) {
      rejectColumnLevelForDataProduct(accessType);
    } else if (isDatabaseFamilyEntity(aboutType)) {
      enforceConnectorCapability(about, accessType);
    }
  }

  private static DataAccessRequestPayload readDataAccessPayload(Object payload) {
    DataAccessRequestPayload result = null;
    if (payload != null) {
      try {
        result = JsonUtils.convertValue(payload, DataAccessRequestPayload.class);
      } catch (IllegalArgumentException ignored) {
        result = null;
      }
    }
    return result;
  }

  private static boolean isDatabaseFamilyEntity(String type) {
    return Entity.TABLE.equals(type)
        || Entity.DATABASE_SCHEMA.equals(type)
        || Entity.DATABASE.equals(type)
        || Entity.STORED_PROCEDURE.equals(type);
  }

  private static void rejectColumnLevelForDataProduct(DataAccessType accessType) {
    if (accessType == DataAccessType.ColumnLevel) {
      throw new IllegalArgumentException(
          "Column-level access is not supported for Data Products. "
              + "Request FullAccess or Masked instead.");
    }
  }

  private static void enforceConnectorCapability(EntityReference about, DataAccessType accessType) {
    Map<String, Object> policyAgent = resolvePolicyAgentConfig(about);
    if (!isAgentEnabled(policyAgent)) {
      return;
    }
    String capabilityFlag = capabilityFlagFor(accessType);
    if (capabilityFlag != null && !flagIsTrue(policyAgent, capabilityFlag)) {
      throw new IllegalArgumentException(
          String.format(
              "%s is not supported by the connector for '%s'.",
              accessTypeLabel(accessType), targetLabel(about)));
    }
  }

  private static String targetLabel(EntityReference about) {
    return nullOrEmpty(about.getFullyQualifiedName())
        ? about.getName()
        : about.getFullyQualifiedName();
  }

  private static boolean isAgentEnabled(Map<String, Object> policyAgent) {
    return policyAgent != null && flagIsTrue(policyAgent, POLICY_AGENT_ENABLED);
  }

  private static boolean flagIsTrue(Map<String, Object> policyAgent, String flag) {
    Object value = policyAgent.get(flag);
    return value instanceof Boolean && (Boolean) value;
  }

  private static String capabilityFlagFor(DataAccessType accessType) {
    String result = null;
    switch (accessType) {
      case FullAccess -> result = SUPPORTS_FULL_ACCESS;
      case ColumnLevel -> result = SUPPORTS_COLUMN_ACCESS;
      case Masked -> result = SUPPORTS_MASKED_ACCESS;
    }
    return result;
  }

  private static String accessTypeLabel(DataAccessType accessType) {
    String result = accessType.value();
    switch (accessType) {
      case FullAccess -> result = "Full access";
      case ColumnLevel -> result = "Column-level access";
      case Masked -> result = "Masked access";
    }
    return result;
  }

  private static Map<String, Object> resolvePolicyAgentConfig(EntityReference about) {
    Map<String, Object> result = null;
    EntityReference serviceRef = resolveDatabaseServiceRef(about);
    if (serviceRef != null) {
      DatabaseService service = loadDatabaseService(serviceRef);
      result = extractPolicyAgentMap(service);
    }
    return result;
  }

  private static DatabaseService loadDatabaseService(EntityReference serviceRef) {
    DatabaseService result = null;
    try {
      result = Entity.getEntity(serviceRef, "", Include.NON_DELETED);
    } catch (EntityNotFoundException ignored) {
      result = null;
    }
    return result;
  }

  private static Map<String, Object> extractPolicyAgentMap(DatabaseService service) {
    Map<String, Object> result = null;
    Object config =
        (service != null && service.getConnection() != null)
            ? service.getConnection().getConfig()
            : null;
    if (config != null) {
      try {
        Map<String, Object> configMap = JsonUtils.getMap(config);
        Object policyConfig = configMap.get(POLICY_AGENT_CONFIG_KEY);
        if (policyConfig != null) {
          result = JsonUtils.getMap(policyConfig);
        }
      } catch (IllegalArgumentException ignored) {
        result = null;
      }
    }
    return result;
  }

  private static EntityReference resolveDatabaseServiceRef(EntityReference about) {
    EntityReference result = null;
    if (about.getId() != null) {
      try {
        result = lookupServiceRefByType(about);
      } catch (EntityNotFoundException ignored) {
        result = null;
      }
    }
    return result;
  }

  private static EntityReference lookupServiceRefByType(EntityReference about) {
    EntityReference result = null;
    switch (about.getType()) {
      case Entity.TABLE -> {
        org.openmetadata.schema.entity.data.Table table =
            Entity.getEntity(Entity.TABLE, about.getId(), "service", Include.NON_DELETED);
        result = table.getService();
      }
      case Entity.STORED_PROCEDURE -> {
        org.openmetadata.schema.entity.data.StoredProcedure proc =
            Entity.getEntity(
                Entity.STORED_PROCEDURE, about.getId(), "service", Include.NON_DELETED);
        result = proc.getService();
      }
      case Entity.DATABASE_SCHEMA -> {
        org.openmetadata.schema.entity.data.DatabaseSchema schema =
            Entity.getEntity(Entity.DATABASE_SCHEMA, about.getId(), "service", Include.NON_DELETED);
        result = schema.getService();
      }
      case Entity.DATABASE -> {
        org.openmetadata.schema.entity.data.Database database =
            Entity.getEntity(Entity.DATABASE, about.getId(), "service", Include.NON_DELETED);
        result = database.getService();
      }
      default -> result = null;
    }
    return result;
  }

  /**
   * Validate the resolution-time payload (or new-value override) against the transition form
   * schema. No-op when the task has no type or no resolution data is provided.
   */
  public static void validateResolutionPayloadAgainstFormSchema(
      Task task, String transitionId, Object resolvedPayload, String newValue) {
    if (task.getType() == null) {
      return;
    }
    if (resolvedPayload == null && newValue == null) {
      return;
    }

    TaskWorkflowLifecycleResolver.resolveSchema(task)
        .ifPresent(
            schema -> {
              TaskAvailableTransition transition =
                  TaskWorkflowLifecycleResolver.findTransition(task, transitionId);
              Object transitionSchema =
                  TaskWorkflowLifecycleResolver.resolveTransitionFormSchema(
                      schema, transitionId, transition);
              TaskFormSchemaValidator.validatePayload(
                  transitionSchema,
                  TaskWorkflowHandler.mergeResolutionPayload(task, resolvedPayload, newValue));
            });
  }
}
