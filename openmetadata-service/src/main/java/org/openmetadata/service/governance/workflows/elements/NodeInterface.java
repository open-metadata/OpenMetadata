package org.openmetadata.service.governance.workflows.elements;

import java.util.ArrayList;
import java.util.List;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.FlowNode;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.Process;
import org.openmetadata.service.governance.workflows.WorkflowInstanceStageUpdaterListener;
import org.openmetadata.service.governance.workflows.flowable.builders.FlowableListenerBuilder;

public interface NodeInterface {
  void addToWorkflow(BpmnModel model, Process process);

  default void attachDefaultListeners(FlowNode flowableNode) {
    for (FlowableListener listener : getDefaultListeners()) {
      flowableNode.getExecutionListeners().add(listener);
    }
  }

  private List<FlowableListener> getDefaultListeners() {
    List<FlowableListener> listeners = new ArrayList<>();

    List<String> events = List.of("start", "end");
    for (String event : events) {
      FlowableListener listener =
          new FlowableListenerBuilder()
              .event(event)
              .implementation(WorkflowInstanceStageUpdaterListener.class.getName())
              .build();
      listeners.add(listener);
    }

    return listeners;
  }
}
