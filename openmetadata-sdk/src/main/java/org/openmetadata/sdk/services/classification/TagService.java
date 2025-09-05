package org.openmetadata.sdk.services.classification;

import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class TagService extends EntityServiceBase<Tag> {
  public TagService(HttpClient httpClient) {
    super(httpClient, "/v1/tags");
  }

  @Override
  protected Class<Tag> getEntityClass() {
    return Tag.class;
  }
}
