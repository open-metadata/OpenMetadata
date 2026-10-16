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

package org.openmetadata.service.governance.approval;

import static org.openmetadata.service.governance.workflows.Workflow.CHANGE_REQUEST_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.CHANGE_REQUEST_REVISION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.CHANGE_REQUEST_WORKFLOW_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;

import java.util.Optional;
import java.util.UUID;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;

/** The change request a hook workflow run is reviewing, read from the run's global variables. */
public record ChangeRequestRun(UUID changeRequestId, int revisionNumber, String workflowName) {

  // Flowable variables are untyped: ChangeRequestDelivery sets the id and workflow name as Strings
  // and the revision as an Integer. They are absent on every run that is not reviewing a change
  // request, which is how callers tell the two apart.
  public static Optional<ChangeRequestRun> from(WorkflowVariableHandler varHandler) {
    Object id = varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, CHANGE_REQUEST_ID_VARIABLE);
    Object revision =
        varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, CHANGE_REQUEST_REVISION_VARIABLE);
    Object workflow =
        varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, CHANGE_REQUEST_WORKFLOW_VARIABLE);
    Optional<ChangeRequestRun> run = Optional.empty();
    if (id instanceof String requestId && revision instanceof Number number) {
      String workflowName = workflow instanceof String name ? name : null;
      run =
          Optional.of(
              new ChangeRequestRun(UUID.fromString(requestId), number.intValue(), workflowName));
    }
    return run;
  }

  /** Same as {@link #from} for nodes that only ever run on behalf of a change request. */
  public static ChangeRequestRun required(WorkflowVariableHandler varHandler) {
    return from(varHandler)
        .orElseThrow(
            () ->
                new IllegalStateException(
                    "This node ran without a change request; hook workflows start only from change requests"));
  }
}
