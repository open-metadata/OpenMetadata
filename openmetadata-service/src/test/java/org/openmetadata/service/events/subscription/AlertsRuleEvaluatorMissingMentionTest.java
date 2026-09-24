package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.feed.Conversation;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.AccessControlDAOs.UserDAO;
import org.openmetadata.service.jdbi3.CollectionDAO;

class AlertsRuleEvaluatorMissingMentionTest {

  @Test
  void mentionOfDeletedUserStillMatchesTheOthers() {
    ChangeEvent event = conversationSaying("ping <#E::user::ghost> and <#E::user::alice>");

    CollectionDAO dao = daoWhereOnlyAliceExists();

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);

      assertTrue(new AlertsRuleEvaluator(event).matchConversationUser(List.of("alice")));
    }
  }

  @Test
  void mentionOfOnlyDeletedUsersDoesNotMatchAndDoesNotThrow() {
    ChangeEvent event = conversationSaying("ping <#E::user::ghost>");

    CollectionDAO dao = daoWhereOnlyAliceExists();

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);

      assertFalse(new AlertsRuleEvaluator(event).matchConversationUser(List.of("alice")));
    }
  }

  private static ChangeEvent conversationSaying(String message) {
    Conversation conversation = new Conversation().withId(UUID.randomUUID()).withMessage(message);
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEntityType(Entity.CONVERSATION)
        .withEntity(conversation);
  }

  private static CollectionDAO daoWhereOnlyAliceExists() {
    UserDAO users = mock(UserDAO.class);
    when(users.findEntityByName("ghost"))
        .thenThrow(EntityNotFoundException.byMessage("user instance for ghost not found"));
    when(users.findEntityByName("alice")).thenReturn(new User().withName("alice"));
    CollectionDAO dao = mock(CollectionDAO.class);
    when(dao.userDAO()).thenReturn(users);
    return dao;
  }
}
