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

package org.openmetadata.service.exception;

import jakarta.ws.rs.core.Response;
import org.openmetadata.sdk.exception.WebServiceException;

/**
 * Thrown when a caller's task-resolve request loses a race against another concurrent
 * resolve / a workflow instance that has already advanced past the target node. Maps to
 * 409 CONFLICT — the caller's request was well-formed but the task's current state no
 * longer permits the requested transition.
 *
 * <p>Distinct from {@code IllegalStateException} on purpose: only the specific
 * resolve-race sites in {@link org.openmetadata.service.tasks.TaskWorkflowHandler} throw
 * this. Other {@code IllegalStateException} instances remain server bugs and continue to
 * surface as 500 via {@link CatalogGenericExceptionMapper} — a global mapping would
 * hide those.
 */
public final class TaskStateConflictException extends WebServiceException {
  private static final String ERROR_TYPE = "TASK_STATE_CONFLICT";

  public TaskStateConflictException(String message) {
    super(Response.Status.CONFLICT, ERROR_TYPE, message);
  }

  public static TaskStateConflictException of(String message) {
    return new TaskStateConflictException(message);
  }
}
