package org.openmetadata.service.entity.policy;

import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.service.exception.CatalogExceptionMessage.csvNotSupported;
import static org.openmetadata.service.util.EntityUtil.isNullOrEmptyChangeDescription;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.csv.CsvExportProgressCallback;
import org.openmetadata.csv.CsvImportProgressCallback;
import org.openmetadata.schema.BulkAssetsRequestInterface;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.delete.EntitySubtreeUpdates;
import org.openmetadata.service.entity.metadata.EntityAssetMembership;

public interface EntityBulkPolicy<T extends EntityInterface> extends EntityPolicyAccess<T> {

  @Transaction
  public default BulkOperationResult bulkAssetsOperation(
      UUID entityId,
      String fromEntity,
      Relationship relationship,
      BulkAssets request,
      boolean isAdd) {
    return context()
        .policy()
        .bulkAssetsOperation(entityId, fromEntity, relationship, request, isAdd, null);
  }

  @Transaction
  public default BulkOperationResult bulkAssetsOperation(
      UUID entityId,
      String fromEntity,
      Relationship relationship,
      BulkAssets request,
      boolean isAdd,
      String userName) {
    return context()
        .services()
        .getAssetMembership()
        .apply(
            new EntityAssetMembership.Target(entityId, fromEntity, relationship),
            request,
            isAdd ? EntityAssetMembership.Mode.ADD : EntityAssetMembership.Mode.REMOVE,
            userName);
  }

  public default ChangeDescription addBulkAddRemoveChangeDescription(
      Double version, boolean isAdd, Object newValue, Object oldValue) {
    FieldChange fieldChange =
        new FieldChange().withName("assets").withNewValue(newValue).withOldValue(oldValue);
    ChangeDescription change = new ChangeDescription().withPreviousVersion(version);
    if (isAdd) {
      change.getFieldsAdded().add(fieldChange);
    } else {
      change.getFieldsDeleted().add(fieldChange);
    }
    return change;
  }

  public default ChangeEvent getChangeEvent(
      EntityInterface updated, ChangeDescription change, String entityType, Double prevVersion) {
    return context()
        .policy()
        .getChangeEvent(updated, change, entityType, prevVersion, updated.getUpdatedBy());
  }

  public default ChangeEvent getChangeEvent(
      EntityInterface updated,
      ChangeDescription change,
      String entityType,
      Double prevVersion,
      String userName) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEntity(updated)
        .withChangeDescription(change)
        .withEventType(ENTITY_UPDATED)
        .withEntityType(entityType)
        .withEntityId(updated.getId())
        .withEntityFullyQualifiedName(updated.getFullyQualifiedName())
        .withUserName(userName)
        .withTimestamp(System.currentTimeMillis())
        .withCurrentVersion(updated.getVersion())
        .withPreviousVersion(prevVersion);
  }

  public default void createAndInsertChangeEvent(
      T original, T updated, ChangeDescription changeDescription, EventType eventType) {
    if (isNullOrEmptyChangeDescription(changeDescription)) {
      return;
    }
    if (changeDescription.getPreviousVersion() == null) {
      changeDescription.withPreviousVersion(original.getVersion());
    }
    ChangeEvent changeEvent =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEventType(eventType)
            .withEntityType(context().schema().entityType())
            .withEntityId(updated.getId())
            .withEntityFullyQualifiedName(updated.getFullyQualifiedName())
            .withUserName(updated.getUpdatedBy())
            .withTimestamp(System.currentTimeMillis())
            .withCurrentVersion(updated.getVersion())
            .withPreviousVersion(changeDescription.getPreviousVersion())
            .withChangeDescription(changeDescription)
            .withEntity(updated);
    context().dependencies().daos().changeEventDAO().insert(JsonUtils.pojoToJson(changeEvent));
    EntityPolicySupport.LOG.debug(
        "Inserted incremental ChangeEvent for {} version {}",
        context().schema().entityType(),
        updated.getVersion());
  }

  /**
   * Indicates whether this repository's bulk CSV import should create version history.
   * Most repositories import entities into a parent entity (e.g., Glossary, Team, Table)
   * and should version that parent. Some repositories (e.g., User) import entities without
   * a versionable parent entity and should return false.
   *
   * @return true if bulk import should create version history (default), false otherwise
   */
  public default boolean supportsBulkImportVersioning() {
    // Default: most repositories version the parent entity during bulk import
    return true;
  }

  /**
   * Override this method to support downloading CSV functionality
   */
  public default String exportToCsv(String name, String user, boolean recursive)
      throws IOException {
    return context().policy().exportToCsv(name, user, recursive, null);
  }

  public default String exportToCsv(
      String name, String user, boolean recursive, CsvExportProgressCallback callback)
      throws IOException {
    throw new IllegalArgumentException(csvNotSupported(context().schema().entityType()));
  }

  /**
   * Load CSV provided for bulk upload
   */
  public default CsvImportResult importFromCsv(
      String name, String csv, boolean dryRun, String user, boolean recursive) throws IOException {
    return context()
        .policy()
        .importFromCsv(name, csv, dryRun, user, recursive, (CsvImportProgressCallback) null);
  }

  public default CsvImportResult importFromCsv(
      String name,
      String csv,
      boolean dryRun,
      String user,
      boolean recursive,
      CsvImportProgressCallback callback)
      throws IOException {
    throw new IllegalArgumentException(csvNotSupported(context().schema().entityType()));
  }

  public default CsvImportResult importFromCsv(
      String name,
      String csv,
      boolean dryRun,
      String user,
      boolean recursive,
      String targetEntityType)
      throws IOException {
    return context()
        .policy()
        .importFromCsv(name, csv, dryRun, user, recursive, targetEntityType, null);
  }

  public default CsvImportResult importFromCsv(
      String name,
      String csv,
      boolean dryRun,
      String user,
      boolean recursive,
      String targetEntityType,
      CsvImportProgressCallback callback)
      throws IOException {
    throw new IllegalArgumentException(csvNotSupported(context().schema().entityType()));
  }

  public default BulkOperationResult bulkAddAndValidateTagsToAssets(
      UUID glossaryTermId, BulkAssetsRequestInterface request) {
    throw new UnsupportedOperationException("Bulk Add tags to Asset operation not supported");
  }

  public default BulkOperationResult bulkRemoveAndValidateTagsToAssets(
      UUID glossaryTermId, BulkAssetsRequestInterface request) {
    throw new UnsupportedOperationException("Bulk Remove tags to Asset operation not supported");
  }

  public default void createChangeEventForBulkOperation(
      T original, CsvImportResult result, String updatedBy) {
    context().services().getCsvChangeLog().record(original.getId(), result, updatedBy);
  }

  /**
   * Records the change event for an async delete/restore whose HTTP 202 response bypasses the
   * response filter that records change events for synchronous operations. Without this, async
   * deletes and restores are invisible to audit logs, alerts, and webhooks. Recursive deletes pass
   * a single root event here; cascaded descendants are intentionally not recorded individually (see
   * {@link EntitySubtreeUpdates}).
   */
  public default void storeChangeEventForAsyncOperation(
      T entity, EventType eventType, boolean recursive, String userName) {
    context().services().getEventService().recordAsync(entity, eventType, recursive, userName);
  }

  public default Optional<String> buildChangeEventJsonForBulkOperation(
      T entity, EventType eventType, String userName) {
    return context().services().getEventService().json(entity, eventType, userName);
  }

  public default void insertChangeEventsBatch(List<String> changeEvents) {
    context().services().getEventService().insertBatch(changeEvents);
  }
}
