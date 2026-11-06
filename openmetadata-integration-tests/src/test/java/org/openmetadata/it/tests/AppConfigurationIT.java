package org.openmetadata.it.tests;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.AppType;
import org.openmetadata.schema.entity.app.CreateApp;
import org.openmetadata.schema.entity.app.CreateAppMarketPlaceDefinitionReq;
import org.openmetadata.schema.entity.app.NativeAppPermission;
import org.openmetadata.schema.entity.app.ScheduleType;
import org.openmetadata.schema.entity.app.ScheduledExecutionContext;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.audit.AuditLogRepository;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AppConfigurationIT {
  @Test
  void appConfigurationRoundTripsWithoutRuntimeProperties(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    User owner = createOwner(ns);
    OpenMetadataClient client =
        SdkClients.createClient(owner.getName(), owner.getEmail(), new String[] {});
    String name = createDefinition(ns);
    CreateApp request =
        new CreateApp()
            .withName(name)
            .withOwners(List.of(owner.getEntityReference()))
            .withAppConfiguration(Map.of("value", "configured"));
    App app =
        ns.trackRoot(
            Entity.APPLICATION,
            admin.getHttpClient().execute(HttpMethod.POST, "/v1/apps", request, App.class));
    assertRuntimePropertiesAbsent(app);
    App updated =
        client
            .getHttpClient()
            .execute(HttpMethod.PUT, "/v1/apps", request.withDescription("updated"), App.class);
    assertRuntimePropertiesAbsent(updated);
    assertEquals("updated", updated.getDescription());
    assertEquals(app.getBot().getId(), updated.getBot().getId());
    await()
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(1))
        .untilAsserted(
            () -> {
              JsonNode data = auditEntries(client, name);
              assertFalse(data.isEmpty());
              for (JsonNode entry : data) {
                assertFalse(
                    entry.toString().contains("openMetadataServerConnection"), entry.toString());
                assertFalse(entry.toString().contains("privateConfiguration"), entry.toString());
              }
            });
    App selected =
        admin
            .getHttpClient()
            .execute(
                HttpMethod.PUT, "/v1/apps", request.withBot(app.getBot().getName()), App.class);
    assertEquals(app.getBot().getId(), selected.getBot().getId());
  }

  @Test
  void selectingAnExistingBotRequiresAnAdministrator(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    User owner = createOwner(ns);
    OpenMetadataClient client =
        SdkClients.createClient(owner.getName(), owner.getEmail(), new String[] {});
    String name = createDefinition(ns);
    CreateApp request =
        new CreateApp()
            .withName(name)
            .withOwners(List.of(owner.getEntityReference()))
            .withAppConfiguration(Map.of("value", "configured"));
    App app =
        ns.trackRoot(
            Entity.APPLICATION,
            admin.getHttpClient().execute(HttpMethod.POST, "/v1/apps", request, App.class));
    for (HttpMethod method : List.of(HttpMethod.POST, HttpMethod.PUT)) {
      OpenMetadataException failure =
          assertThrows(
              OpenMetadataException.class,
              () ->
                  client
                      .getHttpClient()
                      .execute(method, "/v1/apps", request.withBot("ingestion-bot"), App.class));
      assertEquals(403, failure.getStatusCode(), failure.getMessage());
    }
    App saved =
        admin
            .getHttpClient()
            .execute(HttpMethod.GET, "/v1/apps/" + app.getId() + "?fields=bot", null, App.class);
    assertEquals(app.getBot().getId(), saved.getBot().getId());
    assertEquals(app.getVersion(), saved.getVersion());
  }

  @Test
  void existingAppRecordsUseTheCurrentProjection(TestNamespace ns) {
    User reader = createOwner(ns);
    OpenMetadataClient client =
        SdkClients.createClient(reader.getName(), reader.getEmail(), new String[] {});
    String name = ns.prefix("app_record");
    new AuditLogRepository(Entity.getCollectionDAO())
        .write(
            new ChangeEvent()
                .withId(UUID.randomUUID())
                .withTimestamp(System.currentTimeMillis())
                .withEventType(EventType.ENTITY_UPDATED)
                .withEntityType(Entity.APPLICATION)
                .withEntityFullyQualifiedName(name)
                .withEntityId(UUID.randomUUID())
                .withUserName("admin")
                .withEntity(
                    Map.of(
                        "name",
                        name,
                        "openMetadataServerConnection",
                        Map.of("securityConfig", Map.of("jwtToken", "runtime-value")),
                        "privateConfiguration",
                        Map.of("parameter", "runtime-parameter")))
                .withChangeDescription(
                    new ChangeDescription()
                        .withFieldsUpdated(
                            List.of(
                                new FieldChange()
                                    .withName("privateConfiguration")
                                    .withNewValue("runtime-new")))));
    JsonNode entries = auditEntries(client, name);
    assertEquals(1, entries.size());
    assertFalse(entries.toString().contains("runtime-"), entries.toString());
    assertTrue(entries.get(0).has("changeEvent"));
  }

  private User createOwner(TestNamespace ns) {
    String name = ns.shortPrefix() + "owner_" + UUID.randomUUID().toString().substring(0, 6);
    return ns.trackRoot(
        Entity.USER,
        SdkClients.adminClient()
            .users()
            .create(
                new CreateUser()
                    .withName(name)
                    .withEmail(name + "@test.om.org")
                    .withRoles(List.of())));
  }

  private String createDefinition(TestNamespace ns) {
    String name = ns.shortPrefix() + "Config" + UUID.randomUUID().toString().substring(0, 6);
    AppMarketPlaceDefinition definition =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                "/v1/apps/marketplace",
                new CreateAppMarketPlaceDefinitionReq()
                    .withName(name)
                    .withDisplayName("Configuration Test")
                    .withDescription("Configuration round trip")
                    .withFeatures("configuration")
                    .withDeveloper("Test Developer")
                    .withDeveloperUrl("https://www.example.com")
                    .withPrivacyPolicyUrl("https://www.example.com/privacy")
                    .withSupportEmail("support@example.com")
                    .withClassName("org.openmetadata.service.apps.AbstractNativeApplication")
                    .withAppType(AppType.Internal)
                    .withScheduleType(ScheduleType.NoSchedule)
                    .withRuntime(new ScheduledExecutionContext().withEnabled(true))
                    .withAppConfiguration(Map.of())
                    .withPermission(NativeAppPermission.All),
                AppMarketPlaceDefinition.class);
    ns.trackRoot(Entity.APP_MARKET_PLACE_DEF, definition);
    return name;
  }

  private JsonNode auditEntries(OpenMetadataClient client, String name) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET, "/v1/audit/logs?entityType=app&entityFQN=" + name, null, JsonNode.class)
        .path("data");
  }

  private void assertRuntimePropertiesAbsent(App app) {
    assertNull(app.getOpenMetadataServerConnection());
    assertNull(app.getPrivateConfiguration());
    assertEquals(Map.of("value", "configured"), app.getAppConfiguration());
  }
}
