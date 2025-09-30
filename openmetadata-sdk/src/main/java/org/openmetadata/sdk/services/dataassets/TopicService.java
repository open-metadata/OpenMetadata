package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.resources.BaseResource;

public class TopicService extends BaseResource<Topic> {
  public TopicService(HttpClient httpClient) {
    super(httpClient, "/v1/topics");
  }

  @Override
  protected Class<Topic> getEntityClass() {
    return Topic.class;
  }

  // Create using CreateTopic request
  public org.openmetadata.schema.entity.data.Topic create(CreateTopic request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, basePath, request, org.openmetadata.schema.entity.data.Topic.class);
  }
}
