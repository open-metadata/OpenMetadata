package org.openmetadata.sdk.services.bots;

import org.openmetadata.schema.entity.Bot;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class BotService extends EntityServiceBase<Bot> {
  public BotService(HttpClient httpClient) {
    super(httpClient, "/v1/bots");
  }

  @Override
  protected Class<Bot> getEntityClass() {
    return Bot.class;
  }
}
