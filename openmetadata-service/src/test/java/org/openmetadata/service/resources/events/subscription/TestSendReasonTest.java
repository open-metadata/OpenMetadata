package org.openmetadata.service.resources.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import java.net.URI;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.alerting.channel.webhook.WebhookRequests;

/** What a failed test send reports back: redacted, bounded, and cheap whatever it quotes. */
class TestSendReasonTest {

  private static final int QUARTER_MEGABYTE = 256 * 1024;

  @Test
  void queryStringsAreRedactedAsBefore() {
    String reason =
        "failed at https://x.example.com/hook?token=abc and http://y.example.com/p done";

    assertEquals(
        "failed at https://x.example.com/hook?*** and http://y.example.com/p done",
        EventSubscriptionResource.redactUrlQueryParams(reason));
  }

  @Test
  void aReplacementCharacterInTheUrlIsKeptAsWritten() {
    assertEquals(
        "see https://x.example.com/$1/a?***",
        EventSubscriptionResource.redactUrlQueryParams("see https://x.example.com/$1/a?b=c"));
  }

  @Test
  void textWithManyUrlsAndNoQueryIsRedactedQuickly() {
    String reason = "http://".repeat(QUARTER_MEGABYTE / 7);

    assertTimeoutPreemptively(
        Duration.ofSeconds(2), () -> EventSubscriptionResource.redactUrlQueryParams(reason));
  }

  @Test
  void onlyTheStartOfALongReasonIsReturned() {
    String redacted = EventSubscriptionResource.redactUrlQueryParams("x".repeat(QUARTER_MEGABYTE));

    assertTrue(redacted.length() <= 2048, "returned " + redacted.length() + " characters");
  }

  @Test
  void aQueryValueWithABraceIsSentAsWritten() {
    try (Client client = ClientBuilder.newClient()) {
      URI sent =
          WebhookRequests.addQueryParams(
                  client.target("http://localhost/hook"), Map.of("filter", "{unclosed"))
              .getUri();

      assertEquals("filter=%7Bunclosed", sent.getRawQuery());
    }
  }
}
