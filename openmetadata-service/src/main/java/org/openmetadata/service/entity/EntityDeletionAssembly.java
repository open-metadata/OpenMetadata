package org.openmetadata.service.entity;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.utils.EntityInterfaceUtil.quoteName;
import static org.openmetadata.service.Entity.FIELD_DELETED;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.ListCountCache;
import org.openmetadata.service.entity.delete.EntityChildDeletion;
import org.openmetadata.service.entity.delete.EntityDeleteCommands;
import org.openmetadata.service.entity.delete.EntityDeletes;
import org.openmetadata.service.entity.delete.EntityDeletionGuard;
import org.openmetadata.service.entity.delete.EntityDeletionPersistence;
import org.openmetadata.service.entity.delete.EntityDeletionReader;
import org.openmetadata.service.entity.delete.EntityDeletionService;
import org.openmetadata.service.entity.delete.EntityDependentCleanup;
import org.openmetadata.service.entity.delete.EntityHardDeletion;
import org.openmetadata.service.entity.delete.EntityHierarchy;
import org.openmetadata.service.entity.delete.EntityRestoreService;
import org.openmetadata.service.entity.delete.EntityRestores;
import org.openmetadata.service.entity.delete.EntitySubtreeLifecycle;
import org.openmetadata.service.entity.delete.EntitySubtreeUpdates;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.policy.EntityPolicySupport;
import org.openmetadata.service.entity.read.EntityReadService;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.PostCommitActionQueue;

final class EntityDeletionAssembly {

  private EntityDeletionAssembly() {}

  static <T extends EntityInterface> EntityDeletionService<T> createDeletionService(
      EntityPolicyContext<T> context) {
    final var reader =
        new EntityDeletionReader<T>(
            context.schema().entityType(),
            entity -> context.policy().setFieldsInternal(entity, context.putFields()),
            new EntityDeletionReader.Queries<>(
                id ->
                    context
                        .policy()
                        .reads()
                        .byId(
                            id,
                            new EntityReadService.Query(
                                null,
                                context.putFields(),
                                RelationIncludes.fromInclude(ALL),
                                false)),
                id -> context.policy().lookup().byId(id, ALL)));
    final var preparation =
        new EntityDeletionService.Preparation<T>(
            context.policy()::checkSystemEntityDeletion,
            context.policy()::preDelete,
            reader::hydrate,
            reader::load);
    final var children =
        new EntityDeletionService.Children(
            (id, request) ->
                context
                    .policy()
                    .deleteChildren(id, request.recursive(), request.hardDelete(), request.actor()),
            context.policy()::softDeleteAdditionalChildren,
            context.policy()::hardDeleteAdditionalChildren);
    final var mutation =
        new EntityDeletionService.Mutation<T>(
            context.supports(FIELD_DELETED),
            (original, updated) ->
                context
                    .policy()
                    .getUpdater(original, updated, EntityOperation.SOFT_DELETE, null)
                    .update(),
            context.policy()::cleanup);
    return new EntityDeletionService<>(
        preparation,
        children,
        mutation,
        new EntityDeletionGuard(
            context.schema().entityType(), () -> EntityPolicySupport.lockManager),
        context.dependencies().clock());
  }

  static <T extends EntityInterface> EntityRestoreService<T> createRestoreService(
      EntityPolicyContext<T> context) {
    final var preparation =
        new EntityRestoreService.Preparation<T>(
            context.services().getLookupService()::byId,
            entity -> context.policy().setFieldsInternal(entity, context.putFields(), ALL),
            entity -> context.policy().setInheritedFields(entity, context.putFields()));
    final var children =
        new EntityRestoreService.Children(
            context.policy()::restoreChildren, context.policy()::restoreAdditionalChildren);
    final var mutation =
        new EntityRestoreService.Mutation<T>(
            context.schema().entityClass(),
            (original, updated) ->
                context.policy().getUpdater(original, updated, EntityOperation.PUT, null).update(),
            () -> ListCountCache.invalidate(context.schema().entityType()));
    return new EntityRestoreService<>(
        context.schema().entityType(),
        preparation,
        children,
        mutation,
        context.dependencies().clock());
  }

