package org.openmetadata.service.entity.read;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.function.BiPredicate;
import java.util.function.Function;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.util.EntityUtil.Fields;

/** Loads local inheritance metadata and traverses parents through the entity's declared policy. */
@Slf4j
public final class EntityInheritanceReader<T extends EntityInterface> {
  public record Capabilities(String type, boolean owners, boolean domains) {}

  public interface ParentLookup {
    EntityInterface read(String type, UUID id, String fields, Include include);
  }

  public interface Inheritance<T> {
    void apply(T entity, Fields fields, EntityInterface parent);
  }

  public record Lookup<T>(
      BiFunction<UUID, Include, T> entity,
      BiFunction<List<EntityRelationshipRecord>, Include, List<EntityReference>> references,
      Function<UUID, EntityReference> fallback,
      ParentLookup parent) {}

  public record Policy<T>(
      BiPredicate<T, Fields> required, Supplier<String> inheritable, Inheritance<T> inheritance) {}

  private final Capabilities capabilities;
  private final Supplier<EntityRelationshipDAO> relationships;
  private final Lookup<T> lookup;
  private final Policy<T> policy;

  public EntityInheritanceReader(
      final Capabilities capabilities,
      final Supplier<EntityRelationshipDAO> relationships,
      final Lookup<T> lookup,
      final Policy<T> policy) {
    this.capabilities = capabilities;
    this.relationships = relationships;
    this.lookup = lookup;
    this.policy = policy;
  }

  public T read(final UUID id, final Fields fields, final Include include) {
    final T entity = lookup.entity().apply(id, include);
    final List<EntityRelationshipObject> records =
        relationships
            .get()
            .findToRelationshipsForEntity(
                entity.getId(), capabilities.type(), relations(fields), ALL);
    populateLocal(entity, fields, records);
    if (policy.required().test(entity, fields)) {
      inherit(entity, fields, records);
    }
    return entity;
  }

  private List<Integer> relations(final Fields fields) {
    final Fields requested = fields == null ? Fields.EMPTY_FIELDS : fields;
    final Set<Integer> selected = new HashSet<>();
    if (capabilities.owners() && requested.contains(FIELD_OWNERS)) {
      selected.add(Relationship.OWNS.ordinal());
    }
    if (capabilities.domains() && requested.contains(FIELD_DOMAINS)) {
      selected.add(Relationship.HAS.ordinal());
    }
    selected.add(Relationship.CONTAINS.ordinal());
    return new ArrayList<>(selected);
  }

  private void populateLocal(
      final T entity, final Fields fields, final List<EntityRelationshipObject> records) {
    if (fields.contains(FIELD_OWNERS)) {
      entity.setOwners(references(records, Relationship.OWNS, null));
    }
    if (fields.contains(FIELD_DOMAINS)) {
      entity.setDomains(references(records, Relationship.HAS, DOMAIN));
    }
  }

  private List<EntityReference> references(
      final List<EntityRelationshipObject> records,
      final Relationship relation,
      final String type) {
    return lookup
        .references()
        .apply(RelationshipReadLoader.incomingReferences(records, relation, type), NON_DELETED);
  }

  private void inherit(
      final T entity, final Fields fields, final List<EntityRelationshipObject> records) {
    final List<EntityRelationshipObject> parents = findParents(records);
    if (!parents.isEmpty()) {
      final EntityReference projected = parentReference(parents.getFirst());
      final EntityReference reference =
          projected == null ? lookup.fallback().apply(entity.getId()) : projected;
      if (reference != null) {
        final EntityInterface parent =
            lookup
                .parent()
                .read(reference.getType(), reference.getId(), projectFields(fields), ALL);
        policy.inheritance().apply(entity, fields, parent);
      }
    }
  }

  private List<EntityRelationshipObject> findParents(final List<EntityRelationshipObject> records) {
    final List<EntityRelationshipObject> parents =
        nullOrEmpty(records)
            ? List.of()
            : records.stream()
                .filter(record -> record.getRelation() == Relationship.CONTAINS.ordinal())
                .toList();
    if (parents.size() > 1) {
      LOG.warn(
          "Possible database issues - multiple relations {} for entity {} fromEntityType {}",
          Relationship.CONTAINS.value(),
          capabilities.type(),
          null);
    }
    return parents;
  }

  private EntityReference parentReference(final EntityRelationshipObject record) {
    return nullOrEmpty(record.getFromEntity()) || nullOrEmpty(record.getFromId())
        ? null
        : new EntityReference()
            .withType(record.getFromEntity())
            .withId(UUID.fromString(record.getFromId()));
  }

  private String projectFields(final Fields fields) {
    final String inheritable = policy.inheritable().get();
    if (inheritable == null || inheritable.isBlank()) {
      return "";
    }
    return fields == null || nullOrEmpty(fields.getFieldList())
        ? inheritable
        : projectFields(inheritable, fields);
  }

  private String projectFields(final String inheritable, final Fields fields) {
    final List<String> selected = new ArrayList<>();
    for (final String field : inheritable.split(",")) {
      final String normalized = field.trim();
      if (!normalized.isEmpty() && fields.contains(normalized)) {
        selected.add(normalized);
      }
    }
    return selected.isEmpty() ? inheritable : String.join(",", selected);
  }
}
