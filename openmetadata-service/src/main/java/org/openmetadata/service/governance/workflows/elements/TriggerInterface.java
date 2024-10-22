package org.openmetadata.service.governance.workflows.elements;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.FlowNode;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.StartEvent;
import org.openmetadata.service.governance.workflows.WorkflowInstanceExecutionIdSetterListener;
import org.openmetadata.service.governance.workflows.WorkflowInstanceListener;
import org.openmetadata.service.governance.workflows.WorkflowInstanceStageListener;
import org.openmetadata.service.governance.workflows.flowable.builders.FlowableListenerBuilder;

import java.util.ArrayList;
import java.util.List;

public interface TriggerInterface {
  String getTriggerWorkflowId();
  void addToWorkflow(BpmnModel model);

  default void attachWorkflowInstanceListeners(Process process) {
    for (FlowableListener listener : getWorkflowInstanceListeners()) {
      process.getExecutionListeners().add(listener);
    }
  }

  private List<FlowableListener> getWorkflowInstanceListeners() {
    List<FlowableListener> listeners = new ArrayList<>();

    List<String> events = List.of("start");
    for (String event : events) {
      FlowableListener listener =
              new FlowableListenerBuilder()
                      .event(event)
                      .implementation(WorkflowInstanceListener.class.getName())
                      .build();
      listeners.add(listener);
    }

    return listeners;
  }
}
