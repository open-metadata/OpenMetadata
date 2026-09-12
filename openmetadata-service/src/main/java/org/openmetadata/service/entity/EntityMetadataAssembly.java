package org.openmetadata.service.entity;

import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.FIELD_CERTIFICATION;
import static org.openmetadata.service.Entity.FIELD_EXTENSION;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.FIELD_VOTES;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.Entity.getEntityReferenceById;
import static org.openmetadata.service.util.LineageUtil.addDomainLineage;
import static org.openmetadata.service.util.LineageUtil.removeDomainLineage;

import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.entity.cache.EntityCaches;
import org.openmetadata.service.entity.metadata.DerivedTagLoader;
import org.openmetadata.service.entity.metadata.EntityAssetMembership;
import org.openmetadata.service.entity.metadata.EntityCertificationService;
import org.openmetadata.service.entity.metadata.EntityExtensionService;
import org.openmetadata.service.entity.metadata.EntityMetadataCleanup;
import org.openmetadata.service.entity.metadata.EntityMetadataPersistence;
import org.openmetadata.service.entity.metadata.EntityMetadataWriter;
import org.openmetadata.service.entity.metadata.EntityOwnershipWriter;
import org.openmetadata.service.entity.metadata.EntityRelationshipUpdates;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.metadata.EntityTagReader;
import org.openmetadata.service.entity.metadata.EntityTagWriter;
import org.openmetadata.service.entity.metadata.EntityUserActions;
import org.openmetadata.service.entity.metadata.EntityWorkflowReferences;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityMetadataHydrator;
import org.openmetadata.service.entity.read.EntityMetadataReads;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.rdf.RdfTagUpdater;
import org.openmetadata.service.rdf.RdfUpdater;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;

final class EntityMetadataAssembly {

  private EntityMetadataAssembly() {}

  static <T extends EntityInterface> EntityMetadataPersistence<T> createMetadataPersistence(
      EntityPolicyContext<T> context) {
    return new EntityMetadataPersistence<>(
        List.of(
            entity -> context.policy().storeOwners(entity, entity.getOwners()),
            context.policy()::applyTags,
            entity -> context.policy().storeDomains(entity, entity.getDomains()),
            entity -> context.policy().storeDataProducts(entity, entity.getDataProducts()),
            entity -> context.policy().storeReviewers(entity, entity.getReviewers()),
            entity -> context.policy().certification().apply(entity),
            context.policy()::storeRelationships),
        List.of(
            context.policy()::storeOwners,
            context.policy()::storeDomains,
            context.policy()::storeReviewers,
            context.policy()::storeDataProducts,
            context.policy()::applyTagsToEntities,
            entities -> context.policy().certification().applyMany(entities),
            context.policy()::storeEntitySpecificRelationshipsForMany),
        List.of(
            context.services().getMetadataCleanup()::clearMany,
            context.policy()::clearEntitySpecificRelationshipsForMany));
  }

  static <T extends EntityInterface> EntityTagReader<T> createTagReader(
      EntityPolicyContext<T> context) {
    return new EntityTagReader<>(
        () -> context.dependencies().daos().tagUsageDAO(),
        CacheBundle::getCachedTagUsageDao,
        context.services().getCertificationService(),
        new EntityTagReader.Hydration<>(
            TagLabelUtil::populateTagLabel,
            new DerivedTagLoader(
                TagLabelUtil::batchFetchDerivedTags,
                TagLabelUtil::addDerivedTagsWithPreFetched,
                TagLabelUtil::addDerivedTagsGracefully),
            entity -> context.policy().certification().read(entity)),
        new EntityTagReader.Options(
            context.schema().entityType(),
            context.supports(FIELD_TAGS),
            reason -> EntityQueryCallbacks.recordReadBundleFallback(context, FIELD_TAGS, reason)));
  }

  static <T extends EntityInterface> EntityRelationshipWriter assembleRelationshipWriter(
      EntityPolicyContext<T> context) {
    return new EntityRelationshipWriter(
        () -> context.dependencies().daos().relationshipDAO(),
        new EntityRelationshipWriter.Effects(
            RdfUpdater::addRelationship,
            RdfUpdater::removeRelationship,
            (type, id) -> EntityCaches.invalidations().referencesChanged(type, id, null)));
  }

