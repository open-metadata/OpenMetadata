package org.openmetadata.service.entity;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.Entity.findEntityByNameOrNull;
import static org.openmetadata.service.util.LineageUtil.addDataProductsLineage;
import static org.openmetadata.service.util.LineageUtil.removeDataProductsLineage;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.ListCountCache;
import org.openmetadata.service.entity.cache.EntityCaches;
import org.openmetadata.service.entity.history.EntitySummaryWriter;
import org.openmetadata.service.entity.metadata.CustomPropertyValidator;
import org.openmetadata.service.entity.metadata.EntityCertificationUpdates;
import org.openmetadata.service.entity.metadata.EntityGovernanceUpdates;
import org.openmetadata.service.entity.metadata.EntityReferenceValidator;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.policy.EntityPolicySupport;
import org.openmetadata.service.entity.write.EntityLifecyclePublisher;
import org.openmetadata.service.entity.write.EntityMutationLifecycle;
import org.openmetadata.service.entity.write.EntityMutationPermissions;
import org.openmetadata.service.entity.write.EntityMutationServices;
import org.openmetadata.service.entity.write.EntityPreparation;
import org.openmetadata.service.entity.write.EntityUpdateContext;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.rdf.RdfUpdater;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.security.policyevaluator.PolicyEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.DescriptionSanitizer;

final class EntityMutationAssembly {

  private EntityMutationAssembly() {}

  static <T extends EntityInterface> EntityLifecyclePublisher<T> createLifecyclePublisher(
      EntityPolicyContext<T> context) {
    final var writes =
        new EntityLifecyclePublisher.Writes<T>(
            entity -> EntityLifecycleEventDispatcher.getInstance().onEntityCreated(entity, null),
            entities ->
                EntityLifecycleEventDispatcher.getInstance().onEntitiesCreated(entities, null),
            entity ->
                EntityLifecycleEventDispatcher.getInstance()
                    .onEntityUpdated(entity, entity.getChangeDescription(), null),
            entities ->
                EntityLifecycleEventDispatcher.getInstance()
                    .onEntitiesUpdated(entities, null, null));
    final var deletes =
        new EntityLifecyclePublisher.Deletes<T>(
            entity -> EntityLifecycleEventDispatcher.getInstance().onEntityDeleted(entity, null),
            (entity, deleted) ->
                EntityLifecycleEventDispatcher.getInstance()
                    .onEntitySoftDeletedOrRestored(entity, deleted, null));
    final var projections =
        new EntityLifecyclePublisher.Projections<T>(
            RdfUpdater::updateEntity,
            entity -> RdfUpdater.deleteEntity(entity.getEntityReference()),
            () -> ListCountCache.invalidate(context.schema().entityType()),
            entity ->
                EntityPolicySupport.deferCacheBundleInvalidation(
                    context.schema().entityType(), entity.getId(), entity.getFullyQualifiedName()),
            entities -> context.policy().writeThroughCacheMany(entities, true));
    return new EntityLifecyclePublisher<>(writes, deletes, projections);
  }

  static <T extends EntityInterface> EntitySummaryWriter createSummaryWriter(
      EntityPolicyContext<T> context) {
    return new EntitySummaryWriter(
        context.schema().entityType(),
        new EntitySummaryWriter.Rows(
            id -> context.schema().dao().findSummaryForUpdate(id, NON_DELETED),
            stored ->
                context
                    .schema()
                    .dao()
                    .updateChangeDescription(stored.id(), stored.changeDescriptionJson())),
        new EntitySummaryWriter.Boundary(
            work ->
                context
                    .policy()
                    .executeInTransaction(
                        () -> {
                          work.run();
                          return null;
                        }),
            stored ->
                EntityCaches.invalidations()
                    .referencesChanged(
                        context.schema().entityType(), stored.id(), stored.fullyQualifiedName())),
        context.dependencies().clock());
  }

  static <T extends EntityInterface> EntityUpdateContext<T> createUpdateContext(
      EntityPolicyContext<T> context) {
    return EntityMutationServices.create(
        new EntityMutationServices.Schema<>(
            context.schema().entityType(), context.schema().entityClass(), context.allowedFields()),
        new EntityMutationServices.Metadata<>(
            context.dependencies().daos(),
            context.services().getRelationshipUpdates(),
            context.services().getOwnershipWriter(),
            context.services().getTagWriter(),
            context.services().getExtensionService()),
        new EntityMutationServices.Policies<>(
            DescriptionSanitizer::sanitize,
            value ->
                CustomPropertyValidator.shared()
                    .validateAndTransform(value, context.schema().entityType()),
            new EntityMutationServices.Governance(
                new EntityGovernanceUpdates.Validation(
                    context.policy()::validateDataProducts,
                    context.policy().referenceValidation()::users,
                    EntityReferenceValidator.shared()::reviewers),
                new EntityGovernanceUpdates.Lineage(
                    (id, type, refs) -> removeDataProductsLineage(id, type, refs),
                    (id, type, refs) -> addDataProductsLineage(id, type, refs)),
                EntityPolicySupport.REVIEWER_POLICY::check),
            new EntityMutationServices.Certification<>(
                () -> Entity.getSystemRepository().getAssetCertificationSettingOrDefault(),
                new EntityCertificationUpdates.Persistence<>(
                    fqn -> context.policy().certification().delete(fqn),
                    entity -> context.policy().certification().apply(entity)),
                context.policy()::getCertificationClassification,
                TagLabelUtil::checkMutuallyExclusive)),
        new EntityMutationServices.Execution<>(
            context.services().getHistoryServices(),
            new EntityMutationLifecycle.Execution<>(
                context.policy()::flushInOneTransaction,
                context.services().getHistoryServices().updateWorkflow()::flush,
                context.services().getPersistence()::clearStored),
            context.policy()::postUpdate,
            new EntityUpdateContext.Hooks<>(
                name -> findEntityByNameOrNull(USER, name, ALL),
                user ->
                    new EntityMutationPermissions(
                        () ->
                            PolicyEvaluator.getPermission(
                                SubjectContext.getSubjectContext(user.getName()),
                                context.schema().entityType())),
                context.policy()::updateOwners,
                (value0, value1) ->
                    EntityWriteCallbacks.publishUpdatedEntity(context, value0, value1)),
            context.dependencies().clock()));
  }

  static <T extends EntityInterface> EntityPreparation<T> assemblePreparation(
      EntityPolicyContext<T> context) {
    return new EntityPreparation<>(
        new EntityPreparation.Steps<>(
            context.policy()::validateTags,
            context.policy()::prepare,
            context.policy()::setFullyQualifiedName,
            (value0, value1) -> EntityWriteCallbacks.validateExtension(context, value0, value1),
            (entity, update) -> {
              context.policy().setDefaultStatus(entity, update);
              // Unrelated PATCHes must tolerate a stored certification after settings change.
              if (!update) {
                context
                    .services()
                    .getUpdaterServices()
                    .metadata()
                    .plan()
                    .prepareCertification(entity);
              }
            }));
  }

  static <T extends EntityInterface> EntityLifecyclePublisher<T> assembleLifecyclePublisher(
      EntityPolicyContext<T> context) {
    return EntityMutationAssembly.createLifecyclePublisher(context);
  }

  static <T extends EntityInterface> void initialize(EntityPolicyContext<T> context) {
    context.services().preparation = EntityMutationAssembly.assemblePreparation(context);
    context.services().lifecyclePublisher =
        EntityMutationAssembly.assembleLifecyclePublisher(context);
  }
}
