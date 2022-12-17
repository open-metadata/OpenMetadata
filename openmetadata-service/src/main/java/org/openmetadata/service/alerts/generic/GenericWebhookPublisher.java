package org.openmetadata.service.alerts.generic;

import java.io.IOException;
import java.net.UnknownHostException;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import org.openmetadata.service.alerts.AlertsActionPublisher;

@Slf4j
public class GenericWebhookPublisher extends AlertsActionPublisher {
  private final Client client;
  private final Webhook webhook;

  public GenericWebhookPublisher(Alert alert, AlertAction alertAction) {
    super(alert, alertAction);
    if (alertAction.getAlertActionType() == AlertAction.AlertActionType.GENERIC_WEBHOOK) {
      webhook = JsonUtils.convertValue(alertAction.getAlertActionConfig(), Webhook.class);
      ClientBuilder clientBuilder = ClientBuilder.newBuilder();
      clientBuilder.connectTimeout(alertAction.getTimeout(), TimeUnit.SECONDS);
      clientBuilder.readTimeout(alertAction.getReadTimeout(), TimeUnit.SECONDS);
      client = clientBuilder.build();
    } else {
      throw new IllegalArgumentException("GenericWebhook Alert Invoked with Illegal Type and Settings.");
    }
  }

  @Override
  public void onStartDelegate() {
    LOG.info("Generic Webhook Publisher Started");
  }

  @Override
  public void onShutdownDelegate() {
    if (client != null) {
      client.close();
    }
  }

  private Invocation.Builder getTarget() {
    Map<String, String> authHeaders = SecurityUtil.authHeaders("admin@open-metadata.org");
    return SecurityUtil.addHeaders(client.target(webhook.getEndpoint()), authHeaders);
  }

  @Override
  public void sendAlert(EventResource.ChangeEventList list)
      throws EventPublisherException, IOException, InterruptedException {
    long attemptTime = System.currentTimeMillis();
    try {
      String json = JsonUtils.pojoToJson(list);
      Response response;
      if (webhook.getSecretKey() != null && !webhook.getSecretKey().isEmpty()) {
        String hmac = "sha256=" + CommonUtil.calculateHMAC(webhook.getSecretKey(), json);
        response = getTarget().header(RestUtil.SIGNATURE_HEADER, hmac).post(javax.ws.rs.client.Entity.json(json));
      } else {
        response = getTarget().post(javax.ws.rs.client.Entity.json(json));
      }
      LOG.debug(
          "GenericWebhook {}:{}:{} received response {}",
          alert.getName(),
          alertAction.getStatusDetails().getStatus(),
          batch.size(),
          response.getStatusInfo());
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
    } catch (Exception ex) {
      Throwable cause = ex.getCause();
      if (cause != null && cause.getClass() == UnknownHostException.class) {
        LOG.warn("Invalid webhook {} endpoint {}", webhook.getName(), webhook.getEndpoint());
        setErrorStatus(attemptTime, 400, "UnknownHostException");
      } else {
        LOG.debug("Exception occurred while publishing webhook", ex);
      }
    }
  }
}
