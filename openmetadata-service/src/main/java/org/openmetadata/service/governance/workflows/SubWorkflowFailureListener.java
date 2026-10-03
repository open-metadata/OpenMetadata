package org.openmetadata.service.governance.workflows;

import static org.openmetadata.service.governance.workflows.Workflow.FAILURE_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.IOParameter;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.service.governance.workflows.flowable.builders.FlowableListenerBuilder;

/**
 * Carries a failure recorded inside the main workflow up to the trigger process that owns the
 * WorkflowInstance.
 *
 * <p>The call activity copies the child's {@code global_failure} into {@link
 * #SUB_WORKFLOW_FAILURE_VARIABLE} through {@link #outParameter()}; this listener, attached to the
 * call activity's end event, then sets the trigger's {@code failure} variable. A call activity's
 * output mapping overwrites its target on every completion, so the mapping targets a scratch
 * variable and this listener only ever sets {@code failure} to true: a later successful run of the
 * called workflow, in a loop or a parallel multi-instance, does not clear an earlier failure.
 */
public class SubWorkflowFailureListener implements JavaDelegate {

  public static final String SUB_WORKFLOW_FAILURE_VARIABLE = "subWorkflowFailure";

  @Override
  public void execute(DelegateExecution execution) {
    if (Boolean.TRUE.equals(execution.getVariable(SUB_WORKFLOW_FAILURE_VARIABLE))) {
      execution.setVariable(FAILURE_VARIABLE, true);
    }
  }

  /** Output mapping from the called workflow's {@code global_failure}. */
  public static IOParameter outParameter() {
    IOParameter parameter = new IOParameter();
    parameter.setSource(getNamespacedVariableName(GLOBAL_NAMESPACE, FAILURE_VARIABLE));
    parameter.setTarget(SUB_WORKFLOW_FAILURE_VARIABLE);
    return parameter;
  }

  /** End listener to attach to the call activity. */
  public static FlowableListener endListener() {
    return new FlowableListenerBuilder()
        .event("end")
        .implementation(SubWorkflowFailureListener.class.getName())
        .build();
  }
}
