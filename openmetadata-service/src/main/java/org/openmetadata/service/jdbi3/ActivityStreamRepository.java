/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.type.ActivityEventType;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Reaction;
import org.openmetadata.schema.type.ReactionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Repository for the lightweight activity_stream table.
 *
 * <p>This is NOT a full EntityRepository - ActivityEvent is ephemeral and doesn't need versioning,
 * relationships, or the full entity lifecycle. It's a simple write-heavy, read-mostly-recent store.
 */
@Slf4j
public class ActivityStreamRepository {

  private final CollectionDAO.ActivityStreamDAO activityStreamDAO;

  public ActivityStreamRepository() {
    this.activityStreamDAO = Entity.getCollectionDAO().activityStreamDAO();
  }

  public ActivityStreamRepository(CollectionDAO.ActivityStreamDAO activityStreamDAO) {
    this.activityStreamDAO = activityStreamDAO;
  }

  /**
   * Create an ActivityEvent from a ChangeEvent and persist it.
   *
   * @param changeEvent The change event to convert
   * @param entity The entity that changed (for extracting domains)
   * @return The created ActivityEvent
   */
  public ActivityEvent createFromChangeEvent(ChangeEvent changeEvent, EntityInterface entity) {
    if (changeEvent == null || entity == null) {
      return null;
    }

    ActivityEvent event = convertChangeEventToActivityEvent(changeEvent, entity);
    if (event != null) {
      insert(event);
    }
    return event;
  }

  /**
   * Create multiple ActivityEvents from a ChangeEvent with field-level changes.
   *
   * @param changeEvent The change event
   * @param entity The entity that changed
   * @return List of created ActivityEvents (one per significant field change)
   */
  public List<ActivityEvent> createFieldEventsFromChangeEvent(
      ChangeEvent changeEvent, EntityInterface entity) {
    List<ActivityEvent> events = new ArrayList<>();

    if (changeEvent == null || entity == null) {
      return events;
    }

    ChangeDescription changeDesc = changeEvent.getChangeDescription();
    if (changeDesc == null) {
      // No field-level changes, create a single event
      ActivityEvent event = convertChangeEventToActivityEvent(changeEvent, entity);
      if (event != null) {
        insert(event);
        events.add(event);
      }
      return events;
    }

    // Create events for significant field changes
    List<FieldChange> allChanges = new ArrayList<>();
    if (changeDesc.getFieldsAdded() != null) {
      allChanges.addAll(changeDesc.getFieldsAdded());
    }
    if (changeDesc.getFieldsUpdated() != null) {
      allChanges.addAll(changeDesc.getFieldsUpdated());
    }
    if (changeDesc.getFieldsDeleted() != null) {
      allChanges.addAll(changeDesc.getFieldsDeleted());
    }

    for (FieldChange fieldChange : allChanges) {
      ActivityEventType eventType = mapFieldToEventType(fieldChange.getName());
      if (eventType != null) {
        ActivityEvent event = buildActivityEvent(changeEvent, entity, eventType, fieldChange);
        insert(event);
        events.add(event);
      }
    }

    // If no significant field changes, create a generic update event
    if (events.isEmpty()) {
      ActivityEvent event = convertChangeEventToActivityEvent(changeEvent, entity);
      if (event != null) {
        insert(event);
        events.add(event);
      }
    }

    return events;
  }

  /** Insert an ActivityEvent into the database. */
  public void insert(ActivityEvent event) {
    if (event == null) {
      return;
    }

    String domainsJson = null;
    if (event.getDomains() != null && !event.getDomains().isEmpty()) {
      List<String> domainIds =
          event.getDomains().stream().map(ref -> ref.getId().toString()).toList();
      domainsJson = JsonUtils.pojoToJson(domainIds);
    }

    String aboutFqnHash = null;
    if (event.getAbout() != null) {
      aboutFqnHash = FullyQualifiedName.buildHash(event.getAbout());
    }

    activityStreamDAO.insert(
        event.getId().toString(),
        event.getEventType().value(),
        event.getEntity().getType(),
        event.getEntity().getId().toString(),
        event.getEntity().getFullyQualifiedName() != null
            ? FullyQualifiedName.buildHash(event.getEntity().getFullyQualifiedName())
            : null,
        event.getAbout(),
        aboutFqnHash,
        event.getActor().getId().toString(),
        event.getActor().getName(),
        event.getTimestamp(),
        event.getSummary(),
        event.getFieldName(),
        event.getOldValue(),
        event.getNewValue(),
        domainsJson,
        JsonUtils.pojoToJson(event));
  }

