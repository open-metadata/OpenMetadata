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

package org.openmetadata.service.events.subscription;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.type.EventType;

/**
 * Populates {@code FilterResourceDescriptor.supportedEventTypes}: the event types an alert on a
 * given notification resource can actually receive, derived from what the emitters produce rather
 * than from the {@link EventType} enum. Consumers read the descriptor, never this class.
 *
 * <p>An alert matches an event when {@code AlertUtil.shouldTriggerAlert} lets it through: the "all"
 * resource takes everything; a THREAD event matches {@code thread.type} for the thread-type
 * resources and {@code thread.entityRef.type} for every other resource; anything else matches on
 * {@code entityType}. Values no emitter produces, or that never reach {@code change_event}, are
 * deliberately absent, see {@code UNREACHABLE}.
 */
public final class ResourceEventTypes {
  public static final String ALL_RESOURCE = "all";
  private static final String CONVERSATION = "conversation";

  /** Emitted for every entity by the generic CRUD paths in EntityRepository. */
  private static final List<EventType> ENTITY_EVENTS =
      List.of(
          EventType.ENTITY_CREATED,
          EventType.ENTITY_UPDATED,
          EventType.ENTITY_SOFT_DELETED,
          EventType.ENTITY_DELETED,
          EventType.ENTITY_RESTORED);

  /** Emitted with entityType=THREAD; reaches an entity resource via the thread's parent entity. */
  private static final List<EventType> THREAD_EVENTS =
      List.of(
          EventType.THREAD_CREATED,
          EventType.THREAD_UPDATED,
          EventType.POST_CREATED,
          EventType.POST_UPDATED);

  /** Reachable only through "all": their entity types are not notification resources. */
  private static final List<EventType> ALL_ONLY_EVENTS =
      List.of(
          EventType.LOGICAL_TEST_CASE_ADDED,
          EventType.ENTITY_LINEAGE_ADDED,
          EventType.ENTITY_LINEAGE_UPDATED,
          EventType.ENTITY_LINEAGE_DELETED);

  /**
   * Legacy thread-tasks emit these with entityType=THREAD, so they reach the thread's parent entity
   * exactly like {@code THREAD_EVENTS}; retired with the Recognizer migration (#30559).
   */
  private static final List<EventType> LEGACY_TASK_EVENTS =
      List.of(EventType.TASK_RESOLVED, EventType.TASK_CLOSED);

  /**
   * Values no resource can advertise: {@code ENTITY_NO_CHANGE} is a sentinel that ChangeEventHandler
   * never inserts, {@code USER_LOGIN}/{@code USER_LOGOUT} are written to the audit log only, {@code
   * ENTITY_FIELDS_CHANGED} only ever reaches the X-OpenMetadata-Change header (FormatterUtil returns
   * the pre-built ChangeEvent, whose eventType is entityUpdated, before the header is read), and the
   * rest lost their emitter in the task redesign (#29039).
   */
  public static final Set<EventType> UNREACHABLE =
      Set.of(
          EventType.ENTITY_NO_CHANGE,
          EventType.ENTITY_FIELDS_CHANGED,
          EventType.TASK_CREATED,
          EventType.TASK_UPDATED,
          EventType.SUGGESTION_CREATED,
          EventType.SUGGESTION_UPDATED,
          EventType.SUGGESTION_ACCEPTED,
          EventType.SUGGESTION_REJECTED,
          EventType.SUGGESTION_DELETED,
          EventType.USER_LOGIN,
          EventType.USER_LOGOUT);

  private ResourceEventTypes() {}

  public static List<EventType> forResource(String resource) {
    if (CONVERSATION.equalsIgnoreCase(resource)) {
      return THREAD_EVENTS;
    }
    Set<EventType> eventTypes = new LinkedHashSet<>(ENTITY_EVENTS);
    eventTypes.addAll(THREAD_EVENTS);
    eventTypes.addAll(LEGACY_TASK_EVENTS);
    if (ALL_RESOURCE.equalsIgnoreCase(resource)) {
      eventTypes.addAll(ALL_ONLY_EVENTS);
    }
    return List.copyOf(eventTypes);
  }
}
