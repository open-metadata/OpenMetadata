package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.authentication.WebhookOAuth2Config;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Throwaway end-to-end check that a Slack destination carrying an OAuth2 {@code authType} has its
 * {@code clientId}/{@code clientSecret} Fernet-encrypted in the at-rest row, not plaintext. This is
 * the exact exploit scenario from the bug report, run through the real API + DB.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class SlackOAuth2AtRestEncryptionIT {

  private static final String CLIENT_ID = "real-client-id";
  private static final String CLIENT_SECRET = "real-client-secret";
  private static final String FERNET_PREFIX = "fernet:";

  @Test
  void slackOauth2SecretsAreEncryptedAtRest(TestNamespace ns) throws Exception {
    WebhookOAuth2Config oauth2 =
        new WebhookOAuth2Config()
            .withType(WebhookOAuth2Config.Type.OAUTH_2)
            .withTokenUrl(URI.create("https://auth.example.com/token"))
            .withClientId(CLIENT_ID)
            .withClientSecret(CLIENT_SECRET);

    Map<String, Object> webhookConfig = new LinkedHashMap<>();
    webhookConfig.put("endpoint", "http://localhost:8585/api/v1/test/webhook/slack");
    webhookConfig.put("authType", JsonUtils.convertValue(oauth2, Map.class));

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("slack_oauth2_at_rest"))
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withDestinations(
                List.of(
                    new SubscriptionDestination()
                        .withId(UUID.randomUUID())
                        .withType(SubscriptionDestination.SubscriptionType.SLACK)
                        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
                        .withConfig(webhookConfig)));

    EventSubscription created = SdkClients.adminClient().eventSubscriptions().create(request);
    assertNotNull(created);
    String subscriptionId = created.getId().toString();

    // 1. At-rest: read the stored JSON row straight from the database.
    String storedJson =
        TestSuiteBootstrap.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT json FROM event_subscription_entity WHERE id = :id")
                        .bind("id", subscriptionId)
                        .mapTo(String.class)
                        .one());
    JsonNode stored = JsonUtils.readTree(storedJson);
    JsonNode storedDestination = stored.get("destinations").get(0);
    JsonNode storedAuth = storedDestination.get("config").get("authType");
    String storedClientId = storedAuth.get("clientId").asText();
    String storedClientSecret = storedAuth.get("clientSecret").asText();
    assertTrue(
        storedClientId.startsWith(FERNET_PREFIX),
        "at-rest clientId not encrypted: " + storedClientId);
    assertTrue(
        storedClientSecret.startsWith(FERNET_PREFIX),
        "at-rest clientSecret not encrypted: " + storedClientSecret);

    // 2. API response masks the secrets: the plaintext never comes back over the API.
    EventSubscription fetched = SdkClients.adminClient().eventSubscriptions().get(subscriptionId);
    JsonNode fetchedAuth =
        JsonUtils.readTree(
                JsonUtils.valueToTree(fetched.getDestinations().get(0).getConfig()).toString())
            .get("authType");
    String maskedClientId = fetchedAuth.get("clientId").asText();
    String maskedClientSecret = fetchedAuth.get("clientSecret").asText();
    assertFalse(maskedClientId.contains(CLIENT_ID), "API leaked plaintext clientId");
    assertFalse(maskedClientSecret.contains(CLIENT_SECRET), "API leaked plaintext clientSecret");
    assertEquals("oauth2", fetchedAuth.get("type").asText());
  }
}
