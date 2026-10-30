package org.openmetadata.service.alerting.channel;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.alerting.channel.DestinationSecretsTest.TOKEN;
import static org.openmetadata.service.alerting.channel.DestinationSecretsTest.configOf;
import static org.openmetadata.service.alerting.channel.DestinationSecretsTest.incomingWebhook;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.BadRequestException;
import java.io.StringReader;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
  void storedOAuthCredentialsCannotBeTestedAtAnotherTokenUrl() {
    SubscriptionDestination destination = incomingWebhook(SubscriptionType.WEBHOOK);
    Map<String, Object> config = new LinkedHashMap<>(configOf(destination));
    config.put(
        "authType",
        Map.of(
            "type",
            "oauth2",
            "tokenUrl",
            "https://auth.example.com/token",
            "clientId",
            "client",
            "clientSecret",
            "secret"));
    destination.withConfig(config);
    DestinationSecrets.encrypt(List.of(destination));
    SubscriptionDestination submitted = DestinationSecrets.mask(List.of(destination)).getFirst();
    DestinationSecrets.restore(destination, submitted);
    assertDoesNotThrow(
        () -> DestinationSecretGuards.requireSecretsAsStored(destination, submitted));

    var changed = JsonUtils.valueToTree(submitted.getConfig());
    ((ObjectNode) changed.path("authType")).put("tokenUrl", "https://elsewhere.example.com/token");
    submitted.withConfig(changed);
    assertThrows(
        BadRequestException.class,
        () -> DestinationSecretGuards.requireSecretsAsStored(destination, submitted));
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
  void aPatchMayNotCopyALegacyNumericSecretIntoANumericField() {
    SubscriptionDestination destination = incomingWebhook(SubscriptionType.WEBHOOK);
    Map<String, Object> config = new LinkedHashMap<>(configOf(destination));
    config.put("headers", Map.of("Authorization", 123));
    destination.withConfig(config);
    EventSubscription original = alertWith(destination);
    EventSubscription copied =
        JsonUtils.deepCopy(original, EventSubscription.class).withBatchSize(123);
    JsonPatch patch =
        Json.createPatchBuilder()
            .copy("/batchSize", "/destinations/0/config/headers/Authorization")
            .build();
    assertThrows(
        BadRequestException.class,
        () -> DestinationSecretGuards.requireSecretsOnlyInSecretFields(original, copied, patch));
  }

  @Test
  void unrelatedCopyMayLeaveAPreexistingNumericSecretMatchUnchanged() {
    SubscriptionDestination destination = incomingWebhook(SubscriptionType.WEBHOOK);
    Map<String, Object> config = new LinkedHashMap<>(configOf(destination));
    config.put("headers", Map.of("Authorization", 123));
    destination.withConfig(config);
    EventSubscription original = alertWith(destination).withBatchSize(123);
    EventSubscription patched =
        JsonUtils.deepCopy(original, EventSubscription.class).withDisplayName(original.getName());
    JsonPatch patch = Json.createPatchBuilder().copy("/displayName", "/name").build();

    assertDoesNotThrow(
        () -> DestinationSecretGuards.requireSecretsOnlyInSecretFields(original, patched, patch));
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

  // A patch that only moves the endpoint leaves the stored header value where it was; keeping it
  // would deliver the stored secret to the address the request named, so it is entered again.
  @Test
  void storedSecretsDoNotFollowAMovedTarget() {
    SubscriptionDestination storedDestination = stored();
    EventSubscription original = alertWith(storedDestination);
    SubscriptionDestination moved =
        JsonUtils.deepCopy(storedDestination, SubscriptionDestination.class);
    Map<String, Object> config = new LinkedHashMap<>(configOf(moved));
    config.put("endpoint", "https://hooks.example.com/moved");
    moved.withConfig(config);

    assertThrows(
        BadRequestException.class,
        () -> DestinationSecretGuards.requireFreshSecretsOnAMovedTarget(original, alertWith(moved)),
        "the stored value would follow the moved endpoint");

    config.put("headers", new LinkedHashMap<>(Map.of("Authorization", TOKEN)));
    moved.withConfig(config);
    assertDoesNotThrow(
        () -> DestinationSecretGuards.requireFreshSecretsOnAMovedTarget(original, alertWith(moved)),
        "every secret is entered again");
  }

  // A row stored before secrets were encrypted holds plaintext, which a patch that writes only
  // the endpoint carries along; by value it reads as entered, so the patch itself has to tell.
  @Test
  void aPatchMovingATargetEntersEveryLegacyPlaintextSecretAgain() {
    EventSubscription original = alertWith(incomingWebhook(SubscriptionType.SLACK));
    JsonPatch endpointOnly =
        Json.createPatchBuilder().replace(ENDPOINT_PATH, "https://hooks.example.com/moved").build();
    EventSubscription carried = patched(original, endpointOnly);

    assertDoesNotThrow(
        () -> DestinationSecretGuards.requireFreshSecretsOnAMovedTarget(original, carried),
        "plaintext left in place is not a mask or ciphertext");
    assertThrows(
        BadRequestException.class,
        () ->
            DestinationSecretGuards.requireUnwrittenSecretsStayProtected(
                original, carried, endpointOnly),
        "the header value was never entered by this patch");

    JsonPatch everySecret =
        Json.createPatchBuilder()
            .replace(ENDPOINT_PATH, "https://hooks.example.com/moved")
            .replace(HEADER_PATH, TOKEN)
            .build();
    EventSubscription reentered = patched(original, everySecret);
    assertDoesNotThrow(
        () ->
            DestinationSecretGuards.requireUnwrittenSecretsStayProtected(
                original, reentered, everySecret),
        "the same value entered again moves the destination");

    JsonPatch wholeList =
        Json.createPatchBuilder()
            .replace("/destinations", jsonArrayOf(carried.getDestinations()))
            .build();
    assertDoesNotThrow(
        () ->
            DestinationSecretGuards.requireUnwrittenSecretsStayProtected(
                original, carried, wholeList),
        "a whole-list replace writes every field; what it wrote is judged by value");
  }

  @Test
  void aPatchThatKeepsTheTargetMayLeaveLegacyPlaintextInPlace() {
    EventSubscription original = alertWith(incomingWebhook(SubscriptionType.SLACK));
    JsonPatch description = Json.createPatchBuilder().replace("/description", "typed").build();
    assertDoesNotThrow(
        () ->
            DestinationSecretGuards.requireUnwrittenSecretsStayProtected(
                original, patched(original, description), description));
  }

  // The patch is replayed, not read: an operation naming a position that another operation
  // shifted is judged by where the secret ends up, not by the path it was written at.
  @Test
  void aReshapedListIsJudgedByWhereEachSecretEndsUp() {
    SubscriptionDestination first = incomingWebhook(SubscriptionType.SLACK);
    SubscriptionDestination second = incomingWebhook(SubscriptionType.SLACK);
    EventSubscription original =
        new EventSubscription().withName("alert").withDestinations(List.of(first, second));
    JsonPatch headerOfTheRemovedOne =
        Json.createPatchBuilder()
            .replace(HEADER_PATH, "Bearer typed")
            .remove("/destinations/0")
            .replace(ENDPOINT_PATH, "https://hooks.example.com/moved")
            .build();
    EventSubscription patched = patched(original, headerOfTheRemovedOne);
    assertEquals(second.getId(), patched.getDestinations().getFirst().getId());

    assertThrows(
        BadRequestException.class,
        () ->
            DestinationSecretGuards.requireUnwrittenSecretsStayProtected(
                original, patched, headerOfTheRemovedOne),
        "the surviving destination moved with the header value it was stored with");
  }

  // A destination a patch renames or re-channels keeps the configuration stored under its old
  // position. Changing the served channel blinds every rule that names this destination's secrets,
  // so the stored values would be stored and read back as written.
  @Test
  void aPatchMayNotCarryAStoredSecretIntoAChannelThatDoesNotProtectIt() {
    EventSubscription original = alertWith(incomingWebhook(SubscriptionType.SLACK));
    JsonPatch reidentity =
        Json.createPatchBuilder()
            .add("/destinations/0/id", UUID.randomUUID().toString())
            .add("/destinations/0/channel", "ActivityFeed")
            .build();
    EventSubscription carried = patched(original, reidentity);
    BadRequestException refused =
        assertThrows(
            BadRequestException.class,
            () ->
                DestinationSecretGuards.requireUnwrittenSecretsStayProtected(
                    original, carried, reidentity),
            "the stored endpoint and header would be served in the clear");
    assertTrue(refused.getMessage().contains("'/endpoint'"), refused.getMessage());

    JsonPatch retyped =
        Json.createPatchBuilder()
            .add("/destinations/0/id", UUID.randomUUID().toString())
            .add("/destinations/0/type", "ActivityFeed")
            .build();
    EventSubscription retypedCarried = patched(original, retyped);
    assertThrows(
        BadRequestException.class,
        () ->
            DestinationSecretGuards.requireUnwrittenSecretsStayProtected(
                original, retypedCarried, retyped),
        "the channel a destination is served by is its type when it names none");

    JsonPatch everySecret =
        Json.createPatchBuilder()
            .add("/destinations/0/id", UUID.randomUUID().toString())
            .add("/destinations/0/channel", "ActivityFeed")
            .replace(ENDPOINT_PATH, "https://activity.example.com")
            .remove("/destinations/0/config/headers")
            .build();
    assertDoesNotThrow(
        () ->
            DestinationSecretGuards.requireUnwrittenSecretsStayProtected(
                original, patched(original, everySecret), everySecret),
        "a destination that leaves no stored value behind is a new one");
  }

  @Test
  void aDestinationKeptByItsIdKeepsTheChannelItIsServedBy() {
    SubscriptionDestination storedDestination = stored();
    EventSubscription original = alertWith(storedDestination);
    SubscriptionDestination moved =
        JsonUtils.deepCopy(storedDestination, SubscriptionDestination.class)
            .withChannel("ActivityFeed");

    assertThrows(
        BadRequestException.class,
        () -> DestinationSecretGuards.requireServedChannelUnchanged(original, alertWith(moved)));

    assertDoesNotThrow(
        () ->
            DestinationSecretGuards.requireServedChannelUnchanged(
                original,
                alertWith(JsonUtils.deepCopy(storedDestination, SubscriptionDestination.class))),
        "what is unchanged does not refuse");
    assertDoesNotThrow(
        () ->
            DestinationSecretGuards.requireServedChannelUnchanged(
                original,
                alertWith(
                    JsonUtils.deepCopy(storedDestination, SubscriptionDestination.class)
                        .withId(UUID.randomUUID())
                        .withChannel("ActivityFeed"))),
        "a new destination is served by the channel its save chooses");
  }

  private static final String ENDPOINT_PATH = "/destinations/0/config/endpoint";
  private static final String HEADER_PATH = "/destinations/0/config/headers/Authorization";

  private static JsonArray jsonArrayOf(List<SubscriptionDestination> destinations) {
    return Json.createReader(new StringReader(JsonUtils.pojoToJson(destinations))).readArray();
  }

  private static EventSubscription patched(EventSubscription original, JsonPatch patch) {
    return JsonUtils.applyPatch(original, patch, EventSubscription.class);
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
