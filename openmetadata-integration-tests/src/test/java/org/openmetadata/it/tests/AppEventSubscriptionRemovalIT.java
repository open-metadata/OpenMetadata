package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.CreateEventSubscription;
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
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * An app does not bring its own alerts. A signed-up user can own an app and its definition, since
 * neither has an owner, so whatever an install does with the definition is theirs to decide.
 */
@ExtendWith(TestNamespaceExtension.class)
class AppEventSubscriptionRemovalIT {

  private static final RequestOptions JSON_PATCH =
      RequestOptions.builder().header("Content-Type", "application/json-patch+json").build();

  @Test
  void anAlertWrittenIntoADefinitionIsNeverCreatedByAnInstall(TestNamespace ns) throws Exception {
    String appName = "tapApp" + System.currentTimeMillis();
    try {
      AppMarketPlaceDefinition definition = createDefinition(appName);
      App app = createApp(definition);
      User user = UserTestFactory.createUser(ns, "appOwner");
      HttpClient asUser = clientOf(user).getHttpClient();
      claim(asUser, "/v1/apps/marketplace/" + definition.getId(), user);
      claim(asUser, "/v1/apps/" + app.getId(), user);
      String alertName = ns.prefix("tap");

      assertThrows(
          OpenMetadataException.class,
          () ->
              patch(
                  asUser,
                  "/v1/apps/marketplace/" + definition.getId(),
                  plantedAlert(alertName, "http://localhost:9999/tap")));
      asUser.executeForString(
          HttpMethod.POST, "/v1/apps/schedule/" + appName, null, RequestOptions.builder().build());

      assertThrows(
          OpenMetadataException.class,
          () -> SdkClients.adminClient().eventSubscriptions().getByName(alertName));
    } finally {
      uninstall(appName);
    }
  }

  @Test
  void deletingAnAppLeavesAnotherUsersAlertAlone(TestNamespace ns) throws Exception {
    String appName = "keepApp" + System.currentTimeMillis();
    try {
      EventSubscription alert = createAlert(ns.prefix("kept"));
      App app = createApp(createDefinition(appName));
      User user = UserTestFactory.createUser(ns, "appOwner");
      HttpClient asUser = clientOf(user).getHttpClient();
      claim(asUser, "/v1/apps/" + app.getId(), user);

      assertThrows(
          OpenMetadataException.class,
          () -> patch(asUser, "/v1/apps/" + app.getId(), linkedAlert(alert.getId())));
      asUser.execute(
          HttpMethod.DELETE, "/v1/apps/name/" + appName + "?hardDelete=true", null, Void.class);

      assertEquals(
          alert.getId(),
          SdkClients.adminClient().eventSubscriptions().get(alert.getId().toString()).getId());
    } finally {
      uninstall(appName);
    }
  }

  private static EventSubscription createAlert(String name) {
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(name)
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("table"))
            .withEnabled(true)
            .withDestinations(
                List.of(
                    new SubscriptionDestination()
                        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
                        .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
                        .withConfig(
                            new Webhook().withEndpoint(URI.create("http://localhost:9999/kept")))));
    return SdkClients.adminClient().eventSubscriptions().create(request);
  }

  private static AppMarketPlaceDefinition createDefinition(String appName) {
    CreateAppMarketPlaceDefinitionReq request =
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
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, "/v1/apps/marketplace", request, AppMarketPlaceDefinition.class);
  }

  private static App createApp(AppMarketPlaceDefinition definition) {
    CreateApp request =
        new CreateApp()
            .withName(definition.getName())
            .withDisplayName(definition.getDisplayName())
            .withAppConfiguration(definition.getAppConfiguration())
            .withAppSchedule(new AppSchedule().withScheduleTimeline(ScheduleTimeline.HOURLY));
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, "/v1/apps", request, App.class);
  }

  private static OpenMetadataClient clientOf(User user) {
    return SdkClients.createClient(user.getName(), user.getEmail(), new String[] {});
  }

  private static void claim(HttpClient client, String path, User user) {
    patch(
        client,
        path,
        List.of(
            Map.of(
                "op",
                "add",
                "path",
                "/owners",
                "value",
                List.of(Map.of("id", user.getId().toString(), "type", "user")))));
  }

  private static List<Map<String, Object>> plantedAlert(String name, String endpoint) {
    Map<String, Object> alert =
        Map.of(
            "name",
            name,
            "alertType",
            "Notification",
            "resources",
            List.of("all"),
            "destinations",
            List.of(
                Map.of(
                    "category",
                    "External",
                    "type",
                    "Webhook",
                    "config",
                    Map.of("endpoint", endpoint))));
    return List.of(
        Map.of("op", "add", "path", "/eventSubscriptions", "value", List.of(alert)),
        Map.of("op", "add", "path", "/description", "value", "Edited by its owner"));
  }

  private static List<Map<String, Object>> linkedAlert(UUID alertId) {
    return List.of(
        Map.of(
            "op",
            "add",
            "path",
            "/eventSubscriptions",
            "value",
            List.of(Map.of("id", alertId.toString(), "type", "eventsubscription"))));
  }

  private static void patch(HttpClient client, String path, List<Map<String, Object>> operations) {
    client.executeForString(HttpMethod.PATCH, path, JsonUtils.pojoToJson(operations), JSON_PATCH);
  }

  private static void uninstall(String appName) {
    HttpClient admin = SdkClients.adminClient().getHttpClient();
    try {
      admin.execute(
          HttpMethod.DELETE, "/v1/apps/name/" + appName + "?hardDelete=true", null, Void.class);
    } catch (OpenMetadataException ignored) {
      // Already deleted by the test.
    }
    try {
      admin.execute(
          HttpMethod.DELETE,
          "/v1/apps/marketplace/name/" + appName + "?hardDelete=true",
          null,
          Void.class);
    } catch (OpenMetadataException ignored) {
      // Never created.
    }
  }
}
