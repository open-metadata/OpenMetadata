package org.openmetadata.service.entity.metadata;

import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_VOTES;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;

import jakarta.ws.rs.core.Response.Status;
import java.util.List;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Function;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.VoteRequest.VoteType;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.Edge;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.Value;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil.PutResponse;

/** Applies follower and vote relationships with their existing unversioned response contracts. */
public final class EntityUserActions<T extends EntityInterface> {
  public record Lookup<T>(
      Function<UUID, T> entity,
      Function<UUID, User> userById,
      Function<String, User> userByName,
      Function<UUID, EntityReference> userReference) {}

  public record Hydration<T>(
      Function<T, List<EntityReference>> followers,
      Consumer<T> votes,
      BiConsumer<T, T> postUpdate) {}

  private final String entityType;
  private final Lookup<T> lookup;
  private final EntityRelationshipWriter relationships;
  private final Hydration<T> hydration;

  public EntityUserActions(
      final String entityType,
      final Lookup<T> lookup,
      final EntityRelationshipWriter relationships,
      final Hydration<T> hydration) {
    this.entityType = entityType;
    this.lookup = lookup;
    this.relationships = relationships;
    this.hydration = hydration;
  }

  public PutResponse<T> follow(final String actor, final UUID entityId, final UUID userId) {
    final T entity = lookup.entity().apply(entityId);
    final User user = lookup.userById().apply(userId);
    validateUser(user, userId);
    relationships.add(edge(entityId, userId, Relationship.FOLLOWS), Value.EMPTY, false);
    final ChangeDescription change =
        new ChangeDescription().withPreviousVersion(entity.getVersion());
    fieldAdded(change, FIELD_FOLLOWERS, List.of(user.getEntityReference()));
    final ChangeEvent event = event(actor, entityId, entity, change);
    return publishFollowerChange(entity, event);
  }

  public PutResponse<T> unfollow(final String actor, final UUID entityId, final UUID userId) {
    final T entity = lookup.entity().apply(entityId);
    final EntityReference user = lookup.userReference().apply(userId);
    relationships.delete(edge(entityId, userId, Relationship.FOLLOWS));
    final ChangeDescription change =
        new ChangeDescription().withPreviousVersion(entity.getVersion());
    fieldDeleted(change, FIELD_FOLLOWERS, List.of(user));
    return publishFollowerChange(entity, event(actor, entityId, entity, change));
  }

  private PutResponse<T> publishFollowerChange(final T entity, final ChangeEvent event) {
    final ChangeDescription change = event.getChangeDescription();
    entity.setIncrementalChangeDescription(change);
    entity.setChangeDescription(change);
    // Child propagation must see the new follower set, including inherited followers.
    entity.setFollowers(hydration.followers().apply(entity));
    hydration.postUpdate().accept(entity, entity);
    return new PutResponse<>(Status.OK, event, EventType.ENTITY_FIELDS_CHANGED);
  }

  public PutResponse<T> vote(final String actor, final UUID entityId, final VoteRequest request) {
    final T entity = lookup.entity().apply(entityId);
    final User user = lookup.userByName().apply(FullyQualifiedName.quoteName(actor));
    final UUID userId = user.getId();
    validateUser(user, userId);
    final ChangeDescription change =
        new ChangeDescription().withPreviousVersion(entity.getVersion());
    fieldUpdated(change, FIELD_VOTES, null, request.getUpdatedVoteType());
    storeVote(entityId, userId, request.getUpdatedVoteType());
    hydration.votes().accept(entity);
    final ChangeEvent event = event(actor, entityId, entity, change);
    hydration.postUpdate().accept(entity, entity);
    return new PutResponse<>(Status.OK, event, EventType.ENTITY_FIELDS_CHANGED);
  }

  private void storeVote(final UUID entityId, final UUID userId, final VoteType vote) {
    final Edge edge = edge(entityId, userId, Relationship.VOTED);
    if (vote == VoteType.UN_VOTED) {
      relationships.delete(edge);
    } else {
      relationships.add(edge, new Value("", JsonUtils.pojoToJson(vote)), false);
    }
  }

  private Edge edge(final UUID entityId, final UUID userId, final Relationship relation) {
    return new Edge(userId, entityId, USER, entityType, relation);
  }

  private static void validateUser(final User user, final UUID userId) {
    if (Boolean.TRUE.equals(user.getDeleted())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.deletedUser(userId));
    }
  }

  private ChangeEvent event(
      final String actor, final UUID entityId, final T entity, final ChangeDescription change) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEntity(entity)
        .withChangeDescription(change)
        .withIncrementalChangeDescription(change)
        .withEventType(EventType.ENTITY_UPDATED)
        .withEntityType(entityType)
        .withEntityId(entityId)
        .withEntityFullyQualifiedName(entity.getFullyQualifiedName())
        .withUserName(actor)
        .withTimestamp(System.currentTimeMillis())
        .withCurrentVersion(entity.getVersion())
        .withPreviousVersion(change.getPreviousVersion());
  }
}
