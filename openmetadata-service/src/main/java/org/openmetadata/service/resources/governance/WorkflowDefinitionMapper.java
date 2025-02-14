package org.openmetadata.service.resources.governance;

import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.mapper.EntityMapper;

import java.util.ArrayList;
import java.util.List;

public class WorkflowDefinitionMapper
    implements EntityMapper<WorkflowDefinition, CreateWorkflowDefinition> {
  @Override
  public WorkflowDefinition createToEntity(CreateWorkflowDefinition create, String user) {
    return copy(new WorkflowDefinition(), create, user)
        .withFullyQualifiedName(create.getName())
        .withTrigger(create.getTrigger())
        .withNodes(create.getNodes())
        .withEdges(create.getEdges());
  }
}
