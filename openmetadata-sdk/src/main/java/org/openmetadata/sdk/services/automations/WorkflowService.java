package org.openmetadata.sdk.services.automations;

import org.openmetadata.schema.entity.automations.CreateWorkflow;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class WorkflowService extends EntityServiceBase<Workflow> {

  public WorkflowService(HttpClient httpClient) {
    super(httpClient, "/v1/automations/workflows");
  }

  @Override
  protected Class<Workflow> getEntityClass() {
    return Workflow.class;
  }

  public Workflow create(CreateWorkflow request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Workflow.class);
  }
}
