package org.openmetadata.service.events.subscription.msteams;

import static org.openmetadata.schema.api.events.CreateEventSubscription.SubscriptionType.MS_TEAMS_WEBHOOK;

import java.util.concurrent.TimeUnit;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Invocation;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.events.subscription.SubscriptionPublisher;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.events.EventResource;
import org.openmetadata.service.util.ChangeEventParser;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class MSTeamsPublisher extends SubscriptionPublisher {
  private final Invocation.Builder target;
  private final Client client;

  public MSTeamsPublisher(EventSubscription eventSub, CollectionDAO dao) {
    super(eventSub, dao);
    if (eventSub.getSubscriptionType() == MS_TEAMS_WEBHOOK) {
      Webhook webhook = JsonUtils.convertValue(eventSub.getSubscriptionConfig(), Webhook.class);
      String msTeamsWebhookURL = webhook.getEndpoint().toString();
      ClientBuilder clientBuilder = ClientBuilder.newBuilder();
      clientBuilder.connectTimeout(eventSub.getTimeout(), TimeUnit.SECONDS);
      clientBuilder.readTimeout(eventSub.getReadTimeout(), TimeUnit.SECONDS);
      client = clientBuilder.build();
      target = client.target(msTeamsWebhookURL).request();
    } else {
      throw new IllegalArgumentException("MsTeams Alert Invoked with Illegal Type and Settings.");
    }
  }

  @Override
  public void onStartDelegate() {
    LOG.info("MsTeams Webhook Publisher Started");
  }

  @Override
  public void onShutdownDelegate() {
    if (client != null) {
      client.close();
    }
  }

  @Override
  public void sendAlert(EventResource.ChangeEventList list) {
    for (ChangeEvent event : list.getData()) {
      long attemptTime = System.currentTimeMillis();
      try {
        TeamsMessage teamsMessage = ChangeEventParser.buildTeamsMessage(event);
        Response response =
            target.post(javax.ws.rs.client.Entity.entity(teamsMessage, MediaType.APPLICATION_JSON_TYPE));
        if (response.getStatus() >= 300 && response.getStatus() < 400) {
          // 3xx response/redirection is not allowed for callback. Set the webhook state as in error
          setErrorStatus(attemptTime, response.getStatus(), response.getStatusInfo().getReasonPhrase());
        } else if (response.getStatus() >= 300 && response.getStatus() < 600) {
          // 4xx, 5xx response retry delivering events after timeout
          setNextBackOff();
          setAwaitingRetry(attemptTime, response.getStatus(), response.getStatusInfo().getReasonPhrase());
          Thread.sleep(currentBackoffTime);
        } else if (response.getStatus() == 200) {
          setSuccessStatus(System.currentTimeMillis());
        }
      } catch (Exception e) {
        LOG.error("Failed to publish event {} to msteams due to {} ", event, e.getMessage());
        throw new EventPublisherException(
            String.format("Failed to publish event %s to msteams due to %s ", event, e.getMessage()));
      }
    }
  }
}