  static <T extends EntityInterface> EntitySubtreeLifecycle<T> createSubtreeLifecycle(
      EntityPolicyContext<T> context) {
    final var loading =
        new EntitySubtreeLifecycle.Loading<T>(
            context.supports(FIELD_DELETED),
            ids -> context.services().getLookupService().byIds(ids, ALL));
    final var hooks =
        new EntitySubtreeLifecycle.Hooks<T>(
            (entity, actor) -> {
              context.policy().checkSystemEntityDeletion(entity);
              context.policy().preDelete(entity, actor);
            },
            context.policy()::restoreAdditionalChildren,
            context.policy()::softDeleteAdditionalChildren,
            (id, actor) ->
                Entity.deleteEntity(actor, context.schema().entityType(), id, true, false));
    return new EntitySubtreeLifecycle<>(
        loading,
        hooks,
        context.services().getHierarchy(),
        context.services().getSubtreeUpdates(),
        context.services().getHardDeletion()::delete);
  }

  static <T extends EntityInterface> EntitySubtreeUpdates<T> createSubtreeUpdates(
      EntityPolicyContext<T> context) {
    final var preparation =
        new EntitySubtreeUpdates.Preparation<T>(
            context.schema().entityClass(),
            (value0) -> EntityDeletionCallbacks.hydrateRelationsForBulkUpdater(context, value0));
    final var rows =
        new EntitySubtreeUpdates.Rows<T>(
            context.services().getHistoryServices().versionStore()::insertMany,
            entities -> context.policy().persistence().updateMany(entities),
            context.policy()::executeInTransaction);
    final var effects =
        new EntitySubtreeUpdates.Effects<T>(
            context.policy()::invalidateMany,
            entities ->
                EntityLifecycleEventDispatcher.getInstance()
                    .onEntitiesUpdated(entities, null, null),
            () -> ListCountCache.invalidate(context.schema().entityType()),
            PostCommitActionQueue::runOrDefer);
    return new EntitySubtreeUpdates<>(
        preparation,
        (original, updated, mode) ->
            context
                .policy()
                .getUpdater(
                    original,
                    updated,
                    mode == EntitySubtreeUpdates.Mode.SOFT_DELETE
                        ? EntityOperation.SOFT_DELETE
                        : EntityOperation.PUT,
                    null),
        rows,
        effects,
        context.dependencies().clock());
  }

  static <T extends EntityInterface> EntityHardDeletion<T> createHardDeletion(
      EntityPolicyContext<T> context) {
    final var preparation =
        new EntityHardDeletion.Preparation<T>(
            ids -> context.services().getLookupService().byIds(ids, ALL),
            context.policy()::enterBulkHardDeleteCascade,
            (value0) -> EntityDeletionCallbacks.populateRelationFields(context, value0),
            (entity, actor) -> {
              context.policy().checkSystemEntityDeletion(entity);
              context.policy().preDelete(entity, actor);
            });
    final var cleanup =
        new EntityHardDeletion.Cleanup<T>(
            context.policy()::bulkEntitySpecificCleanup,
            context.policy()::hardDeleteAdditionalChildren,
            entities -> context.services().getDeletionPersistence().deleteMany(entities));
    final var completion =
        new EntityHardDeletion.Completion<T>(
            (value0) -> EntityDeletionCallbacks.bulkInvalidate(context, value0),
            entity -> context.policy().postDelete(entity, true),
            entity -> context.policy().deleteFromSearch(entity, true),
            () -> context.options().isDescendantsCoveredByAncestorCascade());
    return new EntityHardDeletion<>(
        preparation,
        cleanup,
        completion,
        context.services().getHierarchy(),
        EntityPolicySupport.BULK_HARD_DELETE_TXN_CHUNK_SIZE);
  }