  /** List recent activity events. */
  public List<ActivityEvent> list(long afterTimestamp, int limit) {
    List<String> jsonList = activityStreamDAO.list(afterTimestamp, limit);
    return jsonList.stream().map(json -> JsonUtils.readValue(json, ActivityEvent.class)).toList();
  }

  /** List activity for a specific entity. */
  public List<ActivityEvent> listByEntity(
      String entityType, UUID entityId, long afterTimestamp, int limit) {
    List<String> jsonList =
        activityStreamDAO.listByEntity(entityType, entityId.toString(), afterTimestamp, limit);
    return jsonList.stream().map(json -> JsonUtils.readValue(json, ActivityEvent.class)).toList();
  }

  /** List activity by a specific actor (user). */
  public List<ActivityEvent> listByActor(UUID actorId, long afterTimestamp, int limit) {
    List<String> jsonList =
        activityStreamDAO.listByActor(actorId.toString(), afterTimestamp, limit);
    return jsonList.stream().map(json -> JsonUtils.readValue(json, ActivityEvent.class)).toList();
  }

  /**
   * List activity for entities in specific domains.
   *
   * @param domainIds List of domain IDs to filter by
   * @param afterTimestamp Only return events after this timestamp
   * @param limit Maximum number of events to return
   */
  public List<ActivityEvent> listByDomains(List<UUID> domainIds, long afterTimestamp, int limit) {
    if (nullOrEmpty(domainIds)) {
      return list(afterTimestamp, limit);
    }

    // Build JSON array for domain filtering
    List<String> domainIdStrings = domainIds.stream().map(UUID::toString).toList();
    String domainJson = JsonUtils.pojoToJson(domainIdStrings);

    List<String> jsonList = activityStreamDAO.listByDomains(domainJson, afterTimestamp, limit);
    return jsonList.stream().map(json -> JsonUtils.readValue(json, ActivityEvent.class)).toList();
  }

  /**
   * List activity for entities owned by a user or their teams.
   * Uses entity_relationship table to find owned entities.
   */
  public List<ActivityEvent> listByOwners(
      String userId, List<String> teamIds, long afterTimestamp, int limit) {
    if (nullOrEmpty(teamIds)) {
      teamIds = List.of("00000000-0000-0000-0000-000000000000"); // dummy to avoid SQL error
    }
    List<String> jsonList = activityStreamDAO.listByOwners(userId, teamIds, afterTimestamp, limit);
    return jsonList.stream().map(json -> JsonUtils.readValue(json, ActivityEvent.class)).toList();
  }

  /** List activity events by EntityLink (about field). */
  public List<ActivityEvent> listByAbout(String entityLink, long afterTimestamp, int limit) {
    String aboutFqnHash = FullyQualifiedName.buildHash(entityLink);
    List<String> jsonList = activityStreamDAO.listByAbout(aboutFqnHash, afterTimestamp, limit);
    return jsonList.stream().map(json -> JsonUtils.readValue(json, ActivityEvent.class)).toList();
  }

  /** Get count of activity events. */
  public int count(long afterTimestamp) {
    return activityStreamDAO.count(afterTimestamp);
  }

  /** Delete events older than the cutoff timestamp. */
  public int deleteOlderThan(long cutoffTimestamp) {
    return activityStreamDAO.deleteOlderThan(cutoffTimestamp);
  }

  /** Get an activity event by ID. */
  public ActivityEvent getById(UUID id) {
    String json = activityStreamDAO.findById(id.toString());
    if (json == null) {
      throw new EntityNotFoundException("ActivityEvent not found: " + id);
    }
    return JsonUtils.readValue(json, ActivityEvent.class);
  }

