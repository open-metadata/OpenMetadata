package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.events.AlertCapabilities;
import org.openmetadata.schema.api.events.AlertCapabilitiesRequest;
import org.openmetadata.schema.api.events.AlertSourceCapability;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.AlertSourceKind;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;

/** What the form asks before a save, over the wire. */
class CapabilitiesIT {

  private static final String PATH = "/v1/events/subscriptions/capabilities";

  @Test
  void listsEverySourceWithItsKind() {
    AlertCapabilities capabilities = ask(AlertType.OBSERVABILITY, List.of("table"));

    assertEquals(8, capabilities.getSources().size());
    assertTrue(
        capabilities.getSources().stream()
            .allMatch(source -> source.getKind() == AlertSourceKind.ENTITY));
    assertTrue(selected(capabilities, "table"));
    assertFalse(selected(capabilities, "topic"));
    assertFalse(capabilities.getTriggers().isEmpty());
  }

  // Offered in the form, never enforced on save.
  @Test
  void offersTheRecipientsInsideThePlatformTheSourcesReach() {
    AlertCapabilities capabilities = ask(AlertType.NOTIFICATION, List.of("task"));

    assertEquals(
        List.of(
            SubscriptionCategory.ASSIGNEES,
            SubscriptionCategory.OWNERS,
            SubscriptionCategory.MENTIONS),
        capabilities.getRecipientCategories());
  }

  @Test
  void invalidSelectionIs400() {
    OpenMetadataException refused =
        assertThrows(
            OpenMetadataException.class,
            () -> ask(AlertType.NOTIFICATION, List.of("table", "conversation")));

    assertEquals(400, refused.getStatusCode());
    assertTrue(String.valueOf(refused.getMessage()).contains("different kinds"));
  }

  @Test
  void requiresViewPermission() throws Exception {
    String body =
        JsonUtils.pojoToJson(new AlertCapabilitiesRequest().withAlertType(AlertType.NOTIFICATION));
    HttpRequest withoutAToken =
        HttpRequest.newBuilder(URI.create(SdkClients.getServerUrl() + PATH))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();

    HttpResponse<String> answer =
        HttpClient.newHttpClient().send(withoutAToken, HttpResponse.BodyHandlers.ofString());

    assertEquals(401, answer.statusCode());
  }

  private static boolean selected(AlertCapabilities capabilities, String name) {
    return capabilities.getSources().stream()
        .filter(source -> name.equals(source.getName()))
        .findFirst()
        .map(AlertSourceCapability::getSelected)
        .orElseThrow();
  }

  private static AlertCapabilities ask(AlertType alertType, List<String> sources) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            PATH,
            new AlertCapabilitiesRequest().withAlertType(alertType).withSources(sources),
            AlertCapabilities.class);
  }
}
