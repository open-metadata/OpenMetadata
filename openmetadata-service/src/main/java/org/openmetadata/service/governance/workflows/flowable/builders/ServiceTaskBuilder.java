package org.openmetadata.service.governance.workflows.flowable.builders;

import java.util.ArrayList;
import java.util.List;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.ServiceTask;

public class ServiceTaskBuilder extends FlowableElementBuilder<ServiceTaskBuilder> {
  private String implementation;
  private String implementationType = "class";
  private boolean async = false;
  private boolean exclusive = false;
  private final List<FieldExtension> fieldExtensions = new ArrayList<>();

  public ServiceTaskBuilder implementation(String implementation) {
    this.implementation = implementation;
    return this;
  }

  public ServiceTaskBuilder implementationType(String implementationType) {
    this.implementationType = implementationType;
    return this;
  }

  public ServiceTaskBuilder addFieldExtension(FieldExtension fieldExtension) {
    this.fieldExtensions.add(fieldExtension);
    return this;
  }

  public ServiceTaskBuilder setAsync(boolean async) {
    this.async = async;
    return this;
  }

  public ServiceTaskBuilder exclusive(boolean exclusive) {
    this.exclusive = exclusive;
    return this;
  }

  @Override
  public ServiceTask build() {
    ServiceTask serviceTask = new ServiceTask();
    serviceTask.setId(id);
    serviceTask.setName(id);
    serviceTask.setImplementationType(implementationType);
    serviceTask.setImplementation(implementation);
    serviceTask.setAsynchronous(async);
    serviceTask.setExclusive(exclusive);

    for (FieldExtension fieldExtension : fieldExtensions) {
      serviceTask.getFieldExtensions().add(fieldExtension);
    }

    return serviceTask;
  }
}
