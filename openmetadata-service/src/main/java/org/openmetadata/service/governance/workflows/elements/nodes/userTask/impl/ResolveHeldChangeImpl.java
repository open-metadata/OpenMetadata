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

package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.ChangeRequestStatus;
import org.openmetadata.service.governance.approval.ChangeApplyService;
import org.openmetadata.service.governance.approval.ChangeRequestRun;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;

/**
 * The step of an approval task, in a workflow that holds edits, that settles the change request the
 * run reviews once reviewers decide it. {@code publish} asks the catalog to apply the changes the
 * reviewers agreed on, which it does only when an eligible approval of that exact revision is
 * recorded; {@code discard} drops the changes they rejected. The outcome is kept in the approval
 * task's {@value #HELD_CHANGE_RESULT} variable, apart from the approve or reject result that leads
 * the workflow on.
 */
@Slf4j
public class ResolveHeldChangeImpl implements JavaDelegate {
  public static final String PUBLISH = "publish";
  public static final String DISCARD = "discard";
  public static final String HELD_CHANGE_RESULT = "heldChangeResult";
  public static final String NOT_APPLIED = "notApplied";
  private static final String APPLIED = "applied";
  private static final String DISCARDED = "discarded";
  private static final String REJECTED_REASON = "Rejected by the review workflow";
  private Expression actionExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      String action = (String) actionExpr.getValue(execution);
      varHandler.setNodeVariable(
          HELD_CHANGE_RESULT, resolve(action, ChangeRequestRun.required(varHandler)));
    } catch (Exception exc) {
      LOG.error(
          "[{}] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()), exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  // "applied" when this step published the agreed changes, or the request already ended applied;
  // "notApplied" when it could not (the request stays open with its conflicts and the run ends);
  // "discarded" when the rejected changes were dropped. Parts published earlier in the same review
  // do not count as this step's.
  private String resolve(String action, ChangeRequestRun run) {
    String result = DISCARDED;
    if (PUBLISH.equals(action)) {
      int publishedBefore = ChangeApplyService.publishedCount(run.changeRequestId());
      ChangeRequest request =
          ChangeApplyService.approveAndApply(run.changeRequestId(), run.revisionNumber());
      result =
          request.getStatus() == ChangeRequestStatus.APPLIED
                  || ChangeApplyService.publishedCount(run.changeRequestId()) > publishedBefore
              ? APPLIED
              : NOT_APPLIED;
    } else {
      ChangeApplyService.discard(run.changeRequestId(), run.revisionNumber(), REJECTED_REASON);
    }
    return result;
  }
}
