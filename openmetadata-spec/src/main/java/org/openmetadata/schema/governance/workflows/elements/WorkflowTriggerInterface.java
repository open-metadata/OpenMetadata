package org.openmetadata.schema.governance.workflows.elements;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import java.util.Set;
import org.openmetadata.schema.governance.workflows.elements.triggers.EventBasedEntityTriggerDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.NoOpTriggerDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.PeriodicBatchEntityTriggerDefinition;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
@JsonSubTypes({
  @JsonSubTypes.Type(value = EventBasedEntityTriggerDefinition.class, name = "eventBasedEntity"),
  @JsonSubTypes.Type(value = NoOpTriggerDefinition.class, name = "noOp"),
  @JsonSubTypes.Type(
      value = PeriodicBatchEntityTriggerDefinition.class,
      name = "periodicBatchEntity"),
})
public interface WorkflowTriggerInterface {
  // TODO If set as enum, it results in null when the JSON is deserialized.
  // Maybe there can be another way to validate it on deserialization.
  String getType();

  Object getConfig();

  Set<String> getOutput();
}
