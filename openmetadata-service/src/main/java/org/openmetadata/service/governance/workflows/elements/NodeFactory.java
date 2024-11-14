package org.openmetadata.service.governance.workflows.elements;

import java.util.Map;
import org.openmetadata.schema.governance.workflows.elements.NodeSubType;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.CheckEntityAttributesTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SetEntityCertificationTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SetGlossaryTermStatusTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.endEvent.EndEventDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.startEvent.StartEventDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.userTask.UserApprovalTaskDefinition;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.CheckEntityAttributesTask;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.SetEntityCertificationTask;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.SetGlossaryTermStatusTask;
import org.openmetadata.service.governance.workflows.elements.nodes.endEvent.EndEvent;
import org.openmetadata.service.governance.workflows.elements.nodes.startEvent.StartEvent;
import org.openmetadata.service.governance.workflows.elements.nodes.userTask.UserApprovalTask;
import org.openmetadata.service.util.JsonUtils;

public class NodeFactory {
  public static NodeInterface createNode(Map<String, Object> nodeDefinition) {
    return switch (NodeSubType.fromValue((String) nodeDefinition.get("subType"))) {
      case START_EVENT -> new StartEvent(
          JsonUtils.readOrConvertValue(nodeDefinition, StartEventDefinition.class));
      case END_EVENT -> new EndEvent(
          JsonUtils.readOrConvertValue(nodeDefinition, EndEventDefinition.class));
      case CHECK_ENTITY_ATTRIBUTES_TASK -> new CheckEntityAttributesTask(
          JsonUtils.readOrConvertValue(nodeDefinition, CheckEntityAttributesTaskDefinition.class));
      case SET_ENTITY_CERTIFICATION_TASK -> new SetEntityCertificationTask(
          JsonUtils.readOrConvertValue(nodeDefinition, SetEntityCertificationTaskDefinition.class));
      case SET_GLOSSARY_TERM_STATUS_TASK -> new SetGlossaryTermStatusTask(
          JsonUtils.readOrConvertValue(nodeDefinition, SetGlossaryTermStatusTaskDefinition.class));
      case USER_APPROVAL_TASK -> new UserApprovalTask(
          JsonUtils.readOrConvertValue(nodeDefinition, UserApprovalTaskDefinition.class));
    };
  }
}
