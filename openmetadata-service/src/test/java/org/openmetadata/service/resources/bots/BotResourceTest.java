package org.openmetadata.service.resources.bots;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Map;
import java.util.Objects;
import lombok.SneakyThrows;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.entity.Bot;
import org.openmetadata.schema.entity.BotType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.bots.BotResource.BotList;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.util.ResultList;

public class BotResourceTest extends EntityResourceTest<Bot, CreateBot> {
  public static User botUser;
  public static EntityReference botUserRef;

  public BotResourceTest() {
    super(Entity.BOT, Bot.class, BotList.class, "bots", ""); // TODO fix this
    supportsFieldsQueryParam = false;
  }

  @BeforeAll
  public void setup(TestInfo test) throws URISyntaxException, IOException {
    super.setup(test);
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
  void put_entityNonEmptyDescriptionUpdate_200(TestInfo test) {
    // PUT based updates are categorized as create operation
    // PUT from a bot to update itself is rejected because of that
    // TODO turning off the test for now which requires BOT to make update using PUT
  }

  @Test
  void delete_ensureBotUserDelete(TestInfo test) throws IOException {
    User testUser = new UserResourceTest().createUser("test-deleter", true);
    EntityReference testUserRef = testUser.getEntityReference();

    CreateBot create = createRequest(test).withBotUser(testUserRef);
    Bot bot = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    deleteAndCheckEntity(bot, true, true, ADMIN_AUTH_HEADERS);

    // When bot is deleted, the corresponding bot user is also deleted
    assertEntityDeleted(testUser.getId(), true);
  }

  @Test
  void put_failIfUserIsAlreadyUsedByAnotherBot(TestInfo test) throws IOException {
    // create a bot user
    User testUser = new UserResourceTest().createUser("bot-test-user", true);
    EntityReference botUserRef = Objects.requireNonNull(testUser).getEntityReference();
    // create a bot
    CreateBot create = createRequest(test).withBotUser(botUserRef);
    createEntity(create, ADMIN_AUTH_HEADERS);
    // create another bot with the same bot user
    CreateBot failCreateRequest = createRequest(test).withName("wrong-bot").withBotUser(botUserRef);
    assertResponse(
        () -> createEntity(failCreateRequest, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Bot user [bot-test-user] is already used by [bot_put_failIfUserIsAlreadyUsedByAnotherBot] bot");
  }

  @Test
  void put_failIfUserIsNotBot(TestInfo test) {
    // create a non bot user
    User testUser = new UserResourceTest().createUser("bot-test-user", false);
    EntityReference userRef = Objects.requireNonNull(testUser).getEntityReference();
    CreateBot failCreateRequest = createRequest(test).withBotUser(userRef);
    // fail because it is not a bot
    assertResponse(
        () -> createEntity(failCreateRequest, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "User [bot-test-user] is not a bot user");
  }

  @Test
  void delete_failIfUserIsIngestionBot(TestInfo test) throws IOException {
    // get ingestion bot
    Bot ingestionBot = getEntityByName(BotType.INGESTION_BOT.value(), "", ADMIN_AUTH_HEADERS);
    // fail because it is a system bot
    assertResponse(
        () -> deleteEntity(ingestionBot.getId(), true, true, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[ingestion-bot] can not be deleted.");
  }

  @Override
  public CreateBot createRequest(String name) {
    if (name != null && name.contains("entityListWithPagination_200")) {
      return new CreateBot()
          .withName(name)
          .withBotUser(Objects.requireNonNull(new UserResourceTest().createUser(name, true)).getEntityReference());
    }
    return new CreateBot().withName(name).withBotUser(botUserRef);
  }

  @SneakyThrows // TODO remove
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
    if (botUser != null) {
      botUserRef = botUser.getEntityReference();
    }
  }
}
