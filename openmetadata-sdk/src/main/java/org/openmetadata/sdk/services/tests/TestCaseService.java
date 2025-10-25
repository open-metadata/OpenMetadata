package org.openmetadata.sdk.services.tests;

import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class TestCaseService extends EntityServiceBase<org.openmetadata.schema.tests.TestCase> {

  public TestCaseService(HttpClient httpClient) {
    super(httpClient, "/v1/dataQuality/testCases");
  }

  @Override
  protected Class<org.openmetadata.schema.tests.TestCase> getEntityClass() {
    return org.openmetadata.schema.tests.TestCase.class;
  }

  // Create using CreateTestCase request
  public org.openmetadata.schema.tests.TestCase create(CreateTestCase request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, basePath, request, org.openmetadata.schema.tests.TestCase.class);
  }
}
