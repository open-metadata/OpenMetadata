package org.openmetadata.service.alerts.slack;

import java.util.concurrent.TimeUnit;

import javax.swing.event.ChangeEvent;

import org.openmetadata.service.alerts.AlertsActionPublisher;

@Slf4j
public class SlackWebhookEventPublisher extends AlertsActionPublisher {
  private final Invocation.Builder target;
  private final Client client;

  public SlackWebhookEventPublisher(Alert alert, AlertAction alertAction) {
    super(alert, alertAction);
    if (alertAction.getAlertActionType() == AlertAction.AlertActionType.SLACK_WEBHOOK) {
      Webhook webhook = JsonUtils.convertValue(alertAction.getAlertActionConfig(), Webhook.class);
      String slackWebhookURL = webhook.getEndpoint().toString();
      ClientBuilder clientBuilder = ClientBuilder.newBuilder();
      clientBuilder.connectTimeout(alertAction.getTimeout(), TimeUnit.SECONDS);
      clientBuilder.readTimeout(alertAction.getReadTimeout(), TimeUnit.SECONDS);
      client = clientBuilder.build();
      target = client.target(slackWebhookURL).request();
    } else {
      throw new IllegalArgumentException("Slack Alert Invoked with Illegal Type and Settings.");
    }
  }

  @Override
  public void onStartDelegate() {
    LOG.info("Slack Webhook Publisher Started");
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
        SlackMessage slackMessage = ChangeEventParser.buildSlackMessage(event);
        Response response =
            target.post(javax.ws.rs.client.Entity.entity(slackMessage, MediaType.APPLICATION_JSON_TYPE));
        // Successfully sent Alert, update Status
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
        LOG.error("Failed to publish event {} to slack due to {} ", event, e.getMessage());
        throw new EventPublisherException(
            String.format("Failed to publish event %s to slack due to %s ", event, e.getMessage()));
      }
    }
  }
}
