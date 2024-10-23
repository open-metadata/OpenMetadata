package org.openmetadata.service.governance.workflows.elements;

import java.util.ArrayList;
import java.util.List;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.FlowNode;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.StartEvent;
import org.openmetadata.service.governance.workflows.MainWorkflowHasFinishedListener;
import org.openmetadata.service.governance.workflows.WorkflowInstanceExecutionIdSetterListener;
import org.openmetadata.service.governance.workflows.WorkflowInstanceStageListener;
import org.openmetadata.service.governance.workflows.MainWorkflowTerminationListener;
import org.openmetadata.service.governance.workflows.flowable.builders.FlowableListenerBuilder;

public interface NodeInterface {
  void addToWorkflow(BpmnModel model, Process process);

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

  default void attachMainWorkflowHasFinishedListener(EndEvent endEvent) {
    FlowableListener listener =
            new FlowableListenerBuilder()
                    .event("end")
                    .implementation(MainWorkflowHasFinishedListener.class.getName())
                    .build();
    endEvent.getExecutionListeners().add(listener);
  }

  default void attachMainWorkflowTerminationListener(EndEvent endEvent) {
    FlowableListener listener =
            new FlowableListenerBuilder()
                    .event("start")
                    .implementation(MainWorkflowTerminationListener.class.getName())
                    .build();
    endEvent.getExecutionListeners().add(listener);
  }

}
