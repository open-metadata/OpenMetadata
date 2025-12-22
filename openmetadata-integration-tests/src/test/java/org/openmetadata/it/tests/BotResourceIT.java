package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.Bot;
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
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateBot createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    User botUser = createBotUser(ns, client);

    return new CreateBot()
        .withName(ns.prefix("bot"))
        .withDescription("Test bot created by integration test")
        .withBotUser(botUser.getName());
  }

  @Override
  protected CreateBot createRequest(String name, TestNamespace ns, OpenMetadataClient client) {
    User botUser = createBotUser(ns, client);

    return new CreateBot()
        .withName(name)
        .withDescription("Test bot")
        .withBotUser(botUser.getName());
  }

  private User createBotUser(TestNamespace ns, OpenMetadataClient client) {
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String userName = ns.prefix("botuser_" + uniqueId);

    CreateUser userRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(userName + "@test.com")
            .withDescription("Bot user for testing")
            .withIsBot(true);

    return client.users().create(userRequest);
  }

  @Override
  protected Bot createEntity(CreateBot createRequest, OpenMetadataClient client) {
    return client.bots().create(createRequest);
  }

  @Override
  protected Bot getEntity(String id, OpenMetadataClient client) {
    return client.bots().get(id);
  }

  @Override
  protected Bot getEntityByName(String fqn, OpenMetadataClient client) {
    return client.bots().getByName(fqn);
  }

  @Override
  protected Bot patchEntity(String id, Bot entity, OpenMetadataClient client) {
    return client.bots().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.bots().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.bots().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    client.bots().delete(id, params);
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
  protected ListResponse<Bot> listEntities(ListParams params, OpenMetadataClient client) {
    return client.bots().list(params);
  }

  @Override
  protected Bot getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    return client.bots().get(id, fields);
  }

  @Override
  protected Bot getEntityByNameWithFields(String fqn, String fields, OpenMetadataClient client) {
    return client.bots().getByName(fqn, fields);
  }

  @Override
  protected Bot getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.bots().get(id, "botUser", "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.bots().getVersionList(id);
  }

  @Override
  protected Bot getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.bots().getVersion(id.toString(), version);
  }

  // ===================================================================
  // BOT-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_botWithBotUser_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    User botUser = createBotUser(ns, client);

    CreateBot request =
        new CreateBot()
            .withName(ns.prefix("bot_with_user"))
            .withDescription("Bot with bot user")
            .withBotUser(botUser.getName());

    Bot bot = createEntity(request, client);
    assertNotNull(bot);
    assertNotNull(bot.getBotUser());
    assertEquals(botUser.getName().toLowerCase(), bot.getBotUser().getName().toLowerCase());
  }

  @Test
  void put_botDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    User botUser = createBotUser(ns, client);

    CreateBot request =
        new CreateBot()
            .withName(ns.prefix("bot_update_desc"))
            .withDescription("Initial description")
            .withBotUser(botUser.getName());

    Bot bot = createEntity(request, client);
    assertEquals("Initial description", bot.getDescription());

    // Update description
    bot.setDescription("Updated description");
    Bot updated = patchEntity(bot.getId().toString(), bot, client);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_botUserIsBot_required(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a non-bot user
    String uniqueId = UUID.randomUUID().toString().substring(0, 8);
    String userName = ns.prefix("nonbotuser_" + uniqueId);

    CreateUser userRequest =
        new CreateUser()
            .withName(userName)
            .withEmail(userName + "@test.com")
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
        Exception.class,
        () -> createEntity(request, client),
        "Creating bot with non-bot user should fail");
  }

  @Test
  void test_botUserCannotBeShared(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    User botUser = createBotUser(ns, client);

    // Create first bot
    CreateBot request1 =
        new CreateBot()
            .withName(ns.prefix("bot_first"))
            .withDescription("First bot")
            .withBotUser(botUser.getName());

    Bot bot1 = createEntity(request1, client);
    assertNotNull(bot1);

    // Try to create second bot with same bot user
    CreateBot request2 =
        new CreateBot()
            .withName(ns.prefix("bot_second"))
            .withDescription("Second bot")
            .withBotUser(botUser.getName());

    assertThrows(
        Exception.class,
        () -> createEntity(request2, client),
        "Creating bot with already-used bot user should fail");
  }

  @Test
  void test_botNameUniqueness(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String botName = ns.prefix("unique_bot");
    User botUser1 = createBotUser(ns, client);
    User botUser2 = createBotUser(ns, client);

    CreateBot request1 =
        new CreateBot()
            .withName(botName)
            .withDescription("First bot")
            .withBotUser(botUser1.getName());

    Bot bot1 = createEntity(request1, client);
    assertNotNull(bot1);

    // Try to create bot with same name
    CreateBot request2 =
        new CreateBot()
            .withName(botName)
            .withDescription("Duplicate bot")
            .withBotUser(botUser2.getName());

    assertThrows(
        Exception.class,
        () -> createEntity(request2, client),
        "Creating duplicate bot should fail");
  }
}
