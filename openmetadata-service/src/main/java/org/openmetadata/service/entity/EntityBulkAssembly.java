package org.openmetadata.service.entity;

import static org.openmetadata.schema.type.Include.NON_DELETED;

import io.micrometer.core.instrument.Metrics;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.bulk.EntityBulkJobs;
import org.openmetadata.service.entity.bulk.EntityBulkMetrics;
import org.openmetadata.service.entity.bulk.EntityBulkOperations;
import org.openmetadata.service.entity.bulk.EntityBulkService;
import org.openmetadata.service.entity.bulk.EntityBulkUpdateService;
import org.openmetadata.service.entity.bulk.EntityCsvChangeLog;
import org.openmetadata.service.entity.bulk.EntityStaleDeletion;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.entity.write.EntityEventService;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntityUnitOfWork;
import org.openmetadata.service.formatter.util.FormatterUtil;
import org.openmetadata.service.util.PostCommitActionQueue;

final class EntityBulkAssembly {

  private EntityBulkAssembly() {}

  static <T extends EntityInterface> EntityBulkUpdateService<T> createBulkUpdateService(
      EntityPolicyContext<T> context) {
    final var preparation =
        new EntityBulkUpdateService.Preparation<T>(
            context.schema().entityClass(),
            entities -> context.policy().setFieldsInBulk(context.putFields(), entities),
            entities ->
                context
                    .policy()
                    .setInheritedFields(
                        entities, context.policy().getBulkUpdateInheritanceFields()),
            (actor, id) -> context.policy().restores().restore(actor, id));
    final var persistence =
        new EntityBulkUpdateService.Persistence<T>(
            (original, updated) ->
                context.policy().getUpdater(original, updated, EntityOperation.PUT, null),
            context.services().getHistoryServices().versionStore()::insertMany,
            entities -> context.policy().persistence().updateMany(entities));
    final var boundary =
        new EntityBulkUpdateService.Boundary<T>(
            context.policy()::executeInTransaction,
            EntityUnitOfWork::isActive,
            effect ->
                PostCommitActionQueue.runOrDefer(() -> PostCommitActionQueue.run(List.of(effect))));
    final var effects =
        new EntityBulkUpdateService.Effects<T>(
            context.policy()::invalidateMany,
            context.policy()::postUpdate,
            (value0, value1) ->
                EntityBulkCallbacks.publishBulkUpdateEvents(context, value0, value1),
            elapsed -> context.services().getBulkMetrics().recordEntity(elapsed, 0, true));
    return new EntityBulkUpdateService<>(
        preparation, persistence, boundary, effects, context.dependencies().clock());
  }

  static <T extends EntityInterface> EntityCsvChangeLog<T> createCsvChangeLog(
      EntityPolicyContext<T> context) {
    final var preparation =
        new EntityCsvChangeLog.Preparation<T>(
            context.schema().entityClass(),
            id -> context.services().getLookupService().byId(id, NON_DELETED, false),
            entity -> context.policy().setFieldsInternal(entity, context.policy().getPutFields()),
            entity -> context.policy().setInheritedFields(entity, context.policy().getPutFields()));
    final var persistence =
        new EntityCsvChangeLog.Persistence<T>(
            context.services().getHistoryServices().versionStore()::insert,
            (entity, json) ->
                context.schema().dao().update(entity.getId(), entity.getFullyQualifiedName(), json),
            entity ->
                context
                    .policy()
                    .getChangeEvent(
                        entity,
                        entity.getChangeDescription(),
                        context.schema().entityType(),
                        entity.getChangeDescription().getPreviousVersion()),
            json -> context.dependencies().daos().changeEventDAO().insert(json));
    final var boundary =
        new EntityCsvChangeLog.Boundary(
            work ->
                context
                    .policy()
                    .executeInTransaction(
                        () -> {
                          work.run();
                          return null;
                        }),
            PostCommitActionQueue::runOrDefer);
    return new EntityCsvChangeLog<>(
        preparation,
        persistence,
        boundary,
        context.policy()::invalidate,
        context.dependencies().clock());
  }

  static <T extends EntityInterface> EntityCsvChangeLog<T> assembleCsvChangeLog(
      EntityPolicyContext<T> context) {
    return EntityBulkAssembly.createCsvChangeLog(context);
  }

  static <T extends EntityInterface> EntityBulkMetrics assembleBulkMetrics(
      EntityPolicyContext<T> context) {
    return new EntityBulkMetrics(context.schema().entityType(), Metrics.globalRegistry);
  }

  static <T extends EntityInterface> EntityBulkUpdateService<T> assembleBulkUpdateService(
      EntityPolicyContext<T> context) {
    return EntityBulkAssembly.createBulkUpdateService(context);
  }

  static <T extends EntityInterface> EntityEventService<T> assembleEventService(
      EntityPolicyContext<T> context) {
    return new EntityEventService<>(
        FormatterUtil::createChangeEventForEntity,
        event -> context.dependencies().daos().changeEventDAO().insert(event),
        events -> context.dependencies().daos().changeEventDAO().insertBatch(events));
  }

  static <T extends EntityInterface> EntityBulkOperations<T> assembleBulk(
      EntityPolicyContext<T> context) {
    final EntityStaleDeletion staleDeletion =
        new EntityStaleDeletion(
            context.schema().entityType(),
            new EntityStaleDeletion.Scopes(
                Entity::hasEntityRepository,
                (type, fqn) ->
                    Entity.getEntityRepository(type).lookup().byNameOrNull(fqn, NON_DELETED)
                        != null,
                Entity::getServiceType),
            context.schema().dao()::listDescendantIdFqnByPrefixNonDeleted,
            (actor, id, recursive, hardDelete) ->
                context.policy().deletes().internalById(actor, id, recursive, hardDelete));
    return new EntityBulkService<>(
        new EntityBulkService.Creators<>(
            (value0) -> EntityWriteCallbacks.createManyEntities(context, value0),
            (uri, entity, actor) ->
                context
                    .policy()
                    .creates()
                    .upsert(uri, entity, new EntityCommandActor(actor, null), false)),
        names -> context.schema().dao().findEntityByNames(names, Include.ALL),
        new EntityBulkService.Services<>(
            context.services().getBulkUpdateService(),
            new EntityBulkService.Events<>(
                context.policy()::buildChangeEventJsonForBulkOperation,
                context.services().getEventService()::insert,
                context.policy()::insertChangeEventsBatch),
            context.services().getBulkMetrics(),
            EntityBulkJobs.shared(),
            staleDeletion));
  }

  static <T extends EntityInterface> void initialize(EntityPolicyContext<T> context) {
    context.services().csvChangeLog = EntityBulkAssembly.assembleCsvChangeLog(context);
    context.services().bulkMetrics = EntityBulkAssembly.assembleBulkMetrics(context);
    context.services().bulkUpdateService = EntityBulkAssembly.assembleBulkUpdateService(context);
    context.services().eventService = EntityBulkAssembly.assembleEventService(context);
    context.services().bulk = EntityBulkAssembly.assembleBulk(context);
  }
}
