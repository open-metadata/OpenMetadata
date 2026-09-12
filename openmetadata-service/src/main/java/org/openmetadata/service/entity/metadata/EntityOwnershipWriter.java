package org.openmetadata.service.entity.metadata;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.DOMAIN;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter.Edge;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;

/** Reconciles persisted owner/domain IDs through the repository's metadata and lineage policies. */
@Slf4j
public final class EntityOwnershipWriter<T extends EntityInterface> {
  public record Writes<T>(
      BiConsumer<T, List<EntityReference>> owners,
      BiConsumer<T, List<EntityReference>> domains,
      BiConsumer<UUID, EntityReference> removeDomainLineage) {}

  private record Difference(boolean changed, List<EntityReference> removed) {
    private static Difference between(
        final List<EntityReference> original, final List<EntityReference> requested) {
      final Set<UUID> originalIds = ids(original);
      final Set<UUID> requestedIds = ids(requested);
      if (originalIds.equals(requestedIds)) {
        return new Difference(false, List.of());
      }
      return new Difference(
          true,
          original.stream()
              .filter(reference -> !requestedIds.contains(reference.getId()))
              .collect(Collectors.toList()));
    }

    private static Set<UUID> ids(final List<EntityReference> references) {
      return references.stream().map(EntityReference::getId).collect(Collectors.toSet());
    }
  }

  private final String entityType;
  private final Supplier<EntityRelationshipDAO> dao;
  private final EntityRelationshipWriter relationships;
  private final Writes<T> writes;

  public EntityOwnershipWriter(
      final String entityType,
      final Supplier<EntityRelationshipDAO> dao,
      final EntityRelationshipWriter relationships,
      final Writes<T> writes) {
    this.entityType = entityType;
    this.dao = dao;
    this.relationships = relationships;
    this.writes = writes;
  }

  public void owners(
      final T entity, final List<EntityReference> original, final List<EntityReference> requested) {
    final Difference difference = Difference.between(original, requested);
    if (difference.changed()) {
      removeOwners(entity, difference.removed());
      // Reassert every requested relationship, including IDs missing after a concurrent mutation.
      writes.owners().accept(entity, requested);
    }
  }

  private void removeOwners(final T entity, final List<EntityReference> owners) {
    if (nullOrEmpty(owners)) {
      return;
    }
    LOG.info("Removing {} owners for entity {}", owners.size(), entity.getId());
    final Map<String, List<UUID>> byType =
        owners.stream()
            .collect(
                Collectors.groupingBy(
                    EntityReference::getType,
                    Collectors.mapping(EntityReference::getId, Collectors.toList())));
    for (final Map.Entry<String, List<UUID>> entry : byType.entrySet()) {
      dao.get()
          .bulkRemoveFromRelationship(
              entry.getValue(),
              entity.getId(),
              entry.getKey(),
              entityType,
              Relationship.OWNS.ordinal());
    }
  }

  public void domains(
      final T entity,
      final Supplier<UUID> lineageTarget,
      final List<EntityReference> original,
      final List<EntityReference> requested) {
    final Difference difference = Difference.between(original, requested);
    if (difference.changed()) {
      removeDomains(entity, lineageTarget, difference.removed());
      writes.domains().accept(entity, requested);
    }
  }

  private void removeDomains(
      final T entity, final Supplier<UUID> lineageTarget, final List<EntityReference> domains) {
    for (final EntityReference domain : domains) {
      LOG.info(
          "Removing domain {}:{} for entity {}",
          domain.getType(),
          domain.getFullyQualifiedName(),
          entity.getId());
      writes.removeDomainLineage().accept(lineageTarget.get(), domain);
      relationships.delete(
          new Edge(domain.getId(), entity.getId(), DOMAIN, entityType, Relationship.HAS));
    }
  }
}
