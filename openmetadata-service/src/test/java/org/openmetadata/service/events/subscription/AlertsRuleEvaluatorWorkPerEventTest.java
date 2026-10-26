package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
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
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.UserDAO;

/** How much work one evaluation does no longer grows with what the event's author wrote. */
class AlertsRuleEvaluatorWorkPerEventTest {

  private static final int MANY = 10_000;

  @Test
  void mentionsOfUsersTheAlertDoesNotListCostNoLookups() {
    String message =
        IntStream.range(0, MANY)
            .mapToObj(index -> "<#E::user::someone_" + index + ">")
            .collect(Collectors.joining(" "));
    UserDAO users = mock(UserDAO.class);
    when(users.findEntityByName(anyString())).thenReturn(new User().withName("someone"));
    CollectionDAO dao = daoWith(users);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);

      assertFalse(
          new AlertsRuleEvaluator(threadSaying(message)).matchConversationUser(List.of("alice")));
    }
    verify(users, never()).findEntityByName(anyString());
  }

  @Test
  void aListedMentionRepeatedManyTimesIsLookedUpOnce() {
    String message = "<#E::user::alice> ".repeat(MANY);
    UserDAO users = mock(UserDAO.class);
    when(users.findEntityByName("alice")).thenReturn(new User().withName("someone-else"));
    CollectionDAO dao = daoWith(users);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);

      assertFalse(
          new AlertsRuleEvaluator(threadSaying(message)).matchConversationUser(List.of("alice")));
    }
    verify(users, times(1)).findEntityByName("alice");
  }

  @Test
  void aListedMentionStillMatches() {
    UserDAO users = mock(UserDAO.class);
    when(users.findEntityByName("alice")).thenReturn(new User().withName("alice"));
    CollectionDAO dao = daoWith(users);

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);

      assertTrue(
          new AlertsRuleEvaluator(threadSaying("hi <#E::user::bob> <#E::user::alice>"))
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

  private static ChangeEvent threadSaying(String message) {
    Thread thread = new Thread().withId(UUID.randomUUID()).withMessage(message).withPostsCount(0);
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEntityType(Entity.THREAD)
        .withEntity(thread);
  }

  private static CollectionDAO daoWith(UserDAO users) {
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.userDAO()).thenReturn(users);
    return dao;
  }
}
