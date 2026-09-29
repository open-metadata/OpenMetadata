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
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import io.micrometer.core.instrument.Metrics;
import jakarta.ws.rs.core.SecurityContext;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
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
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Reaction;
import org.openmetadata.schema.type.ReactionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonStorageUtils;

/**
 * Repository for the lightweight activity_stream table.
 *
 * <p>This is NOT a full EntityRepository - ActivityEvent is ephemeral and doesn't need versioning,
 * relationships, or the full entity lifecycle. It's a simple write-heavy, read-mostly-recent store.
 */
@Slf4j
public class ActivityStreamRepository {
  private static final int MAX_STORED_SUMMARY_LENGTH = 500;
  private static final String UNRESOLVED_ACTOR_METRIC = "activity_stream.unresolved_actor";
  private static final UUID NO_DOMAIN_ACCESS = new UUID(0L, 0L);

  private final CollectionDAO.ActivityStreamDAO activityStreamDAO;

  public ActivityStreamRepository() {
    this.activityStreamDAO = Entity.getCollectionDAO().activityStreamDAO();
  }

  public ActivityStreamRepository(CollectionDAO.ActivityStreamDAO activityStreamDAO) {
    this.activityStreamDAO = activityStreamDAO;
  }

  public ResultList<ActivityEvent> listActivityEvents(
      SecurityContext securityContext,
      String entityType,
      UUID entityId,
      UUID actorId,
      String domainsParam,
      String domain,
      int days,
      int limit) {
    long afterTimestamp = afterTimestamp(days);
    List<UUID> domainIds =
        nullOrEmpty(domain)
            ? getEffectiveDomains(securityContext, domainsParam)
            : getEffectiveDomainsByFqn(securityContext, domain);
    List<ActivityEvent> events;
    if (entityType != null) {
      events =
          entityId != null
              ? listByEntity(entityType, entityId, domainIds, afterTimestamp, limit)
              : listByEntityType(entityType, domainIds, afterTimestamp, limit);
    } else if (actorId != null) {
      events = listByActor(actorId, domainIds, afterTimestamp, limit);
    } else if (!nullOrEmpty(domainIds)) {
      events = listByDomains(domainIds, afterTimestamp, limit);
    } else {
      events = list(afterTimestamp, limit);
    }
    return result(events);
  }

  public ResultList<ActivityEvent> getEntityActivityById(
      SecurityContext securityContext,
      String entityType,
      UUID entityId,
      String domain,
      int days,
      int limit) {
    long afterTimestamp = afterTimestamp(days);
    List<UUID> domainIds = getEffectiveDomainsByFqn(securityContext, domain);
    if (limit == 0) {
      int total = countByEntity(entityType, entityId, domainIds, afterTimestamp);
      return new ResultList<>(List.of(), null, null, total);
    }
    return result(listByEntity(entityType, entityId, domainIds, afterTimestamp, limit));
  }

  public ResultList<ActivityEvent> getEntityActivityByFqn(
      SecurityContext securityContext,
      String entityType,
      String fqn,
      String domain,
      int days,
      int limit) {
    EntityInterface entity = Entity.getEntityByName(entityType, fqn, "", null);
    return getEntityActivityById(securityContext, entityType, entity.getId(), domain, days, limit);
  }

  public ResultList<ActivityEvent> getMyFeed(
      SecurityContext securityContext, String domain, int days, int limit) {
    String userName = securityContext.getUserPrincipal().getName();
    EntityReference user = Entity.getEntityReferenceByName(Entity.USER, userName, null);
    return result(
        listByOwners(
            user.getId().toString(),
            getTeamIds(userName),
            getEffectiveDomainsByFqn(securityContext, domain),
            afterTimestamp(days),
            limit));
  }

  public ResultList<ActivityEvent> getFollowingFeed(
      SecurityContext securityContext, String domain, int days, int limit) {
    EntityReference user = currentUser(securityContext);
    return result(
        listByFollowers(
            user.getId().toString(),
            getEffectiveDomainsByFqn(securityContext, domain),
            afterTimestamp(days),
            limit));
  }

  public ResultList<ActivityEvent> getActivityByEntityLink(
      SecurityContext securityContext, String entityLink, String domain, int days, int limit) {
    return result(
        listByAbout(
            entityLink,
            getEffectiveDomainsByFqn(securityContext, domain),
            afterTimestamp(days),
            limit));
  }

