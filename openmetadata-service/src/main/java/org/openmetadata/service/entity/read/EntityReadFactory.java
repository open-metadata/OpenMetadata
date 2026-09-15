package org.openmetadata.service.entity.read;

import jakarta.ws.rs.core.UriInfo;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.BooleanSupplier;
import java.util.function.Function;
import java.util.function.UnaryOperator;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.ListCountCache;
import org.openmetadata.service.entity.cache.EntityCacheKeys;
import org.openmetadata.service.entity.cache.EntityCachePolicy;
import org.openmetadata.service.entity.cache.EntityCaches;
import org.openmetadata.service.entity.metadata.EntityFieldTagReader;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRelationshipRepository;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.search.SearchRepository;

/** Constructs shared read components once, retaining the caller's DAO graph and cache providers. */
public final class EntityReadFactory {
  public record Schema<T extends EntityInterface>(
      String type, Class<T> entityClass, EntityDAO<T> dao) {}

  @FunctionalInterface
  public interface Prefetch<T> {
    void load(T entity, ReadPlan plan, ReadBundle bundle);
  }

  public record Metadata<T>(
      BiConsumer<T, ReadBundle> tags,
      Function<T, Votes> votes,
      Function<T, Object> extension,
      Prefetch<T> prefetch) {}

  private EntityReadFactory() {}

  public static <T extends EntityInterface> EntityLookupService<T> lookup(
      final Schema<T> schema, final BooleanSupplier quoteName) {
    return new EntityLookupService<>(
        new EntityLookupService.Schema<>(schema.type(), schema.entityClass(), quoteName),
        schema.dao(),
        new EntityLookupService.Caches(
            EntityCaches::byId,
            EntityCaches::byName,
            CacheBundle::getNotFoundCache,
            EntityCaches.epochs()));
  }

  public static <T extends EntityInterface> EntitySearchReader<T> search(
      final Schema<T> schema,
      final SearchRepository search,
      final BiFunction<UriInfo, T, T> withHref) {
    return new EntitySearchReader<>(
        schema.entityClass(),
        (query, subject) ->
            search.listWithOffset(
                query.filter(),
                query.page().limit(),
                query.page().offset(),
                schema.type(),
                query.sort(),
                query.text(),
                query.queryString(),
                subject),
        withHref);
  }

  public static EntityBatchReferenceReader batchReferences(final CollectionDAO dao) {
    return new EntityBatchReferenceReader(
        () -> dao.relationshipDAO(), Entity::getEntityReferencesByIds);
  }

  public static EntityAccessMetadataReader accessMetadata(final CollectionDAO dao) {
    return new EntityAccessMetadataReader(
        () -> dao.relationshipDAO(), Entity::getEntityReferencesByIds);
  }

  public static EntityRelationshipReader relationships(
      final String entityType, final CollectionDAO dao) {
    return new EntityRelationshipReader(
        entityType,
        () -> dao.relationshipDAO(),
        new EntityRelationshipReader.References(
            Entity::getEntityReferenceById,
            (records, include) ->
                Entity.getEntityRelationshipRepository().getEntityReferences(records, include)),
        CacheBundle::getCachedRelationshipDao);
  }

  public static EntityRelationshipFields relationshipFields(
      final String entityType,
      final Set<String> fields,
      final EntityRelationshipReader relationships,
      final ReadBundleAccess bundles) {
    return new EntityRelationshipFields(
        new EntityRelationshipFields.Schema(entityType, fields),
        relationships,
        bundles,
        CacheBundle::getCachedRelationshipDao);
  }

  public static EntityFieldTagReader fieldTags(final CollectionDAO dao) {
    return new EntityFieldTagReader(
        () -> dao.tagUsageDAO(),
        new EntityFieldTagReader.Hydration(
            TagLabelUtil::populateTagLabel,
            TagLabelUtil::batchFetchDerivedTags,
            TagLabelUtil::addDerivedTagsWithPreFetched));
  }

  public static BulkRelationshipLoader bulkRelationships(
      final String entityType, final Set<String> fields, final CollectionDAO dao) {
    return new BulkRelationshipLoader(
        entityType,
        BulkRelationshipField.defaults(entityType, fields),
        () -> dao.relationshipDAO(),
        new BulkRelationshipLoader.ReferenceSource(
            Entity::hasEntityRepository,
            (type, ids) -> Entity.getEntityReferencesByIds(type, ids, Include.NON_DELETED)));
  }

  public static <T extends EntityInterface> EntityReadService<T> detail(
      final Schema<T> schema,
      final UnaryOperator<String> normalizeName,
      final EntityLookupService<T> lookup,
      final EntityReadService.Hydration<T> hydration,
      final BiFunction<UriInfo, T, T> withHref) {
    return new EntityReadService<>(
        new EntityReadService.Schema<>(schema.type(), schema.entityClass(), normalizeName),
        new EntityReadService.Lookup<>(
            lookup::byId,
            lookup::byName,
            id -> EntityCaches.byId().invalidate(new ImmutablePair<>(schema.type(), id)),
            name -> EntityCaches.byName().invalidate(EntityCacheKeys.name(schema.type(), name))),
        hydration,
        withHref);
  }

  public static <T extends EntityInterface> EntityPageReader<T> pages(
      final Schema<T> schema,
      final EntityRowReader.Hydration<T> hydration,
      final Function<T, String> cursor,
      final EntityPagePolicy<T> policy) {
    return new EntityPageReader<>(
        schema.dao(),
        new EntityRowReader<>(schema.entityClass(), hydration, cursor),
        filter ->
            ListCountCache.getOrCompute(
                schema.type(), filter, () -> schema.dao().listCount(filter)),
        policy);
  }

  public static <T extends EntityInterface> ReadBundleLoader<T> bundles(
      final Schema<T> schema,
      final CollectionDAO dao,
      final EntityRelationshipRepository relationships,
      final boolean supportsCertification,
      final Metadata<T> metadata) {
    return new ReadBundleLoader<>(
        new ReadBundleLoader.Options(schema.type(), supportsCertification),
        new RelationshipReadLoader(
            () -> dao.relationshipDAO(),
            new RelatedEntityResolver(relationships::getEntityReferences)),
        new ReadBundleLoader.CacheAccess(
            EntityCachePolicy.isCacheable(schema.type()),
            CacheBundle::getCachedReadBundle,
            id -> EntityCaches.epochs().byId(EntityCacheKeys.id(schema.type(), id))),
        metadataSource(metadata));
  }

  private static <T extends EntityInterface> ReadMetadataSource<T> metadataSource(
      final Metadata<T> metadata) {
    return new ReadMetadataSource<>() {
      @Override
      public void loadTags(T entity, ReadBundle bundle) {
        metadata.tags().accept(entity, bundle);
      }

      @Override
      public Votes loadVotes(T entity) {
        return metadata.votes().apply(entity);
      }

      @Override
      public Object loadExtension(T entity) {
        return metadata.extension().apply(entity);
      }

      @Override
      public void prefetch(T entity, ReadPlan plan, ReadBundle bundle) {
        metadata.prefetch().load(entity, plan, bundle);
      }
    };
  }
}
