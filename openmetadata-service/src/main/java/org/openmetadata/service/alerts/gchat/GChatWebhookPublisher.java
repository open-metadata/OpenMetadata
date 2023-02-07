package org.openmetadata.service.alerts.gchat;

import java.util.concurrent.TimeUnit;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Invocation;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.alerts.Alert;
import org.openmetadata.schema.entity.alerts.AlertAction;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.service.alerts.AlertsActionPublisher;
import org.openmetadata.service.events.errors.EventPublisherException;
import org.openmetadata.service.resources.events.EventResource;
import org.openmetadata.service.util.ChangeEventParser;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class GChatWebhookPublisher extends AlertsActionPublisher {

  private final Invocation.Builder target;
  private final Client client;

  public GChatWebhookPublisher(Alert alert, AlertAction alertAction) {
    super(alert, alertAction);
    if (alertAction.getAlertActionType() == AlertAction.AlertActionType.G_CHAT_WEBHOOK) {
      Webhook webhook = JsonUtils.convertValue(alertAction.getAlertActionConfig(), Webhook.class);
      String gChatWebhookURL = webhook.getEndpoint().toString();
      ClientBuilder clientBuilder = ClientBuilder.newBuilder();
      clientBuilder.connectTimeout(alertAction.getTimeout(), TimeUnit.SECONDS);
      clientBuilder.readTimeout(alertAction.getReadTimeout(), TimeUnit.SECONDS);
      client = clientBuilder.build();
      target = client.target(gChatWebhookURL).request();
    } else {
      throw new IllegalArgumentException("GChat Alert Invoked with Illegal Type and Settings.");
    }
  }

  @Override
  protected void onStartDelegate() {
    LOG.info("GChat Webhook publisher started");
  }

  @Override
  protected void onShutdownDelegate() {
    if (null != client) {
      client.close();
    }
  }

  @Override
  protected void sendAlert(EventResource.ChangeEventList list) {

    for (ChangeEvent event : list.getData()) {
      long attemptTime = System.currentTimeMillis();
      try {
        GChatMessage gchatMessage = ChangeEventParser.buildGChatMessage(event);
        Response response =
            target.post(javax.ws.rs.client.Entity.entity(gchatMessage, MediaType.APPLICATION_JSON_TYPE));
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
        LOG.error("Failed to publish event {} to gchat due to {} ", event, e.getMessage());
        throw new EventPublisherException(
            String.format("Failed to publish event %s to gchat due to %s ", event, e.getMessage()));
      }
    }
  }
}
