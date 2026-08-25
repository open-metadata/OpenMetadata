package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.StartEvent;

public class StartEventBuilder extends FlowableElementBuilder<StartEventBuilder> {
  @Override
  public StartEvent build() {
    StartEvent startEvent = new StartEvent();
    startEvent.setId(id);
    startEvent.setName(id);
    return startEvent;
  }
}
