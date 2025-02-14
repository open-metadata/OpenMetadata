package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.MultiInstanceLoopCharacteristics;

public class MultiInstanceLoopCharacteristicsBuilder {
  private String loopCardinality;
  private String inputDataItem;
  private String elementVariable;

  public MultiInstanceLoopCharacteristicsBuilder loopCardinality(String loopCardinality) {
    this.loopCardinality = loopCardinality;
    return this;
  }

  public MultiInstanceLoopCharacteristicsBuilder inputDataItem(String inputDataItem) {
    this.inputDataItem = inputDataItem;
    return this;
  }

  public MultiInstanceLoopCharacteristicsBuilder elementVariable(String elementVariable) {
    this.elementVariable = elementVariable;
    return this;
  }

  public MultiInstanceLoopCharacteristics build() {
    MultiInstanceLoopCharacteristics multiInstance = new MultiInstanceLoopCharacteristics();
    multiInstance.setLoopCardinality(loopCardinality);
    multiInstance.setInputDataItem(inputDataItem);
    multiInstance.setElementVariable(elementVariable);
    return multiInstance;
  }
}
