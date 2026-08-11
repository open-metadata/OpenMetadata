package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import java.util.List;
import org.flowable.task.service.delegate.DelegateTask;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ApprovalTaskCompletionValidatorTest {

  @Mock private DelegateTask delegateTask;

  @Test
  void notify_acceptsStringThresholdsWhenThresholdIsMet() {
    ApprovalTaskCompletionValidator validator = new ApprovalTaskCompletionValidator();

    when(delegateTask.getId()).thenReturn("task-1");
    when(delegateTask.getVariable("approvalThreshold")).thenReturn("2");
    when(delegateTask.getVariable("rejectionThreshold")).thenReturn("1");
    when(delegateTask.getVariable("approversList")).thenReturn(List.of("alice", "bob"));
    when(delegateTask.getVariable("rejectersList")).thenReturn(List.of());

    assertDoesNotThrow(() -> validator.notify(delegateTask));
  }

  @Test
  void notify_blocksCompletionWhenStringThresholdNotMet() {
    ApprovalTaskCompletionValidator validator = new ApprovalTaskCompletionValidator();

    when(delegateTask.getId()).thenReturn("task-2");
    when(delegateTask.getVariable("approvalThreshold")).thenReturn("2");
    when(delegateTask.getVariable("rejectionThreshold")).thenReturn("1");
    when(delegateTask.getVariable("approversList")).thenReturn(List.of("alice"));
    when(delegateTask.getVariable("rejectersList")).thenReturn(List.of());

    RuntimeException exception =
        assertThrows(RuntimeException.class, () -> validator.notify(delegateTask));

    org.junit.jupiter.api.Assertions.assertTrue(
        exception.getMessage().contains("MULTI_APPROVAL_THRESHOLD_NOT_MET"));
  }
}