  static <T extends EntityInterface> EntityRelationshipUpdates assembleRelationshipUpdates(
      EntityPolicyContext<T> context) {
    return new EntityRelationshipUpdates(
        () -> context.dependencies().daos().relationshipDAO(),
        context.services().getRelationshipWriter());
  }

  static <T extends EntityInterface> EntityWorkflowReferences assembleWorkflowReferences(
      EntityPolicyContext<T> context) {
    return new EntityWorkflowReferences(
        (oldHashes, newHashes) ->
            context.dependencies().daos().taskDAO().updateAboutFqnHashBatch(oldHashes, newHashes),
        subtree ->
            context
                .dependencies()
                .daos()
                .workflowInstanceTimeSeriesDAO()
                .repointRelatedEntitySubtree(
                    subtree.oldLink(),
                    subtree.oldChildPrefix(),
                    subtree.oldStem(),
                    subtree.newStem()));
  }

  static <T extends EntityInterface> EntityAssetMembership assembleAssetMembership(
      EntityPolicyContext<T> context) {
    return new EntityAssetMembership(
        new EntityAssetMembership.References(
            EntityUtil::populateEntityReferences,
            (value0, value1) ->
                EntityBulkCallbacks.loadMembershipAuditSource(context, value0, value1)),
        context.services().getRelationshipWriter(),
        new EntityAssetMembership.Effects(
            ref ->
                EntityCaches.invalidations()
                    .referencesChanged(ref.getType(), ref.getId(), ref.getFullyQualifiedName()),
            ref -> EntityLifecycleEventDispatcher.getInstance().onEntityUpdated(ref, null)),
        new EntityAssetMembership.Events(
            context.policy()::addBulkAddRemoveChangeDescription,
            context.policy()::getChangeEvent,
            event ->
                context.dependencies().daos().changeEventDAO().insert(JsonUtils.pojoToJson(event))),
        context.services().getUnitOfWork()::execute);
  }

  static <T extends EntityInterface> EntityExtensionService assembleExtensionService(
      EntityPolicyContext<T> context) {
    return new EntityExtensionService(
        () -> context.dependencies().daos().entityExtensionDAO(),
        new EntityExtensionService.Properties(
            TypeRegistry.getCustomPropertyFQNPrefix(context.schema().entityType()),
            field -> TypeRegistry.getCustomPropertyFQN(context.schema().entityType(), field),
            TypeRegistry::getPropertyName,
            field -> TypeRegistry.getCustomPropertyType(context.schema().entityType(), field)),
        context.supports(FIELD_EXTENSION));
  }

  static <T extends EntityInterface> EntityMetadataWriter assembleMetadataWriter(
      EntityPolicyContext<T> context) {
    return new EntityMetadataWriter(
        EntityMetadataWriter.Schema.fromFields(
            context.schema().entityType(), context.allowedFields()),
        context.services().getRelationshipWriter(),
        context.policy()::validateDomainsByRef,
        (id, domain) -> addDomainLineage(id, context.schema().entityType(), domain));
  }

  static <T extends EntityInterface> EntityMetadataCleanup assembleMetadataCleanup(
      EntityPolicyContext<T> context) {
    return new EntityMetadataCleanup(
        new EntityMetadataCleanup.Capabilities(
            EntityMetadataWriter.Schema.fromFields(
                context.schema().entityType(), context.allowedFields()),
            context.supports(FIELD_TAGS)),
        fqns -> context.dependencies().daos().tagUsageDAO().deleteTagsByTargets(fqns),
        selection ->
            context
                .policy()
                .deleteToMany(
                    selection.ids(),
                    selection.type(),
                    selection.relation(),
                    selection.relatedType()));
  }

  static <T extends EntityInterface> EntityOwnershipWriter<T> assembleOwnershipWriter(
      EntityPolicyContext<T> context) {
    return new EntityOwnershipWriter<>(
        context.schema().entityType(),
        () -> context.dependencies().daos().relationshipDAO(),
        context.services().getRelationshipWriter(),
        new EntityOwnershipWriter.Writes<>(
            context.policy()::storeOwners,
            context.policy()::storeDomains,
            (id, domain) -> removeDomainLineage(id, context.schema().entityType(), domain)));
  }

