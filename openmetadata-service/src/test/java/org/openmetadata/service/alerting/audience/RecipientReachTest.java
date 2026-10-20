package org.openmetadata.service.alerting.audience;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionCategory;
import org.openmetadata.schema.entity.feed.Announcement;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;

/** Who each category can reach, read from the fields an entity type holds, as delivery reads it. */
class RecipientReachTest {

  private static final Map<String, Class<? extends EntityInterface<?>>> TYPES =
      Map.of(
          Entity.TABLE, Table.class,
          Entity.TASK, Task.class,
          Entity.ANNOUNCEMENT, Announcement.class,
          Entity.USER, User.class,
          Entity.GLOSSARY_TERM, GlossaryTerm.class);
  private static final Map<String, Class<? extends EntityInterface<?>>> BEFORE = new HashMap<>();

  // Registered as the server registers them, by the lower-cased type.
  @BeforeAll
  static void registerTheTypes() {
    TYPES.forEach(
        (type, clazz) -> {
          String key = type.toLowerCase(Locale.ROOT);
          BEFORE.put(key, EntityInterface.ENTITY_TYPE_TO_CLASS_MAP.get(key));
          EntityInterface.ENTITY_TYPE_TO_CLASS_MAP.put(key, clazz);
        });
  }

  @AfterAll
  static void restoreTheTypes() {
    BEFORE.forEach(
        (type, clazz) -> {
          if (clazz == null) {
            EntityInterface.ENTITY_TYPE_TO_CLASS_MAP.remove(type);
          } else {
            EntityInterface.ENTITY_TYPE_TO_CLASS_MAP.put(type, clazz);
          }
        });
  }

  @Test
  void ownersNeedTheFieldOrAConversation() {
    assertEquals(
        List.of(Entity.TABLE, Entity.ANNOUNCEMENT, Entity.GLOSSARY_TERM, Entity.CONVERSATION),
        reachedBy(SubscriptionCategory.OWNERS));
  }

  @Test
  void followersNeedTheFieldOrAConversation() {
    assertEquals(
        List.of(Entity.TABLE, Entity.CONVERSATION), reachedBy(SubscriptionCategory.FOLLOWERS));
  }

  @Test
  void assigneesOnlyATaskHas() {
    assertEquals(List.of(Entity.TASK), reachedBy(SubscriptionCategory.ASSIGNEES));
  }

  @Test
  void mentionsOnlyTextThatMentions() {
    assertEquals(
        List.of(Entity.TASK, Entity.ANNOUNCEMENT, Entity.CONVERSATION),
        reachedBy(SubscriptionCategory.MENTIONS));
  }

  @Test
  void whoTheDestinationNamesIsReachedFromAnyEvent() {
    for (SubscriptionCategory category :
        List.of(
            SubscriptionCategory.USERS,
            SubscriptionCategory.TEAMS,
            SubscriptionCategory.ADMINS,
            SubscriptionCategory.EXTERNAL)) {
      assertEquals(types(), reachedBy(category), category.value());
    }
  }

  // An entity type the server does not know is not judged, so it never loses a recipient.
  @Test
  void unknownTypeIsNotJudged() {
    assertTrue(RecipientResolver.reaches(SubscriptionCategory.OWNERS, "spreadsheet"));
    assertTrue(RecipientResolver.reaches(SubscriptionCategory.FOLLOWERS, "spreadsheet"));
  }

  // Not reached means not looked up: the entity is never fetched for a field it cannot hold.
  @Test
  void typeNotReachedResolvesToNoOneWithoutALookup() {
    UserRecipientResolver users = new UserRecipientResolver();
    TeamRecipientResolver teams = new TeamRecipientResolver();
    SubscriptionDestination destination = new SubscriptionDestination();
    UUID id = UUID.randomUUID();

    assertEquals(
        Recipients.none(),
        new OwnerRecipientResolver(users, teams).resolve(id, Entity.TASK, null, destination, null));
    assertEquals(
        Recipients.none(),
        new FollowerRecipientResolver(users, teams)
            .resolve(id, Entity.ANNOUNCEMENT, null, destination, null));
  }

  private static List<String> types() {
    return List.of(
        Entity.TABLE,
        Entity.TASK,
        Entity.ANNOUNCEMENT,
        Entity.USER,
        Entity.GLOSSARY_TERM,
        Entity.CONVERSATION);
  }

  private static List<String> reachedBy(SubscriptionCategory category) {
    return types().stream().filter(type -> RecipientResolver.reaches(category, type)).toList();
  }
}
