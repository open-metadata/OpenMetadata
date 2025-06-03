package org.openmetadata.service.governance.workflows.elements;

import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import java.util.ArrayList;
import java.util.List;
import org.flowable.bpmn.model.Activity;
import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.ErrorEventDefinition;
import org.flowable.bpmn.model.FlowNode;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.StartEvent;
import org.openmetadata.service.governance.workflows.MainWorkflowTerminationListener;
import org.openmetadata.service.governance.workflows.WorkflowInstanceExecutionIdSetterListener;
import org.openmetadata.service.governance.workflows.WorkflowInstanceStageListener;
import org.openmetadata.service.governance.workflows.flowable.builders.FlowableListenerBuilder;

public interface NodeInterface {
  void addToWorkflow(BpmnModel model, Process process);

  default BoundaryEvent getRuntimeExceptionBoundaryEvent() {
    return null;
  }

  default void attachWorkflowInstanceStageListeners(FlowNode flowableNode) {
    List<String> events = List.of("start", "end");
    attachWorkflowInstanceStageListeners(flowableNode, events);
  }

  default void attachWorkflowInstanceStageListeners(FlowNode flowableNode, List<String> events) {
    for (FlowableListener listener : getWorkflowInstanceStageListeners(events)) {
      flowableNode.getExecutionListeners().add(listener);
    }
  }

  private List<FlowableListener> getWorkflowInstanceStageListeners(List<String> events) {
    List<FlowableListener> listeners = new ArrayList<>();

    for (String event : events) {
      FlowableListener listener =
          new FlowableListenerBuilder()
              .event(event)
              .implementation(WorkflowInstanceStageListener.class.getName())
              .build();
      listeners.add(listener);
    }

    return listeners;
  }

  default void attachWorkflowInstanceExecutionIdSetterListener(StartEvent startEvent) {
    FlowableListener listener =
        new FlowableListenerBuilder()
            .event("start")
            .implementation(WorkflowInstanceExecutionIdSetterListener.class.getName())
            .build();
    startEvent.getExecutionListeners().add(listener);
  }

  default void attachMainWorkflowTerminationListener(EndEvent endEvent) {
    FlowableListener listener =
        new FlowableListenerBuilder()
            .event("start")
            .implementation(MainWorkflowTerminationListener.class.getName())
            .build();
    endEvent.getExecutionListeners().add(listener);
  }

  default BoundaryEvent getRuntimeExceptionBoundaryEvent(
      Activity activity, Boolean storeStageStatus) {
    ErrorEventDefinition runtimeExceptionDefinition = new ErrorEventDefinition();
    runtimeExceptionDefinition.setErrorCode(WORKFLOW_RUNTIME_EXCEPTION);

    BoundaryEvent runtimeExceptionBoundaryEvent = new BoundaryEvent();
    runtimeExceptionBoundaryEvent.setId(
        getFlowableElementId(activity.getId(), "runtimeExceptionBoundaryEvent"));
    runtimeExceptionBoundaryEvent.addEventDefinition(runtimeExceptionDefinition);

    runtimeExceptionBoundaryEvent.setAttachedToRef(activity);
    if (storeStageStatus) {
      for (FlowableListener listener : getWorkflowInstanceStageListeners(List.of("end"))) {
        runtimeExceptionBoundaryEvent.getExecutionListeners().add(listener);
      }
    }
    return runtimeExceptionBoundaryEvent;
  }
}
