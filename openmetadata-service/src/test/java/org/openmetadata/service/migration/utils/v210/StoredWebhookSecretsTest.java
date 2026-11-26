package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;

class StoredWebhookSecretsTest {
  private static final String KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";
  private static final String OTHER_KEY = "ihZpp5gmmDvVsgoOG6OVivKWwC9vd5JQ5x4uDcWn7mY=";
  // Written with KEY by the 2.1 pre-release that encrypted each secret for its holder: the client
  // secret and the endpoint of the destination BOUND_DESTINATION, and the signing key of the
  // generic webhook of the user BOUND_USER.
  private static final UUID BOUND_DESTINATION =
      UUID.fromString("6f1c2a5e-8d4b-4c3a-9e7f-1a2b3c4d5e6f");
  private static final UUID BOUND_USER = UUID.fromString("0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d");
  private static final String BOUND_CLIENT_SECRET =
      "fernet:bound:gAAAAABq-NEZOSjN4Q906mjL3JJOo4jBS2NjWeMjetHbUepul_nzLH6XlOgxh4_Cxhmd0qOuH0o8nUnK4f6C270vJ_5Tuqj-Iw==";
  private static final String BOUND_ENDPOINT =
      "fernet:bound:gAAAAABq-NEZwdFgT9p1EIUzz6hV5yVK8FNa5bTHD5d03J1991QcrHbZd35JL67X5Numb8mKyRRc4-Q4Vcdj5KOPU6zDFjJekA1kfOkRv8WhQEqZvLmw70A=";
  private static final String BOUND_SIGNING_KEY =
      "fernet:bound:gAAAAABq-NEZgtwg2IfiGiAcoGfwHzaeNtwr55H1ABD7cSwZGdWCjl4Eqv47pG4VeZReXtIN6p1bHABzLrbjpHSBQ7e3kivm3Q==";

