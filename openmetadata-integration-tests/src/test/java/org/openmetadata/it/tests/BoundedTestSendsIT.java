package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.TestDestinationStatus;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.events.subscription.AlertLimits;

/** A test send answers within a bound however its destinations behave, and asks a bounded list. */
class BoundedTestSendsIT {

  private static final int SILENT_DESTINATIONS = 3;
  // Each silent destination fails at its 10 s read timeout; one after another, three take 30 s.
  private static final Duration ALL_AT_ONCE = Duration.ofSeconds(25);

  @Test
  void destinationsThatNeverAnswerAreTestedTogether() throws Exception {
    try (ServerSocket silent = new ServerSocket(0, 50, InetAddress.getLoopbackAddress())) {
      List<Socket> held = holdEveryConnection(silent);
      List<SubscriptionDestination> destinations =
          IntStream.range(0, SILENT_DESTINATIONS)
              .mapToObj(index -> silentDestination(silent, index))
              .toList();

      long started = System.nanoTime();
      HttpResponse<String> answer = testSend(destinations);
      Duration took = Duration.ofNanos(System.nanoTime() - started);

      assertEquals(200, answer.statusCode(), answer.body());
      assertTrue(took.compareTo(ALL_AT_ONCE) < 0, "three silent destinations took " + took);
      for (SubscriptionDestination tested : results(answer)) {
        assertEquals(TestDestinationStatus.Status.FAILED, statusOf(tested));
      }
      for (Socket socket : held) {
        socket.close();
      }
    }
  }

  @Test
  void aTestSendOfMoreDestinationsThanAnAlertMayHoldIsRefused() throws Exception {
    List<SubscriptionDestination> tooMany =
        IntStream.range(0, AlertLimits.MAX_DESTINATIONS + 1)
            .mapToObj(index -> webhook("http://localhost:9/hook/" + index))
            .toList();

    assertEquals(400, testSend(tooMany).statusCode());
  }

  private static SubscriptionDestination silentDestination(ServerSocket silent, int index) {
    return webhook("http://localhost:" + silent.getLocalPort() + "/silent/" + index)
        .withTimeout(5)
        .withReadTimeout(10);
  }

  private static SubscriptionDestination webhook(String endpoint) {
    return new SubscriptionDestination()
        .withId(UUID.randomUUID())
        .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
        .withConfig(new Webhook().withEndpoint(URI.create(endpoint)));
  }

  private static List<Socket> holdEveryConnection(ServerSocket server) {
    List<Socket> held = new CopyOnWriteArrayList<>();
    Thread.ofVirtual()
        .start(
            () -> {
              try {
                while (!server.isClosed()) {
                  held.add(server.accept());
                }
              } catch (IOException closed) {
                // The test is over.
              }
            });
    return held;
  }

  private static HttpResponse<String> testSend(List<SubscriptionDestination> destinations)
      throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/events/subscriptions/testDestination"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json")
            .POST(
                HttpRequest.BodyPublishers.ofString(
                    JsonUtils.pojoToJson(Map.of("destinations", destinations))))
            .build();
    return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
  }

  private static List<SubscriptionDestination> results(HttpResponse<String> answer) {
    return List.of(JsonUtils.readValue(answer.body(), SubscriptionDestination[].class));
  }

  private static TestDestinationStatus.Status statusOf(SubscriptionDestination tested) {
    return JsonUtils.convertValue(tested.getStatusDetails(), TestDestinationStatus.class)
        .getStatus();
  }
}
