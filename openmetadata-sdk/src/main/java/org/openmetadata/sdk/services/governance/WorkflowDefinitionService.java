package org.openmetadata.sdk.services.governance;

import java.util.Map;
import org.openmetadata.schema.api.governance.CreateWorkflowDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
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

  public WorkflowDefinition upsert(CreateWorkflowDefinition request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.PUT, basePath, request, WorkflowDefinition.class);
  }

  public void trigger(String name) throws OpenMetadataException {
    httpClient.executeForString(
        HttpMethod.POST,
        basePath + "/name/" + name + "/trigger",
        Map.of(),
        RequestOptions.builder().build());
  }

  public WorkflowDefinition suspend(String name) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT,
        basePath + "/name/" + name + "/suspend",
        Map.of(),
        WorkflowDefinition.class);
  }

  public WorkflowDefinition resume(String name) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT, basePath + "/name/" + name + "/resume", Map.of(), WorkflowDefinition.class);
  }

  public WorkflowDefinition validate(CreateWorkflowDefinition request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, basePath + "/validate", request, WorkflowDefinition.class);
  }
}
