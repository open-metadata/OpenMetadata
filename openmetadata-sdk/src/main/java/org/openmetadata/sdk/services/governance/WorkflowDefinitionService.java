package org.openmetadata.sdk.services.governance;

import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class WorkflowDefinitionService extends EntityServiceBase<WorkflowDefinition> {

  public WorkflowDefinitionService(HttpClient httpClient) {
    super(httpClient, "/v1/governance/workflowDefinitions");
  }

  @Override
  protected Class<WorkflowDefinition> getEntityClass() {
    return WorkflowDefinition.class;
  }

  public WorkflowDefinition create(CreateWorkflowDefinition request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, WorkflowDefinition.class);
  }
}