  static <T extends EntityInterface> EntityDeletionPersistence<T> createDeletionPersistence(
      EntityPolicyContext<T> context) {
    return new EntityDeletionPersistence<>(
        new EntityDeletionPersistence.Schema<>(
            context.schema().entityType(), context.schema().dao(), context.dependencies().daos()),
        new EntityDeletionPersistence.Policy(
            new EntityDependentCleanup.Policy(
                context.policy()::shouldCleanupFqnDependents,
                () -> context.options().isDescendantsCoveredByAncestorCascade()),
            () -> context.dependencies().jdbi() != null),
        new EntityDeletionPersistence.Hooks<>(
            context.policy()::entitySpecificCleanup,
            context.policy()::invalidate,
            (value0) -> EntityDeletionCallbacks.markEntityNotFound(context, value0)),
        work ->
            context
                .policy()
                .executeInTransaction(
                    () -> {
                      work.run();
                      return null;
                    }));
  }

  static <T extends EntityInterface> EntityHierarchy<T> assembleHierarchy(
      EntityPolicyContext<T> context) {
    return new EntityHierarchy<>(
        context.schema().entityType(),
        () -> context.dependencies().daos().relationshipDAO(),
        new EntityHierarchy.Registry(
            type -> Entity.getEntityModule(type).subtrees(), Entity::isTimeSeriesEntity),
        context.policy()::prepareChildrenForHardDeleteCascade);
  }

  static <T extends EntityInterface> EntityChildDeletion assembleChildDeletion(
      EntityPolicyContext<T> context) {
    return new EntityChildDeletion(
        context.schema().entityType(),
        () -> context.dependencies().daos().relationshipDAO(),
        new EntityChildDeletion.Hooks(
            context.policy()::prepareChildrenForHardDeleteCascade,
            context.policy()::deleteChildren));
  }

  static <T extends EntityInterface> EntityHardDeletion<T> assembleHardDeletion(
      EntityPolicyContext<T> context) {
    return EntityDeletionAssembly.createHardDeletion(context);
  }

  static <T extends EntityInterface> EntitySubtreeUpdates<T> assembleSubtreeUpdates(
      EntityPolicyContext<T> context) {
    return EntityDeletionAssembly.createSubtreeUpdates(context);
  }

  static <T extends EntityInterface> EntitySubtreeLifecycle<T> assembleSubtreeLifecycle(
      EntityPolicyContext<T> context) {
    return EntityDeletionAssembly.createSubtreeLifecycle(context);
  }

  static <T extends EntityInterface> EntityRestores<T> assembleRestoreService(
      EntityPolicyContext<T> context) {
    return EntityDeletionAssembly.createRestoreService(context);
  }

  static <T extends EntityInterface> EntityDeletes<T> assembleDeletes(
      EntityPolicyContext<T> context) {
    return new EntityDeleteCommands<>(
        new EntityDeleteCommands.Readers<>(
            id -> context.policy().lookup().byId(id, ALL),
            name -> context.policy().lookup().byName(name, ALL),
            name -> context.policy().lookup().byNameOrNull(name, ALL)),
        name -> context.options().isQuoteFqn() ? quoteName(name) : name,
        EntityDeletionAssembly.createDeletionService(context),
        new EntityDeleteCommands.Completion<>(
            context.policy()::postDelete, context.policy()::deleteFromSearch));
  }

  static <T extends EntityInterface> EntityDeletionPersistence<T> assembleDeletionPersistence(
      EntityPolicyContext<T> context) {
    return EntityDeletionAssembly.createDeletionPersistence(context);
  }

  static <T extends EntityInterface> void initialize(EntityPolicyContext<T> context) {
    context.services().hierarchy = EntityDeletionAssembly.assembleHierarchy(context);
    context.services().childDeletion = EntityDeletionAssembly.assembleChildDeletion(context);
    context.services().hardDeletion = EntityDeletionAssembly.assembleHardDeletion(context);
    context.services().subtreeUpdates = EntityDeletionAssembly.assembleSubtreeUpdates(context);
    context.services().subtreeLifecycle = EntityDeletionAssembly.assembleSubtreeLifecycle(context);
    context.services().restoreService = EntityDeletionAssembly.assembleRestoreService(context);
    context.services().deletes = EntityDeletionAssembly.assembleDeletes(context);
    context.services().deletionPersistence =
        EntityDeletionAssembly.assembleDeletionPersistence(context);
  }
}
