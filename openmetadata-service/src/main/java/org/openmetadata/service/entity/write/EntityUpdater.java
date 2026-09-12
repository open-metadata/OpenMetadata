package org.openmetadata.service.entity.write;

import static org.openmetadata.schema.type.EventType.ENTITY_NO_CHANGE;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.service.util.EntityUtil.objectMatch;
import static org.openmetadata.service.util.EntityUtil.tagLabelMatch;

import com.google.common.annotations.VisibleForTesting;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.BiPredicate;
import java.util.function.Consumer;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.entity.bulk.EntityBulkMutation;
import org.openmetadata.service.entity.history.EntityVersionPolicy;
import org.openmetadata.service.entity.metadata.EntityCertificationUpdates;
import org.openmetadata.service.entity.metadata.EntityExtensionUpdater;
import org.openmetadata.service.entity.metadata.EntityGovernanceUpdates;
import org.openmetadata.service.entity.metadata.EntityOwnershipUpdates;
import org.openmetadata.service.entity.metadata.EntityRelationshipUpdates;
import org.openmetadata.service.entity.metadata.EntityTagUpdates;
import org.openmetadata.service.entity.metadata.EntityValueUpdates;
import org.openmetadata.service.exception.CatalogExceptionMessage;

@Slf4j
public final class EntityUpdater<T extends EntityInterface>
    implements EntityMutationLifecycle.Session<T>,
        EntityExtensionUpdater.Session<T>,
        EntityTagUpdates.Session,
        EntityValueUpdates.Session,
        EntityCertificationUpdates.Session,
        EntityGovernanceUpdates.Session,
        EntityOwnershipUpdates.Session<T>,
        EntityUpdateCommand,
        EntityBulkMutation<T> {
  @Getter final EntityUpdateContext<T> context;
  private final EntitySpecificMutation<T> specific;
  private static volatile long sessionTimeoutMillis = 10L * 60 * 1000; // 10 minutes
  @Getter @Setter T previous;
  @Setter T original;
  @Setter T updated;
  @Getter final EntityOperation operation;
  @Getter @Setter ChangeDescription changeDescription = null;
  @Getter @Setter boolean majorVersionChange = false;
  @Getter final User updatingUser;
  private final EntityMutationPermissions mutationPermissions;
  @Setter private boolean entityChanged = false;
  @Setter private boolean versionChanged = false;
  @Getter @Setter private boolean entityStored = false;

  /**
   * Diff produced by THIS request. Every {@code EntityUpdater} entry point must populate this
   * before its caller classifies the change: {@link #getChangeType()} reads it, and a null value
   * is indistinguishable from "nothing changed", which silently drops the ChangeEvent (see
   * #32092).
   */
  @Getter @Setter ChangeDescription incrementalChangeDescription = null;

  @Getter private final ChangeSource changeSource;
  @Getter @Setter private boolean useOptimisticLocking;
  @Getter @Setter private Set<String> patchedFields;

  // When set (bulk path with overrideMetadata=true), bot updates are allowed to overwrite
  // user-curated metadata that PUT-as-bot would otherwise preserve (description, displayName).
  @Setter boolean overrideMetadata;
  private final List<Runnable> deferredReactOperations = new ArrayList<>();
  private boolean deferredReactExecuted;

  // Store the original FQN at construction time, before any modifications or revert.
  // This is needed because during change consolidation, revert() reassigns 'original' to
  // 'previous',
  // which would cause original.getFullyQualifiedName() to return an outdated value.
  @Getter private final String originalFqn;

  public boolean shouldCompare(String fieldName) {
    return PatchFieldSelection.shouldCompare(patchedFields, fieldName);
  }

  /**
   * Blocks downgrading a system entity's provider to user, which would strip its delete/rename
   * protection (#29974). Both update paths prevent it, only the response differs: a PATCH change is
   * deliberate and rejected with a 400; a PUT's provider defaults to user when omitted (ambiguous),
   * so the system provider is kept silently rather than break PUTs that never meant to change it.
   */
  public final void restrictSystemProviderChange(Consumer<ProviderType> providerSetter) {
    if (!ProviderType.SYSTEM.equals(original.getProvider())) {
      return;
    }
    if (operation.isPatch()) {
      if (!ProviderType.SYSTEM.equals(updated.getProvider())) {
        throw new IllegalArgumentException(
            CatalogExceptionMessage.systemEntityModifyNotAllowed(
                original.getName(), context.type()));
      }
      return;
    }
    providerSetter.accept(original.getProvider());
  }

  public final void compareAndUpdate(String fieldName, Runnable updater) {
    if (shouldCompare(fieldName)) {
      updater.run();
    }
  }

  public final void compareAndUpdateAny(Runnable updater, String... fieldNames) {
    if (fieldNames == null) {
      return;
    }
    for (String fieldName : fieldNames) {
      if (shouldCompare(fieldName)) {
        updater.run();
        return;
      }
    }
  }

  public EntityUpdater(final EntityUpdateContext<T> context, final EntityUpdateRequest<T> request) {
    this(context, request, EntitySpecificMutation.standard());
  }

  public EntityUpdater(
      final EntityUpdateContext<T> context,
      final EntityUpdateRequest<T> request,
      final EntitySpecificMutation<T> specific) {
    this.context = context;
    this.specific = Objects.requireNonNull(specific);
    this.original = request.original();
    this.updated = request.updated();
    this.operation = request.operation();
    this.originalFqn = original.getFullyQualifiedName();
    this.updatingUser = resolveUpdatingUser(updated.getUpdatedBy());
    this.mutationPermissions = context.hooks().permissions().apply(updatingUser);
    this.changeSource = request.changeSource();
    this.useOptimisticLocking = request.optimistic();
  }

  private User resolveUpdatingUser(final String name) {
    final User user =
        name.equalsIgnoreCase(ADMIN_USER_NAME)
            ? new User().withName(ADMIN_USER_NAME).withIsAdmin(true)
            : context.hooks().users().apply(name);
    return user == null ? new User().withName(name).withIsAdmin(false) : user;
  }

  public final void deferReactOperation(Runnable operation) {
    if (operation != null) {
      deferredReactOperations.add(operation);
    }
  }

  public final void runDeferredReactOperations() {
    if (deferredReactExecuted || deferredReactOperations.isEmpty()) {
      return;
    }
    deferredReactExecuted = true;
    for (Runnable operation : deferredReactOperations) {
      try {
        operation.run();
      } catch (Exception e) {
        LOG.warn(
            "Deferred react operation failed for {}:{}",
            context.type(),
            updated != null ? updated.getId() : null,
            e);
      }
    }
  }

  /** Compare original and updated entities and persist update. */
  public final void update() {
    context.execution().lifecycle().update(this, EntityMutationLifecycle.Mode.NORMAL);
  }

  /** Update with optimistic locking - ensures no concurrent modifications. */
  public final void updateWithOptimisticLocking() {
    context.execution().lifecycle().update(this, EntityMutationLifecycle.Mode.OPTIMISTIC);
  }

  public final void updateForImport() {
    context.execution().lifecycle().update(this, EntityMutationLifecycle.Mode.IMPORT);
  }

  @Override
  public final void resetMutationAttempt() {
    deferredReactOperations.clear();
    deferredReactExecuted = false;
    resetForRetryAttempt();
  }

  /**
   * A replay must reset entity-specific guards before consolidation repeats its mutation passes.
   * Otherwise a rolled-back rename or domain cascade can be skipped on the successful attempt.
   */
  void resetForRetryAttempt() {
    specific.reset();
  }

  /**
   * Computes metadata changes for a bulk flush that writes rows later. Each ingestion run is a
   * distinct update, so it skips interactive session consolidation but still captures the per-request
   * diff. Omitting that diff incorrectly classified changed entities as ENTITY_NO_CHANGE (#32092).
   */
  @Transaction
  public final void updateWithDeferredStore() {
    context.execution().workflow().updateWithDeferredStore(this);
  }

  public boolean isVersionChanged() {
    return versionChanged;
  }

  public boolean isEntityChanged() {
    return entityChanged;
  }

  public T getOriginal() {
    return original;
  }

  public T getUpdated() {
    return updated;
  }

  /**
   * Compare original and updated entities and perform updates. Update the entity version and track changes.
   */
  @Override
  public final boolean canConsolidateChanges() {
    return consolidateChanges(original, updated, operation);
  }

  @Override
  public final void applyChanges(boolean importMode, boolean consolidatingChanges) {
    context.metadata().plan().apply(this, importMode, consolidatingChanges);
  }

  void entitySpecificUpdate(boolean consolidatingChanges) {
    specific.update(this, consolidatingChanges);
  }

  @Override
  public final void updateOwners(
      T entity, List<EntityReference> originalOwners, List<EntityReference> updatedOwners) {
    context.hooks().owners().update(entity, originalOwners, updatedOwners);
  }

  public void updateTags(
      String fqn, String fieldName, List<TagLabel> origTags, List<TagLabel> updatedTags) {
    specific.tags(this, fqn, fieldName, origTags, updatedTags);
  }

  void updateTagsForImport(
      String fqn, String fieldName, List<TagLabel> origTags, List<TagLabel> updatedTags) {
    context.metadata().plan().tags().updateForImport(this, fqn, fieldName, origTags, updatedTags);
  }

  final void applyTagsAddInFlushAndDeferRdf(List<TagLabel> tagLabels, String targetFqn) {
    context.metadata().tags().addInFlush(this, tagLabels, targetFqn);
  }

  final void applyTagsDeleteInFlushAndDeferRdf(List<TagLabel> tagLabels, String targetFqn) {
    context.metadata().tags().deleteInFlush(this, tagLabels, targetFqn);
  }

  void updateDomains() {
    specific.domains(this);
  }

  @Transaction
  public final void updateDomains(
      T entity, List<EntityReference> originalDomains, List<EntityReference> newDomains) {
    context
        .metadata()
        .ownership()
        .domains(entity, () -> updated.getId(), originalDomains, newDomains);
  }

  void updateDomainsForImport() {
    context.metadata().plan().ownership().updateDomainsForImport(this, original, updated);
  }

  void updateReviewers() {
    specific.reviewers(this);
  }

  public final boolean updateVersion(Double oldVersion) {
    return EntityVersionPolicy.updateVersion(
        original, updated, changeDescription, oldVersion, majorVersionChange);
  }

  public final boolean fieldsChanged() {
    return EntityChangeRecorder.hasChanges(changeDescription);
  }

  public final boolean incrementalFieldsChanged() {
    return EntityChangeRecorder.hasChanges(incrementalChangeDescription);
  }

  /** Event type produced by this update: ENTITY_UPDATED when this request changed any field. */
  public final EventType getChangeType() {
    return incrementalFieldsChanged() ? ENTITY_UPDATED : ENTITY_NO_CHANGE;
  }

  public final <K> boolean recordChange(String field, K orig, K updated) {
    return recordChange(field, orig, updated, false, objectMatch, true);
  }

  public final <K> boolean recordChange(String field, K orig, K updated, boolean jsonValue) {
    return recordChange(field, orig, updated, jsonValue, objectMatch, true);
  }

  public final <K> boolean recordChange(
      String field, K orig, K updated, boolean jsonValue, BiPredicate<K, K> typeMatch) {
    return recordChange(field, orig, updated, jsonValue, typeMatch, true);
  }

  public final <K> boolean recordChange(
      String field,
      K orig,
      K updated,
      boolean jsonValue,
      BiPredicate<K, K> typeMatch,
      boolean updateVersion) {
    if (!shouldCompare(field)
        || (!updateVersion && entityChanged)
        || !EntityChangeRecorder.differs(orig, updated, typeMatch)) {
      return false;
    }
    entityChanged = true;
    if (updateVersion) {
      EntityChangeRecorder.recordValue(changeDescription, field, orig, updated, jsonValue);
    }
    return true;
  }

  @Override
  public final boolean recordReferenceChange(
      String field, EntityReference original, EntityReference updated) {
    return recordChange(field, original, updated, true, entityReferenceMatch);
  }

  @Override
  public final boolean recordReferenceChanges(
      String field, EntityChangeRecorder.ListChange<EntityReference> values) {
    return recordListChange(
        field,
        values.original(),
        values.updated(),
        values.added(),
        values.deleted(),
        values.match());
  }

  public final <K> boolean recordListChange(
      String field,
      List<K> origList,
      List<K> updatedList,
      List<K> addedItems,
      List<K> deletedItems,
      BiPredicate<K, K> typeMatch) {
    return shouldCompare(field)
        && EntityChangeRecorder.recordList(
            changeDescription,
            field,
            new EntityChangeRecorder.ListChange<>(
                origList, updatedList, addedItems, deletedItems, typeMatch));
  }

  public final void updateToRelationships(
      EntityRelationshipUpdates.Target target,
      EntityRelationshipUpdates.References references,
      boolean bidirectional) {
    context.metadata().relationships().outgoing(this, target, references, bidirectional);
  }

  public final void updateToRelationship(
      EntityRelationshipUpdates.Target target,
      EntityReference original,
      EntityReference updated,
      boolean bidirectional) {
    context
        .metadata()
        .relationships()
        .outgoingSingle(this, target, original, updated, bidirectional);
  }

  public final void updateFromRelationships(
      EntityRelationshipUpdates.Target target, EntityRelationshipUpdates.References references) {
    context.metadata().relationships().incoming(this, target, references);
  }

  public final void updateFromRelationship(
      EntityRelationshipUpdates.Target target, EntityReference original, EntityReference updated) {
    context.metadata().relationships().incomingSingle(this, target, original, updated);
  }

  public final void storeUpdate() {
    context.execution().store().store(this, false);
  }

  public final void storeUpdateWithOptimisticLocking() {
    context.execution().store().store(this, true);
  }

  /** Publishes the committed row and both ID/FQN aliases on the owning request thread. */
  @Override
  public final void publishStoredEntity() {
    context.hooks().publish().accept(updated, originalFqn);
  }

  @Override
  public final boolean isPut() {
    return operation.isPut();
  }

  @Override
  public final boolean isPatch() {
    return operation.isPatch();
  }

  @Override
  public final void recordUnversionedChange(String field, Object original, Object updated) {
    recordChange(field, original, updated, true, objectMatch, false);
  }

  @Override
  public final boolean isOverrideMetadata() {
    return overrideMetadata;
  }

  @Override
  public final String updatingUserName() {
    return updatingUser.getName();
  }

  @Override
  public final void deferTagEffect(Runnable effect) {
    deferReactOperation(effect);
  }

  @Override
  public final void recordTagChanges(
      String field, List<TagLabel> original, List<TagLabel> updated) {
    recordListChange(field, original, updated, new ArrayList<>(), new ArrayList<>(), tagLabelMatch);
  }

  public final boolean updatedByBot() {

    return Boolean.TRUE.equals(updatingUser.getIsBot());
  }

  /**
   * Whether the bot performing this update is denied {@code operation} by policy. A PUT or bulk
   * update authorizes with the coarse EDIT_ALL operation, which does not intersect a field-level
   * deny (e.g. DisplayName-Deny on the ingestion bot), so callers re-apply the field-level check
   * here. Returns false for users the policy does not explicitly deny (including the SCIM bot).
   */
  @Override
  public final boolean updatingBotDeniedOperation(MetadataOperation operation) {
    return mutationPermissions.denies(operation);
  }

  @VisibleForTesting
  public static void setSessionTimeout(long timeout) {
    sessionTimeoutMillis = timeout;
  }

  @VisibleForTesting
  public static long getSessionTimeout() {
    return sessionTimeoutMillis;
  }

  boolean consolidateChanges(T original, T updated, EntityOperation operation) {
    return specific.consolidate(this, original, updated, operation);
  }
}
