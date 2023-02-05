package org.openmetadata.service.resources.bots;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.bots.BotResource.BotList;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.util.ResultList;

public class BotResourceTest extends EntityResourceTest<Bot, CreateBot> {
  public static User botUser;

  public BotResourceTest() {
    super(Entity.BOT, Bot.class, BotList.class, "bots", "", INGESTION_BOT);
    supportsFieldsQueryParam = false;
    supportedNameCharacters = supportedNameCharacters.replace(" ", ""); // Space not supported
  }

  public void setupBots(TestInfo test) throws URISyntaxException, IOException {
    createUser();
  }

  @BeforeEach
  public void beforeEach() throws HttpResponseException {
    ResultList<Bot> bots = listEntities(null, ADMIN_AUTH_HEADERS);
    for (Bot bot : bots.getData()) {
      try {
        deleteEntity(bot.getId(), true, true, ADMIN_AUTH_HEADERS);
        createUser();
      } catch (Exception ignored) {
      }
    }
  }

  @Test
  void testBotInitialization() throws IOException {
    // Ensure all the bots are bootstrapped from the data files
    List<Bot> bots = EntityRepository.getEntitiesFromSeedData(Entity.BOT, ".*json/data/bot/.*\\.json$", Bot.class);
    for (Bot bot : bots) {
      assertNotNull(getEntityByName(bot.getName(), "", ADMIN_AUTH_HEADERS));
    }
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
    CreateBot failCreateRequest = createRequest(test).withName("wrong-bot").withBotUser(testUser.getName());
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
          .withBotUser(Objects.requireNonNull(new UserResourceTest().createUser(name, true)).getName());
    }
    System.out.println("XXX botUser " + botUser);
    return new CreateBot().withName(name).withBotUser(botUser.getName());
  }

  @Override
  public void validateCreatedEntity(Bot entity, CreateBot request, Map<String, String> authHeaders) {
    assertReference(request.getBotUser(), entity.getBotUser());
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
  public void assertFieldChange(String fieldName, Object expected, Object actual) {}

  private void createUser() {
    botUser = new UserResourceTest().createUser("botUser", true);
    System.out.println("XXX botUser " + botUser);
  }
}
