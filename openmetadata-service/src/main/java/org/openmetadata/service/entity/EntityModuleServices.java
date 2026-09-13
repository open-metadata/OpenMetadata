package org.openmetadata.service.entity;

import lombok.Getter;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.bootstrap.EntitySeedInitializer;
import org.openmetadata.service.entity.bulk.EntityBulkMetrics;
import org.openmetadata.service.entity.bulk.EntityBulkOperations;
import org.openmetadata.service.entity.bulk.EntityBulkPreparation;
import org.openmetadata.service.entity.bulk.EntityBulkUpdateService;
import org.openmetadata.service.entity.bulk.EntityCsvChangeLog;
import org.openmetadata.service.entity.delete.EntityChildDeletion;
import org.openmetadata.service.entity.delete.EntityDeletes;
import org.openmetadata.service.entity.delete.EntityDeletionPersistence;
import org.openmetadata.service.entity.delete.EntityHardDeletion;
import org.openmetadata.service.entity.delete.EntityHierarchy;
import org.openmetadata.service.entity.delete.EntityRestores;
import org.openmetadata.service.entity.delete.EntitySubtreeLifecycle;
import org.openmetadata.service.entity.delete.EntitySubtreeUpdates;
import org.openmetadata.service.entity.history.EntityHistoryServices;
import org.openmetadata.service.entity.history.EntitySummaryWriter;
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
import org.openmetadata.service.entity.metadata.EntityTimeSeries;
import org.openmetadata.service.entity.metadata.EntityUserActions;
import org.openmetadata.service.entity.metadata.EntityWorkflowReferences;
import org.openmetadata.service.entity.read.EntityLookupService;
import org.openmetadata.service.entity.read.EntityMetadataReads;
import org.openmetadata.service.entity.read.EntityQueryServices;
import org.openmetadata.service.entity.read.EntityReadFactory;
import org.openmetadata.service.entity.write.EntityCommands;
import org.openmetadata.service.entity.write.EntityCreateWorkflow;
import org.openmetadata.service.entity.write.EntityEventService;
import org.openmetadata.service.entity.write.EntityImports;
import org.openmetadata.service.entity.write.EntityLifecyclePublisher;
import org.openmetadata.service.entity.write.EntityPersistence;
import org.openmetadata.service.entity.write.EntityPreparation;
import org.openmetadata.service.entity.write.EntityUnitOfWork;
import org.openmetadata.service.entity.write.EntityUpdateContext;
import org.openmetadata.service.jdbi3.EntityRelationshipRepository;

@Getter
public final class EntityModuleServices<T extends EntityInterface> {

  EntityRelationshipRepository relationshipRepository;

  EntityQueryServices<T> queries;

  EntityMetadataReads<T> metadataReads;

  EntityMetadataWriter metadataWriter;

  EntityMetadataCleanup metadataCleanup;

  EntityMetadataPersistence<T> metadataPersistence;

  EntityOwnershipWriter<T> ownershipWriter;

  EntityUserActions<T> userActions;

  EntityUnitOfWork unitOfWork;

  EntityPersistence<T> persistence;

  EntityLifecyclePublisher<T> lifecyclePublisher;

  EntityUpdateContext<T> updaterServices;

  EntitySeedInitializer<T> seedInitializer;

  EntityCommands<T> commands;

  EntityPreparation<T> preparation;

  EntityBulkPreparation<T> bulkPreparation;

  EntityDeletionPersistence<T> deletionPersistence;

  EntityCreateWorkflow<T> createWorkflow;

  EntityImports<T> imports;

  EntityHierarchy<T> hierarchy;

  EntityChildDeletion childDeletion;

  EntityHardDeletion<T> hardDeletion;

  EntitySubtreeUpdates<T> subtreeUpdates;

  EntitySubtreeLifecycle<T> subtreeLifecycle;

  EntityRestores<T> restoreService;

  EntityDeletes<T> deletes;

  EntityCsvChangeLog<T> csvChangeLog;

  EntityBulkUpdateService<T> bulkUpdateService;

  EntityBulkMetrics bulkMetrics;

  EntityBulkOperations<T> bulk;

  EntityEventService<T> eventService;

  EntityRelationshipWriter relationshipWriter;

  EntityRelationshipUpdates relationshipUpdates;

  EntityAssetMembership assetMembership;

  EntityLookupService<T> lookupService;

  EntityReadFactory.Schema<T> readSchema;

  EntityExtensionService extensionService;

  EntityTimeSeries timeSeries;

  EntityTagWriter tagWriter;

  EntityCertificationService<T> certificationService;

  EntityTagReader<T> tagReader;

  EntitySummaryWriter summaryWriter;

  EntityWorkflowReferences workflowReferences;

  EntityHistoryServices<T> historyServices;
}
