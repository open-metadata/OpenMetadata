package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
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

    assertTrue(secrets.bindAlert(alert, new StoredWebhookSecrets.CarriedCredentials()));
    String once = JsonUtils.pojoToJson(alert);
    assertFalse(secrets.bindAlert(alert, new StoredWebhookSecrets.CarriedCredentials()));
    assertEquals(once, JsonUtils.pojoToJson(alert));

    assertEquals("https://hooks.slack.com/x", opened(alert, 0, SLACK, "/endpoint"));
    assertEquals("hmac-key", opened(alert, 1, SIGNED, "/authType/secretKey"));
    assertEquals("client", opened(alert, 2, OAUTH, "/authType/clientId"));
    assertEquals("oauth-secret", opened(alert, 2, OAUTH, "/authType/clientSecret"));
    assertEquals(header, configAt(alert, 4, "/headers/Authorization"));
    assertEquals("a@example.com", configAt(alert, 5, "/receivers/0"));
    alert.path("destinations").forEach(d -> assertTrue(d.path("enabled").asBoolean()));
    String recorded = alert.at("/changeDescription/fieldsUpdated/0/newValue").asText();
    assertTrue(recorded.contains(StoredWebhookSecrets.MASK), recorded);
    assertFalse(recorded.contains(storedTwice), recorded);
  }

  @Test
  void aCredentialStoredInSeveralPlacesIsCarriedOverForEachDestinationThatHoldsIt() {
    String storedTwice = legacy("a value stored twice");
    JsonNode alert = alert(storedTwice, legacy("a header value"));
    JsonNode another = alert(storedTwice, legacy("another header value"));
    UUID anotherDestination = UUID.randomUUID();
    ((ObjectNode) another.path("destinations").get(3)).put("id", anotherDestination.toString());

    assertTrue(secrets.bindAlert(alert, new StoredWebhookSecrets.CarriedCredentials()));
    assertTrue(secrets.bindAlert(another, new StoredWebhookSecrets.CarriedCredentials()));

    assertEquals("a value stored twice", opened(alert, 3, STORED_TWICE, "/authType/clientSecret"));
    assertEquals(
        "a value stored twice", opened(another, 3, anotherDestination, "/authType/clientSecret"));
  }

  @Test
  void aCredentialThatDoesNotDecryptWithTheConfiguredKeysStaysAsStored() {
    String underAnotherKey = legacy("a value under another key");
    Fernet.getInstance().setFernetKey("ihZpp5gmmDvVsgoOG6OVivKWwC9vd5JQ5x4uDcWn7mY=");
    StoredWebhookSecrets otherKey = new StoredWebhookSecrets(Fernet.getInstance().getCachedKeys());
    JsonNode alert = alert(underAnotherKey, legacy("a header value"));

    otherKey.bindAlert(alert, new StoredWebhookSecrets.CarriedCredentials());

    assertEquals(underAnotherKey, configAt(alert, 3, "/authType/clientSecret"));
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
