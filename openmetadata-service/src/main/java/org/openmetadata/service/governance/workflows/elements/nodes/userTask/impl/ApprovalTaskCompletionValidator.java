package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.TaskListener;
import org.flowable.task.service.delegate.DelegateTask;

@Slf4j
public class ApprovalTaskCompletionValidator implements TaskListener {

  @Override
  public void notify(DelegateTask delegateTask) {
    try {
      LOG.debug("[ApprovalValidator] Validating completion for task: {}", delegateTask.getId());

      // Get approval thresholds
      Integer approvalThreshold = (Integer) delegateTask.getVariable("approvalThreshold");
      Integer rejectionThreshold = (Integer) delegateTask.getVariable("rejectionThreshold");

      if (approvalThreshold == null) {
        approvalThreshold = 1;
      }
      if (rejectionThreshold == null) {
        rejectionThreshold = 1;
      }

      // Check if this is a multi-approval task (threshold > 1)
      if (approvalThreshold <= 1 && rejectionThreshold <= 1) {
        return; // Single approval, allow completion
      }

      // Get current vote counts
      @SuppressWarnings("unchecked")
      List<Map<String, Object>> approvals =
          (List<Map<String, Object>>) delegateTask.getVariable("approvals");
      if (approvals == null) {
        approvals = new ArrayList<>();
      }

      Integer approvalCount = (Integer) delegateTask.getVariable("approvalCount");
      Integer rejectionCount = (Integer) delegateTask.getVariable("rejectionCount");
      if (approvalCount == null) approvalCount = 0;
      if (rejectionCount == null) rejectionCount = 0;

      // Check if thresholds are met
      boolean approvalThresholdMet = approvalCount >= approvalThreshold;
      boolean rejectionThresholdMet = rejectionCount >= rejectionThreshold;

      if (approvalThresholdMet || rejectionThresholdMet) {
        return; // Threshold met, allow completion
      }

      // Threshold not met, prevent completion
      LOG.debug("[ApprovalValidator] Preventing task completion - threshold not met");
      throw new RuntimeException(
          String.format(
              "MULTI_APPROVAL_THRESHOLD_NOT_MET: Task requires %d approvals but only has %d",
              approvalThreshold, approvalCount));

    } catch (BpmnError e) {
      // Re-throw BPMN errors
      throw e;
    } catch (Exception e) {
      LOG.error(
          String.format(
              "[%s] Approval validation error: ",
              getProcessDefinitionKeyFromId(delegateTask.getProcessDefinitionId())),
          e);
      // Allow completion on validation errors to prevent workflow from getting stuck
    }
  }
}
