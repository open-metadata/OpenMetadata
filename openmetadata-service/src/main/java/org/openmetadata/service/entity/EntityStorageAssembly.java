package org.openmetadata.service.entity;

import static org.openmetadata.schema.type.Include.ALL;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.entity.bootstrap.EntitySeedInitializer;
import org.openmetadata.service.entity.cache.EntityCachePolicy;
import org.openmetadata.service.entity.cache.EntityCaches;
import org.openmetadata.service.entity.metadata.EntityTimeSeries;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityLookupService;
import org.openmetadata.service.entity.read.EntityReadFactory;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.entity.write.EntityPersistence;
import org.openmetadata.service.entity.write.EntityUnitOfWork;
import org.openmetadata.service.jdbi3.EntityRelationshipRepository;
import org.openmetadata.service.seeding.SeedDataGate;

final class EntityStorageAssembly {

  private EntityStorageAssembly() {}

  static <T extends EntityInterface> EntityReadFactory.Schema<T> assembleReadSchema(
      EntityPolicyContext<T> context) {
    return new EntityReadFactory.Schema<>(
        context.schema().entityType(), context.schema().entityClass(), context.schema().dao());
  }

  static <T extends EntityInterface> EntityLookupService<T> assembleLookupService(
      EntityPolicyContext<T> context) {
    return EntityReadFactory.lookup(
        context.services().getReadSchema(), () -> context.options().isQuoteFqn());
  }

  static <T extends EntityInterface> EntityTimeSeries assembleTimeSeries(
      EntityPolicyContext<T> context) {
    return new EntityTimeSeries(() -> context.dependencies().daos().entityExtensionTimeSeriesDao());
  }

  static <T extends EntityInterface> EntityUnitOfWork assembleUnitOfWork(
      EntityPolicyContext<T> context) {
    return new EntityUnitOfWork(
        context.dependencies().jdbi(),
        context.dependencies().daos(),
        context.schema().entityType(),
        EntityCaches.invalidations().deferred());
  }

  static <T extends EntityInterface> EntityPersistence<T> assemblePersistence(
      EntityPolicyContext<T> context) {
    return new EntityPersistence<>(
        new EntityPersistence.Schema<>(context.schema().entityType(), context.schema().dao()),
        new EntityPersistence.Boundaries(
            context.services().getUnitOfWork()::flush, context.services().getUnitOfWork()::execute),
        new EntityPersistence.Cache(
            CacheBundle::getCachedEntityDao,
            EntityCachePolicy.isCacheable(context.schema().entityType())),
        new EntityPersistence.Policy<>(
            context.policy()::serializeForStorage, context.policy()::invalidate));
  }

  static <T extends EntityInterface> EntityRelationshipRepository assembleRelationshipRepository(
      EntityPolicyContext<T> context) {
    return new EntityRelationshipRepository(context.dependencies().daos());
  }

  static <T extends EntityInterface> EntitySeedInitializer<T> assembleSeedInitializer(
      EntityPolicyContext<T> context) {
    return new EntitySeedInitializer<>(
        context.schema().entityType(),
        new EntitySeedInitializer.Operations<>(
            name -> context.services().getLookupService().byNameOrNull(name, ALL),
            entity ->
                context.policy().creates().create(null, entity, new EntityCommandActor(null, null)),
            () -> SeedDataGate.getInstance().recordSeedFailure()),
        context.dependencies().clock());
  }

  static <T extends EntityInterface> void initialize(EntityPolicyContext<T> context) {
    context.services().readSchema = EntityStorageAssembly.assembleReadSchema(context);
    context.services().lookupService = EntityStorageAssembly.assembleLookupService(context);
    context.services().timeSeries = EntityStorageAssembly.assembleTimeSeries(context);
    context.services().unitOfWork = EntityStorageAssembly.assembleUnitOfWork(context);
    context.services().persistence = EntityStorageAssembly.assemblePersistence(context);
    context.services().relationshipRepository =
        EntityStorageAssembly.assembleRelationshipRepository(context);
    context.services().seedInitializer = EntityStorageAssembly.assembleSeedInitializer(context);
  }
}
