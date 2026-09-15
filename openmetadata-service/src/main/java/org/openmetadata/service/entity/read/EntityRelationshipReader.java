package org.openmetadata.service.entity.read;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.cache.CachedRelationshipDao;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.EntityRelationshipNotFoundException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.util.EntityUtil;

/** Resolves relationship references with the existing Include, orphan and container-cache policies. */
@Slf4j
public final class EntityRelationshipReader {
  public record Selection(UUID id, String type, Relationship relationship, String relatedType) {}

  public record Requirement(
      String type, UUID id, String relationship, String relatedType, boolean required) {}

  @FunctionalInterface
  public interface ReferenceById {
    EntityReference get(String type, UUID id, Include include);
  }

  public record References(
      ReferenceById single,
      BiFunction<List<EntityRelationshipRecord>, Include, List<EntityReference>> many) {}

  private final String entityType;
  private final Supplier<EntityRelationshipDAO> relationships;
  private final References references;
  private final Supplier<CachedRelationshipDao> cache;

  public EntityRelationshipReader(
      final String entityType,
      final Supplier<EntityRelationshipDAO> relationships,
      final References references,
      final Supplier<CachedRelationshipDao> cache) {
    this.entityType = entityType;
    this.relationships = relationships;
    this.references = references;
    this.cache = cache;
  }

  public EntityReference container(final UUID id, final String relatedType) {
    return singleFrom(id, Relationship.CONTAINS, relatedType, false);
  }

  public EntityReference singleFrom(
      final UUID id,
      final Relationship relationship,
      final String relatedType,
      final boolean required) {
    return singleFrom(new Selection(id, entityType, relationship, relatedType), required, false);
  }

  public EntityReference singleTo(
      final UUID id,
      final Relationship relationship,
      final String relatedType,
      final boolean required) {
    return singleTo(new Selection(id, entityType, relationship, relatedType), required);
  }

  public List<EntityReference> fromOrNull(
      final UUID id,
      final Relationship relationship,
      final String relatedType,
      final Include include) {
    return fromOrNull(new Selection(id, entityType, relationship, relatedType), include);
  }

  public List<EntityRelationshipRecord> fromRecords(final Selection selection) {
    return selection.relatedType() == null
        ? relationships
            .get()
            .findFrom(selection.id(), selection.type(), selection.relationship().ordinal())
        : relationships
            .get()
            .findFrom(
                selection.id(),
                selection.type(),
                selection.relationship().ordinal(),
                selection.relatedType());
  }

  public List<EntityRelationshipRecord> toRecords(final Selection selection) {
    return selection.relatedType() == null
        ? relationships
            .get()
            .findTo(selection.id(), selection.type(), selection.relationship().ordinal())
        : relationships
            .get()
            .findTo(
                selection.id(),
                selection.type(),
                selection.relationship().ordinal(),
                selection.relatedType());
  }

  public List<EntityRelationshipObject> fromRecordsBatch(
      final Set<String> ids,
      final String type,
      final Relationship relationship,
      final String relatedType) {
    return relationships
        .get()
        .findFromBatch(new ArrayList<>(ids), relationship.ordinal(), type, relatedType);
  }

  public List<EntityRelationshipObject> toRecordsBatch(
      final Set<String> ids,
      final String type,
      final Relationship relationship,
      final String relatedType) {
    return relationships
        .get()
        .findToBatch(new ArrayList<>(ids), relationship.ordinal(), type, relatedType);
  }

  public List<EntityReference> from(final Selection selection, final Include include) {
    return references.many().apply(fromRecords(selection), include);
  }

  public List<EntityReference> to(final Selection selection, final Include include) {
    return references.many().apply(toRecords(selection), include);
  }

  public List<EntityReference> both(final Selection selection) {
    final List<EntityReference> combined = new ArrayList<>(from(selection, NON_DELETED));
    combined.addAll(to(selection, NON_DELETED));
    combined.sort(EntityUtil.compareEntityReference);
    return combined;
  }

  public List<EntityReference> fromOrNull(final Selection selection, final Include include) {
    final List<EntityRelationshipRecord> records = fromRecords(selection);
    final List<EntityReference> found =
        records.isEmpty() ? List.of() : references.many().apply(records, include);
    return found.isEmpty() ? null : found;
  }

  public EntityReference singleFrom(
      final Selection selection, final boolean required, final boolean cacheContainer) {
    final CachedRelationshipDao cached = containerCache(selection, cacheContainer);
    final EntityReference hit =
        cached == null
            ? null
            : cached.getContainer(
                selection.type(), selection.id(), selection.relationship().ordinal());
    return hit != null ? hit : loadParent(selection, required, cacheContainer, cached);
  }

  private CachedRelationshipDao containerCache(final Selection selection, final boolean enabled) {
    return enabled
            && selection.relatedType() == null
            && selection.relationship() == Relationship.CONTAINS
        ? cache.get()
        : null;
  }

  private EntityReference loadParent(
      final Selection selection,
      final boolean required,
      final boolean cacheContainer,
      final CachedRelationshipDao cached) {
    final List<EntityRelationshipRecord> records = fromRecords(selection);
    requireSingle(selection, records, required);
    final EntityReference parent = resolveFirst(records, cacheContainer);
    if (cached != null && parent != null) {
      cached.putContainer(
          selection.type(), selection.id(), selection.relationship().ordinal(), parent);
    }
    return parent;
  }

  public EntityReference singleTo(final Selection selection, final boolean required) {
    final List<EntityRelationshipRecord> records = toRecords(selection);
    requireSingle(selection, records, required);
    return resolveFirst(records, true);
  }

  private EntityReference resolveFirst(
      final List<EntityRelationshipRecord> records, final boolean quiet) {
    if (records.isEmpty()) {
      return null;
    }
    final EntityRelationshipRecord record = records.getFirst();
    try {
      return references.single().get(record.getType(), record.getId(), ALL);
    } catch (EntityNotFoundException exception) {
      logOrphan(record, exception, quiet);
      return null;
    }
  }

  private void logOrphan(
      final EntityRelationshipRecord record,
      final EntityNotFoundException exception,
      final boolean quiet) {
    if (quiet) {
      LOG.debug("Skipping deleted entity reference: {} {}", record.getType(), record.getId());
    } else {
      LOG.info(
          "Skipping deleted entity reference in getFromEntityRef: {} {} - {}",
          record.getType(),
          record.getId(),
          exception.getMessage());
    }
  }

  private void requireSingle(
      final Selection selection,
      final List<EntityRelationshipRecord> records,
      final boolean required) {
    if (records.size() != 1 && (required || !records.isEmpty())) {
      requireSingle(
          new Requirement(
              selection.type(),
              selection.id(),
              selection.relationship().value(),
              selection.relatedType(),
              required),
          records);
    }
  }

  public static void requireSingle(
      final Requirement requirement, final List<EntityRelationshipRecord> records) {
    if (requirement.required() && records.isEmpty()) {
      throw new EntityRelationshipNotFoundException(
          CatalogExceptionMessage.entityRelationshipNotFound(
              requirement.type(),
              requirement.id(),
              requirement.relationship(),
              requirement.relatedType()));
    }
    if (records.size() > 1) {
      LOG.warn(
          "Possible database issues - multiple relations {} for entity {}:{}",
          requirement.relationship(),
          requirement.type(),
          requirement.id());
    }
  }
}
