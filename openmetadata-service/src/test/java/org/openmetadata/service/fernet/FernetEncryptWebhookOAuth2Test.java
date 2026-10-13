package org.openmetadata.service.fernet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType;
import org.openmetadata.schema.entity.events.authentication.WebhookOAuth2Config;
import org.openmetadata.schema.utils.JsonUtils;

class FernetEncryptWebhookOAuth2Test {

  private static final String TEST_FERNET_KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(TEST_FERNET_KEY);
  }

  @Test
  void encryptWebhookSecretKey_oauth2_encryptsClientIdAndSecret() {
    SubscriptionDestination dest = buildOAuth2Destination("my-client-id", "my-client-secret");

    List<SubscriptionDestination> result = Fernet.encryptWebhookSecretKey(List.of(dest));

    Map<String, Object> authMap = authTypeOf(result.get(0));

    String encryptedClientId = (String) authMap.get("clientId");
    String encryptedClientSecret = (String) authMap.get("clientSecret");

    assertTrue(encryptedClientId.startsWith(Fernet.FERNET_PREFIX));
    assertTrue(encryptedClientSecret.startsWith(Fernet.FERNET_PREFIX));

    assertEquals("my-client-id", Fernet.getInstance().decrypt(encryptedClientId));
    assertEquals("my-client-secret", Fernet.getInstance().decrypt(encryptedClientSecret));
  }

  @Test
  void encryptWebhookSecretKey_oauth2_alreadyEncrypted_noDoubleEncryption() {
    String preEncryptedId = Fernet.getInstance().encrypt("my-client-id");
    String preEncryptedSecret = Fernet.getInstance().encrypt("my-client-secret");

    SubscriptionDestination dest = buildOAuth2Destination(preEncryptedId, preEncryptedSecret);

    List<SubscriptionDestination> result = Fernet.encryptWebhookSecretKey(List.of(dest));

    Map<String, Object> authMap = authTypeOf(result.get(0));

    assertEquals(preEncryptedId, authMap.get("clientId"));
    assertEquals(preEncryptedSecret, authMap.get("clientSecret"));
  }

  @Test
  void encryptWebhookSecretKey_bearer_stillWorks() {
    SubscriptionDestination dest =
        buildBearerDestination(SubscriptionType.WEBHOOK, "my-secret-key");

    List<SubscriptionDestination> result = Fernet.encryptWebhookSecretKey(List.of(dest));

    Map<String, Object> authMap = authTypeOf(result.get(0));
    String encryptedKey = (String) authMap.get("secretKey");

    assertTrue(encryptedKey.startsWith(Fernet.FERNET_PREFIX));
    assertEquals("my-secret-key", Fernet.getInstance().decrypt(encryptedKey));
  }

  // Before the fix, a Slack/MS Teams/GChat destination carrying an authType was accepted by
  // validation but stored with its secrets in plaintext, because these channels inherited the
  // no-op ConfigRules.encryptSecrets. They now use the same secret-bearing rules as the generic
  // Webhook, so an OAuth2 clientId/clientSecret is Fernet-encrypted at rest.
  @ParameterizedTest
  @EnumSource(
      value = SubscriptionType.class,
      names = {"SLACK", "MS_TEAMS", "G_CHAT"})
  void encryptWebhookSecretKey_oauth2_encryptsClientIdAndSecretForNonGenericWebhookTypes(
      SubscriptionType type) {
    SubscriptionDestination dest = buildOAuth2Destination(type, "my-client-id", "my-client-secret");

    List<SubscriptionDestination> result = Fernet.encryptWebhookSecretKey(List.of(dest));

    Map<String, Object> authMap = authTypeOf(result.get(0));

    String encryptedClientId = (String) authMap.get("clientId");
    String encryptedClientSecret = (String) authMap.get("clientSecret");

    assertTrue(
        encryptedClientId.startsWith(Fernet.FERNET_PREFIX), type + " clientId was not encrypted");
    assertTrue(
        encryptedClientSecret.startsWith(Fernet.FERNET_PREFIX),
        type + " clientSecret was not encrypted");

    assertEquals("my-client-id", Fernet.getInstance().decrypt(encryptedClientId));
    assertEquals("my-client-secret", Fernet.getInstance().decrypt(encryptedClientSecret));
    assertEquals(type, result.get(0).getType());
  }

  @ParameterizedTest
  @EnumSource(
      value = SubscriptionType.class,
      names = {"SLACK", "MS_TEAMS", "G_CHAT"})
  void encryptWebhookSecretKey_oauth2_alreadyEncryptedForNonGenericWebhookTypes_noDoubleEncryption(
      SubscriptionType type) {
    String preEncryptedId = Fernet.getInstance().encrypt("my-client-id");
    String preEncryptedSecret = Fernet.getInstance().encrypt("my-client-secret");

    SubscriptionDestination dest = buildOAuth2Destination(type, preEncryptedId, preEncryptedSecret);

    List<SubscriptionDestination> result = Fernet.encryptWebhookSecretKey(List.of(dest));

    Map<String, Object> authMap = authTypeOf(result.get(0));

    assertEquals(preEncryptedId, authMap.get("clientId"));
    assertEquals(preEncryptedSecret, authMap.get("clientSecret"));
  }

  // The fix also closes the gap for the bearer secretKey on these channels: it is a distinct
  // credential from the plaintext endpoint URL and is now encrypted consistently.
  @ParameterizedTest
  @EnumSource(
      value = SubscriptionType.class,
      names = {"SLACK", "MS_TEAMS", "G_CHAT"})
  void encryptWebhookSecretKey_bearer_encryptsSecretKeyForNonGenericWebhookTypes(
      SubscriptionType type) {
    SubscriptionDestination dest = buildBearerDestination(type, "my-secret-key");

    List<SubscriptionDestination> result = Fernet.encryptWebhookSecretKey(List.of(dest));

    Map<String, Object> authMap = authTypeOf(result.get(0));
    String encryptedKey = (String) authMap.get("secretKey");

    assertTrue(
        encryptedKey.startsWith(Fernet.FERNET_PREFIX), type + " secretKey was not encrypted");
    assertEquals("my-secret-key", Fernet.getInstance().decrypt(encryptedKey));
    assertEquals(type, result.get(0).getType());
  }

  // A destination with no authType passes through unchanged, whatever its webhook type. This guards
  // the common case -- a Slack/Teams/GChat incoming webhook that only carries an endpoint --
  // against
  // a regression that would scramble or drop a secret-less configuration.
  @ParameterizedTest
  @EnumSource(
      value = SubscriptionType.class,
      names = {"SLACK", "MS_TEAMS", "G_CHAT", "WEBHOOK"})
  void encryptWebhookSecretKey_withoutAuthType_passesThroughUnchanged(SubscriptionType type) {
    SubscriptionDestination dest =
        new SubscriptionDestination()
            .withId(UUID.randomUUID())
            .withType(type)
            .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
            .withConfig(new LinkedHashMap<>(Map.of("endpoint", "http://slack.example.com")));

    List<SubscriptionDestination> result = Fernet.encryptWebhookSecretKey(List.of(dest));

    assertEquals(1, result.size());
    assertEquals(type, result.get(0).getType());
    Map<String, Object> config = JsonUtils.convertValue(result.get(0).getConfig(), Map.class);
    assertEquals("http://slack.example.com", config.get("endpoint"));
    assertNull(config.get("authType"));
  }

  @Test
  void encryptWebhookSecretKey_assignsIdIfMissing() {
    SubscriptionDestination dest = buildOAuth2Destination("cid", "csecret");
    dest.withId(null);

    List<SubscriptionDestination> result = Fernet.encryptWebhookSecretKey(List.of(dest));

    assertNotNull(result.get(0).getId());
  }

  private SubscriptionDestination buildOAuth2Destination(String clientId, String clientSecret) {
    return buildOAuth2Destination(SubscriptionType.WEBHOOK, clientId, clientSecret);
  }

  private static SubscriptionDestination buildOAuth2Destination(
      SubscriptionType type, String clientId, String clientSecret) {
    WebhookOAuth2Config oauth2 =
        new WebhookOAuth2Config()
            .withType(WebhookOAuth2Config.Type.OAUTH_2)
            .withTokenUrl(URI.create("https://auth.example.com/token"))
            .withClientId(clientId)
            .withClientSecret(clientSecret);

    Map<String, Object> webhookConfig = new LinkedHashMap<>();
    webhookConfig.put("endpoint", "http://example.com/webhook");
    webhookConfig.put("authType", JsonUtils.convertValue(oauth2, Map.class));

    return new SubscriptionDestination()
        .withId(UUID.randomUUID())
        .withType(type)
        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
        .withConfig(webhookConfig);
  }

  private static SubscriptionDestination buildBearerDestination(
      SubscriptionType type, String secretKey) {
    Map<String, Object> bearerAuth = new LinkedHashMap<>();
    bearerAuth.put("type", "bearer");
    bearerAuth.put("secretKey", secretKey);

    Map<String, Object> webhookConfig = new LinkedHashMap<>();
    webhookConfig.put("endpoint", "http://example.com/webhook");
    webhookConfig.put("authType", bearerAuth);

    return new SubscriptionDestination()
        .withId(UUID.randomUUID())
        .withType(type)
        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
        .withConfig(webhookConfig);
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> authTypeOf(SubscriptionDestination destination) {
    Map<String, Object> config = JsonUtils.convertValue(destination.getConfig(), Map.class);
    return (Map<String, Object>) config.get("authType");
  }
}
