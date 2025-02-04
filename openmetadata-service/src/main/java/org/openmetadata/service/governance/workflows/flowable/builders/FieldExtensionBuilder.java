package org.openmetadata.service.governance.workflows.flowable.builders;

import org.flowable.bpmn.model.FieldExtension;

public class FieldExtensionBuilder {
  private String fieldName;
  private String fieldValue;

  public FieldExtensionBuilder fieldName(String fieldName) {
    this.fieldName = fieldName;
    return this;
  }

  public FieldExtensionBuilder fieldValue(String fieldValue) {
    this.fieldValue = fieldValue;
    return this;
  }

  public FieldExtension build() {
    FieldExtension fieldExtension = new FieldExtension();
    fieldExtension.setFieldName(fieldName);
    fieldExtension.setStringValue(fieldValue);
    return fieldExtension;
  }
}
