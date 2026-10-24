package org.openmetadata.service.alerting.channel;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.alerting.channel.DestinationSecretsTest.configOf;
import static org.openmetadata.service.alerting.channel.DestinationSecretsTest.incomingWebhook;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.BadRequestException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;

class DestinationSecretGuardsTest {
  private static final String TEST_FERNET_KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(TEST_FERNET_KEY);
  }

  @Test
  void aMaskNothingStoredStandsForIsRefused() {
    SubscriptionDestination masked = DestinationSecrets.mask(List.of(stored())).getFirst();
    BadRequestException refused =
        assertThrows(
            BadRequestException.class,
            () -> DestinationSecretGuards.requireNoMaskedSecrets(List.of(masked)));
    assertTrue(refused.getMessage().contains("/endpoint"));
    assertDoesNotThrow(() -> DestinationSecretGuards.requireNoMaskedSecrets(List.of(stored())));
  }

  @Test
  void ciphertextIsRefusedWhereNothingIsStored() {
    SubscriptionDestination encrypted = stored();
    assertThrows(
        BadRequestException.class,
        () -> DestinationSecretGuards.requireNoCiphertext(List.of(encrypted)));
    assertDoesNotThrow(
        () ->
            DestinationSecretGuards.requireNoCiphertext(
                List.of(incomingWebhook(SubscriptionType.SLACK))));
  }

  @Test
  void ciphertextInAnUpdateMustBeTheStoredValueOfTheSameField() {
    SubscriptionDestination storedDestination = stored();
    EventSubscription original = alertWith(storedDestination);
    SubscriptionDestination sentBack =
        JsonUtils.deepCopy(storedDestination, SubscriptionDestination.class);
    SubscriptionDestination foreign =
        JsonUtils.deepCopy(storedDestination, SubscriptionDestination.class);
    Map<String, Object> config = new LinkedHashMap<>(configOf(foreign));
    config.put("endpoint", Fernet.getInstance().encrypt("https://elsewhere.example.com"));
    foreign.withConfig(config);

    assertDoesNotThrow(
        () -> DestinationSecretGuards.requireStoredCiphertext(original, alertWith(sentBack)));
    assertThrows(
        BadRequestException.class,
        () -> DestinationSecretGuards.requireStoredCiphertext(original, alertWith(foreign)));
    assertThrows(
        BadRequestException.class,
        () ->
            DestinationSecretGuards.requireStoredCiphertext(
                new EventSubscription(), alertWith(sentBack)),
        "no counterpart is stored for it");
  }

  @Test
  void aTestWithStoredCredentialsUsesEveryOneOfThemAsStored() {
    SubscriptionDestination storedDestination = stored();
    SubscriptionDestination restored =
        JsonUtils.deepCopy(storedDestination, SubscriptionDestination.class);
    SubscriptionDestination otherEndpoint =
        JsonUtils.deepCopy(storedDestination, SubscriptionDestination.class);
    Map<String, Object> config = new LinkedHashMap<>(configOf(otherEndpoint));
    config.put("endpoint", "https://elsewhere.example.com");
    otherEndpoint.withConfig(config);

    assertDoesNotThrow(
        () -> DestinationSecretGuards.requireSecretsAsStored(storedDestination, restored));
    assertThrows(
        BadRequestException.class,
        () -> DestinationSecretGuards.requireSecretsAsStored(storedDestination, otherEndpoint));
  }

  @Test
  void aPatchMayNotCopyAStoredSecretOutOfItsField() {
    SubscriptionDestination storedDestination = stored();
    EventSubscription original = alertWith(storedDestination);
    EventSubscription copied =
        alertWith(storedDestination)
            .withDescription(configOf(storedDestination).get("endpoint").toString());
    JsonPatch copy =
        Json.createPatchBuilder().copy("/description", "/destinations/0/config/endpoint").build();
    JsonPatch replace = Json.createPatchBuilder().replace("/description", "typed").build();

    assertThrows(
        BadRequestException.class,
        () -> DestinationSecretGuards.requireSecretsOnlyInSecretFields(original, copied, copy));
    assertDoesNotThrow(
        () -> DestinationSecretGuards.requireSecretsOnlyInSecretFields(original, copied, replace),
        "only a copy or move can read a stored secret");
  }

  @Test
  void theMaskItselfIsNeverASecret() {
    SubscriptionDestination storedDestination = stored();
    EventSubscription original = alertWith(storedDestination);
    EventSubscription patched = alertWith(storedDestination).withDescription(PASSWORD_MASK);
    JsonPatch copy =
        Json.createPatchBuilder().copy("/description", "/destinations/0/config/headers").build();
    assertDoesNotThrow(
        () -> DestinationSecretGuards.requireSecretsOnlyInSecretFields(original, patched, copy));
  }

  private static SubscriptionDestination stored() {
    SubscriptionDestination destination = incomingWebhook(SubscriptionType.SLACK);
    DestinationSecrets.encrypt(List.of(destination));
    return destination;
  }

  private static EventSubscription alertWith(SubscriptionDestination destination) {
    return new EventSubscription().withName("alert").withDestinations(List.of(destination));
  }
}