  /** Add a reaction to an activity event. */
  public ActivityEvent addReaction(
      UUID activityId, EntityReference user, ReactionType reactionType) {
    ActivityEvent event = getById(activityId);

    List<Reaction> reactions = event.getReactions();
    if (reactions == null) {
      reactions = new ArrayList<>();
    }

    // Check if user already has this reaction type
    boolean exists =
        reactions.stream()
            .anyMatch(
                r ->
                    r.getReactionType() == reactionType
                        && r.getUser().getId().equals(user.getId()));

    if (!exists) {
      Reaction reaction = new Reaction().withReactionType(reactionType).withUser(user);
      reactions.add(reaction);
      event.setReactions(reactions);
      activityStreamDAO.updateJson(activityId.toString(), JsonUtils.pojoToJson(event));
    }

    return event;
  }

  /** Remove a reaction from an activity event. */
  public ActivityEvent removeReaction(
      UUID activityId, EntityReference user, ReactionType reactionType) {
    ActivityEvent event = getById(activityId);

    List<Reaction> reactions = event.getReactions();
    if (reactions == null || reactions.isEmpty()) {
      return event;
    }

    // Remove the user's reaction of this type
    reactions.removeIf(
        r -> r.getReactionType() == reactionType && r.getUser().getId().equals(user.getId()));

    event.setReactions(reactions.isEmpty() ? null : reactions);
    activityStreamDAO.updateJson(activityId.toString(), JsonUtils.pojoToJson(event));

    return event;
  }

  // ========== Private Helper Methods ==========

  private ActivityEvent convertChangeEventToActivityEvent(
      ChangeEvent changeEvent, EntityInterface entity) {
    ActivityEventType eventType = mapChangeEventType(changeEvent.getEventType());
    if (eventType == null) {
      return null;
    }

    return buildActivityEvent(changeEvent, entity, eventType, null);
  }

  private ActivityEvent buildActivityEvent(
      ChangeEvent changeEvent,
      EntityInterface entity,
      ActivityEventType eventType,
      FieldChange fieldChange) {

    EntityReference entityRef = entity.getEntityReference();
    EntityReference actorRef = buildActorReference(changeEvent.getUserName());

    String summary = buildSummary(changeEvent, eventType, fieldChange);
    String fieldName = fieldChange != null ? fieldChange.getName() : null;
    String oldValue = fieldChange != null ? truncateValue(fieldChange.getOldValue()) : null;
    String newValue = fieldChange != null ? truncateValue(fieldChange.getNewValue()) : null;

    // Build EntityLink string for the about field
    String about =
        buildEntityLink(changeEvent.getEntityType(), entity.getFullyQualifiedName(), fieldChange);

    return new ActivityEvent()
        .withId(UUID.randomUUID())
        .withEventType(eventType)
        .withEntity(entityRef)
        .withAbout(about)
        .withDomains(entity.getDomains())
        .withActor(actorRef)
        .withTimestamp(changeEvent.getTimestamp())
        .withSummary(summary)
        .withFieldName(fieldName)
        .withOldValue(oldValue)
        .withNewValue(newValue);
  }

  private EntityReference buildActorReference(String userName) {
    if (nullOrEmpty(userName)) {
      return new EntityReference().withType(Entity.USER).withName("system");
    }
    try {
      return Entity.getEntityReferenceByName(Entity.USER, userName, null);
    } catch (Exception e) {
      // User might not exist (e.g., system operations)
      return new EntityReference().withType(Entity.USER).withName(userName);
    }
  }

