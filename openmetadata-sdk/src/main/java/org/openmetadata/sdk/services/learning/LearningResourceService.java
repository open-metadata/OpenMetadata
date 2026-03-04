package org.openmetadata.sdk.services.learning;

import org.openmetadata.schema.api.learning.CreateLearningResource;
import org.openmetadata.schema.entity.learning.LearningResource;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class LearningResourceService extends EntityServiceBase<LearningResource> {
  public LearningResourceService(HttpClient httpClient) {
    super(httpClient, "/v1/learning/resources");
  }

  @Override
  protected Class<LearningResource> getEntityClass() {
    return LearningResource.class;
  }

  public LearningResource create(CreateLearningResource request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, LearningResource.class);
  }

  public LearningResource put(CreateLearningResource request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.PUT, basePath, request, LearningResource.class);
  }
}
