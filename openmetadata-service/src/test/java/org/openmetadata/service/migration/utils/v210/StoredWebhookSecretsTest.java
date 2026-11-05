package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.BoundCiphertext;
import org.openmetadata.service.secrets.SecretOwner;

class StoredWebhookSecretsTest {
  private static final String KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";
  private static final UUID SLACK = UUID.randomUUID();
  private static final UUID SIGNED = UUID.randomUUID();
  private static final UUID OAUTH = UUID.randomUUID();
  private static final UUID STORED_TWICE = UUID.randomUUID();
  private static final UUID HEADER = UUID.randomUUID();
  private static final UUID EMAIL = UUID.randomUUID();

  private StoredWebhookSecrets secrets;

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(KEY);
    secrets = new StoredWebhookSecrets(Fernet.getInstance().getCachedKeys());
  }

  @Test
  void anAlertKeepsTheCredentialsReleasesBefore21EncryptedAndLeavesTheRestToEnterAgain() {
    String storedTwice = legacy("a value stored twice");
    String header = legacy("a header value");
    JsonNode alert = alert(storedTwice, header);

    assertTrue(secrets.bindAlert(alert, storedTwice::equals));
    String once = JsonUtils.pojoToJson(alert);
    assertFalse(secrets.bindAlert(alert, storedTwice::equals));
    assertEquals(once, JsonUtils.pojoToJson(alert));

    assertEquals("https://hooks.slack.com/x", opened(alert, 0, SLACK, "/endpoint"));
    assertEquals("hmac-key", opened(alert, 1, SIGNED, "/authType/secretKey"));
    assertEquals("client", opened(alert, 2, OAUTH, "/authType/clientId"));
    assertEquals("oauth-secret", opened(alert, 2, OAUTH, "/authType/clientSecret"));
    assertEquals(storedTwice, configAt(alert, 3, "/authType/clientSecret"));
    assertEquals(header, configAt(alert, 4, "/headers/Authorization"));
    assertEquals("a@example.com", configAt(alert, 5, "/receivers/0"));
    alert.path("destinations").forEach(d -> assertTrue(d.path("enabled").asBoolean()));
    String recorded = alert.at("/changeDescription/fieldsUpdated/0/newValue").asText();
    assertTrue(recorded.contains(StoredWebhookSecrets.MASK), recorded);
    assertFalse(recorded.contains(storedTwice), recorded);
  }

  @Test
  void aProfileBindsWhatWasEnteredAndCarriesNoCiphertextOver() {
    UUID userId = UUID.randomUUID();
    String header = legacy("a header value");
    String profile =
        """
        {"subscription": {
          "generic": {"endpoint": "https://hooks.example.com/g",
                      "authType": {"type": "oauth2", "tokenUrl": "https://t", "clientId": "c",
                                   "clientSecret": "entered in the clear"}},
          "slack": {"endpoint": "https://hooks.slack.com/s",
                    "headers": {"Authorization": "%s"}}}}"""
            .formatted(header);
    JsonNode user =
        JsonUtils.readTree(
            """
            {"id": "%s", "name": "u", "profile": %s,
             "changeDescription": {"fieldsUpdated": [
               {"name": "profile", "oldValue": "{}", "newValue": %s}]}}"""
                .formatted(userId, profile, JsonUtils.pojoToJson(profile)));

    assertTrue(secrets.bindProfileEntity("user", user));

    SecretOwner generic =
        SecretOwner.builder("user").id(userId).literal("webhook").literal("generic").build();
    String bound = user.at("/profile/subscription/generic/authType/clientSecret").asText();
    assertEquals(
        Optional.of("entered in the clear"),
        BoundCiphertext.decrypt(generic, "/authType/clientSecret", bound));
    assertEquals(header, user.at("/profile/subscription/slack/headers/Authorization").asText());
    String recorded = user.at("/changeDescription/fieldsUpdated/0/newValue").asText();
    assertTrue(recorded.contains(StoredWebhookSecrets.MASK), recorded);
    assertFalse(recorded.contains("entered in the clear"), recorded);
  }

  @Test
  void theFrozenRulesAndTheServerOpenEachOthersValues() {
    UUID destination = UUID.randomUUID();
    SecretOwner owner = SecretOwner.builder("alertdestination").id(destination).build();
    String written = BoundCiphertext.encrypt(owner, "/endpoint", "https://hooks.example.com/x");

    assertEquals(
        Optional.of("https://hooks.example.com/x"),
        secrets.openBound(
            StoredWebhookSecrets.alertDestinationOwner(destination), "/endpoint", written));
  }

  @Test
  void aStoredChangeEventOfAnAlertKeepsOnlyTheMask() {
    String secret = legacy("an event value");
    JsonNode event =
        JsonUtils.readTree(
            """
            {"entityType": "eventsubscription",
             "entity": %s}"""
                .formatted(JsonUtils.pojoToJson(JsonUtils.pojoToJson(alert(secret, secret)))));

    assertTrue(StoredWebhookSecrets.maskChangeEvent(event, StoredWebhookSecrets::maskAlert));
    assertFalse(event.path("entity").asText().contains(secret));
  }

  @Test
  void theCopyCheckReadsEveryTableButTheLargeOnesThatCannotHoldASecret() {
    List.of(
            "dbservice_entity",
            "llm_service_entity",
            "ingestion_pipeline_entity",
            "user_entity",
            "team_entity",
            "workflow_definition_entity",
            "installed_apps",
            "apps_marketplace",
            "automations_workflow",
            "openmetadata_settings",
            "test_suite",
            "user_session",
            "user_tokens",
            "context_plugin_entity",
            "a_table_a_distribution_adds")
        .forEach(table -> assertTrue(StoredCiphertextCopies.isRead(table), table));
    List.of(
            "table_entity",
            "glossary_term_entity",
            "event_subscription_entity",
            "entity_extension",
            "change_event",
            "successful_sent_change_events",
            "consumers_dlq",
            "entity_relationship",
            "agent_execution_entity",
            "mcp_execution_entity",
            "entity_extension_time_series",
            "workflow_instance_state_time_series")
        .forEach(table -> assertFalse(StoredCiphertextCopies.isRead(table), table));
  }

  private String opened(JsonNode alert, int index, UUID destination, String field) {
    String value = configAt(alert, index, field);
    assertTrue(value.startsWith(StoredWebhookSecrets.BOUND_PREFIX), value);
    SecretOwner owner = SecretOwner.builder("alertdestination").id(destination).build();
    return BoundCiphertext.decrypt(owner, field, value).orElseThrow();
  }

  private static String configAt(JsonNode alert, int index, String field) {
    return alert.path("destinations").get(index).path("config").at(field).asText();
  }

  private static String legacy(String secret) {
    return Fernet.getInstance().encrypt(secret);
  }

  private static JsonNode alert(String storedTwice, String header) {
    String destinations =
        """
        [{"id": "%s", "type": "Slack", "enabled": true,
          "config": {"endpoint": "https://hooks.slack.com/x"}},
         {"id": "%s", "type": "Webhook", "enabled": true,
          "config": {"endpoint": "https://e/1", "authType": {"type": "bearer", "secretKey": "%s"}}},
         {"id": "%s", "type": "Webhook", "enabled": true,
          "config": {"endpoint": "https://e/2", "authType": {"type": "oauth2",
                     "tokenUrl": "https://t", "clientId": "%s", "clientSecret": "%s"}}},
         {"id": "%s", "type": "Webhook", "enabled": true,
          "config": {"endpoint": "https://e/3", "authType": {"type": "oauth2",
                     "tokenUrl": "https://t", "clientId": "c", "clientSecret": "%s"}}},
         {"id": "%s", "type": "Webhook", "enabled": true,
          "config": {"endpoint": "https://e/4", "headers": {"Authorization": "%s"}}},
         {"id": "%s", "type": "Email", "enabled": true,
          "config": {"receivers": ["a@example.com"]}}]"""
            .formatted(
                SLACK,
                SIGNED,
                legacy("hmac-key"),
                OAUTH,
                legacy("client"),
                legacy("oauth-secret"),
                STORED_TWICE,
                storedTwice,
                HEADER,
                header,
                EMAIL);
    return JsonUtils.readTree(
        """
        {"id": "%s", "name": "legacy", "destinations": %s,
         "changeDescription": {"fieldsUpdated": [
           {"name": "destinations", "oldValue": "[]", "newValue": %s}]}}"""
            .formatted(UUID.randomUUID(), destinations, JsonUtils.pojoToJson(destinations)));
  }
}
