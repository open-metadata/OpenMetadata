package org.openmetadata.sdk.services.tests;

import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class TestSuiteService extends EntityServiceBase<org.openmetadata.schema.tests.TestSuite> {

  public TestSuiteService(HttpClient httpClient) {
    super(httpClient, "/v1/testSuites");
  }

  @Override
  protected Class<org.openmetadata.schema.tests.TestSuite> getEntityClass() {
    return org.openmetadata.schema.tests.TestSuite.class;
  }
}