  public ResultList<ActivityEvent> getUserActivity(
      SecurityContext securityContext, UUID userId, String domain, int days, int limit) {
    return result(
        listByActor(
            userId,
            getEffectiveDomainsByFqn(securityContext, domain),
            afterTimestamp(days),
            limit));
  }

  public int getActivityCount(SecurityContext securityContext, String domain, int days) {
    return count(getEffectiveDomainsByFqn(securityContext, domain), afterTimestamp(days));
  }

  public ActivityEvent addReaction(
      SecurityContext securityContext,
      Authorizer authorizer,
      UUID activityId,
      ReactionType reactionType) {
    ActivityEvent event = authorizeActivityMutation(securityContext, authorizer, activityId);
    EntityReference user = currentUser(securityContext);
    return mutateReaction(event.getId(), user, reactionType, true);
  }

  public ActivityEvent removeReaction(
      SecurityContext securityContext,
      Authorizer authorizer,
      UUID activityId,
      ReactionType reactionType) {
    ActivityEvent event = authorizeActivityMutation(securityContext, authorizer, activityId);
    EntityReference user = currentUser(securityContext);
    return mutateReaction(event.getId(), user, reactionType, false);
  }

  public ActivityEvent insertForTesting(
      SecurityContext securityContext, Authorizer authorizer, ActivityEvent event) {
    authorizer.authorizeAdmin(securityContext);
    insert(event);
    return event;
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
        events.add(buildActivityEvent(changeEvent, entity, eventType, fieldChange));
      }
    }

    // If no significant field changes, create a generic update event
    if (events.isEmpty()) {
      ActivityEvent event = convertChangeEventToActivityEvent(changeEvent, entity);
      if (event != null) {
        events.add(event);
      }
    }

    return events;
  }

  /** Insert a single ActivityEvent into the database. */
  public void insert(ActivityEvent event) {
    if (event == null) {
      return;
    }
    insertBatch(List.of(event));
  }

  /** Batch-insert ActivityEvents in a single round-trip instead of one per row. */
  public void insertBatch(List<ActivityEvent> events) {
    if (nullOrEmpty(events)) {
      return;
    }
    List<CollectionDAO.ActivityStreamRow> rows =
        events.stream().filter(event -> event != null).map(this::toRow).toList();
    if (!rows.isEmpty()) {
      activityStreamDAO.insertBatch(rows);
    }
  }

  private CollectionDAO.ActivityStreamRow toRow(ActivityEvent event) {
    String about = JsonStorageUtils.removeNulCharacters(event.getAbout());
    return CollectionDAO.ActivityStreamRow.builder()
        .id(event.getId().toString())
        .eventType(JsonStorageUtils.removeNulCharacters(event.getEventType().value()))
        .entityType(JsonStorageUtils.removeNulCharacters(event.getEntity().getType()))
        .entityId(event.getEntity().getId().toString())
        .entityFqnHash(
            event.getEntity().getFullyQualifiedName() != null
                ? FullyQualifiedName.buildHash(event.getEntity().getFullyQualifiedName())
                : null)
        .about(about)
        .aboutFqnHash(buildAboutFqnHash(about))
        .actorId(
            event.getActor() != null && event.getActor().getId() != null
                ? event.getActor().getId().toString()
                : null)
        .actorName(
            JsonStorageUtils.removeNulCharacters(
                event.getActor() != null ? event.getActor().getName() : null))
        .timestamp(event.getTimestamp())
        .summary(
            JsonStorageUtils.removeNulCharacters(truncateSummaryForStorage(event.getSummary())))
        .fieldName(JsonStorageUtils.removeNulCharacters(event.getFieldName()))
        .oldValue(JsonStorageUtils.removeNulCharacters(event.getOldValue()))
        .newValue(JsonStorageUtils.removeNulCharacters(event.getNewValue()))
        .domains(JsonStorageUtils.sanitizeNulCharacters(buildDomainsJson(event)))
        .json(JsonStorageUtils.sanitizeNulCharacters(JsonUtils.pojoToJson(event)))
        .build();
  }

  private static String buildDomainsJson(ActivityEvent event) {
    if (event.getDomains() == null || event.getDomains().isEmpty()) {
      return null;
    }
    List<String> domainIds =
        event.getDomains().stream().map(ref -> ref.getId().toString()).toList();
    return JsonUtils.pojoToJson(domainIds);
  }

  // about is an EntityLink, not an FQN — parse first, then hash the FQN portion.
  private static String buildAboutFqnHash(String about) {
    return nullOrEmpty(about)
        ? null
        : FullyQualifiedName.buildHash(MessageParser.EntityLink.parse(about).getEntityFQN());
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

  /** List activity for all entities of a given type. */
  public List<ActivityEvent> listByEntityType(String entityType, long afterTimestamp, int limit) {
    List<String> jsonList = activityStreamDAO.listByEntityType(entityType, afterTimestamp, limit);
    return jsonList.stream().map(json -> JsonUtils.readValue(json, ActivityEvent.class)).toList();
  }

  /** List activity for all entities of a given type scoped to specific domains. */
  public List<ActivityEvent> listByEntityType(
      String entityType, List<UUID> domainIds, long afterTimestamp, int limit) {
    if (nullOrEmpty(domainIds)) {
      return listByEntityType(entityType, afterTimestamp, limit);
    }

    List<String> domainIdStrings = domainIds.stream().map(UUID::toString).toList();
    String domainJson = JsonUtils.pojoToJson(domainIdStrings);
    List<String> jsonList =
        activityStreamDAO.listByEntityTypeAndDomains(
            entityType, domainJson, domainIdStrings, afterTimestamp, limit);
    return jsonList.stream().map(json -> JsonUtils.readValue(json, ActivityEvent.class)).toList();
  }

  /** List activity for a specific entity scoped to specific domains. */
  public List<ActivityEvent> listByEntity(
      String entityType, UUID entityId, List<UUID> domainIds, long afterTimestamp, int limit) {
    if (nullOrEmpty(domainIds)) {
      return listByEntity(entityType, entityId, afterTimestamp, limit);
    }

    List<String> domainIdStrings = domainIds.stream().map(UUID::toString).toList();
    String domainJson = JsonUtils.pojoToJson(domainIdStrings);
    List<String> jsonList =
        activityStreamDAO.listByEntityAndDomains(
            entityType, entityId.toString(), domainJson, domainIdStrings, afterTimestamp, limit);
    return jsonList.stream().map(json -> JsonUtils.readValue(json, ActivityEvent.class)).toList();
  }

  /** List activity by a specific actor (user). */
  public List<ActivityEvent> listByActor(UUID actorId, long afterTimestamp, int limit) {
    List<String> jsonList =
        activityStreamDAO.listByActor(actorId.toString(), afterTimestamp, limit);
    return jsonList.stream().map(json -> JsonUtils.readValue(json, ActivityEvent.class)).toList();
  }

  /** List activity by a specific actor (user) scoped to specific domains. */
  public List<ActivityEvent> listByActor(
      UUID actorId, List<UUID> domainIds, long afterTimestamp, int limit) {
    if (nullOrEmpty(domainIds)) {
      return listByActor(actorId, afterTimestamp, limit);
    }

    List<String> domainIdStrings = domainIds.stream().map(UUID::toString).toList();
    String domainJson = JsonUtils.pojoToJson(domainIdStrings);
    List<String> jsonList =
        activityStreamDAO.listByActorAndDomains(
            actorId.toString(), domainJson, domainIdStrings, afterTimestamp, limit);
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

    List<String> jsonList =
        activityStreamDAO.listByDomains(domainJson, domainIdStrings, afterTimestamp, limit);
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

  /** List activity for entities owned by a user or their teams within specific domains. */
  public List<ActivityEvent> listByOwners(
      String userId, List<String> teamIds, List<UUID> domainIds, long afterTimestamp, int limit) {
    if (nullOrEmpty(domainIds)) {
      return listByOwners(userId, teamIds, afterTimestamp, limit);
    }
    if (nullOrEmpty(teamIds)) {
      teamIds = List.of("00000000-0000-0000-0000-000000000000");
    }

    List<String> domainIdStrings = domainIds.stream().map(UUID::toString).toList();
    String domainJson = JsonUtils.pojoToJson(domainIdStrings);
    List<String> jsonList =
        activityStreamDAO.listByOwnersAndDomains(
            userId, teamIds, domainJson, domainIdStrings, afterTimestamp, limit);
    return jsonList.stream().map(json -> JsonUtils.readValue(json, ActivityEvent.class)).toList();
  }

  /**
   * List activity for entities a user follows. Following is a user-only relationship, so unlike
   * {@link #listByOwners} there is no team leg.
   */
  public List<ActivityEvent> listByFollowers(String userId, long afterTimestamp, int limit) {
    List<String> jsonList = activityStreamDAO.listByFollowers(userId, afterTimestamp, limit);
    return jsonList.stream().map(json -> JsonUtils.readValue(json, ActivityEvent.class)).toList();
  }

  /** List activity for entities a user follows within specific domains. */
  public List<ActivityEvent> listByFollowers(
      String userId, List<UUID> domainIds, long afterTimestamp, int limit) {
    if (nullOrEmpty(domainIds)) {
      return listByFollowers(userId, afterTimestamp, limit);
    }

    List<String> domainIdStrings = domainIds.stream().map(UUID::toString).toList();
    String domainJson = JsonUtils.pojoToJson(domainIdStrings);
    List<String> jsonList =
        activityStreamDAO.listByFollowersAndDomains(
            userId, domainJson, domainIdStrings, afterTimestamp, limit);
    return jsonList.stream().map(json -> JsonUtils.readValue(json, ActivityEvent.class)).toList();
  }

  /** List activity events by EntityLink (about field). */
  public List<ActivityEvent> listByAbout(String entityLink, long afterTimestamp, int limit) {
    String aboutFqnHash =
        nullOrEmpty(entityLink)
            ? null
            : FullyQualifiedName.buildHash(
                MessageParser.EntityLink.parse(entityLink).getEntityFQN());
    List<String> jsonList = activityStreamDAO.listByAbout(aboutFqnHash, afterTimestamp, limit);
    return jsonList.stream().map(json -> JsonUtils.readValue(json, ActivityEvent.class)).toList();
  }

  /** List activity events by EntityLink scoped to specific domains. */
  public List<ActivityEvent> listByAbout(
      String entityLink, List<UUID> domainIds, long afterTimestamp, int limit) {
    if (nullOrEmpty(domainIds)) {
      return listByAbout(entityLink, afterTimestamp, limit);
    }

    String aboutFqnHash =
        nullOrEmpty(entityLink)
            ? null
            : FullyQualifiedName.buildHash(
                MessageParser.EntityLink.parse(entityLink).getEntityFQN());
    List<String> domainIdStrings = domainIds.stream().map(UUID::toString).toList();
    String domainJson = JsonUtils.pojoToJson(domainIdStrings);
    List<String> jsonList =
        activityStreamDAO.listByAboutAndDomains(
            aboutFqnHash, domainJson, domainIdStrings, afterTimestamp, limit);
    return jsonList.stream().map(json -> JsonUtils.readValue(json, ActivityEvent.class)).toList();
  }

  /** Get count of activity events. */
  public int count(long afterTimestamp) {
    return activityStreamDAO.count(afterTimestamp);
  }

  /** Get count of activity events scoped to specific domains. */
  public int count(List<UUID> domainIds, long afterTimestamp) {
    if (nullOrEmpty(domainIds)) {
      return count(afterTimestamp);
    }

    List<String> domainIdStrings = domainIds.stream().map(UUID::toString).toList();
    String domainJson = JsonUtils.pojoToJson(domainIdStrings);
    return activityStreamDAO.countByDomains(domainJson, domainIdStrings, afterTimestamp);
  }

  /** Get count of activity events for a specific entity. */
  public int countByEntity(String entityType, UUID entityId, long afterTimestamp) {
    return activityStreamDAO.countByEntity(entityType, entityId.toString(), afterTimestamp);
  }

  /** Get count of activity events for a specific entity scoped to specific domains. */
  public int countByEntity(
      String entityType, UUID entityId, List<UUID> domainIds, long afterTimestamp) {
    if (nullOrEmpty(domainIds)) {
      return countByEntity(entityType, entityId, afterTimestamp);
    }

    List<String> domainIdStrings = domainIds.stream().map(UUID::toString).toList();
    String domainJson = JsonUtils.pojoToJson(domainIdStrings);
    return activityStreamDAO.countByEntityAndDomains(
        entityType, entityId.toString(), domainJson, domainIdStrings, afterTimestamp);
  }

  /** Delete events older than the cutoff timestamp. */
  public int deleteOlderThan(long cutoffTimestamp) {
    return activityStreamDAO.deleteOlderThan(cutoffTimestamp);
  }

  /**
   * Delete every activity event of a specific entity. Called when an entity is hard deleted so a
   * later entity recreated with the same fully qualified name does not inherit its history (#28923).
   * Keyed by entity id (not FQN) so it can never remove a same-named successor's events.
   */
  public int deleteByEntity(String entityType, UUID entityId) {
    return activityStreamDAO.deleteByEntity(entityType, entityId.toString());
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
    return mutateReaction(activityId, user, reactionType, true);
  }

  /** Remove a reaction from an activity event. */
  public ActivityEvent removeReaction(
      UUID activityId, EntityReference user, ReactionType reactionType) {
    return mutateReaction(activityId, user, reactionType, false);
  }

  private ActivityEvent mutateReaction(
      UUID activityId, EntityReference user, ReactionType reactionType, boolean add) {
    return Entity.getJdbi()
        .inTransaction(
            handle -> {
              CollectionDAO.ActivityStreamDAO dao =
                  handle.attach(CollectionDAO.ActivityStreamDAO.class);
              String json = dao.findByIdForUpdate(activityId.toString());
              if (json == null) {
                throw new EntityNotFoundException("ActivityEvent not found: " + activityId);
              }
              ActivityEvent event = JsonUtils.readValue(json, ActivityEvent.class);
              List<Reaction> reactions = new ArrayList<>();
              if (event.getReactions() != null) {
                reactions.addAll(event.getReactions());
              }
              boolean changed;
              if (add) {
                boolean exists =
                    reactions.stream()
                        .anyMatch(
                            reaction ->
                                reaction.getReactionType() == reactionType
                                    && reaction.getUser().getId().equals(user.getId()));
                changed = !exists;
                if (changed) {
                  reactions.add(new Reaction().withReactionType(reactionType).withUser(user));
                }
              } else {
                changed =
                    reactions.removeIf(
                        reaction ->
                            reaction.getReactionType() == reactionType
                                && reaction.getUser().getId().equals(user.getId()));
              }
              if (changed) {
                event.setReactions(reactions.isEmpty() ? null : reactions);
                dao.updateJson(activityId.toString(), JsonUtils.pojoToJson(event));
              }
              return event;
            });
  }

  private ActivityEvent authorizeActivityMutation(
      SecurityContext securityContext, Authorizer authorizer, UUID activityId) {
    ActivityEvent event = getById(activityId);
    EntityReference target = event.getEntity();
    try {
      SubjectContext subject = getSubjectContext(securityContext);
      if (!subject.isAdmin()
          && subject.hasDomainOnlyAccessRole()
          && !subject.hasDomains(event.getDomains())) {
        throw new AuthorizationException("Activity is outside the user's domains");
      }
      Entity.getEntity(target.getType(), target.getId(), Entity.FIELD_DOMAINS, Include.ALL, false);
      authorizer.authorize(
          securityContext,
          new OperationContext(target.getType(), MetadataOperation.VIEW_BASIC),
          new ResourceContext<>(target.getType(), target.getId(), null, Include.ALL));
    } catch (AuthorizationException | EntityNotFoundException exception) {
      throw new EntityNotFoundException("ActivityEvent not found: " + activityId);
    }
    return event;
  }

  private EntityReference currentUser(SecurityContext securityContext) {
    return Entity.getEntityReferenceByName(
        Entity.USER, securityContext.getUserPrincipal().getName(), Include.NON_DELETED);
  }

  private long afterTimestamp(int days) {
    return Instant.now().minus(days, ChronoUnit.DAYS).toEpochMilli();
  }

  private ResultList<ActivityEvent> result(List<ActivityEvent> events) {
    return new ResultList<>(events, null, null, events.size());
  }

  private List<String> getTeamIds(String userName) {
    List<String> teamIds = new ArrayList<>();
    try {
      org.openmetadata.schema.entity.teams.User user =
          Entity.getEntityByName(Entity.USER, userName, "teams", null);
      if (user.getTeams() != null) {
        user.getTeams().stream()
            .map(EntityReference::getId)
            .map(UUID::toString)
            .forEach(teamIds::add);
      }
    } catch (EntityNotFoundException exception) {
      LOG.debug("Could not get team IDs for user {}: {}", userName, exception.getMessage());
    }
    return teamIds;
  }

  private List<UUID> getEffectiveDomains(SecurityContext securityContext, String domainsParam) {
    List<UUID> requestedDomains = null;
    if (!nullOrEmpty(domainsParam)) {
      requestedDomains =
          Arrays.stream(domainsParam.split(","))
              .map(String::trim)
              .filter(value -> !value.isEmpty())
              .map(UUID::fromString)
              .toList();
    }

    SubjectContext subject = getSubjectContext(securityContext);
    if (!subject.isAdmin() && subject.hasDomainOnlyAccessRole()) {
      List<UUID> userDomainIds =
          nullOrEmpty(subject.getUserDomains())
              ? List.of()
              : subject.getUserDomains().stream().map(EntityReference::getId).toList();
      List<UUID> allowedDomains =
          requestedDomains == null
              ? userDomainIds
              : requestedDomains.stream().filter(userDomainIds::contains).toList();
      return allowedDomains.isEmpty() ? List.of(NO_DOMAIN_ACCESS) : allowedDomains;
    }
    return requestedDomains;
  }

  private List<UUID> getEffectiveDomainsByFqn(SecurityContext securityContext, String domainFqn) {
    if (nullOrEmpty(domainFqn)) {
      return getEffectiveDomains(securityContext, null);
    }
    EntityReference domain =
        Entity.getEntityReferenceByName(Entity.DOMAIN, domainFqn, Include.NON_DELETED);
    return getEffectiveDomains(securityContext, domain.getId().toString());
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

    String summary = buildSummary(changeEvent, entityRef, eventType, fieldChange);
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
    EntityReference result = null;
    if (nullOrEmpty(userName)) {
      Metrics.counter(UNRESOLVED_ACTOR_METRIC, "kind", "system_event").increment();
    } else {
      try {
        // Include.ALL keeps soft-deleted users resolvable with their real id.
        result = Entity.getEntityReferenceByName(Entity.USER, userName, Include.ALL);
      } catch (EntityNotFoundException ignored) {
        // Hard-deleted: keep the name for display, actorId stays null (no FK target).
        Metrics.counter(UNRESOLVED_ACTOR_METRIC, "kind", "hard_deleted").increment();
        result = new EntityReference().withType(Entity.USER).withName(userName);
      }
    }
    return result;
  }

  private String buildSummary(
      ChangeEvent changeEvent,
      EntityReference entityRef,
      ActivityEventType eventType,
      FieldChange fieldChange) {
    String entityType = changeEvent.getEntityType();
    String entityName = getReadableEntityName(entityRef, changeEvent.getEntityFullyQualifiedName());

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

  private String getReadableEntityName(EntityReference entityRef, String fallbackFqn) {
    if (entityRef != null) {
      if (!nullOrEmpty(entityRef.getDisplayName())) {
        return entityRef.getDisplayName();
      }
      if (!nullOrEmpty(entityRef.getName())) {
        return entityRef.getName();
      }
      if (!nullOrEmpty(entityRef.getFullyQualifiedName())) {
        return getLeafName(entityRef.getFullyQualifiedName());
      }
    }

    return getLeafName(fallbackFqn);
  }

  private String getLeafName(String fullyQualifiedName) {
    if (nullOrEmpty(fullyQualifiedName)) {
      return "entity";
    }

    String[] parts = FullyQualifiedName.split(fullyQualifiedName);
    if (parts.length == 0) {
      return fullyQualifiedName;
    }

    return FullyQualifiedName.unquoteName(parts[parts.length - 1]);
  }

  private String truncateSummaryForStorage(String summary) {
    if (summary == null || summary.length() <= MAX_STORED_SUMMARY_LENGTH) {
      return summary;
    }

    return summary.substring(0, MAX_STORED_SUMMARY_LENGTH - 3) + "...";
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
        || (fieldName.startsWith("columns") && fieldName.contains("description"))) {
      return ActivityEventType.DESCRIPTION_UPDATED;
    }
    if (fieldName.equals("tags")
        || (fieldName.startsWith("columns") && fieldName.contains("tags"))) {
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
