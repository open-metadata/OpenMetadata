package org.openmetadata.service.entity.read;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DOMAIN;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;

/** Hydrates access metadata while retaining each field's reference and missing-value policy. */
public final class EntityAccessMetadataReader {
  public record Projection(boolean owners, boolean domains) {}

  public record Metadata(
      Map<UUID, List<EntityReference>> owners, Map<UUID, List<EntityReference>> domains) {
    public Metadata {
      owners = Collections.unmodifiableMap(owners);
      domains = Collections.unmodifiableMap(domains);
    }
  }

  @FunctionalInterface
  public interface References {
    List<EntityReference> get(String type, List<UUID> ids, Include include);
  }

  private record Rows(
      List<EntityRelationshipObject> owners, List<EntityRelationshipObject> domains) {}

  private static final Projection ALL_FIELDS = new Projection(true, true);
  private static final Metadata EMPTY = new Metadata(Map.of(), Map.of());
  private final Supplier<EntityRelationshipDAO> relationships;
  private final References references;

  public EntityAccessMetadataReader(
      final Supplier<EntityRelationshipDAO> relationships, final References references) {
    this.relationships = relationships;
    this.references = references;
  }

  public void populateForAuth(final List<? extends EntityInterface> entities) {
    if (nullOrEmpty(entities)) {
      return;
    }
    final Metadata metadata = read(entities, ALL_FIELDS);
    for (final EntityInterface entity : entities) {
      entity.setOwners(metadata.owners().getOrDefault(entity.getId(), entity.getOwners()));
      entity.setDomains(metadata.domains().getOrDefault(entity.getId(), entity.getDomains()));
    }
  }

  public void populateForInheritance(
      final List<? extends EntityInterface> entities, final Projection projection) {
    final Metadata metadata = read(entities, projection);
    for (final EntityInterface entity : entities) {
      if (projection.owners()) {
        entity.setOwners(metadata.owners().getOrDefault(entity.getId(), List.of()));
      }
      if (projection.domains()) {
        entity.setDomains(metadata.domains().getOrDefault(entity.getId(), List.of()));
      }
    }
  }

  public Metadata read(
      final List<? extends EntityInterface> entities, final Projection projection) {
    if (nullOrEmpty(entities) || (!projection.owners() && !projection.domains())) {
      return EMPTY;
    }
    final List<String> ids = entities.stream().map(entity -> entity.getId().toString()).toList();
    final Rows rows = readRows(ids, projection);
    final Map<String, UUID> parsedIds = new HashMap<>();
    return new Metadata(
        projection.owners() ? resolveOwners(rows.owners(), parsedIds) : Map.of(),
        projection.domains() ? resolveDomains(rows.domains(), parsedIds) : Map.of());
  }

  private Rows readRows(final List<String> ids, final Projection projection) {
    final EntityRelationshipDAO dao = relationships.get();
    if (projection.owners() && projection.domains()) {
      return partition(dao.findOwnersAndDomainsBatch(ids));
    }
    return new Rows(
        projection.owners() ? dao.findFromBatch(ids, Relationship.OWNS.ordinal(), ALL) : List.of(),
        projection.domains()
            ? dao.findFromBatch(ids, Relationship.HAS.ordinal(), DOMAIN, ALL)
            : List.of());
  }

  private Rows partition(final List<EntityRelationshipObject> records) {
    final Rows rows = new Rows(new ArrayList<>(), new ArrayList<>());
    for (final EntityRelationshipObject record : records) {
      final List<EntityRelationshipObject> field =
          record.getRelation() == Relationship.OWNS.ordinal() ? rows.owners() : rows.domains();
      field.add(record);
    }
    return rows;
  }

  private Map<UUID, List<EntityReference>> resolveOwners(
      final List<EntityRelationshipObject> records, final Map<String, UUID> parsedIds) {
    final Map<String, Set<UUID>> idsByType = ownerIds(records, parsedIds);
    final Map<String, Map<UUID, EntityReference>> referencesByType = new HashMap<>();
    idsByType.forEach((type, ids) -> referencesByType.put(type, ownerReferences(type, ids)));
    final Map<UUID, List<EntityReference>> result = new HashMap<>();
    for (final EntityRelationshipObject record : records) {
      final UUID entityId = parsedIds.computeIfAbsent(record.getToId(), UUID::fromString);
      final EntityReference owner =
          referencesByType.get(record.getFromEntity()).get(parsedIds.get(record.getFromId()));
      if (owner != null) {
        result.computeIfAbsent(entityId, ignored -> new ArrayList<>()).add(owner);
      }
    }
    return result;
  }

  private Map<String, Set<UUID>> ownerIds(
      final List<EntityRelationshipObject> records, final Map<String, UUID> parsedIds) {
    final Map<String, Set<UUID>> result = new HashMap<>();
    for (final EntityRelationshipObject record : records) {
      final UUID id = parsedIds.computeIfAbsent(record.getFromId(), UUID::fromString);
      result.computeIfAbsent(record.getFromEntity(), ignored -> new HashSet<>()).add(id);
    }
    return result;
  }

  private Map<UUID, EntityReference> ownerReferences(final String type, final Set<UUID> ids) {
    return references.get(type, new ArrayList<>(ids), NON_DELETED).stream()
        .collect(
            Collectors.toMap(
                EntityReference::getId, Function.identity(), (first, ignored) -> first));
  }

  private Map<UUID, List<EntityReference>> resolveDomains(
      final List<EntityRelationshipObject> records, final Map<String, UUID> parsedIds) {
    final List<UUID> ids =
        records.stream()
            .map(record -> parsedIds.computeIfAbsent(record.getFromId(), UUID::fromString))
            .distinct()
            .toList();
    final Map<UUID, EntityReference> domains =
        references.get(DOMAIN, ids, ALL).stream()
            .collect(Collectors.toMap(EntityReference::getId, Function.identity()));
    final Map<UUID, List<EntityReference>> result = new HashMap<>();
    for (final EntityRelationshipObject record : records) {
      final UUID entityId = parsedIds.computeIfAbsent(record.getToId(), UUID::fromString);
      result
          .computeIfAbsent(entityId, ignored -> new ArrayList<>())
          .add(domains.get(parsedIds.get(record.getFromId())));
    }
    return result;
  }
}
