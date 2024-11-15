package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.Signal;

public class SignalBuilder {
  private String id;

  public SignalBuilder id(String id) {
    this.id = id;
    return this;
  }

  public Signal build() {
    Signal signal = new Signal();
    signal.setId(id);
    signal.setName(id);
    return signal;
  }
}
