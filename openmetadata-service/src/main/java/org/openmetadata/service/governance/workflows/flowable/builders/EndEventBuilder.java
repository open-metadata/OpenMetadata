package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.EndEvent;

public class EndEventBuilder extends FlowableElementBuilder<EndEventBuilder> {
  @Override
  public EndEvent build() {
    EndEvent endEvent = new EndEvent();
    endEvent.setId(id);
    endEvent.setName(id);
    return endEvent;
  }
}
