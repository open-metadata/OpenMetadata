package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.FlowElement;

public abstract class FlowableElementBuilder<T extends FlowableElementBuilder<T>> {
  protected String id;

  @SuppressWarnings("unchecked")
  public T id(String id) {
    this.id = id;
    return (T) this;
  }

  public abstract FlowElement build();
}
