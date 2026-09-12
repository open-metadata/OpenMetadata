package org.openmetadata.service.entity.policy;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.utils.EntityInterfaceUtil.quoteName;
import static org.openmetadata.service.Entity.FIELD_CERTIFICATION;
import static org.openmetadata.service.Entity.FIELD_ENTITY_STATUS;

import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.ws.rs.core.UriInfo;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.configuration.AssetCertificationSettings;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityWriteCallbacks;
import org.openmetadata.service.entity.history.EntityHistoryQuery;
import org.openmetadata.service.entity.write.EntityCommandActor;
import org.openmetadata.service.entity.write.EntityImportCommands;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.entity.write.StorageProjection;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.JsonStorageUtils;

public interface EntityMutationPolicy<T extends EntityInterface> extends EntityPolicyAccess<T> {

  /**
   * This method is used for validating an entity to be created during POST, PUT, and PATCH operations and prepare the
   * entity with all the required attributes and relationships.
   *
   * <p>The implementation of this method must perform the following:
   *
   * <ol>
   *   <li>Prepare the values for attributes that are not required in the request but can be derived on the server side.
   *       Example - <i>>FullyQualifiedNames</i> of an entity can be derived from the hierarchy that an entity belongs
   *       to .
   *   <li>Validate all the attributes of an entity.
   *   <li>Validate all the relationships of an entity. As an example - during <i>table</i> creation, relationships such
   *       as <i>Tags</i>, <i>Owner</i>, <i>Database</i>a table belongs to are validated. During validation additional
   *       information that is not required in the create/update request are set up in the corresponding relationship
   *       fields.
   * </ol>
   * <p>
   * At the end of this operation, entity is expected to be valid and fully constructed with all the fields that will be
   * sent as payload in the POST, PUT, and PATCH operations response.
   *
   * @see TableRepository#prepare(Table, boolean) for an example implementation
   */
  public void prepare(T entity, boolean update);

  /**
   * An entity is stored in the backend database as JSON document. The JSON includes some attributes of the entity and
   * does not include attributes such as <i>href</i>. The relationship fields of an entity is never stored in the JSON
   * document. It is always reconstructed based on relationship edges from the backend database. <br>
   * <br>
   * As an example, when <i>table</i> entity is stored, the attributes such as <i>href</i> and the relationships such as
   * <i>owners</i>, <i>database</i>, and <i>tags</i> are set to null. These attributes are restored back after the JSON
   * document is stored to be sent as response.
   *
   * @see TableRepository#storeEntity(Table, boolean) for an example implementation
   */
  public void storeEntity(T entity, boolean update);

  public default void storeEntityWithVersion(T entity, boolean update, Double expectedVersion) {
    // This method should be overridden by concrete repositories to use version-aware storage
    // The default implementation uses the store method with version checking
    context().policy().persistence().store(entity, update, expectedVersion);
  }

  public default void storeEntities(List<T> entities) {
    // Default: store entities directly. Override if fields need nullification before storage.
    context().policy().persistence().insertMany(entities);
  }

  /**
   * PATCH operations can't overwrite certain fields, such as entity ID, fullyQualifiedNames etc. Instead of throwing an
   * error, we take lenient approach of ignoring the user error and restore those attributes based on what is already
   * stored in the original entity.
   */
  public default void restorePatchAttributes(T original, T updated) {
    updated.setId(original.getId());
    updated.setName(context().options().isRenameAllowed() ? updated.getName() : original.getName());
    updated.setFullyQualifiedName(original.getFullyQualifiedName());
    updated.setChangeDescription(original.getChangeDescription());
  }

  public default T restorePatchSecrets(T original, T updated) {
    return updated;
  }

  /**
   * This function updates the Elasticsearch indexes wherever the specific entity is present.
   * It is typically invoked when there are changes in the entity that might affect its indexing in Elasticsearch.
   * The function ensures that the indexes are kept up-to-date with the latest state of the entity across all relevant Elasticsearch indexes.
   */
  public default void entityRelationshipReindex(T original, T updated) {
    // Logic override by the child class to update the indexes
  }

  /**
   * Set fullyQualifiedName of an entity
   */
  public default void setFullyQualifiedName(T entity) {
    entity.setFullyQualifiedName(quoteName(entity.getName()));
  }

  /**
   * Set default status for entities that support status field.
   * All entities use EntityStatus.APPROVED as the default.
   * Override this method only for entities that need custom status logic (e.g., GlossaryTerm with reviewers)
   */
  public default void setDefaultStatus(T entity, boolean update) {
    if (!context().supports(FIELD_ENTITY_STATUS)) {
      return;
    }
    // Skip if status is already set
    if (entity.getEntityStatus() != null) {
      return;
    }
    // Set default status to UNPROCESSED
    entity.setEntityStatus(EntityStatus.UNPROCESSED);
  }

  /**
   * This use new version with changeSource.
   */
  @Deprecated
  public default EntityUpdater<T> getUpdater(T original, T updated, EntityOperation operation) {
    return new EntityUpdater<>(
        context().services().getUpdaterServices(),
        new EntityUpdateRequest<>(original, updated, operation, null, false));
  }

  public default EntityUpdater<T> getUpdater(
      T original, T updated, EntityOperation operation, ChangeSource changeSource) {
    return new EntityUpdater<>(
        context().services().getUpdaterServices(),
        new EntityUpdateRequest<>(original, updated, operation, changeSource, false));
  }

