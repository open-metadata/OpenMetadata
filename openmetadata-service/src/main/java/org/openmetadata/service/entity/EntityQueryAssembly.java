package org.openmetadata.service.entity;

import static org.openmetadata.schema.type.Include.ALL;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.history.EntityHistoryServices;
import org.openmetadata.service.entity.history.EntityHistoryType;
import org.openmetadata.service.entity.history.EntitySummaryWriter;
import org.openmetadata.service.entity.history.EntityVersionHistory;
import org.openmetadata.service.entity.metadata.EntityMetadataPersistence;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityInheritanceLoader;
import org.openmetadata.service.entity.read.EntityInheritanceReader;
import org.openmetadata.service.entity.read.EntityQueryServices;
import org.openmetadata.service.entity.write.EntityUpdateContext;
import org.openmetadata.service.entity.write.EntityUpdateStore;
import org.openmetadata.service.entity.write.EntityUpdater;

final class EntityQueryAssembly {

  private EntityQueryAssembly() {}

  static <T extends EntityInterface> EntityQueryServices<T> createQueryServices(
      EntityPolicyContext<T> context) {
    return new EntityQueryServices<>(
        new EntityQueryServices.Schema<>(
            context.services().getReadSchema(),
            context.services().getLookupService(),
            context.allowedFields()),
        new EntityQueryServices.Dependencies(
            context.dependencies().daos(),
            context.services().getRelationshipRepository(),
            context.dependencies().search()),
        new EntityQueryServices.Values<>(
            context.services().getMetadataReads(),
            context.services().getTagReader(),
            context.services().getExtensionService()),
        new EntityQueryServices.Policies<>(
            EntityQueryAssembly.queryDetailPolicy(context),
            EntityQueryAssembly.queryBulkPolicy(context),
            EntityQueryAssembly.queryInheritancePolicy(context),
            new EntityQueryServices.Paging<>(
                context.policy()::getCursorValue, context.policy().pagingPolicy())));
  }

  static <T extends EntityInterface> EntityQueryServices.Detail<T> queryDetailPolicy(
      EntityPolicyContext<T> context) {
    return new EntityQueryServices.Detail<>(
        () -> context.options().isQuoteFqn(),
        context.policy()::augmentReadPlan,
        context.policy()::prefetchEntitySpecificReadData,
        context.policy()::setInheritedFields,
        context.policy()::withHref);
  }

  static <T extends EntityInterface> EntityQueryServices.Bulk<T> queryBulkPolicy(
      EntityPolicyContext<T> context) {
    return new EntityQueryServices.Bulk<>(
        context.policy()::setFieldsInBulk,
        context.policy()::setFieldsInBulk,
        context.policy()::setInheritedFields,
        context.policy()::fetchAndSetChildren,
        context.policy()::derivedTagFailureMode);
  }

  static <T extends EntityInterface> EntityQueryServices.Inheritance<T> queryInheritancePolicy(
      EntityPolicyContext<T> context) {
    return new EntityQueryServices.Inheritance<>(
        new EntityInheritanceLoader.Policy<>(
            context.policy()::requiresParentForInheritance,
            context.policy()::getParentReference,
            type ->
                type == null
                    ? context.policy().getInheritableFields()
                    : context.policy().getInheritableFields(type),
            context.policy()::applyInheritance),
        new EntityInheritanceLoader.Parents<>(
            context.policy()::getParentEntity,
            (references, fields) -> Entity.getEntitiesForInheritance(references, fields, ALL)),
        context.policy()::setInheritedFields,
        new EntityInheritanceReader.Policy<>(
            context.policy()::requiresParentForInheritance,
            context.policy()::getInheritableFields,
            context.policy()::applyInheritance));
  }

  static <T extends EntityInterface> EntityQueryServices<T> assembleQueries(
      EntityPolicyContext<T> context) {
    return EntityQueryAssembly.createQueryServices(context);
  }

  static <T extends EntityInterface> EntityHistoryServices<T> assembleHistoryServices(
      EntityPolicyContext<T> context) {
    return new EntityHistoryServices<>(
        new EntityHistoryType<>(
            context.schema().entityType(),
            context.schema().entityClass(),
            context.schema().dao().getTableName()),
        new EntityHistoryServices.Storage<>(
            () -> context.dependencies().daos().entityExtensionDAO(),
            context.policy()::serializeForVersionHistory,
            new EntityUpdateStore.Rows<>(
                entity -> context.policy().storeEntityAndCaptureJson(entity, true),
                (entity, version) ->
                    EntityWriteCallbacks.storeEntityWithVersionAndCaptureJson(
                        context, entity, true, version))),
        new EntityHistoryServices.Hydration<>(
            id -> context.services().getLookupService().byId(id, ALL),
            new EntityVersionHistory.Hydration<>(
                entity -> context.policy().setFieldsInternal(entity, context.putFields()),
                entity -> context.policy().setInheritedFields(entity, context.putFields())),
            entities -> {
              context.policy().setFieldsInBulk(context.putFields(), entities);
              context.policy().hydrateHistoryEntities(entities);
            }),
        new EntityHistoryServices.Changes(
            context.fieldPolicy().summaryFields(context.writeFields().summaries()),
            EntityUpdater::getSessionTimeout));
  }

  static <T extends EntityInterface> EntitySummaryWriter assembleSummaryWriter(
      EntityPolicyContext<T> context) {
    return EntityMutationAssembly.createSummaryWriter(context);
  }

  static <T extends EntityInterface> EntityUpdateContext<T> assembleUpdaterServices(
      EntityPolicyContext<T> context) {
    return EntityMutationAssembly.createUpdateContext(context);
  }

  static <T extends EntityInterface> EntityMetadataPersistence<T> assembleMetadataPersistence(
      EntityPolicyContext<T> context) {
    return EntityMetadataAssembly.createMetadataPersistence(context);
  }

  static <T extends EntityInterface> void initialize(EntityPolicyContext<T> context) {
    context.services().queries = EntityQueryAssembly.assembleQueries(context);
    context.services().historyServices = EntityQueryAssembly.assembleHistoryServices(context);
    context.services().summaryWriter = EntityQueryAssembly.assembleSummaryWriter(context);
    context.services().updaterServices = EntityQueryAssembly.assembleUpdaterServices(context);
    context.services().metadataPersistence =
        EntityQueryAssembly.assembleMetadataPersistence(context);
  }
}
