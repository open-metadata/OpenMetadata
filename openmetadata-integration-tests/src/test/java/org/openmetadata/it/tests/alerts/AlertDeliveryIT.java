package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory.EXTERNAL;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/** Isolated for the same reason as the golden corpus: it drives a tick over inserted events. */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class AlertDeliveryIT {

  private static final String LIVE_USER = "admin";
  private static final int ONE_DAY_SECONDS = 86400;

  @Test
  void mentionOfDeletedUserStillNotifiesOthers(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription alert = createMentionAlert(ns, receiver.url("/mentions"));
      QuietAlert.settle(alert);
      String ghost = ns.prefix("ghost_user");
      ChangeEvent comment =
          conversationSaying("ping <#E::user::" + ghost + "> and <#E::user::" + LIVE_USER + ">");

      Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToJson(comment));
      DirectTick.run(alert);

      List<RecordingReceiver.Received> received = receiver.received();
      assertEquals(1, received.size(), "the live mention must still be notified");
      assertTrue(received.getFirst().body().contains(comment.getId().toString()));
    }
  }

  private static EventSubscription createMentionAlert(TestNamespace ns, String endpoint) {
    ArgumentsInput mentionsTheLiveUser =
        new ArgumentsInput()
            .withName("filterByMentionedName")
            .withEffect(ArgumentsInput.Effect.INCLUDE)
            .withArguments(
                List.of(new Argument().withName("userList").withInput(List.of(LIVE_USER))));
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("mention_alert"))
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of(Entity.CONVERSATION))
            .withInput(new AlertFilteringInput().withFilters(List.of(mentionsTheLiveUser)))
            .withEnabled(true)
            .withBatchSize(100)
            .withPollInterval(ONE_DAY_SECONDS)
            .withDestinations(
                List.of(
                    new SubscriptionDestination()
                        .withType(WEBHOOK)
                        .withCategory(EXTERNAL)
                        .withConfig(new Webhook().withEndpoint(URI.create(endpoint)))));
    UUID id = SdkClients.adminClient().eventSubscriptions().create(request).getId();
    return Entity.getEntity(Entity.EVENT_SUBSCRIPTION, id, "*", Include.NON_DELETED);
  }

  private static ChangeEvent conversationSaying(String message) {
    UUID conversationId = UUID.randomUUID();
    Conversation conversation =
        new Conversation()
            .withId(conversationId)
            .withAbout("<#E::table::golden_service.golden_db.golden_schema.orders>")
            .withEntityRef(new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE))
            .withMessage(message);
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEventType(EventType.ENTITY_CREATED)
        .withEntityType(Entity.CONVERSATION)
        .withEntityId(conversationId)
        .withUserName(LIVE_USER)
        .withTimestamp(System.currentTimeMillis())
        .withEntity(JsonUtils.pojoToJson(conversation));
  }
}
