package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.ServiceTask;

public class ServiceTaskBuilder extends FlowableElementBuilder<ServiceTaskBuilder> {
  private String implementation;

  public ServiceTaskBuilder implementation(String implementation) {
    this.implementation = implementation;
    return this;
  }

  @Override
  public ServiceTask build() {
    ServiceTask serviceTask = new ServiceTask();
    serviceTask.setId(id);
    serviceTask.setName(id);
    serviceTask.setImplementationType("class");
    serviceTask.setImplementation(implementation);
    return serviceTask;
  }
}
