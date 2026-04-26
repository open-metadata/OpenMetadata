package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for Bot entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds bot-specific tests for bot user
 * relationships.
 *
 * <p>Migrated from: org.openmetadata.service.resources.bots.BotResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class BotResourceIT extends BaseEntityIT<Bot, CreateBot> {

  // Bot has special requirements
  {
    supportsFieldsQueryParam = false;
    supportsTags = false;
    supportsOwners = false; // Bot has bot user, not owners
    supportsDomains = false; // Bot doesn't support domains
    supportsDataProducts = false;
    supportsSearchIndex = false; // Bot doesn't have a search index
    supportsListHistoryByTimestamp = true;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateBot createMinimalRequest(TestNamespace ns) {
    User botUser = createBotUser(ns);

    return new CreateBot()
        .withName(ns.prefix("bot"))
        .withDescription("Test bot created by integration test")
        .withBotUser(botUser.getName());
  }

  @Override
  protected CreateBot createRequest(String name, TestNamespace ns) {
    User botUser = createBotUser(ns);

    return new CreateBot()
        .withName(name)
        .withDescription("Test bot")
        .withBotUser(botUser.getName());
  }

  private User createBotUser(TestNamespace ns) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String userName = ns.prefix("botuser_" + uniqueId);
    // Email must be well-formed - use simple alphanumeric format
    String email = "botuser" + uniqueId + "@test.com";

    // Bot users require an authentication mechanism
    AuthenticationMechanism authMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));

    CreateUser userRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(email)
            .withDescription("Bot user for testing")
            .withIsBot(true)
            .withAuthenticationMechanism(authMechanism);

    return SdkClients.adminClient().users().create(userRequest);
  }

  @Override
  protected Bot createEntity(CreateBot createRequest) {
    return SdkClients.adminClient().bots().create(createRequest);
  }

  @Override
  protected Bot getEntity(String id) {
    return SdkClients.adminClient().bots().get(id);
  }

  @Override
  protected Bot getEntityByName(String fqn) {
    return SdkClients.adminClient().bots().getByName(fqn);
  }

  @Override
  protected Bot patchEntity(String id, Bot entity) {
    return SdkClients.adminClient().bots().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().bots().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().bots().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().bots().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "bot";
  }

  @Override
  protected void validateCreatedEntity(Bot entity, CreateBot createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getBotUser(), "Bot must have a bot user");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected ListResponse<Bot> listEntities(ListParams params) {
    return SdkClients.adminClient().bots().list(params);
  }

  @Override
  protected Bot getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().bots().get(id, fields);
  }

  @Override
  protected Bot getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().bots().getByName(fqn, fields);
  }

  @Override
  protected Bot getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().bots().get(id, "botUser", "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().bots().getVersionList(id);
  }

  @Override
  protected EntityHistory getVersionHistoryPaginated(UUID id, int limit, int offset) {
    return SdkClients.adminClient().bots().getVersionList(id, limit, offset);
  }

  @Override
  protected EntityHistory getVersionHistoryWithFieldChanged(
      UUID id, int limit, int offset, String fieldChanged) {
    return SdkClients.adminClient().bots().getVersionList(id, limit, offset, fieldChanged);
  }

  @Override
  protected Bot getVersion(UUID id, Double version) {
    return SdkClients.adminClient().bots().getVersion(id.toString(), version);
  }

  // ===================================================================
  // BOT-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_botWithBotUser_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    User botUser = createBotUser(ns);

    CreateBot request =
        new CreateBot()
            .withName(ns.prefix("bot_with_user"))
            .withDescription("Bot with bot user")
            .withBotUser(botUser.getName());

    Bot bot = createEntity(request);
    assertNotNull(bot);
    assertNotNull(bot.getBotUser());
    assertEquals(botUser.getName().toLowerCase(), bot.getBotUser().getName().toLowerCase());
  }

  @Test
  void put_botDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    User botUser = createBotUser(ns);

    CreateBot request =
        new CreateBot()
            .withName(ns.prefix("bot_update_desc"))
            .withDescription("Initial description")
            .withBotUser(botUser.getName());

    Bot bot = createEntity(request);
    assertEquals("Initial description", bot.getDescription());

    // Update description
    bot.setDescription("Updated description");
    Bot updated = patchEntity(bot.getId().toString(), bot);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_botUserIsBot_required(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a non-bot user
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String userName = ns.prefix("nonbotuser_" + uniqueId);
    // Email must be well-formed - use simple alphanumeric format
    String email = "nonbotuser" + uniqueId + "@test.com";

    CreateUser userRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(email)
            .withDescription("Non-bot user for testing")
            .withIsBot(false);

    User nonBotUser = client.users().create(userRequest);

    // Try to create bot with non-bot user
    CreateBot request =
        new CreateBot()
            .withName(ns.prefix("bot_nonbot_user"))
            .withDescription("Bot with non-bot user")
            .withBotUser(nonBotUser.getName());

    assertThrows(
        Exception.class, () -> createEntity(request), "Creating bot with non-bot user should fail");
  }

  @Test
  void test_botUserCannotBeShared(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    User botUser = createBotUser(ns);

    // Create first bot
    CreateBot request1 =
        new CreateBot()
            .withName(ns.prefix("bot_first"))
            .withDescription("First bot")
            .withBotUser(botUser.getName());

    Bot bot1 = createEntity(request1);
    assertNotNull(bot1);

    // Try to create second bot with same bot user
    CreateBot request2 =
        new CreateBot()
            .withName(ns.prefix("bot_second"))
            .withDescription("Second bot")
            .withBotUser(botUser.getName());

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating bot with already-used bot user should fail");
  }

  /**
   * Verifies that GET /bots without ?fields=botUser does NOT populate botUser. The fields query
   * parameter acts as an opt-in filter — consistent with how other resources handle optional
   * fields (e.g. owners, tags).
   */
  @Test
  void test_listBots_withoutFieldsParam_omitsBotUser(TestNamespace ns) {
    User botUser = createBotUser(ns);
    CreateBot request =
        new CreateBot()
            .withName(ns.prefix("bot_list_omits_user"))
            .withDescription("Bot for list-without-fields test")
            .withBotUser(botUser.getName());
    Bot createdBot = createEntity(request);

    ListParams params = new ListParams().setLimit(1000);
    ListResponse<Bot> response = listEntities(params);

    assertNotNull(response, "List response should not be null");
    assertNotNull(response.getData(), "List data should not be null");

    Bot listedBot =
        response.getData().stream()
            .filter(b -> createdBot.getId().equals(b.getId()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("Created bot missing from list response"));

    assertNull(
        listedBot.getBotUser(),
        "botUser must NOT be populated when ?fields=botUser is not requested");
  }

  /**
   * Regression test for issue #25878: verifies that passing ?fields=botUser is accepted and does
   * not cause an error (the param was previously silently ignored).
   */
  @Test
  void test_listBots_withFieldsParam_returnsBotUser(TestNamespace ns) {
    User botUser = createBotUser(ns);
    CreateBot request =
        new CreateBot()
            .withName(ns.prefix("bot_list_fields_param"))
            .withDescription("Bot for ?fields=botUser regression test")
            .withBotUser(botUser.getName());
    Bot createdBot = createEntity(request);

    ListParams params = new ListParams().setLimit(1000).setFields("botUser");
    ListResponse<Bot> response = listEntities(params);

    Bot listedBot =
        response.getData().stream()
            .filter(b -> createdBot.getId().equals(b.getId()))
            .findFirst()
            .orElseThrow(() -> new AssertionError("Created bot missing from list response"));

    assertNotNull(
        listedBot.getBotUser(), "botUser must be populated when ?fields=botUser is provided");
    assertEquals(botUser.getId(), listedBot.getBotUser().getId());
  }

  /**
   * Regression test for issue #25878: GET /bots/{id}?fields=botUser must return botUser (the
   * fields query parameter was previously not exposed on this endpoint).
   */
  @Test
  void test_getBotById_withFieldsParam_returnsBotUser(TestNamespace ns) {
    User botUser = createBotUser(ns);
    CreateBot request =
        new CreateBot()
            .withName(ns.prefix("bot_get_fields_param"))
            .withDescription("Bot for GET by id ?fields=botUser test")
            .withBotUser(botUser.getName());
    Bot createdBot = createEntity(request);

    Bot retrieved = getEntityWithFields(createdBot.getId().toString(), "botUser");

    assertNotNull(retrieved, "Bot must be retrievable by id with ?fields=botUser");
    assertNotNull(retrieved.getBotUser(), "botUser must be populated on GET by id");
    assertEquals(botUser.getId(), retrieved.getBotUser().getId());
  }

  /**
   * Regression test for issue #25878: GET /bots/name/{name}?fields=botUser must return botUser.
   */
  @Test
  void test_getBotByName_withFieldsParam_returnsBotUser(TestNamespace ns) {
    User botUser = createBotUser(ns);
    CreateBot request =
        new CreateBot()
            .withName(ns.prefix("bot_get_by_name_fields"))
            .withDescription("Bot for GET by name ?fields=botUser test")
            .withBotUser(botUser.getName());
    Bot createdBot = createEntity(request);

    Bot retrieved = getEntityByNameWithFields(createdBot.getFullyQualifiedName(), "botUser");

    assertNotNull(retrieved, "Bot must be retrievable by name with ?fields=botUser");
    assertNotNull(retrieved.getBotUser(), "botUser must be populated on GET by name");
    assertEquals(botUser.getId(), retrieved.getBotUser().getId());
  }

  /**
   * Verifies all bots in a multi-bot list response have botUser populated — exercises the
   * BotRepository bulk fetch path.
   */
  @Test
  void test_listBots_multipleBots_allHaveBotUser(TestNamespace ns) {
    User user1 = createBotUser(ns);
    User user2 = createBotUser(ns);
    User user3 = createBotUser(ns);

    Bot bot1 =
        createEntity(
            new CreateBot()
                .withName(ns.prefix("bot_bulk_1"))
                .withDescription("Bulk test bot 1")
                .withBotUser(user1.getName()));
    Bot bot2 =
        createEntity(
            new CreateBot()
                .withName(ns.prefix("bot_bulk_2"))
                .withDescription("Bulk test bot 2")
                .withBotUser(user2.getName()));
    Bot bot3 =
        createEntity(
            new CreateBot()
                .withName(ns.prefix("bot_bulk_3"))
                .withDescription("Bulk test bot 3")
                .withBotUser(user3.getName()));

    java.util.Set<UUID> createdIds = java.util.Set.of(bot1.getId(), bot2.getId(), bot3.getId());
    java.util.Map<UUID, UUID> expectedUserByBot =
        java.util.Map.of(
            bot1.getId(), user1.getId(),
            bot2.getId(), user2.getId(),
            bot3.getId(), user3.getId());

    ListResponse<Bot> response = listEntities(new ListParams().setLimit(1000).setFields("botUser"));

    long matched =
        response.getData().stream()
            .filter(b -> createdIds.contains(b.getId()))
            .peek(
                b -> {
                  assertNotNull(
                      b.getBotUser(),
                      "Every bot in list must have botUser populated (bulk fetch path)");
                  assertEquals(expectedUserByBot.get(b.getId()), b.getBotUser().getId());
                })
            .count();

    assertTrue(
        matched == createdIds.size(),
        "All three created bots should appear in the list response with botUser populated");
  }

  /**
   * Regression test: verifies POST /bots returns botUser in the response body. The create flow
   * uses the in-memory entity populated by {@link
   * org.openmetadata.service.jdbi3.BotRepository#prepare}, which must still set botUser after the
   * fields-gating refactor.
   */
  @Test
  void test_createBot_responseIncludesBotUser(TestNamespace ns) {
    User botUser = createBotUser(ns);
    CreateBot request =
        new CreateBot()
            .withName(ns.prefix("bot_create_response"))
            .withDescription("Regression: create response must include botUser")
            .withBotUser(botUser.getName());

    Bot created = createEntity(request);

    assertNotNull(created, "Create response should not be null");
    assertNotNull(created.getBotUser(), "POST /bots response must populate botUser");
    assertEquals(botUser.getId(), created.getBotUser().getId());
    assertEquals("user", created.getBotUser().getType());
  }

  /**
   * Regression test: patching a bot's description must not drop or alter its botUser
   * relationship. Exercises the BotUpdater + restorePatchAttributes path.
   */
  @Test
  void test_patchBotDescription_preservesBotUser(TestNamespace ns) {
    User botUser = createBotUser(ns);
    CreateBot request =
        new CreateBot()
            .withName(ns.prefix("bot_patch_preserves_user"))
            .withDescription("Initial description")
            .withBotUser(botUser.getName());
    Bot created = createEntity(request);
    UUID originalBotUserId = created.getBotUser().getId();

    created.setDescription("Patched description");
    Bot patched = patchEntity(created.getId().toString(), created);
    assertEquals("Patched description", patched.getDescription());

    Bot refetched = getEntityWithFields(created.getId().toString(), "botUser");
    assertNotNull(refetched.getBotUser(), "botUser should still be resolvable after patch");
    assertEquals(
        originalBotUserId,
        refetched.getBotUser().getId(),
        "Patching description must not change the botUser relationship");
  }

  /**
   * Regression test: bot user cannot be changed via PATCH (enforced by
   * {@link org.openmetadata.service.jdbi3.BotRepository#restorePatchAttributes}). Either the
   * patch is silently reverted or the server rejects it — both outcomes are acceptable as long
   * as the original relationship survives.
   */
  @Test
  void test_patchBot_cannotChangeBotUser(TestNamespace ns) {
    User originalBotUser = createBotUser(ns);
    User replacementBotUser = createBotUser(ns);

    Bot created =
        createEntity(
            new CreateBot()
                .withName(ns.prefix("bot_patch_user_immutable"))
                .withDescription("Bot for botUser immutability test")
                .withBotUser(originalBotUser.getName()));
    UUID originalBotUserId = created.getBotUser().getId();

    created.setBotUser(replacementBotUser.getEntityReference());

    try {
      patchEntity(created.getId().toString(), created);
    } catch (Exception ignored) {
      // Server may reject the patch outright — also acceptable.
    }

    Bot refetched = getEntityWithFields(created.getId().toString(), "botUser");
    assertEquals(
        originalBotUserId,
        refetched.getBotUser().getId(),
        "Bot's underlying botUser relationship must be immutable via PATCH");
  }

  /**
   * Backward-compatibility test: GET /bots/{id} must always return botUser, with or without the
   * fields query param. Existing integrations rely on botUser being present in the default GET
   * response — the fields-gating fix only applies to the list bulk path.
   */
  @Test
  void test_getBotById_alwaysReturnsBotUser(TestNamespace ns) {
    User botUser = createBotUser(ns);
    Bot created =
        createEntity(
            new CreateBot()
                .withName(ns.prefix("bot_get_backcompat"))
                .withDescription("Bot for GET backward-compat test")
                .withBotUser(botUser.getName()));

    Bot fetchedNoFields = getEntity(created.getId().toString());
    assertEquals(created.getId(), fetchedNoFields.getId());
    assertNotNull(
        fetchedNoFields.getBotUser(),
        "GET /bots/{id} without ?fields must still return botUser (backward compat)");
    assertEquals(botUser.getId(), fetchedNoFields.getBotUser().getId());

    Bot fetchedWithFields = getEntityWithFields(created.getId().toString(), "botUser");
    assertNotNull(fetchedWithFields.getBotUser());
    assertEquals(botUser.getId(), fetchedWithFields.getBotUser().getId());
  }

  /**
   * Backward-compatibility test: GET /bots/name/{name} must always return botUser, matching the
   * pre-existing contract for existing integrations.
   */
  @Test
  void test_getBotByName_alwaysReturnsBotUser(TestNamespace ns) {
    User botUser = createBotUser(ns);
    Bot created =
        createEntity(
            new CreateBot()
                .withName(ns.prefix("bot_get_by_name_backcompat"))
                .withDescription("Bot for GET-by-name backward-compat test")
                .withBotUser(botUser.getName()));

    Bot fetchedNoFields = getEntityByName(created.getFullyQualifiedName());
    assertEquals(created.getId(), fetchedNoFields.getId());
    assertNotNull(
        fetchedNoFields.getBotUser(),
        "GET /bots/name/{name} without ?fields must still return botUser (backward compat)");
    assertEquals(botUser.getId(), fetchedNoFields.getBotUser().getId());
  }

  @Test
  void test_botNameUniqueness(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String botName = ns.prefix("unique_bot");
    User botUser1 = createBotUser(ns);
    User botUser2 = createBotUser(ns);

    CreateBot request1 =
        new CreateBot()
            .withName(botName)
            .withDescription("First bot")
            .withBotUser(botUser1.getName());

    Bot bot1 = createEntity(request1);
    assertNotNull(bot1);

    // Try to create bot with same name
    CreateBot request2 =
        new CreateBot()
            .withName(botName)
            .withDescription("Duplicate bot")
            .withBotUser(botUser2.getName());

    assertThrows(
        Exception.class, () -> createEntity(request2), "Creating duplicate bot should fail");
  }
}
