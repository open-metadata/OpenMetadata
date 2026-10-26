package org.openmetadata.service.alerting.channel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType;
import org.openmetadata.schema.entity.events.authentication.WebhookOAuth2Config;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.alerting.channel.webhook.WebhookConfigRules;
import org.openmetadata.service.fernet.Fernet;

class DestinationSecretsTest {

  private static final String TEST_FERNET_KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(TEST_FERNET_KEY);
  }

  @Test
  void encrypt_oauth2_encryptsClientIdAndSecret() {
    SubscriptionDestination dest = buildOAuth2Destination("my-client-id", "my-client-secret");

    List<SubscriptionDestination> result = DestinationSecrets.encrypt(List.of(dest));

    Map<String, Object> authMap = authTypeOf(result.get(0));

    String encryptedClientId = (String) authMap.get("clientId");
    String encryptedClientSecret = (String) authMap.get("clientSecret");

    assertTrue(encryptedClientId.startsWith(Fernet.FERNET_PREFIX));
    assertTrue(encryptedClientSecret.startsWith(Fernet.FERNET_PREFIX));

    assertEquals("my-client-id", Fernet.getInstance().decrypt(encryptedClientId));
    assertEquals("my-client-secret", Fernet.getInstance().decrypt(encryptedClientSecret));
  }

  @Test
  void encrypt_oauth2_alreadyEncrypted_noDoubleEncryption() {
    String preEncryptedId = Fernet.getInstance().encrypt("my-client-id");
    String preEncryptedSecret = Fernet.getInstance().encrypt("my-client-secret");

    SubscriptionDestination dest = buildOAuth2Destination(preEncryptedId, preEncryptedSecret);

    List<SubscriptionDestination> result = DestinationSecrets.encrypt(List.of(dest));

    Map<String, Object> authMap = authTypeOf(result.get(0));

    assertEquals(preEncryptedId, authMap.get("clientId"));
    assertEquals(preEncryptedSecret, authMap.get("clientSecret"));
  }

  @Test
  void encrypt_bearer_stillWorks() {
    SubscriptionDestination dest =
        buildBearerDestination(SubscriptionType.WEBHOOK, "my-secret-key");

    List<SubscriptionDestination> result = DestinationSecrets.encrypt(List.of(dest));

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
  void encrypt_oauth2_encryptsClientIdAndSecretForNonGenericWebhookTypes(SubscriptionType type) {
    SubscriptionDestination dest = buildOAuth2Destination(type, "my-client-id", "my-client-secret");

    List<SubscriptionDestination> result = DestinationSecrets.encrypt(List.of(dest));

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
  void encrypt_oauth2_alreadyEncryptedForNonGenericWebhookTypes_noDoubleEncryption(
      SubscriptionType type) {
    String preEncryptedId = Fernet.getInstance().encrypt("my-client-id");
    String preEncryptedSecret = Fernet.getInstance().encrypt("my-client-secret");

    SubscriptionDestination dest = buildOAuth2Destination(type, preEncryptedId, preEncryptedSecret);

    List<SubscriptionDestination> result = DestinationSecrets.encrypt(List.of(dest));

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
  void encrypt_bearer_encryptsSecretKeyForNonGenericWebhookTypes(SubscriptionType type) {
    SubscriptionDestination dest = buildBearerDestination(type, "my-secret-key");

    List<SubscriptionDestination> result = DestinationSecrets.encrypt(List.of(dest));

    Map<String, Object> authMap = authTypeOf(result.get(0));
    String encryptedKey = (String) authMap.get("secretKey");

    assertTrue(
        encryptedKey.startsWith(Fernet.FERNET_PREFIX), type + " secretKey was not encrypted");
    assertEquals("my-secret-key", Fernet.getInstance().decrypt(encryptedKey));
    assertEquals(type, result.get(0).getType());
  }

  // An incoming-webhook URL is a credential of its own, so the endpoint of every webhook-family
  // channel is encrypted, as every custom header value is; a query parameter is not.
  @ParameterizedTest
  @EnumSource(
      value = SubscriptionType.class,
      names = {"SLACK", "MS_TEAMS", "G_CHAT", "WEBHOOK"})
  void encrypt_endpointAndHeaders_whateverTheWebhookType(SubscriptionType type) {
    SubscriptionDestination dest = incomingWebhook(type);
    List<SubscriptionDestination> result = DestinationSecrets.encrypt(List.of(dest));
    Map<String, Object> config = configOf(result.getFirst());
    Map<String, String> headers = headersOf(result.getFirst());
    assertEquals(ENDPOINT, Fernet.getInstance().decrypt((String) config.get("endpoint")));
    assertEquals(TOKEN, Fernet.getInstance().decrypt((String) headers.get("Authorization")));
    assertEquals(Map.of("team", "a"), config.get("queryParams"));
    assertNull(config.get("authType"));
    assertEquals(type, result.getFirst().getType());
  }

  @Test
  void numericHeaderValuesAcceptedByWebhookParsingAreStillSecrets() {
    SubscriptionDestination destination = incomingWebhook(SubscriptionType.WEBHOOK);
    Map<String, Object> config = new LinkedHashMap<>(configOf(destination));
    config.put("headers", Map.of("Authorization", 123456789));
    destination.withConfig(config);
    assertEquals(
        "123456789", WebhookConfigRules.stored(destination).getHeaders().get("Authorization"));

    SubscriptionDestination masked = DestinationSecrets.mask(List.of(destination)).getFirst();
    assertEquals(PASSWORD_MASK, headersOf(masked).get("Authorization"));
    DestinationSecrets.encrypt(List.of(destination));
    assertEquals(
        "123456789", Fernet.getInstance().decrypt(headersOf(destination).get("Authorization")));
  }

  @Test
  void encrypt_emailReceivers_passThroughUnchanged() {
    SubscriptionDestination dest =
        new SubscriptionDestination()
            .withId(UUID.randomUUID())
            .withType(SubscriptionType.EMAIL)
            .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
            .withConfig(new LinkedHashMap<>(Map.of("receivers", List.of("a@example.com"))));
    List<SubscriptionDestination> result = DestinationSecrets.encrypt(List.of(dest));
    assertEquals(List.of("a@example.com"), configOf(result.getFirst()).get("receivers"));
  }

  @Test
  void encrypt_isIdempotent_soAStoredValueSentAgainStaysTheSame() {
    SubscriptionDestination dest = incomingWebhook(SubscriptionType.SLACK);
    DestinationSecrets.encrypt(List.of(dest));
    String once = (String) configOf(dest).get("endpoint");
    DestinationSecrets.encrypt(List.of(dest));
    assertEquals(once, configOf(dest).get("endpoint"));
  }

  @Test
  void decrypted_isACopyAsItCanBeSentTo() {
    SubscriptionDestination stored = incomingWebhook(SubscriptionType.SLACK);
    DestinationSecrets.encrypt(List.of(stored));
    SubscriptionDestination usable = DestinationSecrets.decrypted(stored);
    assertEquals(ENDPOINT, configOf(usable).get("endpoint"));
    assertEquals(TOKEN, headersOf(usable).get("Authorization"));
    assertTrue(((String) configOf(stored).get("endpoint")).startsWith(Fernet.FERNET_PREFIX));
    assertEquals(ENDPOINT, WebhookConfigRules.stored(stored).getEndpoint().toString());
  }

  @Test
  void mask_hidesEverySecretOfTheAlertAndItsHistory_onACopy() {
    SubscriptionDestination stored = incomingWebhook(SubscriptionType.WEBHOOK);
    stored.withConfig(withBearer(configOf(stored), "hmac-key"));
    DestinationSecrets.encrypt(List.of(stored));
    EventSubscription alert =
        new EventSubscription()
            .withId(UUID.randomUUID())
            .withName("alert")
            .withDestinations(List.of(stored))
            .withChangeDescription(
                destinationsChange(List.of(incomingWebhook(SubscriptionType.WEBHOOK))));

    EventSubscription masked = DestinationSecrets.mask(alert);

    Map<String, Object> config = configOf(masked.getDestinations().getFirst());
    assertEquals(PASSWORD_MASK, config.get("endpoint"));
    assertEquals(
        PASSWORD_MASK, headersOf(masked.getDestinations().getFirst()).get("Authorization"));
    assertEquals(PASSWORD_MASK, authTypeOf(masked.getDestinations().getFirst()).get("secretKey"));
    assertEquals(Map.of("team", "a"), config.get("queryParams"));
    String history = JsonUtils.pojoToJson(masked.getChangeDescription());
    assertFalse(history.contains(ENDPOINT), "the change description recorded the plaintext");
    assertFalse(history.contains(TOKEN));
    assertTrue(
        JsonUtils.pojoToJson(alert).contains(Fernet.FERNET_PREFIX), "the alert is untouched");
  }

  @Test
  void mask_versionHistory() {
    SubscriptionDestination stored = incomingWebhook(SubscriptionType.G_CHAT);
    EventSubscription alert = new EventSubscription().withDestinations(List.of(stored));
    EntityHistory masked =
        DestinationSecrets.mask(
            new EntityHistory()
                .withEntityType("eventsubscription")
                .withVersions(List.of(JsonUtils.pojoToJson(alert))));
    String version = (String) masked.getVersions().getFirst();
    assertFalse(version.contains(ENDPOINT));
    assertTrue(version.contains(PASSWORD_MASK));
  }

  @Test
  void restore_maskStandsForTheStoredValue_byIdAndByPosition() {
    SubscriptionDestination stored = incomingWebhook(SubscriptionType.SLACK);
    DestinationSecrets.encrypt(List.of(stored));
    EventSubscription original = new EventSubscription().withDestinations(List.of(stored));

    SubscriptionDestination byId = DestinationSecrets.mask(List.of(stored)).getFirst();
    SubscriptionDestination byPosition =
        DestinationSecrets.mask(List.of(stored)).getFirst().withId(null);
    DestinationSecrets.restore(original, new EventSubscription().withDestinations(List.of(byId)));
    DestinationSecrets.restore(
        original, new EventSubscription().withDestinations(List.of(byPosition)));

    assertEquals(configOf(stored), configOf(byId));
    assertEquals(configOf(stored), configOf(byPosition));
    assertEquals(stored.getId(), byPosition.getId());
  }

  @Test
  void restore_reservesExplicitIdsWhenInsertingADestination() {
    SubscriptionDestination stored = incomingWebhook(SubscriptionType.SLACK);
    DestinationSecrets.encrypt(List.of(stored));
    SubscriptionDestination inserted = incomingWebhook(SubscriptionType.SLACK).withId(null);
    SubscriptionDestination retained = DestinationSecrets.mask(List.of(stored)).getFirst();
    EventSubscription updated =
        new EventSubscription().withDestinations(List.of(inserted, retained));

    DestinationSecrets.restore(new EventSubscription().withDestinations(List.of(stored)), updated);
    DestinationSecrets.encrypt(updated.getDestinations());

    assertFalse(inserted.getId().equals(retained.getId()));
    assertEquals(stored.getId(), retained.getId());
    assertEquals(configOf(stored), configOf(retained));
  }

  @Test
  void restore_plaintextTheStoredCiphertextDecryptsTo_keepsTheCiphertext() {
    SubscriptionDestination stored = incomingWebhook(SubscriptionType.SLACK);
    DestinationSecrets.encrypt(List.of(stored));
    SubscriptionDestination sentAgain =
        incomingWebhook(SubscriptionType.SLACK).withId(stored.getId());
    SubscriptionDestination changed =
        incomingWebhook(SubscriptionType.SLACK).withId(stored.getId());
    changed.withConfig(new LinkedHashMap<>(Map.of("endpoint", "https://hooks.example.com/other")));

    DestinationSecrets.restore(stored, sentAgain);
    DestinationSecrets.restore(stored, changed);

    assertEquals(configOf(stored), configOf(sentAgain));
    assertEquals("https://hooks.example.com/other", configOf(changed).get("endpoint"));
  }

  @Test
  void restore_leavesADestinationOfAnotherKindAlone() {
    SubscriptionDestination stored = incomingWebhook(SubscriptionType.SLACK);
    DestinationSecrets.encrypt(List.of(stored));
    SubscriptionDestination other =
        DestinationSecrets.mask(List.of(stored))
            .getFirst()
            .withId(null)
            .withType(SubscriptionType.WEBHOOK);

    DestinationSecrets.restore(
        new EventSubscription().withDestinations(List.of(stored)),
        new EventSubscription().withDestinations(List.of(other)));

    assertEquals(PASSWORD_MASK, configOf(other).get("endpoint"));
    assertTrue(DestinationSecrets.hasMaskedSecrets(other));
    assertFalse(DestinationSecrets.hasMaskedSecrets(stored));
  }

  static final String ENDPOINT = "https://hooks.example.com/services/T0/B0/token";
  static final String TOKEN = "Bearer header-token";

  static SubscriptionDestination incomingWebhook(SubscriptionType type) {
    Map<String, Object> config = new LinkedHashMap<>();
    config.put("endpoint", ENDPOINT);
    config.put("headers", new LinkedHashMap<>(Map.of("Authorization", TOKEN)));
    config.put("queryParams", new LinkedHashMap<>(Map.of("team", "a")));
    return new SubscriptionDestination()
        .withId(UUID.randomUUID())
        .withType(type)
        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
        .withConfig(config);
  }

  private static Map<String, Object> withBearer(Map<String, Object> config, String secretKey) {
    Map<String, Object> withAuth = new LinkedHashMap<>(config);
    withAuth.put("authType", new LinkedHashMap<>(Map.of("type", "bearer", "secretKey", secretKey)));
    return withAuth;
  }

  private static ChangeDescription destinationsChange(List<SubscriptionDestination> destinations) {
    FieldChange change =
        new FieldChange()
            .withName("destinations")
            .withOldValue(JsonUtils.pojoToJson(destinations))
            .withNewValue(JsonUtils.pojoToJson(destinations));
    return new ChangeDescription().withFieldsUpdated(List.of(change));
  }

  @SuppressWarnings("unchecked")
  static Map<String, Object> configOf(SubscriptionDestination destination) {
    return JsonUtils.convertValue(destination.getConfig(), Map.class);
  }

  @SuppressWarnings("unchecked")
  private static Map<String, String> headersOf(SubscriptionDestination destination) {
    return (Map<String, String>) configOf(destination).get("headers");
  }

  @Test
  void encrypt_assignsIdIfMissing() {
    SubscriptionDestination dest = buildOAuth2Destination("cid", "csecret");
    dest.withId(null);

    List<SubscriptionDestination> result = DestinationSecrets.encrypt(List.of(dest));

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