  private StoredWebhookSecrets secrets;

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(KEY);
    secrets = new StoredWebhookSecrets(Fernet.getInstance().getCachedKeys());
  }

  @AfterEach
  void tearDown() {
    Fernet.getInstance().setFernetKey((String) null);
  }

  @Test
  void anAlertStoredInTheClearIsEncryptedAndCiphertextIsKeptAsStored() {
    String signingKey = Fernet.getInstance().encrypt("hmac-key");
    String clientSecret = Fernet.getInstance().encrypt("oauth-secret");
    JsonNode alert =
        alert(
            """
            [{"id": "%s", "type": "Slack", "enabled": true,
              "config": {"endpoint": "https://hooks.slack.com/x"}},
             {"id": "%s", "type": "Webhook", "enabled": true,
              "config": {"endpoint": "https://e/1", "headers": {"Authorization": "a token"},
                         "authType": {"type": "bearer", "secretKey": "%s"}}},
             {"id": "%s", "type": "Webhook", "enabled": true,
              "config": {"endpoint": "https://e/2", "authType": {"type": "oauth2",
                         "tokenUrl": "https://t", "clientId": "c", "clientSecret": "%s"}}},
             {"id": "%s", "type": "Email", "enabled": true,
              "config": {"receivers": ["a@example.com"]}}]"""
                .formatted(
                    UUID.randomUUID(),
                    UUID.randomUUID(),
                    signingKey,
                    UUID.randomUUID(),
                    clientSecret,
                    UUID.randomUUID()));

    assertTrue(secrets.encryptAlert(alert));

    assertEquals("https://hooks.slack.com/x", opened(configAt(alert, 0, "/endpoint")));
    assertEquals("a token", opened(configAt(alert, 1, "/headers/Authorization")));
    assertEquals(signingKey, configAt(alert, 1, "/authType/secretKey"));
    assertEquals("c", opened(configAt(alert, 2, "/authType/clientId")));
    assertEquals(clientSecret, configAt(alert, 2, "/authType/clientSecret"));
    assertEquals("a@example.com", configAt(alert, 3, "/receivers/0"));
    String recorded = alert.at("/changeDescription/fieldsUpdated/0/newValue").asText();
    assertTrue(recorded.contains(StoredWebhookSecrets.MASK), recorded);
    assertFalse(recorded.contains("a token"), recorded);
  }

  // Releases before 2.1 sent the endpoint and header values as stored, so whatever is stored there
  // is encrypted as it is and still sent as it was; only the credentials they encrypted stay.
  @Test
  void ciphertextAtAFieldSentAsStoredIsEncryptedAsItIs() {
    String endpoint = Fernet.getInstance().encrypt("https://hooks.example.com/x");
    String header = Fernet.getInstance().encrypt("a header value");
    String signingKey = Fernet.getInstance().encrypt("hmac-key");
    JsonNode alert =
        alert(
            """
            [{"id": "%s", "type": "Webhook", "enabled": true,
              "config": {"endpoint": "%s", "headers": {"Authorization": "%s"},
                         "authType": {"type": "bearer", "secretKey": "%s"}}}]"""
                .formatted(UUID.randomUUID(), endpoint, header, signingKey));

    assertTrue(secrets.encryptAlert(alert));

    assertEquals(endpoint, opened(configAt(alert, 0, "/endpoint")));
    assertEquals(header, opened(configAt(alert, 0, "/headers/Authorization")));
    assertEquals(signingKey, configAt(alert, 0, "/authType/secretKey"));
  }

  @Test
  void aValueBoundToItsDestinationIsEncryptedAgainWithTheServerKey() {
    JsonNode alert = alertBoundBefore(BOUND_DESTINATION);

    assertTrue(secrets.encryptAlert(alert));

    assertEquals("a client secret", opened(configAt(alert, 0, "/authType/clientSecret")));
    assertEquals("https://hooks.example.com/bound", opened(configAt(alert, 0, "/endpoint")));
  }

  // A bound value opens only for the holder it was written for, and only with the key it was
  // written with: anywhere else it stays as stored and is entered again.
  @Test
  void aBoundValueThatDoesNotOpenStaysAsStored() {
    JsonNode anotherDestination = alertBoundBefore(UUID.randomUUID());
    secrets.encryptAlert(anotherDestination);
    Fernet.getInstance().setFernetKey(OTHER_KEY);
    JsonNode anotherKey = alertBoundBefore(BOUND_DESTINATION);
    new StoredWebhookSecrets(Fernet.getInstance().getCachedKeys()).encryptAlert(anotherKey);

    for (JsonNode alert : new JsonNode[] {anotherDestination, anotherKey}) {
      assertEquals(BOUND_CLIENT_SECRET, configAt(alert, 0, "/authType/clientSecret"));
      assertEquals(BOUND_ENDPOINT, configAt(alert, 0, "/endpoint"));
    }
  }

  @Test
  void aProfileIsEncryptedWithTheServerKeyAsAnAlertIs() {
    String header = Fernet.getInstance().encrypt("a header value");
    String profile =
        """
        {"subscription": {
          "generic": {"endpoint": "https://hooks.example.com/g",
                      "authType": {"type": "bearer", "secretKey": "%s"}},
          "slack": {"endpoint": "https://hooks.slack.com/s",
                    "headers": {"Authorization": "%s"}},
          "msTeams": {"endpoint": "https://hooks.example.com/t",
                      "authType": {"type": "oauth2", "tokenUrl": "https://t", "clientId": "c",
                                   "clientSecret": "entered in the clear"}}}}"""
            .formatted(BOUND_SIGNING_KEY, header);
    JsonNode user =
        JsonUtils.readTree(
            """
            {"id": "%s", "name": "u", "profile": %s,
             "changeDescription": {"fieldsUpdated": [
               {"name": "profile", "oldValue": "{}", "newValue": %s}]}}"""
                .formatted(BOUND_USER, profile, JsonUtils.pojoToJson(profile)));

    assertTrue(secrets.encryptProfileEntity("user", user));

    assertEquals("a signing key", opened(webhookAt(user, "generic", "/authType/secretKey")));
    assertEquals(header, opened(webhookAt(user, "slack", "/headers/Authorization")));
    assertEquals(
        "entered in the clear", opened(webhookAt(user, "msTeams", "/authType/clientSecret")));
    String recorded = user.at("/changeDescription/fieldsUpdated/0/newValue").asText();
    assertTrue(recorded.contains(StoredWebhookSecrets.MASK), recorded);
    assertFalse(recorded.contains("entered in the clear"), recorded);
  }

  @Test
  void aStoredChangeEventOfAnAlertKeepsOnlyTheMask() {
    String secret = Fernet.getInstance().encrypt("an event value");
    JsonNode event =
        JsonUtils.readTree(
            """
            {"entityType": "eventsubscription",
             "entity": %s}"""
                .formatted(JsonUtils.pojoToJson(JsonUtils.pojoToJson(alertWithHeader(secret)))));

    assertTrue(StoredWebhookSecrets.maskChangeEvent(event, StoredWebhookSecrets::maskAlert));
    assertFalse(event.path("entity").asText().contains(secret));
  }

  private static String opened(String value) {
    assertTrue(Fernet.isTokenized(value), value);
    assertFalse(value.startsWith(StoredWebhookSecrets.BOUND_PREFIX), value);
    return Fernet.getInstance().decrypt(value);
  }

  private static String configAt(JsonNode alert, int index, String field) {
    return alert.path("destinations").get(index).path("config").at(field).asText();
  }

  private static String webhookAt(JsonNode entity, String slot, String field) {
    return entity.at("/profile/subscription/" + slot).at(field).asText();
  }

  private static JsonNode alertBoundBefore(UUID destinationId) {
    return alert(
        """
        [{"id": "%s", "type": "Webhook", "enabled": true,
          "config": {"endpoint": "%s", "authType": {"type": "oauth2", "tokenUrl": "https://t",
                     "clientId": "c", "clientSecret": "%s"}}}]"""
            .formatted(destinationId, BOUND_ENDPOINT, BOUND_CLIENT_SECRET));
  }

  private static JsonNode alertWithHeader(String header) {
    return alert(
        """
        [{"id": "%s", "type": "Webhook", "enabled": true,
          "config": {"endpoint": "https://e/4", "headers": {"Authorization": "%s"}}}]"""
            .formatted(UUID.randomUUID(), header));
  }

  private static JsonNode alert(String destinations) {
    return JsonUtils.readTree(
        """
        {"id": "%s", "name": "legacy", "destinations": %s,
         "changeDescription": {"fieldsUpdated": [
           {"name": "destinations", "oldValue": "[]", "newValue": %s}]}}"""
            .formatted(UUID.randomUUID(), destinations, JsonUtils.pojoToJson(destinations)));
  }
}