  private String buildSummary(
      ChangeEvent changeEvent, ActivityEventType eventType, FieldChange fieldChange) {
    String entityType = changeEvent.getEntityType();
    String entityName = changeEvent.getEntityFullyQualifiedName();

    return switch (eventType) {
      case ENTITY_CREATED -> String.format("Created %s: %s", entityType, entityName);
      case ENTITY_DELETED -> String.format("Deleted %s: %s", entityType, entityName);
      case ENTITY_SOFT_DELETED -> String.format("Soft deleted %s: %s", entityType, entityName);
      case ENTITY_RESTORED -> String.format("Restored %s: %s", entityType, entityName);
      case DESCRIPTION_UPDATED -> fieldChange != null
          ? String.format("Updated description of %s", entityName)
          : String.format("Description updated on %s", entityName);
      case TAGS_UPDATED -> String.format("Tags updated on %s", entityName);
      case OWNER_UPDATED -> String.format("Owner changed on %s", entityName);
      case DOMAIN_UPDATED -> String.format("Domain changed on %s", entityName);
      case TIER_UPDATED -> String.format("Tier changed on %s", entityName);
      case CUSTOM_PROPERTY_UPDATED -> fieldChange != null
          ? String.format("Custom property '%s' updated on %s", fieldChange.getName(), entityName)
          : String.format("Custom property updated on %s", entityName);
      default -> String.format("Updated %s: %s", entityType, entityName);
    };
  }

  private ActivityEventType mapChangeEventType(org.openmetadata.schema.type.EventType eventType) {
    if (eventType == null) {
      return null;
    }
    return switch (eventType) {
      case ENTITY_CREATED -> ActivityEventType.ENTITY_CREATED;
      case ENTITY_UPDATED -> ActivityEventType.ENTITY_UPDATED;
      case ENTITY_DELETED -> ActivityEventType.ENTITY_DELETED;
      case ENTITY_SOFT_DELETED -> ActivityEventType.ENTITY_SOFT_DELETED;
      case ENTITY_RESTORED -> ActivityEventType.ENTITY_RESTORED;
      default -> null; // Skip other event types
    };
  }

  private ActivityEventType mapFieldToEventType(String fieldName) {
    if (nullOrEmpty(fieldName)) {
      return null;
    }

    // Map significant fields to specific event types
    if (fieldName.equals("description")
        || fieldName.startsWith("columns") && fieldName.contains("description")) {
      return ActivityEventType.DESCRIPTION_UPDATED;
    }
    if (fieldName.equals("tags") || fieldName.startsWith("columns") && fieldName.contains("tags")) {
      return ActivityEventType.TAGS_UPDATED;
    }
    if (fieldName.equals("owners") || fieldName.equals("owner")) {
      return ActivityEventType.OWNER_UPDATED;
    }
    if (fieldName.equals("domain") || fieldName.equals("domains")) {
      return ActivityEventType.DOMAIN_UPDATED;
    }
    if (fieldName.equals("tier")) {
      return ActivityEventType.TIER_UPDATED;
    }
    if (fieldName.startsWith("extension")) {
      return ActivityEventType.CUSTOM_PROPERTY_UPDATED;
    }

    // Skip minor field changes to avoid noise
    return null;
  }

  private String buildEntityLink(String entityType, String entityFqn, FieldChange fieldChange) {
    StringBuilder link = new StringBuilder("<#E::");
    link.append(entityType).append("::").append(entityFqn);

    if (fieldChange != null && !nullOrEmpty(fieldChange.getName())) {
      String fieldName = fieldChange.getName();
      // Parse field name like "columns.col1.description" into EntityLink format
      if (fieldName.contains(".")) {
        String[] parts = fieldName.split("\\.", 3);
        if (parts.length >= 2) {
          // e.g., columns.product_id -> ::columns::product_id
          link.append("::").append(parts[0]).append("::").append(parts[1]);
          if (parts.length >= 3) {
            // e.g., columns.product_id.description -> ::columns::product_id::description
            link.append("::").append(parts[2]);
          }
        }
      } else {
        // Simple field like "description" -> ::description
        link.append("::").append(fieldName);
      }
    }
    link.append(">");
    return link.toString();
  }

  private String truncateValue(Object value) {
    if (value == null) {
      return null;
    }
    String str = value.toString();
    if (str.length() > 1000) {
      return str.substring(0, 997) + "...";
    }
    return str;
  }
}
