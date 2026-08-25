package org.openmetadata.service.events.subscription;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FilterResourceDescriptor;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.events.subscription.EventSubscriptionResource;

class ResourceEventTypesTest {

  private static List<String> notificationResources() throws IOException {
    return EventSubscriptionResource.getNotificationsFilterDescriptors().stream()
        .map(FilterResourceDescriptor::getName)
        .toList();
  }

  @Test
  void everyNotificationResourceDeclaresEventTypes() throws IOException {
    for (String resource : notificationResources()) {
      assertFalse(
          ResourceEventTypes.forResource(resource).isEmpty(),
          "Resource " + resource + " declares no event type");
    }
  }

  @Test
  void entityResourceDeclaresEntityAndThreadEvents() {
    List<EventType> glossaryTerm = ResourceEventTypes.forResource(Entity.GLOSSARY_TERM);
    assertTrue(glossaryTerm.contains(EventType.ENTITY_CREATED));
    assertTrue(glossaryTerm.contains(EventType.ENTITY_DELETED));
    // #28122 routes a conversation to the alert of the entity the thread is about
    assertTrue(glossaryTerm.contains(EventType.THREAD_CREATED));
    assertTrue(glossaryTerm.contains(EventType.POST_CREATED));
    // a task thread reaches its parent entity down the same path
    assertTrue(glossaryTerm.contains(EventType.TASK_RESOLVED));
    assertTrue(glossaryTerm.contains(EventType.TASK_CLOSED));
  }

  @Test
  void noResourceDeclaresFieldsChanged() throws IOException {
    for (String resource : notificationResources()) {
      assertFalse(
          ResourceEventTypes.forResource(resource).contains(EventType.ENTITY_FIELDS_CHANGED),
          resource + " declares entityFieldsChanged, which never reaches change_event");
    }
  }

  @Test
  void conversationDeclaresThreadEventsOnly() {
    List<EventType> conversation = ResourceEventTypes.forResource("conversation");
    assertEquals(
        List.of(
            EventType.THREAD_CREATED,
            EventType.THREAD_UPDATED,
            EventType.POST_CREATED,
            EventType.POST_UPDATED),
        conversation);
  }

  @Test
  void taskDeclaresEntityEventsAndTheLegacyThreadTaskEvents() {
    List<EventType> task = ResourceEventTypes.forResource(Entity.TASK);
    assertTrue(task.contains(EventType.ENTITY_UPDATED));
    assertTrue(task.contains(EventType.TASK_RESOLVED));
    assertTrue(task.contains(EventType.TASK_CLOSED));
  }

  @Test
  void conversationDeclaresNoTaskEvents() {
    assertFalse(ResourceEventTypes.forResource("conversation").contains(EventType.TASK_RESOLVED));
  }

  @Test
  void allResourceIsASupersetOfEveryOtherResource() throws IOException {
    Set<EventType> all =
        Set.copyOf(ResourceEventTypes.forResource(ResourceEventTypes.ALL_RESOURCE));
    for (String resource : notificationResources()) {
      assertTrue(
          all.containsAll(ResourceEventTypes.forResource(resource)),
          "Resource " + resource + " declares an event type that 'all' does not");
    }
    // reachable only through "all": their entity types are not notification resources
    assertTrue(all.contains(EventType.LOGICAL_TEST_CASE_ADDED));
    assertTrue(all.contains(EventType.ENTITY_LINEAGE_ADDED));
  }

  @Test
  void noResourceDeclaresAnUnreachableEventType() throws IOException {
    for (String resource : notificationResources()) {
      for (EventType eventType : ResourceEventTypes.forResource(resource)) {
        assertFalse(
            ResourceEventTypes.UNREACHABLE.contains(eventType),
            resource + " declares " + eventType.value() + ", which nothing emits");
      }
    }
  }

  // Adding an EventType without deciding which resources can deliver it must fail here.
  @Test
  void declaredAndUnreachableTogetherCoverTheWholeEnum() throws IOException {
    Set<EventType> declared =
        notificationResources().stream()
            .flatMap(resource -> ResourceEventTypes.forResource(resource).stream())
            .collect(Collectors.toSet());
    Set<EventType> covered = EnumSet.copyOf(declared);
    covered.addAll(ResourceEventTypes.UNREACHABLE);
    assertEquals(
        EnumSet.copyOf(Arrays.asList(EventType.values())),
        covered,
        "every EventType must be declared by some resource or listed as unreachable");
  }
}
