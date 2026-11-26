package org.openmetadata.service.alerting.matching;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.AccessControlDAOs.UserDAO;
import org.openmetadata.service.jdbi3.CollectionDAO;

/** How much work one evaluation does no longer grows with what the event's author wrote. */
class AlertsRuleEvaluatorWorkPerEventTest {

  private static final int MANY = 10_000;

  @Test
  void mentionsOfUsersTheAlertDoesNotListCostNoLookups() {
    String message =
        IntStream.range(0, MANY)
            .mapToObj(index -> "<#E::user::someone_" + index + ">")
            .collect(Collectors.joining(" "));
    UserDAO users = usersWhereOnly("alice");

    CollectionDAO dao = daoWith(users);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);

      assertFalse(
          new AlertsRuleEvaluator(conversationSaying(message))
              .matchConversationUser(List.of("alice")));
    }
    verify(users, never()).findEntityByName(anyString());
  }

  @Test
  void aMentionRepeatedManyTimesIsLookedUpOnce() {
    String message = "<#E::user::ghost> ".repeat(MANY);
    UserDAO users = usersWhereOnly();

    CollectionDAO dao = daoWith(users);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);

      assertFalse(
          new AlertsRuleEvaluator(conversationSaying(message))
              .matchConversationUser(List.of("ghost")));
    }
    verify(users, times(1)).findEntityByName("ghost");
  }

  @Test
  void aListedMentionStillMatches() {
    UserDAO users = usersWhereOnly("alice");

    CollectionDAO dao = daoWith(users);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);

      assertTrue(
          new AlertsRuleEvaluator(conversationSaying("hi <#E::user::bob> <#E::user::alice>"))
              .matchConversationUser(List.of("alice")));
    }
  }

  @Test
  void theEventEntityIsReadOnceHoweverManyFiltersAskForIt() {
    Table table = new Table().withId(UUID.randomUUID()).withName("orders");
    ChangeEvent event =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEntityType(Entity.TABLE)
            .withEntity(JsonUtils.pojoToJson(table));
    List<String> otherIds = List.of(UUID.randomUUID().toString());

    try (MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS);
        MockedStatic<JsonUtils> json = mockStatic(JsonUtils.class, CALLS_REAL_METHODS)) {
      entity.when(() -> Entity.getEntityClassFromType(Entity.TABLE)).thenReturn(Table.class);
      AlertsRuleEvaluator evaluator = new AlertsRuleEvaluator(event);

      for (int filter = 0; filter < 50; filter++) {
        assertFalse(evaluator.matchAnyEntityId(otherIds));
      }

      json.verify(() -> JsonUtils.readValue(anyString(), eq(Table.class)), times(1));
    }
  }

  private static ChangeEvent conversationSaying(String message) {
    Conversation conversation = new Conversation().withId(UUID.randomUUID()).withMessage(message);
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEntityType(Entity.CONVERSATION)
        .withEntity(conversation);
  }

  // Like the real store: a user that does not exist is not found, it is never null.
  private static UserDAO usersWhereOnly(String... names) {
    UserDAO users = mock(UserDAO.class);
    when(users.findEntityByName(anyString()))
        .thenThrow(EntityNotFoundException.byMessage("user instance not found"));
    for (String name : names) {
      doReturn(new User().withName(name)).when(users).findEntityByName(name);
    }
    return users;
  }

  private static CollectionDAO daoWith(UserDAO users) {
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.userDAO()).thenReturn(users);
    return dao;
  }
}
