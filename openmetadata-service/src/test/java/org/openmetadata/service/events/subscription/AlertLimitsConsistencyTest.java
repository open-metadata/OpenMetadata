package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

/** The request schemas and AlertLimits state the same bounds, so neither can drift alone. */
class AlertLimitsConsistencyTest {

  private static final String CREATE = "/json/schema/events/api/createEventSubscription.json";
  private static final String TEST_SEND =
      "/json/schema/events/api/testEventSubscriptionDestination.json";
  private static final String TEMPLATE_SEND =
      "/json/schema/api/events/notificationTemplateSendRequest.json";

  @Test
  void aNewAlertsBatchSizeIsBoundedAsAlertLimitsSays() throws IOException {
    JsonNode batchSize = property(CREATE, "batchSize");

    assertEquals(AlertLimits.MAX_BATCH_SIZE, batchSize.get("maximum").asInt());
    assertEquals(1, batchSize.get("minimum").asInt());
  }

  @Test
  void everyListOfDestinationsIsBoundedAsAlertLimitsSays() throws IOException {
    for (String schema : new String[] {CREATE, TEST_SEND, TEMPLATE_SEND}) {
      JsonNode destinations = property(schema, "destinations");

      assertEquals(AlertLimits.MAX_DESTINATIONS, destinations.get("maxItems").asInt(), schema);
    }
  }

  private static JsonNode property(String schema, String name) throws IOException {
    try (InputStream in = AlertLimitsConsistencyTest.class.getResourceAsStream(schema)) {
      return JsonUtils.readTree(new String(in.readAllBytes())).get("properties").get(name);
    }
  }
}
