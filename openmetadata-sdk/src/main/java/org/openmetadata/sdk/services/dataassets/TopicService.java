package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class TopicService extends EntityServiceBase<Topic> {
  public TopicService(HttpClient httpClient) {
    super(httpClient, "/v1/topics");
  }

  @Override
  protected Class<Topic> getEntityClass() {
    return Topic.class;
  }

  // Create using CreateTopic request
  public Topic create(CreateTopic request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Topic.class);
  }
}
