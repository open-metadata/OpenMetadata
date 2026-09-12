package org.openmetadata.service.entity.policy;

import static org.openmetadata.service.Entity.FIELD_CERTIFICATION;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;

import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.EntityFieldPolicy;
import org.openmetadata.service.entity.EntityModule;
import org.openmetadata.service.entity.bulk.EntityBulkOperations;
import org.openmetadata.service.entity.bulk.EntityBulkPreparation;
import org.openmetadata.service.entity.delete.EntityDeletes;
import org.openmetadata.service.entity.delete.EntityRestores;
import org.openmetadata.service.entity.delete.EntitySubtree;
import org.openmetadata.service.entity.history.EntityHistoryQuery;
import org.openmetadata.service.entity.history.EntitySummaryWriter;
import org.openmetadata.service.entity.history.EntityVersionHistory;
import org.openmetadata.service.entity.metadata.EntityCertificationService;
import org.openmetadata.service.entity.metadata.EntityExtensionService;
import org.openmetadata.service.entity.metadata.EntityFieldTagReader;
import org.openmetadata.service.entity.metadata.EntityMetadataPersistence;
import org.openmetadata.service.entity.metadata.EntityReferenceValidator;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.metadata.EntityTagReader;
import org.openmetadata.service.entity.metadata.EntityTagWriter;
import org.openmetadata.service.entity.metadata.EntityTimeSeries;
import org.openmetadata.service.entity.metadata.EntityWorkflowReferences;
import org.openmetadata.service.entity.read.EntityBatchReferenceReader;
import org.openmetadata.service.entity.read.EntityCollections;
import org.openmetadata.service.entity.read.EntityFieldLoading;
import org.openmetadata.service.entity.read.EntityLookupService;
import org.openmetadata.service.entity.read.EntityPages;
import org.openmetadata.service.entity.read.EntityReader;
import org.openmetadata.service.entity.read.EntityRelationshipFields;
import org.openmetadata.service.entity.read.EntityRelationshipReader;
import org.openmetadata.service.entity.write.EntityCreates;
import org.openmetadata.service.entity.write.EntityImports;
import org.openmetadata.service.entity.write.EntityPatches;
import org.openmetadata.service.entity.write.EntityPersistence;
import org.openmetadata.service.entity.write.EntityPrepares;
import org.openmetadata.service.entity.write.EntityPuts;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.util.EntityUtil.Fields;

public interface EntityModuleAccess<T extends EntityInterface>
    extends EntityModule<T>, EntityPolicyAccess<T> {

  public default boolean isSupportsOwners() {
    return context().supports(FIELD_OWNERS);
  }

  public default EntityReader<T> reads() {
    return context().services().getQueries().reads();
  }

  public default EntityCollections<T> collections() {
    return context().services().getQueries().collections();
  }

  public default EntityLookupService<T> lookup() {
    return context().services().getLookupService();
  }

  public default EntityWorkflowReferences workflowReferences() {
    return context().services().getWorkflowReferences();
  }

  public default EntityPages<T> pages() {
    return context().services().getQueries().pages();
  }

  public default EntityVersionHistory<T> versions() {
    return context().services().getHistoryServices().versions();
  }

  public default EntityHistoryQuery<T> history() {
    return context().services().getHistoryServices().query();
  }

  public default EntityCreates<T> creates() {
    return context().services().getCommands().creates();
  }

  public default EntityPrepares<T> preparation() {
    return context().services().getPreparation();
  }

  public default EntityBulkPreparation<T> bulkPreparation() {
    return context().services().getBulkPreparation();
  }

  public default EntityMetadataPersistence<T> metadata() {
    return context().services().getMetadataPersistence();
  }

  public default EntityImports<T> imports() {
    return context().services().getImports();
  }

  public default EntityPuts<T> puts() {
    return context().services().getCommands().puts();
  }

  public default EntityPatches<T> patches() {
    return context().services().getCommands().patches();
  }

  /**
   * Attribution writes for accepted suggestions whose entity value is already current.
   */
  public default EntitySummaryWriter summaryWrites() {
    return context().services().getSummaryWriter();
  }

  public default EntityDeletes<T> deletes() {
    return context().services().getDeletes();
  }

  public default EntityPersistence<T> persistence() {
    return context().services().getPersistence();
  }

  public default EntityTimeSeries timeSeries() {
    return context().services().getTimeSeries();
  }

  public default EntityExtensionService extensions() {
    return context().services().getExtensionService();
  }

  public default EntityTagReader<T> tags() {
    return context().services().getTagReader();
  }

  public default EntityCertificationService<T> certification() {
    return context().services().getCertificationService();
  }

  public default EntityTagWriter tagWrites() {
    return context().services().getTagWriter();
  }

  public default EntityRestores<T> restores() {
    return context().services().getRestoreService();
  }

  public default EntitySubtree subtrees() {
    return context().services().getSubtreeLifecycle();
  }

  public default EntityRelationshipWriter relationshipWrites() {
    return context().services().getRelationshipWriter();
  }

  public default EntityRelationshipReader relationships() {
    return context().services().getMetadataReads().relationships();
  }

  public default EntityReferenceValidator referenceValidation() {
    return EntityReferenceValidator.shared();
  }

  public default EntityRelationshipFields relationshipFields() {
    return context().services().getMetadataReads().fields();
  }

  public default EntityFieldPolicy fieldPolicy() {
    return context().fieldPolicy();
  }

  public default EntityFieldLoading<T> fieldLoading() {
    return context().services().getQueries().fields();
  }

  public default EntityBatchReferenceReader batchReferences() {
    return context().services().getMetadataReads().batch();
  }

  public default EntityFieldTagReader fieldTags() {
    return context().services().getMetadataReads().fieldTags();
  }

  public default EntityBulkOperations<T> bulk() {
    return context().services().getBulk();
  }

  public default Class<T> getEntityClass() {
    return context().schema().entityClass();
  }

  public default String getEntityType() {
    return context().schema().entityType();
  }

  public default EntityDAO<T> getDao() {
    return context().schema().dao();
  }

  public default CollectionDAO getDaoCollection() {
    return context().dependencies().daos();
  }

  public default Set<String> getAllowedFields() {
    return context().allowedFields();
  }

  public default boolean isSupportsTags() {
    return context().supports(FIELD_TAGS);
  }

  public default boolean isSupportsCertification() {
    return context().supports(FIELD_CERTIFICATION);
  }

  public default boolean isSupportsDomains() {
    return context().supports(FIELD_DOMAINS);
  }

  public default boolean isSupportsReviewers() {
    return context().supports(FIELD_REVIEWERS);
  }

  public default Fields getPatchFields() {
    return context().patchFields();
  }

  public default Fields getPutFields() {
    return context().putFields();
  }
}
