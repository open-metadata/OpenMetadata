package org.openmetadata.sdk.services.classification;

import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class ClassificationService extends EntityServiceBase<Classification> {
  public ClassificationService(HttpClient httpClient) {
    super(httpClient, "/v1/classifications");
  }

  @Override
  protected Class<Classification> getEntityClass() {
    return Classification.class;
  }

  // Create classification using CreateClassification request
  public Classification create(CreateClassification request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Classification.class);
  }
}
