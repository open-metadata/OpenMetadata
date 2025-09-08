package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.ArrayList;
import java.util.List;
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

      // Get current vote lists and calculate counts
      @SuppressWarnings("unchecked")
      List<String> approversList = (List<String>) delegateTask.getVariable("approversList");
      if (approversList == null) {
        approversList = new ArrayList<>();
      }

      @SuppressWarnings("unchecked")
      List<String> rejectersList = (List<String>) delegateTask.getVariable("rejectersList");
      if (rejectersList == null) {
        rejectersList = new ArrayList<>();
      }

      int approvalCount = approversList.size();
      int rejectionCount = rejectersList.size();

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
    } catch (RuntimeException e) {
      // Re-throw runtime exceptions that indicate validation failures
      if (e.getMessage() != null && e.getMessage().contains("MULTI_APPROVAL_THRESHOLD_NOT_MET")) {
        throw e;
      }
      LOG.error(
          String.format(
              "[%s] Approval validation error: ",
              getProcessDefinitionKeyFromId(delegateTask.getProcessDefinitionId())),
          e);
      // Re-throw to prevent incorrect completion
      throw e;
    } catch (Exception e) {
      LOG.error(
          String.format(
              "[%s] Approval validation error: ",
              getProcessDefinitionKeyFromId(delegateTask.getProcessDefinitionId())),
          e);
      // Convert to runtime exception to prevent incorrect completion
      throw new RuntimeException("Validation failed: " + e.getMessage(), e);
    }
  }
}
