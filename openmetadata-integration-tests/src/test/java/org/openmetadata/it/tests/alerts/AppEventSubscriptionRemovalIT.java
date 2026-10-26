package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.function.Executable;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.CreateApp;
import org.openmetadata.schema.entity.app.CreateAppMarketPlaceDefinitionReq;
import org.openmetadata.schema.entity.app.NativeAppPermission;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.entity.app.ScheduleType;
import org.openmetadata.schema.entity.app.ScheduledExecutionContext;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * An app's alerts come from its own code, never from its marketplace definition. A signed-up user
 * can own an app and its definition, since neither has an owner, so whatever an install did with
 * the definition was theirs to decide.
 */
// Installs and deletes apps, which walks every app's scheduler job: isolated like AppsResourceIT.
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class AppEventSubscriptionRemovalIT {

  private static final RequestOptions JSON_PATCH =
      RequestOptions.builder().header("Content-Type", "application/json-patch+json").build();
  private static final String EVENT_SUBSCRIPTIONS = "/eventSubscriptions";

  /** An app and its definition, both owned by a signed-up user who acts through {@code asOwner}. */
  private record OwnedApp(App app, AppMarketPlaceDefinition definition, HttpClient asOwner) {}

  @Test
  void anAlertWrittenIntoADefinitionIsNeverCreatedByAnInstall(final TestNamespace ns)
      throws Exception {
    final String appName = "tapApp" + System.currentTimeMillis();
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      final OwnedApp owned = ownedApp(ns, appName);
      final String alertName = ns.prefix("tap");
      final String definitionPath = "/v1/apps/marketplace/" + owned.definition().getId();

      assertBadRequest(
          () ->
              patch(owned.asOwner(), definitionPath, plantedAlert(alertName, receiver.url("/t"))));
      owned.asOwner().executeForString(HttpMethod.POST, "/v1/apps/schedule/" + appName, null);

      assertAlertMissing(alertName);
    } finally {
      uninstall(appName);
    }
  }

  private static OwnedApp ownedApp(final TestNamespace ns, final String appName) {
    final AppMarketPlaceDefinition definition = createDefinition(appName);
    final App app = createApp(definition);
    final User user = UserTestFactory.createUser(ns, "appOwner");
    final HttpClient asOwner =
        SdkClients.createClient(user.getName(), user.getEmail(), new String[] {}).getHttpClient();
    claim(asOwner, "/v1/apps/marketplace/" + definition.getId(), user);
    claim(asOwner, "/v1/apps/" + app.getId(), user);
    return new OwnedApp(app, definition, asOwner);
  }

  private static AppMarketPlaceDefinition createDefinition(final String appName) {
    final CreateAppMarketPlaceDefinitionReq request =
        new CreateAppMarketPlaceDefinitionReq()
            .withName(appName)
            .withDisplayName(appName)
            .withDescription("App whose definition nobody owns")
            .withFeatures("none")
            .withDeveloper("Test Developer")
            .withDeveloperUrl("https://www.example.com")
            .withPrivacyPolicyUrl("https://www.example.com/privacy")
            .withSupportEmail("support@example.com")
            .withClassName("org.openmetadata.service.resources.apps.TestApp")
            .withAppType(AppType.Internal)
            .withScheduleType(ScheduleType.Scheduled)
            .withRuntime(new ScheduledExecutionContext().withEnabled(true))
            .withAppConfiguration(new HashMap<>())
            .withPermission(NativeAppPermission.All);
    return admin()
        .execute(HttpMethod.POST, "/v1/apps/marketplace", request, AppMarketPlaceDefinition.class);
  }

  private static App createApp(final AppMarketPlaceDefinition definition) {
    final CreateApp request =
        new CreateApp()
            .withName(definition.getName())
            .withDisplayName(definition.getDisplayName())
            .withAppConfiguration(definition.getAppConfiguration())
            .withAppSchedule(new AppSchedule().withScheduleTimeline(ScheduleTimeline.HOURLY));
    return admin().execute(HttpMethod.POST, "/v1/apps", request, App.class);
  }

  private static void claim(final HttpClient client, final String path, final User user) {
    final Map<String, Object> owner = Map.of("id", user.getId().toString(), "type", "user");
    patch(client, path, List.of(Map.of("op", "add", "path", "/owners", "value", List.of(owner))));
  }

  private static List<Map<String, Object>> plantedAlert(final String name, final String endpoint) {
    final Map<String, Object> webhook =
        Map.of("category", "External", "type", "Webhook", "config", Map.of("endpoint", endpoint));
    final Map<String, Object> alert =
        Map.of(
            "name",
            name,
            "alertType",
            "Notification",
            "resources",
            List.of("all"),
            "destinations",
            List.of(webhook));
    return List.of(
        Map.of("op", "add", "path", EVENT_SUBSCRIPTIONS, "value", List.of(alert)),
        Map.of("op", "add", "path", "/description", "value", "Edited by its owner"));
  }

  private static void patch(
      final HttpClient client, final String path, final List<Map<String, Object>> operations) {
    client.executeForString(HttpMethod.PATCH, path, JsonUtils.pojoToJson(operations), JSON_PATCH);
  }

  private static void assertBadRequest(final Executable request) {
    assertEquals(400, assertThrows(OpenMetadataException.class, request).getStatusCode());
  }

  private static void assertAlertMissing(final String alertName) {
    final OpenMetadataException missing =
        assertThrows(
            OpenMetadataException.class,
            () -> SdkClients.adminClient().eventSubscriptions().getByName(alertName));
    assertEquals(404, missing.getStatusCode());
  }

  private static HttpClient admin() {
    return SdkClients.adminClient().getHttpClient();
  }

  private static void uninstall(final String appName) {
    deleteIfPresent("/v1/apps/name/" + appName + "?hardDelete=true");
    deleteIfPresent("/v1/apps/marketplace/name/" + appName + "?hardDelete=true");
  }

  // The test may already have deleted it, or failed before creating it.
  private static void deleteIfPresent(final String path) {
    try {
      admin().execute(HttpMethod.DELETE, path, null, Void.class);
    } catch (OpenMetadataException e) {
      if (e.getStatusCode() != 404) {
        throw e;
      }
    }
  }
}