  public default EntityUpdater<T> getUpdater(
      T original,
      T updated,
      EntityOperation operation,
      ChangeSource changeSource,
      boolean useOptimisticLocking) {
    // Delegate to the entity-specific updater (overridden per repository) so the optimistic-locking
    // (If-Match) PATCH path runs the same entitySpecificUpdate — column tag/description
    // persistence,
    // etc. — as the normal path. Constructing a base EntityUpdater here would silently drop every
    // nested/entity-specific change under If-Match, since subclasses only override the 4-arg
    // variant.
    EntityUpdater<T> updater =
        context().policy().getUpdater(original, updated, operation, changeSource);
    updater.setUseOptimisticLocking(useOptimisticLocking);
    return updater;
  }

  /**
   * Hook called after {@link #setFieldsInBulk} for entities returned from {@link
   * EntityHistoryQuery#list(EntityHistoryQuery.Window)}.
   *
   * <p>Subclasses may override to perform additional, entity-specific hydration of history
   * snapshots without overriding the core field-population logic in {@code setFieldsInBulk}.
   */
  public default void hydrateHistoryEntities(List<T> entities) {
    // No additional hydration by default.
  }

  public default List<T> createMany(UriInfo uriInfo, List<T> entities) {
    for (T e : entities) {
      context().policy().preparation().prepare(e, false);
    }
    return EntityWriteCallbacks.createManyEntities(context(), entities);
  }

  /**
   * Supplies startup policies whose callbacks execute after module assembly.
   */
  public default EntityImportCommands.Policy<T> createImportPolicy() {
    return new EntityImportCommands.Policy<>(
        entity ->
            context().policy().lookup().byNameOrNull(entity.getFullyQualifiedName(), Include.ALL),
        (uri, entity, actor) ->
            context()
                .policy()
                .creates()
                .upsert(uri, entity, new EntityCommandActor(actor, null), true));
  }

  public default void storeEntityAndCaptureJson(T entity, boolean update) {
    context()
        .services()
        .getPersistence()
        .capture(entity, () -> context().policy().storeEntity(entity, update));
  }

  public default T createNewEntity(T entity) {
    return context().services().getCreateWorkflow().create(entity);
  }

  /**
   * Run {@code flushBody} as one wrapped DB transaction with the post-commit side-effect collectors
   * (tag RDF + domain/data-product lineage-ES + rename-cascade search + Redis-L2 cache) opened fresh
   * for each deadlock-retry attempt and drained exactly once, synchronously on the request thread,
   * after the final successful commit — so search/lineage stay read-your-write visible by the time
   * the request returns. A rolled-back attempt clears its collector so a replay never double-enqueues.
   * The collectors are (re-)opened inside the transactional runnable so each replay starts empty.
   */
  public default void flushInOneTransaction(Runnable flushBody) {
    context().services().getPersistence().flush(flushBody);
  }

  /**
   * Runs multi-repository work through the retained SQL-object root so every child DAO joins the
   * callback handle. Opening this boundary directly on {@link Entity#getJdbi()} does not bind the
   * on-demand DAO graph, allowing nested repository writes to commit independently of the outer
   * unit of work.
   */
  public default <R> R executeInTransaction(final Supplier<R> work) {
    return context().services().getPersistence().execute(work);
  }

  public default List<String> getFieldsStrippedFromStorageJson() {
    return Collections.emptyList();
  }

  public default ObjectNode storageJsonNode(T entity) {
    return StorageProjection.attributes(entity, getFieldsStrippedFromStorageJson());
  }

  public default String serializeForStorage(T entity) {
    return JsonStorageUtils.sanitizeNulCharacters(storageJsonNode(entity).toString());
  }

  public default String serializeForVersionHistory(T entity) {
    return JsonUtils.pojoToJson(entity);
  }

  /**
   * Columns whose extensions are persisted on initial create. Default: empty.
   */
  public default List<Column> getColumnsForExtensionPersistence(T entity) {
    return Collections.emptyList();
  }

  public default String getCertificationClassification() {
    if (!context().supports(FIELD_CERTIFICATION)) return null;
    return SettingsCache.getSettingOrDefault(
            SettingsType.ASSET_CERTIFICATION_SETTINGS,
            new AssetCertificationSettings()
                .withAllowedClassification("Certification")
                .withValidityPeriod("P30D"),
            AssetCertificationSettings.class)
        .getAllowedClassification();
  }

  public default List<String> entityListToStrings(List<T> entities) {
    return entities.stream().map(EntityInterface::getId).map(UUID::toString).toList();
  }

  /**
   * Fields used to hydrate inherited relationships for changed entities during bulk updates.
   *
   * <p>Use PUT-update fields as baseline and explicitly include inheritable fields so repositories
   * with inheritance beyond owners/domains (for example retentionPeriod or reviewers) keep behavior
   * intact without loading every allowed field.
   */
  public default Fields getBulkUpdateInheritanceFields() {
    Set<String> bulkFields = new HashSet<>(context().putFields().getFieldList());
    String inheritableFields = context().policy().getInheritableFields();
    if (!nullOrEmpty(inheritableFields)) {
      for (String field : inheritableFields.split(",")) {
        String normalized = field.trim();
        if (!normalized.isEmpty() && context().allowedFields().contains(normalized)) {
          bulkFields.add(normalized);
        }
      }
    }
    return new Fields(context().allowedFields(), bulkFields);
  }
}
