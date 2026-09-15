package org.openmetadata.service.entity.read;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.VoteRequest.VoteType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;

/** Projects votes while preserving the different reference policies of single and batch reads. */
public final class EntityVoteReader<T extends EntityInterface> {
  public record Queries(
      Function<UUID, List<EntityRelationshipRecord>> one,
      Function<List<String>, List<EntityRelationshipObject>> many) {}

  public record References(
      Function<List<EntityRelationshipRecord>, List<EntityReference>> records,
      Function<List<UUID>, List<EntityReference>> ids) {}

  private final boolean supported;
  private final Queries queries;
  private final References references;
  private final Function<EntityInterface, Optional<Votes>> bundle;

  public EntityVoteReader(
      final boolean supported,
      final Queries queries,
      final References references,
      final Function<EntityInterface, Optional<Votes>> bundle) {
    this.supported = supported;
    this.queries = queries;
    this.references = references;
    this.bundle = bundle;
  }

  public Votes read(final T entity) {
    return !supported || entity == null
        ? new Votes()
        : bundle.apply(entity).orElseGet(() -> readUncached(entity.getId()));
  }

  private Votes readUncached(final UUID id) {
    final List<EntityRelationshipRecord> up = new ArrayList<>();
    final List<EntityRelationshipRecord> down = new ArrayList<>();
    for (final EntityRelationshipRecord record : queries.one().apply(id)) {
      switch (JsonUtils.readValue(record.getJson(), VoteType.class)) {
        case VOTED_UP -> up.add(record);
        case VOTED_DOWN -> down.add(record);
        case UN_VOTED -> {}
        case null -> {}
      }
    }
    return votes(references.records().apply(up), references.records().apply(down));
  }

  public Map<UUID, Votes> readMany(final List<T> entities) {
    final Map<UUID, Votes> results = new HashMap<>();
    if (!nullOrEmpty(entities)) {
      final VoteIds ids =
          group(
              queries
                  .many()
                  .apply(entities.stream().map(entity -> entity.getId().toString()).toList()));
      final Map<UUID, EntityReference> users = resolve(ids);
      for (final T entity : entities) {
        results.put(
            entity.getId(),
            votes(
                voters(ids.up().getOrDefault(entity.getId(), List.of()), users),
                voters(ids.down().getOrDefault(entity.getId(), List.of()), users)));
      }
    }
    return results;
  }

  private VoteIds group(final List<EntityRelationshipObject> records) {
    final VoteIds ids = new VoteIds(new HashMap<>(), new HashMap<>());
    for (final EntityRelationshipObject record : records) {
      final UUID entityId = UUID.fromString(record.getToId());
      final UUID userId = UUID.fromString(record.getFromId());
      switch (JsonUtils.readValue(record.getJson(), VoteType.class)) {
        case VOTED_UP -> ids.up()
            .computeIfAbsent(entityId, ignored -> new ArrayList<>())
            .add(userId);
        case VOTED_DOWN -> ids.down()
            .computeIfAbsent(entityId, ignored -> new ArrayList<>())
            .add(userId);
        case UN_VOTED -> {}
        case null -> {}
      }
    }
    return ids;
  }

  private Map<UUID, EntityReference> resolve(final VoteIds votes) {
    final Set<UUID> ids = new HashSet<>();
    votes.up().values().forEach(ids::addAll);
    votes.down().values().forEach(ids::addAll);
    return references.ids().apply(new ArrayList<>(ids)).stream()
        .collect(Collectors.toMap(EntityReference::getId, Function.identity()));
  }

  private List<EntityReference> voters(
      final List<UUID> ids, final Map<UUID, EntityReference> users) {
    return ids.stream().map(users::get).filter(Objects::nonNull).toList();
  }

  private Votes votes(final List<EntityReference> up, final List<EntityReference> down) {
    return new Votes()
        .withUpVotes(up.size())
        .withDownVotes(down.size())
        .withUpVoters(up)
        .withDownVoters(down);
  }

  private record VoteIds(Map<UUID, List<UUID>> up, Map<UUID, List<UUID>> down) {}
}
