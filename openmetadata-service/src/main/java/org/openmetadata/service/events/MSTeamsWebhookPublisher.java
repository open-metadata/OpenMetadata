package org.openmetadata.service.events;

import java.util.concurrent.TimeUnit;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Invocation;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.events.EventResource;
import org.openmetadata.service.slack.SlackRetriableException;
import org.openmetadata.service.slack.TeamsMessage;
import org.openmetadata.service.util.ChangeEventParser;

@Slf4j
public class MSTeamsWebhookPublisher extends WebhookPublisher {
  private final Invocation.Builder target;
  private final Client client;

  public MSTeamsWebhookPublisher(Webhook webhook, CollectionDAO dao) {
    super(webhook, dao);
    String msTeamsWebhookURL = webhook.getEndpoint().toString();
    ClientBuilder clientBuilder = ClientBuilder.newBuilder();
    clientBuilder.connectTimeout(webhook.getTimeout(), TimeUnit.SECONDS);
    clientBuilder.readTimeout(webhook.getReadTimeout(), TimeUnit.SECONDS);
    client = clientBuilder.build();
    target = client.target(msTeamsWebhookURL).request();
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
  public void publish(EventResource.ChangeEventList events) throws EventPublisherException {
    for (ChangeEvent event : events.getData()) {
      try {
        TeamsMessage teamsMessage = ChangeEventParser.buildTeamsMessage(event);
        Response response =
            target.post(javax.ws.rs.client.Entity.entity(teamsMessage, MediaType.APPLICATION_JSON_TYPE));
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
