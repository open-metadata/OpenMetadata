package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.SLACK;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.api.events.NotificationTemplateRenderRequest;
import org.openmetadata.schema.api.events.NotificationTemplateSendRequest;
import org.openmetadata.schema.api.events.NotificationTemplateValidationResponse;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

class TemplateTestSendIT {
  private static final String SEND_PATH = "/v1/notificationTemplates/send";
  private static final String HOOK = "/template-test-send";

  @Test
  void goesThroughTheChannel() throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      NotificationTemplateValidationResponse answer =
          send(
              "<p>Sent through the channel</p>", AlertFixtures.external(SLACK, receiver.url(HOOK)));

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

      NotificationTemplateValidationResponse answer =
          send(body, AlertFixtures.external(SLACK, receiver.url(HOOK)));

      assertFalse(answer.getIsValid());
      assertTrue(answer.getBodyError().startsWith("Too large to send to Slack"));
      assertTrue(receiver.received().isEmpty());
    }
  }

  /**
   * A destination sent back as it was read carries masks, so the template is sent to it with the
   * secrets stored for it, as testDestination is: before, the mask failed URL validation and
   * nothing was sent.
   */
  @Test
  void aDestinationSentAsReadIsSentWithTheSecretsStoredForIt() throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      String headerValue = "template-send-header-token";
      SubscriptionDestination masked = maskedDestinationOf(receiver, headerValue);
      Map<?, ?> config = (Map<?, ?>) masked.getConfig();
      assertEquals(PASSWORD_MASK, config.get("endpoint"));
      assertEquals(PASSWORD_MASK, ((Map<?, ?>) config.get("headers")).get("Authorization"));

      NotificationTemplateValidationResponse answer = send("<p>Sent as read</p>", masked);

      assertTrue(answer.getIsValid(), String.valueOf(answer.getBodyError()));
      assertEquals(1, receiver.received().size());
      assertEquals(HOOK, receiver.received().getFirst().path());
      assertEquals(headerValue, receiver.received().getFirst().headers().get("Authorization"));
    }
  }

  /**
   * A masked destination is sent only where its alert stores it: receivers here replace the
   * endpoint at send time, so a changed list is refused as testDestination refuses a changed
   * endpoint.
   */
  @Test
  void aMaskedDestinationIsSentOnlyWhereItsAlertStoresIt() throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      SubscriptionDestination masked = maskedDestinationOf(receiver, "header-token");
      Map<String, Object> elsewhere = new LinkedHashMap<>((Map<String, Object>) masked.getConfig());
      elsewhere.put("receivers", List.of(receiver.url("/elsewhere")));

      assertRefused(() -> send("<p>Sent elsewhere</p>", masked.withConfig(elsewhere)));
      assertTrue(receiver.received().isEmpty(), "a refused test sends nothing");
    }
  }

  private static SubscriptionDestination maskedDestinationOf(
      RecordingReceiver receiver, String headerValue) {
    EventSubscription alert =
        SdkClients.adminClient()
            .eventSubscriptions()
            .create(
                new CreateEventSubscription()
                    .withName("template-send-" + UUID.randomUUID())
                    .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
                    .withResources(List.of(Entity.TABLE))
                    .withEnabled(false)
                    .withDestinations(
                        List.of(
                            AlertFixtures.external(SLACK, receiver.url(HOOK))
                                .withConfig(
                                    new Webhook()
                                        .withEndpoint(URI.create(receiver.url(HOOK)))
                                        .withHeaders(Map.of("Authorization", headerValue))))));
    return alert.getDestinations().getFirst();
  }

  private static NotificationTemplateValidationResponse send(
      String body, SubscriptionDestination destination) throws Exception {
    NotificationTemplateSendRequest request =
        new NotificationTemplateSendRequest()
            .withRenderRequest(
                new NotificationTemplateRenderRequest()
                    .withTemplateSubject("A subject")
                    .withTemplateBody(body)
                    .withResource(Entity.TABLE))
            .withDestinations(List.of(destination));
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, SEND_PATH, request, NotificationTemplateValidationResponse.class);
  }

  private interface ThrowingRequest {
    void run() throws Exception;
  }

  private static void assertRefused(ThrowingRequest request) {
    OpenMetadataException rejected = assertThrows(OpenMetadataException.class, request::run);
    int status =
        rejected.getCause() instanceof InvalidRequestException cause
            ? cause.getStatusCode()
            : rejected.getStatusCode();
    assertEquals(400, status, rejected.getMessage());
  }
}
