package org.openmetadata.catalog.resources.bots;

import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Map;
import lombok.SneakyThrows;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.CreateBot;
import org.openmetadata.catalog.api.teams.CreateUser;
import org.openmetadata.catalog.entity.Bot;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.bots.BotResource.BotList;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.type.EntityReference;

class BotResourceTest extends EntityResourceTest<Bot, CreateBot> {
  public static User botUser;
  public static EntityReference botUserRef;

  public BotResourceTest() {
    super(Entity.BOT, Bot.class, BotList.class, "bots", ""); // TODO fix this
    supportsFieldsQueryParam = false;
  }

  @BeforeAll
  public void setup(TestInfo test) throws URISyntaxException, IOException {
    super.setup(test);
    UserResourceTest userResourceTest = new UserResourceTest();
    CreateUser createUser = userResourceTest.createRequest("botUser", "", "", null);
    botUser = new UserResourceTest().createEntity(createUser, ADMIN_AUTH_HEADERS);
    botUserRef = botUser.getEntityReference();
  }

  @Test
  void delete_ensureBotUserDelete(TestInfo test) throws IOException {
    UserResourceTest userResourceTest = new UserResourceTest();
    CreateUser createUser = userResourceTest.createRequest(test);
    User testUser = new UserResourceTest().createEntity(createUser, ADMIN_AUTH_HEADERS);
    EntityReference testUserRef = testUser.getEntityReference();

    CreateBot create = createRequest(test).withBotUser(testUserRef);
    Bot bot = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    deleteAndCheckEntity(bot, true, true, ADMIN_AUTH_HEADERS);

    // When bot is deleted, the corresponding bot user is also deleted
    assertEntityDeleted(testUser.getId(), true);
  }

  @Override
  public CreateBot createRequest(String name) {
    return new CreateBot().withName(name).withBotUser(botUserRef);
  }

  @SneakyThrows // TODO remove
  @Override
  public void validateCreatedEntity(Bot entity, CreateBot request, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertReference(request.getBotUser(), entity.getBotUser());
  }

  @Override
  public void compareEntities(Bot expected, Bot updated, Map<String, String> authHeaders) throws HttpResponseException {
    assertReference(expected.getBotUser(), updated.getBotUser());
  }

  @Override
  public Bot validateGetWithDifferentFields(Bot entity, boolean byName) throws HttpResponseException {
    return entity; // TODO cleanup
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {}
}
