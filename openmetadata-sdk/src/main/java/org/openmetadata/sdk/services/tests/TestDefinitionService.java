package org.openmetadata.sdk.services.tests;

import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class TestDefinitionService
    extends EntityServiceBase<org.openmetadata.schema.tests.TestDefinition> {

  public TestDefinitionService(HttpClient httpClient) {
    super(httpClient, "/v1/testDefinitions");
  }

  @Override
  protected Class<org.openmetadata.schema.tests.TestDefinition> getEntityClass() {
    return org.openmetadata.schema.tests.TestDefinition.class;
  }
}
