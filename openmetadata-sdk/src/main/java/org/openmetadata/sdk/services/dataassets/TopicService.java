package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.resources.BaseResource;

public class TopicService extends BaseResource<Topic> {
  public TopicService(HttpClient httpClient) {
    super(httpClient, "/v1/topics");
  }

  @Override
  protected Class<Topic> getEntityClass() {
    return Topic.class;
  }
}
