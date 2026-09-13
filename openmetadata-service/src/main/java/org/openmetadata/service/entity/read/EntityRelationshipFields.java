package org.openmetadata.service.entity.read;

import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DATA_CONTRACT;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_CHILDREN;
import static org.openmetadata.service.Entity.FIELD_DATA_CONTRACT;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.Entity.USER;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.cache.CachedRelationshipDao;
import org.openmetadata.service.entity.read.EntityRelationshipReader.Selection;

/** Applies relationship-field capability, request-bundle and Redis projection policies. */
@Slf4j
public final class EntityRelationshipFields {
  public record Schema(String type, Set<String> fields) {
    public Schema {
      fields = Set.copyOf(fields);
    }
  }

  private enum CachedField {
    OWNERS(FIELD_OWNERS, Relationship.OWNS, null),
    DOMAINS(FIELD_DOMAINS, Relationship.HAS, DOMAIN);

    private final String field;
    private final Relationship relation;
    private final String relatedType;

    CachedField(final String field, final Relationship relation, final String relatedType) {
      this.field = field;
      this.relation = relation;
      this.relatedType = relatedType;
    }

    private List<EntityReference> get(
        final CachedRelationshipDao cache, final String type, final UUID id) {
      return switch (this) {
        case OWNERS -> cache.getOwners(type, id);
        case DOMAINS -> cache.getDomains(type, id);
      };
    }

    private void put(
        final CachedRelationshipDao cache, final String type, final UUID id, final String json) {
      switch (this) {
        case OWNERS -> cache.putOwners(type, id, json);
        case DOMAINS -> cache.putDomains(type, id, json);
      }
    }
  }

  private final Schema schema;
  private final EntityRelationshipReader relationships;
  private final ReadBundleAccess bundles;
  private final Supplier<CachedRelationshipDao> caches;

  public EntityRelationshipFields(
      final Schema schema,
      final EntityRelationshipReader relationships,
      final ReadBundleAccess bundles,
      final Supplier<CachedRelationshipDao> caches) {
    this.schema = schema;
    this.relationships = relationships;
    this.bundles = bundles;
    this.caches = caches;
  }

  public List<EntityReference> owners(final EntityInterface entity, final Include include) {
    return supports(FIELD_OWNERS)
        ? bundles
            .relations(entity, FIELD_OWNERS, include)
            .orElseGet(() -> cachedReferences(entity, include, CachedField.OWNERS))
        : Collections.emptyList();
  }

  public List<EntityReference> owners(final EntityReference reference, final Include include) {
    return supports(FIELD_OWNERS)
        ? relationships.fromOrNull(selection(reference.getId(), Relationship.OWNS, null), include)
        : null;
  }

  public List<EntityReference> domains(final EntityInterface entity, final Include include) {
    return supports(FIELD_DOMAINS)
        ? bundles
            .relations(entity, FIELD_DOMAINS, include)
            .orElseGet(() -> readDomains(entity, include))
        : null;
  }

  private List<EntityReference> readDomains(final EntityInterface entity, final Include include) {
    if (entity.getId() == null) {
      LOG.error(
          "Entity has null ID when getting domains! Entity type: {}, Entity: {}",
          schema.type(),
          entity);
      return null;
    }
    return cachedReferences(entity, include, CachedField.DOMAINS);
  }

  private List<EntityReference> cachedReferences(
      final EntityInterface entity, final Include include, final CachedField field) {
    final CachedRelationshipDao cache = caches.get();
    final List<EntityReference> cached =
        include == NON_DELETED && cache != null
            ? field.get(cache, schema.type(), entity.getId())
            : null;
    if (cached != null) {
      LOG.debug(
          "CACHE HIT: Retrieved {} from cache for {} {}",
          field.field,
          schema.type(),
          entity.getId());
      return cached;
    }
    final Selection selection = selection(entity.getId(), field.relation, field.relatedType);
    final List<EntityReference> found =
        field == CachedField.OWNERS
            ? relationships.from(selection, include)
            : relationships.fromOrNull(selection, include);
    if (include == NON_DELETED && cache != null && found != null) {
      field.put(cache, schema.type(), entity.getId(), JsonUtils.pojoToJson(found));
    }
    return found;
  }

  public List<EntityReference> followers(final EntityInterface entity) {
    return followers(entity, NON_DELETED);
  }

  public List<EntityReference> followers(final EntityInterface entity, final Include include) {
    return bundles
        .relations(entity, FIELD_FOLLOWERS, include)
        .orElseGet(
            () ->
                !supports(FIELD_FOLLOWERS) || entity == null
                    ? Collections.emptyList()
                    : relationships.from(
                        selection(entity.getId(), Relationship.FOLLOWS, USER), include));
  }

  public List<EntityReference> dataProducts(final EntityInterface entity, final Include include) {
    return supports(FIELD_DATA_PRODUCTS)
        ? bundles
            .relations(entity, FIELD_DATA_PRODUCTS, include)
            .orElseGet(
                () ->
                    relationships.from(
                        selection(entity.getId(), Relationship.HAS, DATA_PRODUCT), include))
        : null;
  }

  public EntityReference dataContract(final EntityInterface entity) {
    return dataContract(entity, NON_DELETED);
  }

  public EntityReference dataContract(final EntityInterface entity, final Include include) {
    return supports(FIELD_DATA_CONTRACT)
        ? first(
            bundles
                .relations(entity, FIELD_DATA_CONTRACT, include)
                .orElseGet(
                    () ->
                        relationships.to(
                            selection(entity.getId(), Relationship.CONTAINS, DATA_CONTRACT),
                            include)))
        : null;
  }

  public List<EntityReference> children(final EntityInterface entity, final Include include) {
    return bundles
        .relations(entity, FIELD_CHILDREN, include)
        .orElseGet(
            () ->
                relationships.to(
                    selection(entity.getId(), Relationship.CONTAINS, schema.type()), include));
  }

  public List<EntityReference> reviewers(final EntityInterface entity) {
    return reviewers(entity, NON_DELETED);
  }

  public List<EntityReference> reviewers(final EntityInterface entity, final Include include) {
    return bundles
        .relations(entity, FIELD_REVIEWERS, include)
        .orElseGet(
            () ->
                supports(FIELD_REVIEWERS)
                    ? relationships.from(
                        selection(entity.getId(), Relationship.REVIEWS, null), include)
                    : null);
  }

  public List<EntityReference> experts(final EntityInterface entity) {
    return experts(entity, NON_DELETED);
  }

  public List<EntityReference> experts(final EntityInterface entity, final Include include) {
    return bundles
        .relations(entity, FIELD_EXPERTS, include)
        .orElseGet(
            () ->
                supports(FIELD_EXPERTS)
                    ? relationships.to(
                        selection(entity.getId(), Relationship.EXPERT, USER), include)
                    : null);
  }

  private EntityReference first(final List<EntityReference> references) {
    return references.isEmpty() ? null : references.getFirst();
  }

  private Selection selection(
      final UUID id, final Relationship relation, final String relatedType) {
    return new Selection(id, schema.type(), relation, relatedType);
  }

  private boolean supports(final String field) {
    return schema.fields().contains(field);
  }
}
