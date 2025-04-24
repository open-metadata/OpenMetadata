package org.openmetadata.service.resources.automations;

import org.openmetadata.schema.entity.automations.CreateWorkflow;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.service.mapper.EntityMapper;

public class WorkflowMapper implements EntityMapper<Workflow, CreateWorkflow> {

  @Override
  public Workflow createToEntity(CreateWorkflow create, String user) {
    return copy(new Workflow(), create, user)
        .withDescription(create.getDescription())
        .withRequest(create.getRequest())
        .withWorkflowType(create.getWorkflowType())
        .withDisplayName(create.getDisplayName())
        .withResponse(create.getResponse())
        .withStatus(create.getStatus())
        .withName(create.getName());
  }
}
