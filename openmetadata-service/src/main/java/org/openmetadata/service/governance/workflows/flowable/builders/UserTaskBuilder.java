package org.openmetadata.service.governance.workflows.flowable.builders;

import java.util.ArrayList;
import java.util.List;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.UserTask;

public class UserTaskBuilder extends FlowableElementBuilder<UserTaskBuilder> {
  private final List<FlowableListener> listeners = new ArrayList<>();

  public UserTaskBuilder addListener(FlowableListener listener) {
    this.listeners.add(listener);
    return this;
  }

  @Override
  public UserTask build() {
    UserTask userTask = new UserTask();
    userTask.setId(id);
    userTask.setName(id);

    for (FlowableListener listener : listeners) {
      userTask.getTaskListeners().add(listener);
    }

    return userTask;
  }
}
