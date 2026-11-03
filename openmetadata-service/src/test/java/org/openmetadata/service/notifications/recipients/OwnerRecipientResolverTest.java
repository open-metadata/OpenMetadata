/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.notifications.recipients;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.notifications.recipients.context.EmailRecipient;
import org.openmetadata.service.notifications.recipients.context.Recipient;
import org.openmetadata.service.notifications.recipients.strategy.impl.OwnerRecipientResolver;
import org.openmetadata.service.notifications.recipients.strategy.impl.TeamRecipientResolver;
import org.openmetadata.service.notifications.recipients.strategy.impl.UserRecipientResolver;

/**
 * A thread or a task has no owners of its own. Its owners are its creator, unless a bot, and the
 * owners of the entity it is about.
 */
class OwnerRecipientResolverTest {

  private static final UUID TABLE_ID = UUID.randomUUID();
  private static final User CREATOR = user("creator", false);
  private static final User BOT = user("ingestion-bot", true);
  private static final User STEWARD = user("steward", false);

  private final OwnerRecipientResolver owners =
      new OwnerRecipientResolver(new UserRecipientResolver(), new TeamRecipientResolver());

  @Test
  void taskReachesItsCreatorAndTheOwnersOfWhatItIsAbout() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubUsers(entityMock, CREATOR, STEWARD);
      stubTableOwnedBy(entityMock, STEWARD);

      assertEquals(
          Set.of(CREATOR.getEmail(), STEWARD.getEmail()),
          emailsOf(owners.resolve(taskEvent(task(CREATOR, table())), null, email())));
    }
  }

  @Test
  void taskAboutNothingReachesOnlyItsCreator() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubUsers(entityMock, CREATOR);

      assertEquals(
          Set.of(CREATOR.getEmail()),
          emailsOf(owners.resolve(taskEvent(task(CREATOR, null)), null, email())));
    }
  }

  @Test
  void taskAboutAnEntityThatIsGoneReachesOnlyItsCreator() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubUsers(entityMock, CREATOR);
      entityMock
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TABLE), eq(TABLE_ID), eq("owners"), eq(Include.NON_DELETED)))
          .thenThrow(EntityNotFoundException.byMessage("table not found"));

      assertEquals(
          Set.of(CREATOR.getEmail()),
          emailsOf(owners.resolve(taskEvent(task(CREATOR, table())), null, email())));
    }
  }

  @Test
  void taskFiledByABotReachesTheOwnersButNotTheBot() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubUsers(entityMock, BOT, STEWARD);
      stubTableOwnedBy(entityMock, STEWARD);

      assertEquals(
          Set.of(STEWARD.getEmail()),
          emailsOf(owners.resolve(taskEvent(task(BOT, table())), null, email())));
    }
  }

  @Test
  void threadStartedByABotReachesTheOwnersButNotTheBot() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubUsers(entityMock, STEWARD);
      entityMock
          .when(
              () ->
                  Entity.getEntityByName(
                      eq(Entity.USER), eq(BOT.getName()), any(), eq(Include.NON_DELETED)))
          .thenReturn(BOT);
      stubTableOwnedBy(entityMock, STEWARD);
      Thread thread =
          new Thread()
              .withId(UUID.randomUUID())
              .withCreatedBy(BOT.getName())
              .withEntityRef(table());
      ChangeEvent event =
          new ChangeEvent()
              .withId(UUID.randomUUID())
              .withEntityType(Entity.THREAD)
              .withEntity(JsonUtils.pojoToJson(thread));

      assertEquals(Set.of(STEWARD.getEmail()), emailsOf(owners.resolve(event, null, email())));
    }
  }

  @Test
  void storedTaskReachesTheSamePeopleAsItsEvent() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubUsers(entityMock, CREATOR, STEWARD);
      stubTableOwnedBy(entityMock, STEWARD);
      Task task = task(CREATOR, table());
      entityMock
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TASK),
                      eq(task.getId()),
                      eq("about,createdBy"),
                      eq(Include.NON_DELETED)))
          .thenReturn(task);

      assertEquals(
          Set.of(CREATOR.getEmail(), STEWARD.getEmail()),
          emailsOf(owners.resolve(task.getId(), Entity.TASK, null, email())));
    }
  }

  private static void stubUsers(MockedStatic<Entity> entityMock, User... users) {
    for (User user : users) {
      entityMock
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.USER), eq(user.getId()), any(), eq(Include.NON_DELETED)))
          .thenReturn(user);
    }
  }

  private static void stubTableOwnedBy(MockedStatic<Entity> entityMock, User owner) {
    entityMock
        .when(
            () ->
                Entity.getEntity(
                    eq(Entity.TABLE), eq(TABLE_ID), eq("owners"), eq(Include.NON_DELETED)))
        .thenReturn(new Table().withId(TABLE_ID).withOwners(List.of(ref(owner))));
  }

  private static Task task(User creator, EntityReference about) {
    return new Task().withId(UUID.randomUUID()).withCreatedBy(ref(creator)).withAbout(about);
  }

  private static ChangeEvent taskEvent(Task task) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEntityType(Entity.TASK)
        .withEntity(JsonUtils.pojoToJson(task));
  }

  private static EntityReference table() {
    return new EntityReference().withId(TABLE_ID).withType(Entity.TABLE);
  }

  private static EntityReference ref(User user) {
    return new EntityReference()
        .withId(user.getId())
        .withType(Entity.USER)
        .withName(user.getName());
  }

  private static User user(String name, boolean bot) {
    return new User()
        .withId(UUID.randomUUID())
        .withName(name)
        .withEmail(name + "@open-metadata.org")
        .withIsBot(bot);
  }

  private static SubscriptionDestination email() {
    return new SubscriptionDestination().withType(SubscriptionType.EMAIL);
  }

  private static Set<String> emailsOf(Set<Recipient> recipients) {
    return recipients.stream()
        .map(EmailRecipient.class::cast)
        .map(EmailRecipient::getEmail)
        .collect(Collectors.toSet());
  }
}
