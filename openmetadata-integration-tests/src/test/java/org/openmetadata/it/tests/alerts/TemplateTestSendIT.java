package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.SLACK;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.events.NotificationTemplateRenderRequest;
import org.openmetadata.schema.api.events.NotificationTemplateSendRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

class TemplateTestSendIT {
  private static final String SEND_PATH = "/v1/notificationTemplates/send";
  private static final String HOOK = "/template-test-send";

  @Test
  void goesThroughTheChannel() throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      NotificationTemplateSendRequest request =
          new NotificationTemplateSendRequest()
              .withRenderRequest(
                  new NotificationTemplateRenderRequest()
                      .withTemplateSubject("A subject")
                      .withTemplateBody("<p>Sent through the channel</p>")
                      .withResource(Entity.TABLE))
              .withDestinations(List.of(AlertFixtures.external(SLACK, receiver.url(HOOK))));

      NotificationTemplateValidationResponse answer =
          SdkClients.adminClient()
              .getHttpClient()
              .execute(
                  HttpMethod.POST,
                  SEND_PATH,
                  request,
                  NotificationTemplateValidationResponse.class);

      assertTrue(answer.getIsValid());
      List<RecordingReceiver.Received> received = receiver.received();
      assertEquals(1, received.size());
      assertEquals(HOOK, received.getFirst().path());
      assertTrue(received.getFirst().body().contains("blocks"), "the Slack channel's own format");
      assertTrue(received.getFirst().body().contains("Sent through the channel"));
    }
  }
}