  static <T extends EntityInterface> EntityUserActions<T> assembleUserActions(
      EntityPolicyContext<T> context) {
    return new EntityUserActions<>(
        context.schema().entityType(),
        new EntityUserActions.Lookup<>(
            id -> context.services().getLookupService().byId(id, NON_DELETED),
            id -> context.dependencies().daos().userDAO().findEntityById(id),
            name -> context.dependencies().daos().userDAO().findEntityByName(name),
            id -> getEntityReferenceById(USER, id, NON_DELETED)),
        context.services().getRelationshipWriter(),
        new EntityUserActions.Hydration<>(
            entity -> context.policy().relationshipFields().followers(entity),
            entity ->
                context
                    .policy()
                    .setFieldsInternal(entity, new Fields(context.allowedFields(), FIELD_VOTES)),
            context.policy()::postUpdate));
  }

  static <T extends EntityInterface> EntityTagWriter assembleTagWriter(
      EntityPolicyContext<T> context) {
    return new EntityTagWriter(
        () -> context.dependencies().daos().tagUsageDAO(),
        new EntityTagWriter.Rdf(
            (tag, target) -> RdfTagUpdater.applyTag(tag, target.fqn(), target.type(), target.id()),
            (tag, target) ->
                RdfTagUpdater.removeTag(tag, target.fqn(), target.type(), target.id())));
  }

  static <T extends EntityInterface> EntityCertificationService<T> assembleCertificationService(
      EntityPolicyContext<T> context) {
    return new EntityCertificationService<>(
        () -> context.dependencies().daos().tagUsageDAO(),
        context.policy()::getCertificationClassification,
        context.supports(FIELD_CERTIFICATION),
        TagLabelUtil::applyTagCommonFieldsGracefully);
  }

  static <T extends EntityInterface> EntityTagReader<T> assembleTagReader(
      EntityPolicyContext<T> context) {
    return EntityMetadataAssembly.createTagReader(context);
  }

  static <T extends EntityInterface> EntityMetadataReads<T> assembleMetadataReads(
      EntityPolicyContext<T> context) {
    return new EntityMetadataReads<>(
        new EntityMetadataReads.Schema(
            context.schema().entityType(), context.allowedFields(), context.dependencies().daos()),
        new EntityMetadataReads.Hooks<>(
            context.policy()::getDomains,
            context.policy()::getChildren,
            new EntityMetadataHydrator.EntityFields<>(
                context.policy()::setFields, context.policy()::clearFields)),
        new EntityMetadataReads.Values<>(
            context.services().getTagReader()::read,
            context.services().getCertificationService()::read,
            context.services().getExtensionService()::read),
        (value0, value1) -> EntityQueryCallbacks.recordReadBundleFallback(context, value0, value1));
  }

  static <T extends EntityInterface> void initialize(EntityPolicyContext<T> context) {
    context.services().relationshipWriter =
        EntityMetadataAssembly.assembleRelationshipWriter(context);
    context.services().relationshipUpdates =
        EntityMetadataAssembly.assembleRelationshipUpdates(context);
    context.services().workflowReferences =
        EntityMetadataAssembly.assembleWorkflowReferences(context);
    context.services().assetMembership = EntityMetadataAssembly.assembleAssetMembership(context);
    context.services().extensionService = EntityMetadataAssembly.assembleExtensionService(context);
    context.services().metadataWriter = EntityMetadataAssembly.assembleMetadataWriter(context);
    context.services().metadataCleanup = EntityMetadataAssembly.assembleMetadataCleanup(context);
    context.services().ownershipWriter = EntityMetadataAssembly.assembleOwnershipWriter(context);
    context.services().userActions = EntityMetadataAssembly.assembleUserActions(context);
    context.services().tagWriter = EntityMetadataAssembly.assembleTagWriter(context);
    context.services().certificationService =
        EntityMetadataAssembly.assembleCertificationService(context);
    context.services().tagReader = EntityMetadataAssembly.assembleTagReader(context);
    context.services().metadataReads = EntityMetadataAssembly.assembleMetadataReads(context);
  }
}
