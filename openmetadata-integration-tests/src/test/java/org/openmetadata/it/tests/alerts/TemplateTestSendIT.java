package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
      NotificationTemplateValidationResponse answer =
          send("<p>Sent through the channel</p>", receiver);

      assertTrue(answer.getIsValid());
      List<RecordingReceiver.Received> received = receiver.received();
      assertEquals(1, received.size());
      assertEquals(HOOK, received.getFirst().path());
      assertTrue(received.getFirst().body().contains("blocks"), "the Slack channel's own format");
      assertTrue(received.getFirst().body().contains("Sent through the channel"));
    }
  }

  @Test
  void aMessageTooLargeForItsChannelIsAnsweredAsABodyError() throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      String body = "<p>" + "word ".repeat(12_000) + "</p>";

      NotificationTemplateValidationResponse answer = send(body, receiver);

      assertFalse(answer.getIsValid());
      assertTrue(answer.getBodyError().startsWith("Too large to send to Slack"));
      assertTrue(receiver.received().isEmpty());
    }
  }

  private static NotificationTemplateValidationResponse send(
      String body, RecordingReceiver receiver) throws Exception {
    NotificationTemplateSendRequest request =
        new NotificationTemplateSendRequest()
            .withRenderRequest(
                new NotificationTemplateRenderRequest()
                    .withTemplateSubject("A subject")
                    .withTemplateBody(body)
                    .withResource(Entity.TABLE))
            .withDestinations(List.of(AlertFixtures.external(SLACK, receiver.url(HOOK))));
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, SEND_PATH, request, NotificationTemplateValidationResponse.class);
  }
}
