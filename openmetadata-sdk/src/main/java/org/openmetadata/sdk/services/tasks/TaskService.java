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

package org.openmetadata.sdk.services.tasks;

import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.tasks.CreateTaskComment;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.api.tasks.TaskCount;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.EntityServiceBase;

public class TaskService extends EntityServiceBase<Task> {

  public TaskService(HttpClient httpClient) {
    super(httpClient, "/v1/tasks");
  }

  @Override
  protected Class<Task> getEntityClass() {
    return Task.class;
  }

  public Task create(CreateTask request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Task.class);
  }

  public Task resolve(String id, ResolveTask resolveRequest) throws OpenMetadataException {
    String path = basePath + "/" + id + "/resolve";
    return httpClient.execute(HttpMethod.POST, path, resolveRequest, Task.class);
  }

  public ListResponse<Task> listByStatus(TaskEntityStatus status) throws OpenMetadataException {
    ListParams params = new ListParams().addFilter("status", status.value());
    return list(params);
  }

  public ListResponse<Task> listByStatus(TaskEntityStatus status, int limit)
      throws OpenMetadataException {
    ListParams params = new ListParams().addFilter("status", status.value()).setLimit(limit);
    return list(params);
  }

  public ListResponse<Task> listByAssignee(String assigneeFqn) throws OpenMetadataException {
    ListParams params = new ListParams().addFilter("assignee", assigneeFqn);
    return list(params);
  }

  public ListResponse<Task> listByDomain(String domainFqn) throws OpenMetadataException {
    ListParams params = new ListParams().setDomain(domainFqn);
    return list(params);
  }

  public ListResponse<Task> listWithFilters(Map<String, String> filters)
      throws OpenMetadataException {
    RequestOptions options = RequestOptions.builder().queryParams(filters).build();
    String responseStr = httpClient.executeForString(HttpMethod.GET, basePath, null, options);
    return deserializeListResponse(responseStr);
  }

  public Task close(String id, String comment) throws OpenMetadataException {
    String path = basePath + "/" + id + "/close";
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();
    if (comment != null && !comment.isEmpty()) {
      optionsBuilder.queryParam("comment", comment);
    }
    return httpClient.execute(HttpMethod.POST, path, null, Task.class, optionsBuilder.build());
  }

  public Task close(String id) throws OpenMetadataException {
    return close(id, null);
  }

  public ListResponse<Task> listAssigned() throws OpenMetadataException {
    return listAssigned(null);
  }

  public ListResponse<Task> listAssigned(TaskEntityStatus status) throws OpenMetadataException {
    String path = basePath + "/assigned";
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();
    if (status != null) {
      optionsBuilder.queryParam("status", status.value());
    }
    String responseStr =
        httpClient.executeForString(HttpMethod.GET, path, null, optionsBuilder.build());
    return deserializeListResponse(responseStr);
  }

  public ListResponse<Task> listCreated() throws OpenMetadataException {
    return listCreated(null);
  }

  public ListResponse<Task> listCreated(TaskEntityStatus status) throws OpenMetadataException {
    String path = basePath + "/created";
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();
    if (status != null) {
      optionsBuilder.queryParam("status", status.value());
    }
    String responseStr =
        httpClient.executeForString(HttpMethod.GET, path, null, optionsBuilder.build());
    return deserializeListResponse(responseStr);
  }

  // ==================== Comment Methods ====================

  /**
   * Add a comment to a task.
   *
   * @param taskId The task ID (UUID)
   * @param comment The comment to add
   * @return The updated task with the new comment
   */
  public Task addComment(String taskId, CreateTaskComment comment) throws OpenMetadataException {
    String path = basePath + "/" + taskId + "/comments";
    return httpClient.execute(HttpMethod.POST, path, comment, Task.class);
  }

  /**
   * Add a comment to a task using just a message string.
   *
   * @param taskId The task ID (UUID)
   * @param message The comment message
   * @return The updated task with the new comment
   */
  public Task addComment(String taskId, String message) throws OpenMetadataException {
    return addComment(taskId, new CreateTaskComment().withMessage(message));
  }

  /**
   * Edit a comment on a task. Only the comment author can edit their own comment.
   *
   * @param taskId The task ID (UUID)
   * @param commentId The comment ID (UUID)
   * @param comment The updated comment
   * @return The updated task with the edited comment
   */
  public Task editComment(String taskId, UUID commentId, CreateTaskComment comment)
      throws OpenMetadataException {
    String path = basePath + "/" + taskId + "/comments/" + commentId;
    return httpClient.execute(HttpMethod.PATCH, path, comment, Task.class);
  }

  /**
   * Edit a comment on a task using just a message string.
   *
   * @param taskId The task ID (UUID)
   * @param commentId The comment ID (UUID)
   * @param message The updated comment message
   * @return The updated task with the edited comment
   */
  public Task editComment(String taskId, UUID commentId, String message)
      throws OpenMetadataException {
    return editComment(taskId, commentId, new CreateTaskComment().withMessage(message));
  }

  /**
   * Delete a comment from a task. The comment author or an admin can delete a comment.
   *
   * @param taskId The task ID (UUID)
   * @param commentId The comment ID (UUID)
   * @return The updated task with the comment removed
   */
  public Task deleteComment(String taskId, UUID commentId) throws OpenMetadataException {
    String path = basePath + "/" + taskId + "/comments/" + commentId;
    return httpClient.execute(HttpMethod.DELETE, path, null, Task.class);
  }

  // ==================== Count Methods ====================

  /**
   * Get task counts grouped by status.
   *
   * @return Task counts for open, in-progress, completed, and total
   */
  public TaskCount getCount() throws OpenMetadataException {
    return getCount(null, null, null);
  }

  /**
   * Get task counts grouped by status with optional filters.
   *
   * @param assignee Filter by assignee ID
   * @param createdBy Filter by creator FQN
   * @param aboutEntity Filter by the FQN of the entity the task is about
   * @return Task counts for open, in-progress, completed, and total
   */
  public TaskCount getCount(String assignee, String createdBy, String aboutEntity)
      throws OpenMetadataException {
    String path = basePath + "/count";
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();
    if (assignee != null) {
      optionsBuilder.queryParam("assignee", assignee);
    }
    if (createdBy != null) {
      optionsBuilder.queryParam("createdBy", createdBy);
    }
    if (aboutEntity != null) {
      optionsBuilder.queryParam("aboutEntity", aboutEntity);
    }
    return httpClient.execute(HttpMethod.GET, path, null, TaskCount.class, optionsBuilder.build());
  }

  /**
   * Get task counts for tasks about a specific entity.
   *
   * @param aboutEntityFqn The FQN of the entity to count tasks for
   * @return Task counts for open, in-progress, completed, and total
   */
  public TaskCount getCountByAboutEntity(String aboutEntityFqn) throws OpenMetadataException {
    return getCount(null, null, aboutEntityFqn);
  }
}
