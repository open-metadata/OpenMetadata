/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.ResolvePendingChangeAction;
import org.openmetadata.service.governance.approval.ChangeApplyService;
import org.openmetadata.service.governance.approval.ChangeRequestRun;
import org.openmetadata.service.governance.approval.ChangeRequestService;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;

/**
 * Workflow hook node that resolves the change request the run reviews. {@code commit} asks the
 * catalog to apply the revision, which it does only when an eligible approval of that exact revision
 * is recorded; {@code discard} rejects it. Place it where the workflow decides the outcome.
 */
@Slf4j
public class ResolvePendingChangeImpl implements JavaDelegate {
  private static final String REJECTED_REASON = "Rejected by the review workflow";
  private Expression actionExpr;
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      ResolvePendingChangeAction action =
          ResolvePendingChangeAction.fromValue((String) actionExpr.getValue(execution));
      resolve(action, ChangeRequestRun.required(varHandler));
    } catch (Exception exc) {
      LOG.error(
          "[{}] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()), exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private void resolve(ResolvePendingChangeAction action, ChangeRequestRun run) {
    if (action == ResolvePendingChangeAction.COMMIT) {
      ChangeApplyService.approveAndApply(run.changeRequestId(), run.revisionNumber());
    } else {
      ChangeRequestService.finish(
          run.changeRequestId(),
          run.revisionNumber(),
          ChangeRequestStatus.REJECTED,
          REJECTED_REASON);
    }
  }
}
