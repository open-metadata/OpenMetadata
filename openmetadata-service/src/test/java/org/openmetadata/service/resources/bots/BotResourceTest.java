package org.openmetadata.service.resources.bots;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.apps.AppsResourceTest;
import org.openmetadata.service.resources.bots.BotResource.BotList;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.util.DeleteEntityMessage;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class BotResourceTest extends EntityResourceTest<Bot, CreateBot> {
  public static User botUser;

  public BotResourceTest() {
    super(Entity.BOT, Bot.class, BotList.class, "bots", "", INGESTION_BOT);
    supportsFieldsQueryParam = false;
    supportedNameCharacters = "_-.";
  }

  public void setupBots() {
    createUser();
  }

  @BeforeEach
  public void beforeEach() throws HttpResponseException {
    ResultList<Bot> bots = listEntities(null, ADMIN_AUTH_HEADERS);

    // Get App Bots
    AppsResourceTest appsResourceTest = new AppsResourceTest();
    ResultList<App> appResultList = appsResourceTest.listEntities(null, ADMIN_AUTH_HEADERS);
    Set<UUID> applicationBotIds = new HashSet<>();
    appResultList
        .getData()
        .forEach(
            app -> {
              if (app.getBot() != null) {
                applicationBotIds.add(app.getBot().getId());
              } else {
                LOG.error("Bot Entry Null for App : {}", app.getName());
              }
            });
    for (Bot bot : bots.getData()) {
      try {
        if (!bot.getProvider().equals(ProviderType.SYSTEM)
            && !applicationBotIds.contains(bot.getId())) {
          deleteEntity(bot.getId(), true, true, ADMIN_AUTH_HEADERS);
          createUser();
        }
      } catch (Exception ignored) {
      }
    }
  }

  @Test
  void testBotInitialization() throws IOException {
    // Ensure all the bots are bootstrapped from the data files
    List<Bot> bots =
        EntityRepository.getEntitiesFromSeedData(
            Entity.BOT, ".*json/data/bot/.*\\.json$", Bot.class);
    for (Bot bot : bots) {
      assertNotNull(getEntityByName(bot.getName(), "", ADMIN_AUTH_HEADERS));
    }
  }

  @Override
  @Test
  public void delete_async_with_recursive_hardDelete(TestInfo test) throws Exception {
    // Create a separate bot user for this test
    UserResourceTest userResourceTest = new UserResourceTest();
    User testUser = new UserResourceTest().createUser("test-delete-bot-user", true);
    CreateBot create = createRequest(test).withBotUser(testUser.getName());
    Bot bot = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Test async delete with recursive and hard delete flags
    DeleteEntityMessage deleteMessage = receiveDeleteEntityMessage(bot.getId(), true, true);

    assertEquals("COMPLETED", deleteMessage.getStatus());
    assertEquals(bot.getName(), deleteMessage.getEntityName());
    assertNull(deleteMessage.getError());
    assertEntityDeleted(bot.getId(), true);
  }

  @Test
  void delete_ensureBotUserDelete(TestInfo test) throws IOException {
    User testUser = new UserResourceTest().createUser("test-deleter", true);
    CreateBot create = createRequest(test).withBotUser(testUser.getName());
    Bot bot = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    deleteAndCheckEntity(bot, true, true, ADMIN_AUTH_HEADERS);

    // When bot is deleted, the corresponding bot user is also deleted
    assertEntityDeleted(testUser.getId(), true);
  }

  @Test
  void put_failIfUserIsAlreadyUsedByAnotherBot(TestInfo test) throws IOException {
    // create a bot user
    User testUser = new UserResourceTest().createUser("bot-test-user", true);
    // create a bot
    CreateBot create = createRequest(test).withBotUser(testUser.getName());
    createEntity(create, ADMIN_AUTH_HEADERS);
    // create another bot with the same bot user
    CreateBot failCreateRequest =
        createRequest(test).withName("wrong-bot").withBotUser(testUser.getName());
    assertResponse(
        () -> createEntity(failCreateRequest, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.userAlreadyBot(testUser.getName(), create.getName()));
  }

  @Test
  void put_failIfUserIsNotBot(TestInfo test) {
    // create a non bot user
    User testUser = new UserResourceTest().createUser("bot-test-user", false);
    CreateBot failCreateRequest = createRequest(test).withBotUser(testUser.getName());
    // fail because it is not a bot
    assertResponse(
        () -> createEntity(failCreateRequest, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "User [bot-test-user] is not a bot user");
  }

  @Override
  public CreateBot createRequest(String name) {
    if (name != null && name.contains("entityListWithPagination_200")) {
      return new CreateBot()
          .withName(name)
          .withBotUser(
              Objects.requireNonNull(new UserResourceTest().createUser(name, true)).getName());
    }
    return new CreateBot().withName(name).withBotUser(botUser.getName());
  }

  @Override
  public void validateCreatedEntity(
      Bot entity, CreateBot request, Map<String, String> authHeaders) {
    if (request.getBotUser() != null) {
      assertNotNull(entity.getBotUser());
      TestUtils.validateEntityReference(entity.getBotUser());
      Assertions.assertEquals(
          request.getBotUser().toLowerCase(),
          entity.getBotUser().getFullyQualifiedName().toLowerCase());
    } else {
      Assertions.assertNull(entity.getBotUser());
    }
  }

  @Override
  public void compareEntities(Bot expected, Bot updated, Map<String, String> authHeaders) {
    assertReference(expected.getBotUser(), updated.getBotUser());
  }

  @Override
  public Bot validateGetWithDifferentFields(Bot entity, boolean byName) {
    return entity; // TODO cleanup
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    assertCommonFieldChange(fieldName, expected, actual);
  }

  private void createUser() {
    User user = new UserResourceTest().createUser("botUser", true);
    botUser = user != null ? user : botUser;
  }
}
