package org.openmetadata.service.governance.workflows.elements;

import java.util.ArrayList;
import java.util.List;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.Process;
import org.openmetadata.service.governance.workflows.WorkflowInstanceListener;
import org.openmetadata.service.governance.workflows.flowable.builders.FlowableListenerBuilder;

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

    List<String> events = List.of("start", "end");
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
