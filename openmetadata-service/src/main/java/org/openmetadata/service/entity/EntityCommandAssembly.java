package org.openmetadata.service.entity;

import static org.openmetadata.schema.type.Include.ALL;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.bulk.EntityBulkPreparation;
import org.openmetadata.service.entity.cache.EntityCaches;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.policy.EntityPolicySupport;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.entity.write.EntityCommands;
import org.openmetadata.service.entity.write.EntityCreateWorkflow;
import org.openmetadata.service.entity.write.EntityImportBatch;
import org.openmetadata.service.entity.write.EntityImportCommands;
import org.openmetadata.service.entity.write.EntityImportService;
import org.openmetadata.service.entity.write.EntityImports;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntityPatchPreparation;
import org.openmetadata.service.entity.write.EntityUpdateFactory;
import org.openmetadata.service.rules.RuleEngine;
import org.openmetadata.service.util.EntityUtil.Fields;

final class EntityCommandAssembly {

  private EntityCommandAssembly() {}

  static <T extends EntityInterface> EntityImportService<T> createImportService(
      EntityPolicyContext<T> context) {
    final var rows =
        new EntityImportService.Rows<T>(
            context.policy()::storeEntities,
            entities -> context.policy().persistence().updateMany(entities));
    final var metadata =
        new EntityImportService.Metadata<T>(
            entities -> context.policy().extensions().removeMany(entities),
            entities -> context.policy().extensions().storeMany(entities),
            context.services().getMetadataPersistence()::clearMany,
            context.services().getMetadataPersistence()::storeMany,
            entity ->
                EntityCaches.invalidations()
                    .referencesChanged(
                        context.schema().entityType(),
                        entity.getId(),
                        entity.getFullyQualifiedName()));
    final var effects =
        new EntityImportService.Effects<T>(
            entities ->
                context.policy().setInheritedFields(entities, new Fields(context.allowedFields())),
            context.policy()::postCreate,
            context.services().getPersistence()::publishMany);
    final var boundary =
        new EntityImportService.Boundary<T>(
            entities -> {
              if (EntityPolicySupport.lockManager != null) {
                EntityPolicySupport.lockManager.checkModificationsAllowed(entities);
              }
            },
            (value0) -> EntityWriteCallbacks.flushAndCaptureStoredJson(context, value0));
    return new EntityImportService<>(
        rows, metadata, effects, boundary, context.dependencies().clock());
  }

  static <T extends EntityInterface> EntityCreateWorkflow<T> createCreationWorkflow(
      EntityPolicyContext<T> context) {
    final var writes =
        new EntityCreateWorkflow.Writes<T>(
            entity -> context.policy().storeEntityAndCaptureJson(entity, false),
            entity -> context.policy().extensions().store(entity),
            entity ->
                context
                    .policy()
                    .extensions()
                    .storeColumns(
                        entity.getId(), context.policy().getColumnsForExtensionPersistence(entity)),
            context.services().getMetadataPersistence()::store);
    final var effects =
        new EntityCreateWorkflow.Effects<T>(
            entity ->
                context.policy().setInheritedFields(entity, new Fields(context.allowedFields())),
            context.policy()::postCreate,
            entity -> context.policy().writeThroughCache(entity, false),
            context.services().getPersistence()::clearStored);
    final var batch =
        new EntityCreateWorkflow.Batch<T>(
            context.policy()::storeEntities,
            entities -> context.policy().extensions().storeMany(entities),
            context.services().getMetadataPersistence()::storeMany,
            entities ->
                context.policy().setInheritedFields(entities, new Fields(context.allowedFields())),
            context.policy()::postCreate);
    return new EntityCreateWorkflow<>(
        writes,
        effects,
        batch,
        context.policy()::flushInOneTransaction,
        EntityPolicySupport.BULK_CREATE_TXN_CHUNK_SIZE);
  }

