package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.IntermediateCatchEvent;
import org.flowable.bpmn.model.MessageEventDefinition;

public class IntermediateCatchEventBuilder
    extends FlowableElementBuilder<IntermediateCatchEventBuilder> {

  private String messageExpression;

  public IntermediateCatchEventBuilder messageExpression(String messageExpression) {
    this.messageExpression = messageExpression;
    return this;
  }

  @Override
  public IntermediateCatchEvent build() {
    if (messageExpression == null) {
      throw new IllegalStateException(
          "IntermediateCatchEvent requires a messageExpression to be set");
    }

    IntermediateCatchEvent event = new IntermediateCatchEvent();
    event.setId(id);
    event.setName(id);

    MessageEventDefinition messageDefinition = new MessageEventDefinition();
    messageDefinition.setMessageExpression(messageExpression);
    event.addEventDefinition(messageDefinition);

    return event;
  }
}
