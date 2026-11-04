/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.alerting.channel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.json.Json;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.type.profile.SubscriptionConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.OwnedCiphertext;

class ProfileWebhookSecretsTest {
  private static final String TEST_FERNET_KEY = "GhtAEzEb5WD6bTLvwa24JA6ePHxfVLDjb8X4hMShmVY=";
  private static final String ENDPOINT = "https://hooks.example.com/services/T0/B0/hook-token";
  private static final String TOKEN_URL = "https://login.example.com/token";
  private static final ProfileWebhookSecrets.Holder HOLDER =
      new ProfileWebhookSecrets.Holder("user", UUID.randomUUID());
  private static final String GENERIC = "generic";

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey(TEST_FERNET_KEY);
  }

  @Test
  void aNewProfileStoresEveryWebhookSecretEncrypted() {
    Profile sent =
        new Profile()
            .withSubscription(
                new SubscriptionConfig()
                    .withSlack(oauth2("slack-secret"))
                    .withMsTeams(oauth2("teams-secret"))
                    .withgChat(bearer("gchat-key"))
                    .withGeneric(oauth2("generic-secret").withHeaders(Map.of("X-Api-Key", "k1"))));

    Profile stored = ProfileWebhookSecrets.ofANewEntity(HOLDER, sent);

    JsonNode subscriptions = JsonUtils.valueToTree(stored.getSubscription());
    for (String slot : List.of("slack", "msTeams", "gChat", GENERIC)) {
      JsonNode webhook = subscriptions.path(slot);
      assertEncrypted(slot, "/endpoint", webhook, ENDPOINT);
      if (webhook.at("/authType/type").asText().equals("oauth2")) {
        assertEncrypted(slot, "/authType/clientId", webhook, "client");
        assertEquals(TOKEN_URL, webhook.at("/authType/tokenUrl").asText());
      } else {
        assertEncrypted(slot, "/authType/secretKey", webhook, "gchat-key");
      }
    }
    assertEncrypted(GENERIC, "/headers/X-Api-Key", subscriptions.path(GENERIC), "k1");
    String storedJson = JsonUtils.pojoToJson(stored);
    List.of("slack-secret", "teams-secret", "gchat-key", "generic-secret", "hook-token")
        .forEach(secret -> assertFalse(storedJson.contains(secret), secret));
  }

  @Test
  void aNewProfileRefusesWhatOnlyStandsForAStoredValue() {
    Profile masked = profileWith(oauth2(PASSWORD_MASK));
    Profile copied = profileWith(oauth2(Fernet.getInstance().encrypt("someone else's secret")));

    assertRefused(() -> ProfileWebhookSecrets.ofANewEntity(HOLDER, masked), "masked value");
    assertRefused(() -> ProfileWebhookSecrets.ofANewEntity(HOLDER, copied), "encrypted value");
  }

  @Test
  void aMaskSentBackKeepsTheStoredSecret() {
    Profile stored = ProfileWebhookSecrets.ofANewEntity(HOLDER, profileWith(oauth2("the secret")));
    Profile read = ProfileWebhookSecrets.masked(stored);

    Profile updated = ProfileWebhookSecrets.updated(HOLDER, stored, read);

    assertEquals(JsonUtils.pojoToJson(stored), JsonUtils.pojoToJson(updated));
  }

  @Test
  void aSecretEnteredAgainKeepsTheStoredCiphertextAndANewOneIsEncrypted() {
    Profile stored = ProfileWebhookSecrets.ofANewEntity(HOLDER, profileWith(oauth2("the secret")));
    String storedSecret = clientSecretOf(stored);

    Profile same = ProfileWebhookSecrets.updated(HOLDER, stored, profileWith(oauth2("the secret")));
    Profile changed =
        ProfileWebhookSecrets.updated(HOLDER, stored, profileWith(oauth2("a new secret")));

    assertEquals(storedSecret, clientSecretOf(same));
    assertTrue(Fernet.isTokenized(clientSecretOf(changed)));
    assertEquals("a new secret", opened("/authType/clientSecret", clientSecretOf(changed)));
  }

  @Test
  void ciphertextIsAcceptedOnlyWhereItIsStored() {
    Profile stored =
        ProfileWebhookSecrets.ofANewEntity(
            HOLDER,
            new Profile()
                .withSubscription(
                    new SubscriptionConfig()
                        .withGeneric(oauth2("generic secret"))
                        .withSlack(oauth2("slack secret"))));
    String slackSecret = clientSecretOf(stored.getSubscription().getSlack());
    Profile foreign = JsonUtils.deepCopy(stored, Profile.class);
    foreign.getSubscription().getGeneric().setAuthType(oauth2Map(TOKEN_URL, slackSecret));

    assertRefused(() -> ProfileWebhookSecrets.updated(HOLDER, stored, foreign), "encrypted value");
    assertEquals(
        JsonUtils.pojoToJson(stored),
        JsonUtils.pojoToJson(
            ProfileWebhookSecrets.updated(
                HOLDER, stored, JsonUtils.deepCopy(stored, Profile.class))));
  }

  @Test
  void aStoredSecretDoesNotFollowAMovedEndpointOrTokenUrl() {
    Profile stored = ProfileWebhookSecrets.ofANewEntity(HOLDER, profileWith(oauth2("the secret")));
    Profile movedEndpoint = ProfileWebhookSecrets.masked(stored);
    movedEndpoint
        .getSubscription()
        .getGeneric()
        .setEndpoint(URI.create("https://elsewhere.example.com"));
    Profile movedTokenUrl = ProfileWebhookSecrets.masked(stored);
    movedTokenUrl
        .getSubscription()
        .getGeneric()
        .setAuthType(oauth2Map("https://elsewhere.example.com/token", PASSWORD_MASK));

    assertRefused(
        () -> ProfileWebhookSecrets.updated(HOLDER, stored, movedEndpoint), "no longer sends");
    assertRefused(
        () -> ProfileWebhookSecrets.updated(HOLDER, stored, movedTokenUrl), "no longer sends");

    Profile reentered =
        profileWith(oauth2("the secret").withEndpoint(URI.create("https://moved.example.com")));
    Profile moved = ProfileWebhookSecrets.updated(HOLDER, stored, reentered);
    assertEquals(
        "https://moved.example.com",
        opened("/endpoint", JsonUtils.valueToTree(moved).at("/subscription/generic/endpoint")));
  }

  @Test
  void aProfileStoredInTheClearIsEncryptedWhenSentBackMasked() {
    Profile legacy = profileWith(oauth2("legacy secret"));

    Profile updated =
        ProfileWebhookSecrets.updated(HOLDER, legacy, ProfileWebhookSecrets.masked(legacy));

    assertEquals("legacy secret", opened("/authType/clientSecret", clientSecretOf(updated)));
  }

  @Test
  void aPatchCannotReadAProfileSecret() {
    Profile stored = ProfileWebhookSecrets.ofANewEntity(HOLDER, profileWith(oauth2("the secret")));
    JsonPatch copy =
        patch("copy", "/description", "/profile/subscription/generic/authType/clientSecret");
    JsonPatch moveSlot =
        patch("move", "/profile/subscription/slack", "/profile/subscription/generic");

    assertRefused(
        () -> ProfileWebhookSecrets.validatePatch(HOLDER, stored, stored, copy),
        "cannot be copied");
    assertRefused(
        () -> ProfileWebhookSecrets.validatePatch(HOLDER, stored, stored, moveSlot),
        "cannot be copied");
  }

  @Test
  void aPatchThatMovesTheEndpointWritesEverySecret() {
    Profile legacy = profileWith(oauth2("legacy secret"));
    Profile patched = JsonUtils.deepCopy(legacy, Profile.class);
    patched.getSubscription().getGeneric().setEndpoint(URI.create("https://elsewhere.example.com"));
    JsonPatch endpointOnly =
        Json.createPatchBuilder()
            .replace("/profile/subscription/generic/endpoint", "https://elsewhere.example.com")
            .build();
    JsonPatch wholeWebhook =
        Json.createPatchBuilder()
            .replace(
                "/profile/subscription/generic",
                Json.createObjectBuilder().add("endpoint", "https://elsewhere.example.com").build())
            .build();

    assertRefused(
        () -> ProfileWebhookSecrets.validatePatch(HOLDER, legacy, patched, endpointOnly),
        "no longer sends");
    Profile rewritten =
        profileWith(new Webhook().withEndpoint(URI.create("https://elsewhere.example.com")));
    ProfileWebhookSecrets.validatePatch(HOLDER, legacy, rewritten, wholeWebhook);
  }

  @Test
  void responsesMaskTheProfileAndTheProfileValuesItsHistoryRecords() {
    Profile before = ProfileWebhookSecrets.ofANewEntity(HOLDER, profileWith(oauth2("old secret")));
    Profile after = ProfileWebhookSecrets.ofANewEntity(HOLDER, profileWith(oauth2("new secret")));
    ChangeDescription history =
        new ChangeDescription()
            .withFieldsUpdated(
                List.of(
                    new FieldChange()
                        .withName("profile")
                        .withOldValue(JsonUtils.pojoToJson(before))
                        .withNewValue(JsonUtils.pojoToJson(after)),
                    new FieldChange().withName("description").withNewValue("kept")));
    User user = new User().withProfile(after).withChangeDescription(history);
    Team team = new Team().withProfile(after).withIncrementalChangeDescription(history);

    String userJson = JsonUtils.pojoToJson(ProfileWebhookSecrets.mask(user));
    String teamJson = JsonUtils.pojoToJson(ProfileWebhookSecrets.mask(team));

    for (String json : List.of(userJson, teamJson)) {
      assertFalse(json.contains(Fernet.FERNET_PREFIX), json);
      assertTrue(json.contains(PASSWORD_MASK));
      assertTrue(json.contains("kept"));
      assertTrue(json.contains(TOKEN_URL));
    }
  }

  @Test
  void aChangeEventRecordsAMaskedCopyAndLeavesTheEntityAsStored() {
    Profile stored = ProfileWebhookSecrets.ofANewEntity(HOLDER, profileWith(oauth2("the secret")));
    User user = new User().withName("u").withProfile(stored);
    Team team = new Team().withName("t").withProfile(stored);
    String storedJson = JsonUtils.pojoToJson(stored);

    String userEvent = JsonUtils.pojoToJson(ProfileWebhookSecrets.masked(user));
    String teamEvent = JsonUtils.pojoToJson(ProfileWebhookSecrets.masked(team));

    for (String json : List.of(userEvent, teamEvent)) {
      assertFalse(json.contains(Fernet.FERNET_PREFIX), json);
      assertTrue(json.contains(PASSWORD_MASK));
    }
    assertEquals(storedJson, JsonUtils.pojoToJson(user.getProfile()));
    assertEquals(storedJson, JsonUtils.pojoToJson(team.getProfile()));
  }

  @Test
  void aChangeEventOfAnEntityWithoutProfileWebhooksIsNotCopied() {
    User user = new User().withName("u").withProfile(new Profile());
    Team team = new Team().withName("t");

    assertSame(user, ProfileWebhookSecrets.masked(user));
    assertSame(team, ProfileWebhookSecrets.masked(team));
  }

  @Test
  void deliveryReadsTheSecretsDecrypted() {
    Profile stored = ProfileWebhookSecrets.ofANewEntity(HOLDER, profileWith(bearer("the key")));

    Webhook sent = ProfileWebhookSecrets.decrypted(HOLDER, stored).getSubscription().getGeneric();

    assertEquals(URI.create(ENDPOINT), sent.getEndpoint());
    assertEquals("the key", ((Map<?, ?>) sent.getAuthType()).get("secretKey"));
    assertTrue(Fernet.isTokenized(stored.getSubscription().getGeneric().getEndpoint().toString()));
  }

  @Test
  void deliveryRefusesASecretNotWrittenForItsWebhook() {
    Profile stored = ProfileWebhookSecrets.ofANewEntity(HOLDER, profileWith(oauth2("the secret")));
    String storedSecret = clientSecretOf(stored);
    ProfileWebhookSecrets.Holder another =
        new ProfileWebhookSecrets.Holder("user", UUID.randomUUID());
    Profile inAnotherSlot =
        new Profile()
            .withSubscription(
                new SubscriptionConfig()
                    .withSlack(oauth2("x").withAuthType(oauth2Map(TOKEN_URL, storedSecret))));
    Profile encryptedElsewhere =
        profileWith(oauth2(Fernet.getInstance().encrypt("a value held elsewhere")));

    assertRefused(() -> ProfileWebhookSecrets.decrypted(another, stored), "not written for");
    assertRefused(() -> ProfileWebhookSecrets.decrypted(HOLDER, inAnotherSlot), "not written for");
    assertRefused(
        () -> ProfileWebhookSecrets.decrypted(HOLDER, encryptedElsewhere), "not written for");
  }

  @Test
  void bindingAStoredRowKeepsWhatIsItsOwnAndRemovesTheRest() {
    String foreign = Fernet.getInstance().encrypt("a value held elsewhere");
    Profile legacy =
        new Profile()
            .withSubscription(
                new SubscriptionConfig()
                    .withGeneric(oauth2("entered in the clear"))
                    .withSlack(oauth2(foreign))
                    .withgChat(bearer(Fernet.getInstance().encrypt("a signing key"))));
    JsonNode row =
        JsonUtils.valueToTree(
            new User()
                .withId(HOLDER.id())
                .withName("u")
                .withProfile(legacy)
                .withChangeDescription(profileChange(legacy)));

    assertTrue(ProfileWebhookSecrets.bindStoredEntity("user", row));
    String once = JsonUtils.pojoToJson(row);
    assertFalse(ProfileWebhookSecrets.bindStoredEntity("user", row));
    assertEquals(once, JsonUtils.pojoToJson(row));

    JsonNode subscriptions = row.at("/profile/subscription");
    assertTrue(subscriptions.path("slack").isMissingNode(), "a webhook holding a foreign value");
    assertEncrypted(
        GENERIC, "/authType/clientSecret", subscriptions.path(GENERIC), "entered in the clear");
    assertEncrypted("gChat", "/authType/secretKey", subscriptions.path("gChat"), "a signing key");
    assertFalse(once.contains(foreign), "history keeps the mask");
    assertTrue(once.contains(PASSWORD_MASK));
  }

  @Test
  void aProfileWithoutWebhooksIsLeftAlone() {
    Profile images = new Profile();

    assertNull(ProfileWebhookSecrets.ofANewEntity(HOLDER, null));
    assertEquals(images, ProfileWebhookSecrets.ofANewEntity(HOLDER, images));
    assertEquals(images, ProfileWebhookSecrets.updated(HOLDER, null, images));
  }

  private static void assertEncrypted(
      String slot, String field, JsonNode webhook, String plaintext) {
    String value = webhook.at(field).asText();
    assertTrue(OwnedCiphertext.isOwned(value), "not bound to its webhook: " + value);
    assertEquals(
        plaintext, OwnedCiphertext.decrypt(HOLDER.ownerOf(slot), field, value).orElseThrow());
  }

  private static String opened(String field, JsonNode value) {
    return opened(field, value.asText());
  }

  private static String opened(String field, String value) {
    return OwnedCiphertext.decrypt(HOLDER.ownerOf(GENERIC), field, value).orElseThrow();
  }

  private static ChangeDescription profileChange(Profile profile) {
    return new ChangeDescription()
        .withFieldsUpdated(
            List.of(
                new FieldChange()
                    .withName("profile")
                    .withOldValue(JsonUtils.pojoToJson(new Profile()))
                    .withNewValue(JsonUtils.pojoToJson(profile))));
  }

  private static void assertRefused(Runnable call, String reason) {
    BadRequestException refused = assertThrows(BadRequestException.class, call::run);
    assertTrue(refused.getMessage().contains(reason), refused.getMessage());
  }

  private static JsonPatch patch(String op, String path, String from) {
    return Json.createPatch(
        Json.createArrayBuilder()
            .add(Json.createObjectBuilder().add("op", op).add("path", path).add("from", from))
            .build());
  }

  private static String clientSecretOf(Profile profile) {
    return clientSecretOf(profile.getSubscription().getGeneric());
  }

  private static String clientSecretOf(Webhook webhook) {
    return (String) ((Map<?, ?>) webhook.getAuthType()).get("clientSecret");
  }

  private static Profile profileWith(Webhook webhook) {
    return new Profile().withSubscription(new SubscriptionConfig().withGeneric(webhook));
  }

  private static Webhook bearer(String secretKey) {
    return new Webhook()
        .withEndpoint(URI.create(ENDPOINT))
        .withAuthType(Map.of("type", "bearer", "secretKey", secretKey));
  }

  private static Webhook oauth2(String clientSecret) {
    return new Webhook()
        .withEndpoint(URI.create(ENDPOINT))
        .withAuthType(oauth2Map(TOKEN_URL, clientSecret));
  }

  private static Map<String, Object> oauth2Map(String tokenUrl, String clientSecret) {
    return Map.of(
        "type", "oauth2", "tokenUrl", tokenUrl, "clientId", "client", "clientSecret", clientSecret);
  }
}
