package org.openmetadata.sdk.services.tests;

import org.openmetadata.schema.api.tests.CreateTestDefinition;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class TestDefinitionService
    extends EntityServiceBase<org.openmetadata.schema.tests.TestDefinition> {

  public TestDefinitionService(HttpClient httpClient) {
    super(httpClient, "/v1/dataQuality/testDefinitions");
  }

  @Override
  protected Class<org.openmetadata.schema.tests.TestDefinition> getEntityClass() {
    return org.openmetadata.schema.tests.TestDefinition.class;
  }

  // Create using CreateTestDefinition request
  public org.openmetadata.schema.tests.TestDefinition create(CreateTestDefinition request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, basePath, request, org.openmetadata.schema.tests.TestDefinition.class);
  }
}
