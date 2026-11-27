package org.openmetadata.sdk.services.tests;

import org.openmetadata.schema.api.tests.CreateTestDefinition;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class TestDefinitionService extends EntityServiceBase<TestDefinition> {

  public TestDefinitionService(HttpClient httpClient) {
    super(httpClient, "/v1/dataQuality/testDefinitions");
  }

  @Override
  protected Class<TestDefinition> getEntityClass() {
    return TestDefinition.class;
  }

  public TestDefinition create(final CreateTestDefinition request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, TestDefinition.class);
  }

  public TestDefinition upsert(final CreateTestDefinition request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.PUT, basePath, request, TestDefinition.class);
  }
}
