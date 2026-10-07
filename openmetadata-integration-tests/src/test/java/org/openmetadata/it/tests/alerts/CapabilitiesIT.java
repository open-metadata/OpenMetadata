package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.AlertCapabilities;
import org.openmetadata.schema.api.events.AlertCapabilitiesRequest;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.AlertSourceCapability;
import org.openmetadata.schema.api.events.CreateEventSubscription.AlertType;
import org.openmetadata.schema.entity.events.AlertSourceKind;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;

/** What the form asks before a save, over the wire. */
@ExtendWith(TestNamespaceExtension.class)
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

  // Names are never looked up, so the answer does not depend on which services exist.
  @Test
  void warningDoesNotDependOnWhichServicesExist(TestNamespace ns) {
    DashboardService dashboards = DashboardServiceTestFactory.createMetabase(ns);
    ArgumentsInput byName =
        new ArgumentsInput()
            .withName("filterByFqn")
            .withEffect(ArgumentsInput.Effect.INCLUDE)
            .withArguments(
                List.of(
                    new Argument()
                        .withName("fqnList")
                        .withInput(List.of(dashboards.getFullyQualifiedName()))));

    AlertCapabilities capabilities =
        ask(
            new AlertCapabilitiesRequest()
                .withAlertType(AlertType.NOTIFICATION)
                .withSources(List.of("table", "dashboard"))
                .withInput(new AlertFilteringInput().withFilters(List.of(byName))));

    assertNull(warningOf(capabilities, "table"));
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

  private static String warningOf(AlertCapabilities capabilities, String name) {
    return capabilities.getSources().stream()
        .filter(source -> name.equals(source.getName()))
        .findFirst()
        .orElseThrow()
        .getWarning();
  }

  private static AlertCapabilities ask(AlertType alertType, List<String> sources) {
    return ask(new AlertCapabilitiesRequest().withAlertType(alertType).withSources(sources));
  }

  private static AlertCapabilities ask(AlertCapabilitiesRequest request) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, PATH, request, AlertCapabilities.class);
  }
}
