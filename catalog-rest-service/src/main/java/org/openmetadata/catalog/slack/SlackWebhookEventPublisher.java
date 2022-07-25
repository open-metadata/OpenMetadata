package org.openmetadata.catalog.slack;

import java.util.concurrent.TimeUnit;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Invocation;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.events.WebhookPublisher;
import org.openmetadata.catalog.events.errors.EventPublisherException;
import org.openmetadata.catalog.jdbi3.CollectionDAO;
import org.openmetadata.catalog.resources.events.EventResource.ChangeEventList;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.Webhook;
import org.openmetadata.catalog.util.ChangeEventParser;

@Slf4j
public class SlackWebhookEventPublisher extends WebhookPublisher {
  private final Invocation.Builder target;
  private final Client client;

  public SlackWebhookEventPublisher(Webhook webhook, CollectionDAO dao) {
    super(webhook, dao);
    String slackWebhookURL = webhook.getEndpoint().toString();
    ClientBuilder clientBuilder = ClientBuilder.newBuilder();
    clientBuilder.connectTimeout(10, TimeUnit.SECONDS);
    clientBuilder.readTimeout(12, TimeUnit.SECONDS);
    client = clientBuilder.build();
    target = client.target(slackWebhookURL).request();
  }

  @Override
  public void onStart() {
    LOG.info("Slack Webhook Publisher Started");
  }

  @Override
  public void onShutdown() {
    if (client != null) {
      client.close();
    }
  }

  @Override
  public void publish(ChangeEventList events) throws EventPublisherException {
    for (ChangeEvent event : events.getData()) {
      try {
        SlackMessage slackMessage = ChangeEventParser.buildSlackMessage(event);
        Response response =
            target.post(javax.ws.rs.client.Entity.entity(slackMessage, MediaType.APPLICATION_JSON_TYPE));
        if (response.getStatus() >= 300 && response.getStatus() < 400) {
          throw new EventPublisherException(
              "Slack webhook callback is getting redirected. " + "Please check your configuration");
        } else if (response.getStatus() >= 300 && response.getStatus() < 600) {
          throw new SlackRetriableException(response.getStatusInfo().getReasonPhrase());
        }
      } catch (Exception e) {
        LOG.error("Failed to publish event {} to slack due to {} ", event, e.getMessage());
      }
    }
  }
}
