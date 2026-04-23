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

import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.tasks.CreateTaskComment;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.TaskEntityStatus;
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
}
