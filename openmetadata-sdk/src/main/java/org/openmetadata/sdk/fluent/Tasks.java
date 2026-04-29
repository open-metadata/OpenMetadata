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

package org.openmetadata.sdk.fluent;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.tasks.CreateTaskComment;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.DataAccessPermission;
import org.openmetadata.schema.type.DataAccessRequestPayload;
import org.openmetadata.schema.type.DataAccessType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Pure Fluent API for Task operations.
 */
public final class Tasks {
  private static OpenMetadataClient defaultClient;

  private Tasks() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Tasks.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static Task create(CreateTask request) {
    return getClient().tasks().create(request);
  }

  // ==================== Direct Access Methods ====================

  public static Task get(String id) {
    return getClient().tasks().get(id);
  }

  public static Task get(String id, String fields) {
    return getClient().tasks().get(id, fields);
  }

  public static Task get(String id, String fields, String include) {
    return getClient().tasks().get(id, fields, include);
  }

  public static Task getByName(String fqn) {
    return getClient().tasks().getByName(fqn);
  }

  public static Task getByName(String fqn, String fields) {
    return getClient().tasks().getByName(fqn, fields);
  }

  public static Task update(String id, Task entity) {
    return getClient().tasks().update(id, entity);
  }

  public static void delete(String id) {
    getClient().tasks().delete(id);
  }

  public static void delete(String id, Map<String, String> params) {
    getClient().tasks().delete(id, params);
  }

  public static void restore(String id) {
    getClient().tasks().restore(id);
  }

  public static ListResponse<Task> list(ListParams params) {
    return getClient().tasks().list(params);
  }

  public static EntityHistory getVersionList(UUID id) {
    return getClient().tasks().getVersionList(id);
  }

  public static Task getVersion(String id, Double version) {
    return getClient().tasks().getVersion(id, version);
  }

  // ==================== Task-Specific Methods ====================

  public static Task resolve(String id, ResolveTask resolveRequest) {
    return getClient().tasks().resolve(id, resolveRequest);
  }

  public static ListResponse<Task> listByStatus(TaskEntityStatus status) {
    return getClient().tasks().listByStatus(status);
  }

  public static ListResponse<Task> listByStatus(TaskEntityStatus status, int limit) {
    return getClient().tasks().listByStatus(status, limit);
  }

  public static ListResponse<Task> listByAssignee(String assigneeFqn) {
    return getClient().tasks().listByAssignee(assigneeFqn);
  }

  public static ListResponse<Task> listByDomain(String domainFqn) {
    return getClient().tasks().listByDomain(domainFqn);
  }

  public static ListResponse<Task> listWithFilters(Map<String, String> filters) {
    return getClient().tasks().listWithFilters(filters);
  }

  // ==================== Comment Methods ====================

  public static Task addComment(String taskId, CreateTaskComment comment) {
    return getClient().tasks().addComment(taskId, comment);
  }

  public static Task addComment(String taskId, String message) {
    return getClient().tasks().addComment(taskId, message);
  }

  public static Task editComment(String taskId, UUID commentId, CreateTaskComment comment) {
    return getClient().tasks().editComment(taskId, commentId, comment);
  }

  public static Task editComment(String taskId, UUID commentId, String message) {
    return getClient().tasks().editComment(taskId, commentId, message);
  }

  public static Task deleteComment(String taskId, UUID commentId) {
    return getClient().tasks().deleteComment(taskId, commentId);
  }

  // ==================== Data Access Request Helpers ====================

  /**
   * Create a Data Access Request task against any entity (table, dataProduct, etc.).
   *
   * @param entityFqn fully qualified name of the entity access is being requested for
   * @param entityType entity type (e.g., "table", "dataProduct")
   * @param accessType scope of access being requested
   * @param reason business justification (required, must be non-empty)
   * @param duration optional ISO 8601 duration (e.g., {@code Duration.ofDays(14)})
   * @return the created Task
   */
  public static Task requestDataAccess(
      String entityFqn,
      String entityType,
      DataAccessType accessType,
      String reason,
      Duration duration) {
    return requestDataAccess(
        entityFqn, entityType, accessType, DataAccessPermission.Read, reason, duration, List.of());
  }

  /**
   * Create a column-level Data Access Request against a Table.
   */
  public static Task requestColumnLevelAccess(
      String tableFqn, List<String> columnFqns, String reason, Duration duration) {
    return requestDataAccess(
        tableFqn,
        "table",
        DataAccessType.ColumnLevel,
        DataAccessPermission.Read,
        reason,
        duration,
        columnFqns);
  }

  /**
   * Create a Data Access Request task with full control over payload fields.
   */
  public static Task requestDataAccess(
      String entityFqn,
      String entityType,
      DataAccessType accessType,
      DataAccessPermission permission,
      String reason,
      Duration duration,
      List<String> columns) {
    Map<String, Object> payload = new HashMap<>();
    payload.put("accessType", accessType.value());
    payload.put("requestedAccess", permission.value());
    payload.put("reason", reason);
    if (duration != null) {
      payload.put("duration", duration.toString());
    }
    if (columns != null && !columns.isEmpty()) {
      payload.put("columns", columns);
    }

    CreateTask request =
        new CreateTask()
            .withCategory(TaskCategory.DataAccess)
            .withType(TaskEntityType.DataAccessRequest)
            .withPriority(TaskPriority.Medium)
            .withAbout(entityFqn)
            .withAboutType(entityType)
            .withPayload(payload);

    return create(request);
  }

  /**
   * Approve a Data Access Request task. Equivalent to resolving with the
   * {@code approve} transition and {@link TaskResolutionType#APPROVED}.
   */
  public static Task approveDataAccessRequest(String taskId, String comment) {
    ResolveTask request =
        new ResolveTask()
            .withTransitionId("approve")
            .withResolutionType(TaskResolutionType.Approved)
            .withComment(comment);
    return resolve(taskId, request);
  }

  /**
   * Reject a Data Access Request task. The reject transition requires a comment.
   */
  public static Task rejectDataAccessRequest(String taskId, String comment) {
    ResolveTask request =
        new ResolveTask()
            .withTransitionId("reject")
            .withResolutionType(TaskResolutionType.Rejected)
            .withComment(comment);
    return resolve(taskId, request);
  }

  /**
   * Revoke previously-granted access. Only valid against a task in the
   * {@link TaskEntityStatus#Approved} state. Comment is required.
   */
  public static Task revokeDataAccess(String taskId, String comment) {
    ResolveTask request =
        new ResolveTask()
            .withTransitionId("revoke")
            .withResolutionType(TaskResolutionType.Revoked)
            .withComment(comment);
    return resolve(taskId, request);
  }

  /**
   * Convenience: build a typed {@link DataAccessRequestPayload} for inspection.
   * The on-wire payload sent by {@link #requestDataAccess} is a plain Map; use
   * this helper when you need a typed view (e.g., for tests).
   */
  public static DataAccessRequestPayload buildDataAccessPayload(
      DataAccessType accessType,
      DataAccessPermission permission,
      String reason,
      Duration duration,
      List<String> columns) {
    DataAccessRequestPayload payload =
        new DataAccessRequestPayload()
            .withAccessType(accessType)
            .withRequestedAccess(permission)
            .withReason(reason);
    if (duration != null) {
      payload.setDuration(duration.toString());
    }
    if (columns != null && !columns.isEmpty()) {
      payload.setColumns(columns);
    }
    return payload;
  }
}
