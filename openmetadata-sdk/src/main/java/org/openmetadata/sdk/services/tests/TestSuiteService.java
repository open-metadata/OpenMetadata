package org.openmetadata.sdk.services.tests;

import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class TestSuiteService extends EntityServiceBase<org.openmetadata.schema.tests.TestSuite> {

  public TestSuiteService(HttpClient httpClient) {
    super(httpClient, "/v1/dataQuality/testSuites");
  }

  @Override
  protected Class<org.openmetadata.schema.tests.TestSuite> getEntityClass() {
    return org.openmetadata.schema.tests.TestSuite.class;
  }

  // Create using CreateTestSuite request
  public org.openmetadata.schema.tests.TestSuite create(CreateTestSuite request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, basePath, request, org.openmetadata.schema.tests.TestSuite.class);
  }
}
