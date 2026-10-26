package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * The schemas of requests that are never stored state AlertLimits' bound, so neither can drift
 * alone. The create schema states none: PUT sends it for alerts already stored past a bound, which
 * stay editable, so AlertLimits checks those saves itself.
 */
class AlertLimitsConsistencyTest {

  private static final String CREATE = "/json/schema/events/api/createEventSubscription.json";
  private static final String TEST_SEND =
      "/json/schema/events/api/testEventSubscriptionDestination.json";
  private static final String TEMPLATE_SEND =
      "/json/schema/api/events/notificationTemplateSendRequest.json";
  private static final String DESTINATIONS = "destinations";
  private static final String MAX_ITEMS = "maxItems";

  @Test
  void aTestSendIsBoundedAsAlertLimitsSays() throws IOException {
    for (String schema : new String[] {TEST_SEND, TEMPLATE_SEND}) {
      JsonNode destinations = property(schema, DESTINATIONS);

      assertEquals(AlertLimits.MAX_DESTINATIONS, destinations.get(MAX_ITEMS).asInt(), schema);
    }
  }

  @Test
  void theCreateSchemaLeavesAStoredAlertsBoundsToAlertLimits() throws IOException {
    JsonNode batchSize = property(CREATE, "batchSize");

    assertFalse(batchSize.has("maximum") || batchSize.has("minimum"));
    assertFalse(property(CREATE, DESTINATIONS).has(MAX_ITEMS));
  }

  private static JsonNode property(String schema, String name) throws IOException {
    try (InputStream in = AlertLimitsConsistencyTest.class.getResourceAsStream(schema)) {
      return JsonUtils.readTree(new String(in.readAllBytes())).get("properties").get(name);
    }
  }
}
