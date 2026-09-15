package org.openmetadata.service.entity.read;

import static org.openmetadata.service.Entity.FIELD_CERTIFICATION;
import static org.openmetadata.service.Entity.FIELD_CHILDREN;
import static org.openmetadata.service.Entity.FIELD_DATA_CONTRACT;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_EXTENSION;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.FIELD_VOTES;

import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.Function;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/** Applies the shared detail projection before each entity's registered field policy. */
public final class EntityMetadataHydrator<T extends EntityInterface> {
  public record CoreReferences<T>(
      BiFunction<T, Include, List<EntityReference>> owners,
      BiFunction<T, Include, List<EntityReference>> domains,
      BiFunction<T, Include, List<EntityReference>> dataProducts,
      BiFunction<T, Include, EntityReference> dataContract) {}

  public record AccessReferences<T>(
      BiFunction<T, Include, List<EntityReference>> followers,
      BiFunction<T, Include, List<EntityReference>> children,
      BiFunction<T, Include, List<EntityReference>> experts,
      BiFunction<T, Include, List<EntityReference>> reviewers) {}

  public record Values<T>(
      Function<T, List<TagLabel>> tags,
      Function<T, AssetCertification> certification,
      Function<T, Object> extension,
      Function<T, Votes> votes) {}

  @FunctionalInterface
  public interface Reader<T> {
    void read(T entity, Fields fields, RelationIncludes includes);
  }

  public record EntityFields<T>(Reader<T> read, BiConsumer<T, Fields> clear) {}

  private final CoreReferences<T> core;
  private final AccessReferences<T> access;
  private final Values<T> values;
  private final EntityFields<T> specific;

  public EntityMetadataHydrator(
      final CoreReferences<T> core,
      final AccessReferences<T> access,
      final Values<T> values,
      final EntityFields<T> specific) {
    this.core = core;
    this.access = access;
    this.values = values;
    this.specific = specific;
  }

  public T hydrate(final T entity, final Fields fields, final RelationIncludes includes) {
    entity.setOwners(
        fields.contains(FIELD_OWNERS)
            ? core.owners().apply(entity, includes.getIncludeFor(FIELD_OWNERS))
            : entity.getOwners());
    hydrateValues(entity, fields);
    hydrateCoreReferences(entity, fields, includes);
    hydrateAccessReferences(entity, fields, includes);
    entity.setVotes(
        fields.contains(FIELD_VOTES) ? values.votes().apply(entity) : entity.getVotes());
    specific.read().read(entity, fields, includes);
    return entity;
  }

  private void hydrateValues(final T entity, final Fields fields) {
    entity.setTags(fields.contains(FIELD_TAGS) ? values.tags().apply(entity) : entity.getTags());
    entity.setCertification(
        fields.contains(FIELD_TAGS) || fields.contains(FIELD_CERTIFICATION)
            ? values.certification().apply(entity)
            : null);
    entity.setExtension(
        fields.contains(FIELD_EXTENSION)
            ? values.extension().apply(entity)
            : entity.getExtension());
  }

  private void hydrateCoreReferences(
      final T entity, final Fields fields, final RelationIncludes includes) {
    entity.setDomains(
        fields.contains(FIELD_DOMAINS)
            ? core.domains().apply(entity, includes.getIncludeFor(FIELD_DOMAINS))
            : entity.getDomains());
    entity.setDataProducts(
        fields.contains(FIELD_DATA_PRODUCTS)
            ? core.dataProducts().apply(entity, includes.getIncludeFor(FIELD_DATA_PRODUCTS))
            : entity.getDataProducts());
    entity.setDataContract(
        fields.contains(FIELD_DATA_CONTRACT)
            ? core.dataContract().apply(entity, includes.getIncludeFor(FIELD_DATA_CONTRACT))
            : entity.getDataContract());
  }

  private void hydrateAccessReferences(
      final T entity, final Fields fields, final RelationIncludes includes) {
    entity.setFollowers(
        fields.contains(FIELD_FOLLOWERS)
            ? access.followers().apply(entity, includes.getIncludeFor(FIELD_FOLLOWERS))
            : entity.getFollowers());
    entity.setChildren(
        fields.contains(FIELD_CHILDREN)
            ? access.children().apply(entity, includes.getIncludeFor(FIELD_CHILDREN))
            : entity.getChildren());
    entity.setExperts(
        fields.contains(FIELD_EXPERTS)
            ? access.experts().apply(entity, includes.getIncludeFor(FIELD_EXPERTS))
            : entity.getExperts());
    entity.setReviewers(
        fields.contains(FIELD_REVIEWERS)
            ? access.reviewers().apply(entity, includes.getIncludeFor(FIELD_REVIEWERS))
            : entity.getReviewers());
  }

  public void clear(final T entity, final Fields fields) {
    clearCore(entity, fields);
    clearAccess(entity, fields);
    specific.clear().accept(entity, fields);
  }

  private void clearCore(final T entity, final Fields fields) {
    entity.setOwners(fields.contains(FIELD_OWNERS) ? entity.getOwners() : null);
    entity.setTags(fields.contains(FIELD_TAGS) ? entity.getTags() : null);
    entity.setExtension(fields.contains(FIELD_EXTENSION) ? entity.getExtension() : null);
    entity.setDomains(fields.contains(FIELD_DOMAINS) ? entity.getDomains() : null);
    entity.setDataProducts(fields.contains(FIELD_DATA_PRODUCTS) ? entity.getDataProducts() : null);
    entity.setDataContract(fields.contains(FIELD_DATA_CONTRACT) ? entity.getDataContract() : null);
  }

  private void clearAccess(final T entity, final Fields fields) {
    entity.setFollowers(fields.contains(FIELD_FOLLOWERS) ? entity.getFollowers() : null);
    entity.setChildren(fields.contains(FIELD_CHILDREN) ? entity.getChildren() : null);
    entity.setExperts(fields.contains(FIELD_EXPERTS) ? entity.getExperts() : null);
    entity.setReviewers(fields.contains(FIELD_REVIEWERS) ? entity.getReviewers() : null);
    entity.setVotes(fields.contains(FIELD_VOTES) ? entity.getVotes() : null);
  }
}
