package org.openmetadata.service.resources.governance;

import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.mapper.EntityMapper;

public class WorkflowDefinitionMapper
    implements EntityMapper<WorkflowDefinition, CreateWorkflowDefinition> {
  @Override
  public WorkflowDefinition createToEntity(CreateWorkflowDefinition create, String user) {
    return copy(new WorkflowDefinition(), create, user)
        .withFullyQualifiedName(create.getName())
        .withConfig(new WorkflowConfiguration())
        .withTrigger(create.getTrigger())
        .withNodes(create.getNodes())
        .withEdges(create.getEdges());
  }
}
