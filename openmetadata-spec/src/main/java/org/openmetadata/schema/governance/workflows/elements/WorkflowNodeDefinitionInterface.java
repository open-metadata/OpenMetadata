package org.openmetadata.schema.governance.workflows.elements;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import java.util.List;
import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.CheckEntityAttributesTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.ConditionalSetEntityAttributeTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.CreateAndRunIngestionPipelineTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.DataCompletenessTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.RollbackEntityTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.RunAppTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SetEntityAttributeTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SetEntityCertificationTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SetGlossaryTermStatusTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.endEvent.EndEventDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.gateway.ParallelGatewayDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.startEvent.StartEventDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.userTask.UserApprovalTaskDefinition;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "subType")
@JsonSubTypes({
  @JsonSubTypes.Type(
      value = CheckEntityAttributesTaskDefinition.class,
      name = "checkEntityAttributesTask"),
  @JsonSubTypes.Type(
      value = SetEntityAttributeTaskDefinition.class,
      name = "setEntityAttributeTask"),
  @JsonSubTypes.Type(
      value = ConditionalSetEntityAttributeTaskDefinition.class,
      name = "conditionalSetEntityAttributeTask"),
  @JsonSubTypes.Type(
      value = SetEntityCertificationTaskDefinition.class,
      name = "setEntityCertificationTask"),
  @JsonSubTypes.Type(value = RollbackEntityTaskDefinition.class, name = "rollbackEntityTask"),
  @JsonSubTypes.Type(value = DataCompletenessTaskDefinition.class, name = "dataCompletenessTask"),
  @JsonSubTypes.Type(value = StartEventDefinition.class, name = "startEvent"),
  @JsonSubTypes.Type(value = EndEventDefinition.class, name = "endEvent"),
  @JsonSubTypes.Type(
      value = SetGlossaryTermStatusTaskDefinition.class,
      name = "setGlossaryTermStatusTask"),
  @JsonSubTypes.Type(value = UserApprovalTaskDefinition.class, name = "userApprovalTask"),
  @JsonSubTypes.Type(
      value = CreateAndRunIngestionPipelineTaskDefinition.class,
      name = "createAndRunIngestionPipelineTask"),
  @JsonSubTypes.Type(value = RunAppTaskDefinition.class, name = "runAppTask"),
  @JsonSubTypes.Type(value = ParallelGatewayDefinition.class, name = "parallelGateway"),
})
public interface WorkflowNodeDefinitionInterface {
  String getType();

  String getSubType();

  String getName();

  String getDisplayName();

  String getDescription();

  default Object getConfig() {
    return null;
  }
  ;

  default List<String> getInput() {
    return null;
  }
  ;

  default List<String> getOutput() {
    return null;
  }
  ;

  default Object getInputNamespaceMap() {
    return null;
  }

  void setType(String type);

  void setSubType(String subType);

  void setName(String name);

  void setDisplayName(String displayName);

  void setDescription(String description);

  default void setConfig(Map<String, Object> config) {
    /* no-op implementation to be overridden */
  }

  default void setInput(List<String> inputs) {
    /* no-op implementation to be overridden */
  }

  default void setOutput(List<String> outputs) {
    /* no-op implementation to be overridden */
  }

  default void setInputNamespaceMap(Object inputNamespaceMap) {
    /* no-op implementation to be overridden */
  }

  @JsonIgnore
  default String getNodeDisplayName() {
    return CommonUtil.nullOrEmpty(getDisplayName()) ? getName() : getDisplayName();
  }

  @JsonIgnore
  default NodeType getNodeType() {
    return NodeType.fromValue(getType());
  }

  @JsonIgnore
  default NodeSubType getNodeSubType() {
    return NodeSubType.fromValue(getSubType());
  }
}
