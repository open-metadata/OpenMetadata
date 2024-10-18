package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.UserTask;

public class UserTaskBuilder extends FlowableElementBuilder<UserTaskBuilder> {
  @Override
  public UserTask build() {
    UserTask userTask = new UserTask();
    userTask.setId(id);
    userTask.setName(id);
    return userTask;
  }
}
