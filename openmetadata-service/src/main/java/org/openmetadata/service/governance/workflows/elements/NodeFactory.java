package org.openmetadata.service.governance.workflows.elements;

import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.NodeSubType;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.CheckEntityAttributesTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.CreateAndRunIngestionPipelineTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.RunAppTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SetEntityCertificationTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SetGlossaryTermStatusTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.endEvent.EndEventDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.gateway.ParallelGatewayDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.startEvent.StartEventDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.userTask.UserApprovalTaskDefinition;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.CheckEntityAttributesTask;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.SetEntityCertificationTask;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.SetGlossaryTermStatusTask;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.createAndRunIngestionPipeline.CreateAndRunIngestionPipelineTask;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.runApp.RunAppTask;
import org.openmetadata.service.governance.workflows.elements.nodes.endEvent.EndEvent;
import org.openmetadata.service.governance.workflows.elements.nodes.gateway.ParallelGateway;
import org.openmetadata.service.governance.workflows.elements.nodes.startEvent.StartEvent;
import org.openmetadata.service.governance.workflows.elements.nodes.userTask.UserApprovalTask;

public class NodeFactory {
  public static NodeInterface createNode(
      WorkflowNodeDefinitionInterface nodeDefinition, WorkflowConfiguration config) {
    return switch (NodeSubType.fromValue(nodeDefinition.getSubType())) {
      case START_EVENT -> new StartEvent((StartEventDefinition) nodeDefinition, config);
      case END_EVENT -> new EndEvent((EndEventDefinition) nodeDefinition, config);
      case CHECK_ENTITY_ATTRIBUTES_TASK -> new CheckEntityAttributesTask(
          (CheckEntityAttributesTaskDefinition) nodeDefinition, config);
      case SET_ENTITY_CERTIFICATION_TASK -> new SetEntityCertificationTask(
          (SetEntityCertificationTaskDefinition) nodeDefinition, config);
      case SET_GLOSSARY_TERM_STATUS_TASK -> new SetGlossaryTermStatusTask(
          (SetGlossaryTermStatusTaskDefinition) nodeDefinition, config);
      case USER_APPROVAL_TASK -> new UserApprovalTask(
          (UserApprovalTaskDefinition) nodeDefinition, config);
      case CREATE_AND_RUN_INGESTION_PIPELINE_TASK -> new CreateAndRunIngestionPipelineTask(
          (CreateAndRunIngestionPipelineTaskDefinition) nodeDefinition, config);
      case RUN_APP_TASK -> new RunAppTask((RunAppTaskDefinition) nodeDefinition, config);
      case PARALLEL_GATEWAY -> new ParallelGateway(
          (ParallelGatewayDefinition) nodeDefinition, config);
    };
  }
}
