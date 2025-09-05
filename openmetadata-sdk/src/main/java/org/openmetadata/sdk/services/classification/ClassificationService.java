package org.openmetadata.sdk.services.classification;

import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class ClassificationService extends EntityServiceBase<Classification> {
  public ClassificationService(HttpClient httpClient) {
    super(httpClient, "/v1/classifications");
  }

  @Override
  protected Class<Classification> getEntityClass() {
    return Classification.class;
  }
}
