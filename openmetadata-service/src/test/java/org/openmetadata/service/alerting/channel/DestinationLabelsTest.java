package org.openmetadata.service.alerting.channel;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.core.JsonPointer;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType;

class DestinationLabelsTest {

  @Test
  void aDestinationIsNamedAsTheFormShowsIt() {
    assertEquals("Webhook", label(SubscriptionCategory.EXTERNAL, SubscriptionType.WEBHOOK));
    assertEquals(
        "Microsoft Teams", label(SubscriptionCategory.EXTERNAL, SubscriptionType.MS_TEAMS));
    assertEquals("Owners (Slack)", label(SubscriptionCategory.OWNERS, SubscriptionType.SLACK));
  }

  @Test
  void aFieldIsNamedAsTheFormLabelsIt() {
    assertEquals("URL", DestinationLabels.field(JsonPointer.compile("/endpoint")));
    assertEquals(
        "'Authorization' header",
        DestinationLabels.field(JsonPointer.compile("/headers/Authorization")));
    assertEquals(
        "client secret", DestinationLabels.field(JsonPointer.compile("/authType/clientSecret")));
  }

  private static String label(SubscriptionCategory category, SubscriptionType type) {
    return DestinationLabels.of(
        new SubscriptionDestination().withCategory(category).withType(type));
  }
}
