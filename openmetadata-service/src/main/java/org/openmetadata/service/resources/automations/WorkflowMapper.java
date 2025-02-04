package org.openmetadata.service.resources.automations;

import org.openmetadata.schema.entity.automations.CreateWorkflow;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

public class WorkflowMapper implements EntityMapper<Workflow, CreateWorkflow> {
  private final OpenMetadataApplicationConfig openMetadataApplicationConfig;

  public WorkflowMapper(OpenMetadataApplicationConfig config) {
    this.openMetadataApplicationConfig = config;
  }

  @Override
  public Workflow createToEntity(CreateWorkflow create, String user) {
    OpenMetadataConnection openMetadataServerConnection =
        new OpenMetadataConnectionBuilder(openMetadataApplicationConfig).build();
    return copy(new Workflow(), create, user)
        .withDescription(create.getDescription())
        .withRequest(create.getRequest())
        .withWorkflowType(create.getWorkflowType())
        .withDisplayName(create.getDisplayName())
        .withResponse(create.getResponse())
        .withStatus(create.getStatus())
        .withOpenMetadataServerConnection(openMetadataServerConnection)
        .withName(create.getName());
  }
}