  static <T extends EntityInterface> EntityCommands<T> createCommands(
      EntityPolicyContext<T> context) {
    return new EntityCommands<>(
        new EntityCommands.Selections(
            context.putFields(), context.patchFields(), () -> new Fields(context.allowedFields())),
        new EntityCommands.Reads<>(
            context.schema().entityClass(),
            name -> context.services().getLookupService().byNameOrNull(name, ALL),
            context.services().getQueries().reads(),
            context.policy()::setFieldsInternal),
        new EntityCommands.Policies<>(
            context.policy()::setInheritedFields,
            context.policy()::withHref,
            entity -> context.policy().preparation().prepare(entity, false),
            EntityCommandAssembly.createPatchPreparation(context)),
        new EntityCommands.Writes<>(
            EntityCommandAssembly.updateFactory(context, EntityOperation.PUT),
            EntityCommandAssembly.updateFactory(context, EntityOperation.PATCH),
            (actor, id) -> context.policy().restores().restore(actor, id),
            entity -> {
              if (EntityPolicySupport.lockManager != null) {
                EntityPolicySupport.lockManager.checkModificationAllowed(entity);
              }
            },
            context.policy()::createNewEntity),
        context.dependencies().clock());
  }

  static <T extends EntityInterface> EntityUpdateFactory<T> updateFactory(
      EntityPolicyContext<T> context, EntityOperation operation) {
    return (original, updated, source, optimistic) ->
        optimistic
            ? context.policy().getUpdater(original, updated, operation, source, true)
            : context.policy().getUpdater(original, updated, operation, source);
  }

  static <T extends EntityInterface> EntityPatchPreparation<T> createPatchPreparation(
      EntityPolicyContext<T> context) {
    final var rules =
        new EntityPatchPreparation.Rules<T>(
            entity -> context.policy().preparation().prepare(entity, true),
            (original, updated) -> RuleEngine.getInstance().evaluateUpdate(original, updated),
            context.policy()::restorePatchAttributes);
    final var references =
        new EntityPatchPreparation.References(
            context.policy().referenceValidation()::validatedOwners,
            context.policy()::getValidatedDomains);
    return new EntityPatchPreparation<>(
        context.policy()::restorePatchSecrets, rules, references, context.dependencies().clock());
  }

  static <T extends EntityInterface> EntityCommands<T> assembleCommands(
      EntityPolicyContext<T> context) {
    return EntityCommandAssembly.createCommands(context);
  }

  static <T extends EntityInterface> EntityCreateWorkflow<T> assembleCreateWorkflow(
      EntityPolicyContext<T> context) {
    return EntityCommandAssembly.createCreationWorkflow(context);
  }

  static <T extends EntityInterface> EntityImports<T> assembleImports(
      EntityPolicyContext<T> context) {
    final EntityImportService<T> importService = EntityCommandAssembly.createImportService(context);
    final EntityImportBatch<T> importBatch =
        new EntityImportBatch<>(
            name -> context.services().getLookupService().byNameOrNull(name, ALL),
            new EntityImportBatch.Writes<>(
                entities -> importService.create(entities, null),
                (originals, updates, actor) ->
                    importService.update(originals, updates, new EntityCommandActor(actor, null))));
    return new EntityImportCommands<>(
        importService,
        importBatch,
        context.policy().createImportPolicy(),
        (uri, entity, actor) -> context.policy().creates().upsert(uri, entity, actor, true));
  }

  static <T extends EntityInterface> void initialize(EntityPolicyContext<T> context) {
    context.services().bulkPreparation = createBulkPreparation(context);
    context.services().commands = EntityCommandAssembly.assembleCommands(context);
    context.services().createWorkflow = EntityCommandAssembly.assembleCreateWorkflow(context);
    context.services().imports = EntityCommandAssembly.assembleImports(context);
  }

  static <T extends EntityInterface> EntityBulkPreparation<T> createBulkPreparation(
      EntityPolicyContext<T> context) {
    return new EntityBulkPreparation<>(
        new EntityBulkPreparation.Hooks<>(
            context.policy()::getParentReference,
            context.policy()::preloadParentReferences,
            entity -> context.policy().preparation().prepare(entity, false),
            context.policy()::clearParentCache));
  }
}
