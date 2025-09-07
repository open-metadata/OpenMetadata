package org.openmetadata.sdk.services.tests;

import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class TestCaseService extends EntityServiceBase<org.openmetadata.schema.tests.TestCase> {

  public TestCaseService(HttpClient httpClient) {
    super(httpClient, "/v1/testCases");
  }

  @Override
  protected Class<org.openmetadata.schema.tests.TestCase> getEntityClass() {
    return org.openmetadata.schema.tests.TestCase.class;
  }
}
