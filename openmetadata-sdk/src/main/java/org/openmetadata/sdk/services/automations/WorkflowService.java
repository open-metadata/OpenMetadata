package org.openmetadata.sdk.services.automations;

import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class WorkflowService
    extends EntityServiceBase<org.openmetadata.schema.entity.automations.Workflow> {

  public WorkflowService(HttpClient httpClient) {
    super(httpClient, "/v1/automations/workflows");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.automations.Workflow> getEntityClass() {
    return org.openmetadata.schema.entity.automations.Workflow.class;
  }
}
