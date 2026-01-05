package org.openmetadata.sdk.services.classification;

import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class TagService extends EntityServiceBase<Tag> {
  public TagService(HttpClient httpClient) {
    super(httpClient, "/v1/tags");
  }

  @Override
  protected Class<Tag> getEntityClass() {
    return Tag.class;
  }

  // Create tag using CreateTag request
  public Tag create(CreateTag request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Tag.class);
  }
}
