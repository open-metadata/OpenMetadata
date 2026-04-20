package org.openmetadata.service.fernet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
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

    Map<String, Object> config = JsonUtils.convertValue(result.get(0).getConfig(), Map.class);
    Map<String, Object> authMap = (Map<String, Object>) config.get("authType");

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

    Map<String, Object> config = JsonUtils.convertValue(result.get(0).getConfig(), Map.class);
    Map<String, Object> authMap = (Map<String, Object>) config.get("authType");

    assertEquals(preEncryptedId, authMap.get("clientId"));
    assertEquals(preEncryptedSecret, authMap.get("clientSecret"));
  }

  @Test
  void encryptWebhookSecretKey_bearer_stillWorks() {
    Map<String, Object> bearerAuth = new LinkedHashMap<>();
    bearerAuth.put("type", "bearer");
    bearerAuth.put("secretKey", "my-secret-key");

    Map<String, Object> webhookConfig = new LinkedHashMap<>();
    webhookConfig.put("endpoint", "http://example.com/webhook");
    webhookConfig.put("authType", bearerAuth);

    SubscriptionDestination dest =
        new SubscriptionDestination()
            .withId(UUID.randomUUID())
            .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
            .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
            .withConfig(webhookConfig);

    List<SubscriptionDestination> result = Fernet.encryptWebhookSecretKey(List.of(dest));

    Map<String, Object> config = JsonUtils.convertValue(result.get(0).getConfig(), Map.class);
    Map<String, Object> authMap = (Map<String, Object>) config.get("authType");
    String encryptedKey = (String) authMap.get("secretKey");

    assertTrue(encryptedKey.startsWith(Fernet.FERNET_PREFIX));
    assertEquals("my-secret-key", Fernet.getInstance().decrypt(encryptedKey));
  }

  @Test
  void encryptWebhookSecretKey_nonWebhook_passesThrough() {
    SubscriptionDestination dest =
        new SubscriptionDestination()
            .withId(UUID.randomUUID())
            .withType(SubscriptionDestination.SubscriptionType.SLACK)
            .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
            .withConfig(Map.of("endpoint", "http://slack.example.com"));

    List<SubscriptionDestination> result = Fernet.encryptWebhookSecretKey(List.of(dest));

    assertEquals(1, result.size());
    assertEquals(SubscriptionDestination.SubscriptionType.SLACK, result.get(0).getType());
  }

  @Test
  void encryptWebhookSecretKey_assignsIdIfMissing() {
    SubscriptionDestination dest = buildOAuth2Destination("cid", "csecret");
    dest.withId(null);

    List<SubscriptionDestination> result = Fernet.encryptWebhookSecretKey(List.of(dest));

    assertNotNull(result.get(0).getId());
  }

  private SubscriptionDestination buildOAuth2Destination(String clientId, String clientSecret) {
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
        .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
        .withConfig(webhookConfig);
  }
}
