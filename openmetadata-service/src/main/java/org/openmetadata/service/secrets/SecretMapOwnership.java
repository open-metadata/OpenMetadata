package org.openmetadata.service.secrets;

import com.fasterxml.jackson.databind.util.TokenBuffer;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.secrets.SecretsManager.SecretInventory;
import org.openmetadata.service.util.PostCommitActionQueue;

/** Ownership survives entity deletion and aliases; callers hold the lock in their DB transaction. */
@Slf4j
public final class SecretMapOwnership {
  private static final String EXTENSION = "secrets.mapOwnership";
  private static final String DELETED_WORKFLOW = "secrets.pendingWorkflowCleanup";
  private static final String WORKFLOW_CURSOR = "secrets.workflowCleanupCursor";
  private static final int WORKFLOW_PAGE_SIZE = 100;
  private static final UUID LOCK_ID = namespaceId("lock");
  private static final ThreadLocal<Map<Handle, WriteInputs>> WRITE_INPUTS = new ThreadLocal<>();
  private final EntityExtensionDAO dao;
  private final SecretsManager manager;
  private final SharedSecretReferences references;

  public SecretMapOwnership(EntityExtensionDAO dao, SecretsManager manager) {
    this.dao = dao;
    this.references = new SharedSecretReferences(dao, manager);
    this.manager = manager;
  }

  public static void preserveWriteInputs(
      CollectionDAO dao, List<? extends EntityInterface<?>> entities) {
    dao.useHandle(handle -> inputsFor(handle).capture(entities));
  }

  private static WriteInputs inputsFor(Handle handle) {
    Map<Handle, WriteInputs> transactions = WRITE_INPUTS.get();
    if (transactions == null) {
      transactions = new IdentityHashMap<>();
      WRITE_INPUTS.set(transactions);
    }
    return transactions.computeIfAbsent(handle, WriteInputs::new);
  }

  /** Active-transaction state only: the first snapshot wins, even when an object is written twice. */
  private static final class WriteInputs {
    private final Map<EntityInterface<?>, TokenBuffer> snapshots = new IdentityHashMap<>();
    private final Map<SecretsManager, Set<String>> freshSecrets = new IdentityHashMap<>();
    private final Handle handle;

    private WriteInputs(Handle handle) {
      this.handle = handle;
      handle.afterCommit(this::clear);
      handle.afterRollback(this::restore);
    }

    private void capture(List<? extends EntityInterface<?>> entities) {
      entities.forEach(entity -> snapshots.computeIfAbsent(entity, JsonUtils::toTokenBuffer));
    }

    private void trackFreshSecret(SecretsManager manager, String name) {
      freshSecrets.computeIfAbsent(manager, ignored -> new HashSet<>()).add(name);
    }

    private void restore() {
      try {
        freshSecrets.forEach(
            (manager, names) -> names.forEach(name -> deleteAfterRollback(manager, name)));
        snapshots.forEach(JsonUtils::overwriteFromTokenBuffer);
      } finally {
        clear();
      }
    }

    private void clear() {
      snapshots.clear();
      freshSecrets.clear();
      Map<Handle, WriteInputs> transactions = WRITE_INPUTS.get();
      transactions.remove(handle);
      if (transactions.isEmpty()) {
        WRITE_INPUTS.remove();
      }
    }
  }

  private static void deleteAfterRollback(SecretsManager manager, String name) {
    try {
      manager.deleteStoredSecret(name);
    } catch (RuntimeException e) {
      // Provider errors may include credential material. Preserve the original transaction error.
      LOG.warn(
          "Failed to delete fresh secret [{}] after rollback ({})",
          name,
          e.getClass().getSimpleName());
    }
  }

  public void lock() {
    // A stable row also serializes namespace creation and cleanup after its entity row disappears.
    dao.insert(LOCK_ID, EXTENSION, EXTENSION, "{}");
  }

  public <T> WriteContext<T> forWrite(
      CollectionDAO collection, UUID owner, String root, T original) {
    State state = load(root);
    Set<String> owned = new HashSet<>(state.owned());
    Owner previous = state.owners().get(owner);
    if (previous != null) {
      owned.addAll(previous.scalars());
    }
    Set<String> canonicalNames = new HashSet<>();
    owned.forEach(name -> canonicalNames.add(manager.canonicalSecretName(name)));
    return new WriteContext<>(
        original,
        canonicalNames,
        name -> collection.useHandle(handle -> inputsFor(handle).trackFreshSecret(manager, name)),
        new HashSet<>());
  }

  public static final class WriteContext<T> {
    private final T original;
    private final Set<String> ownedNames;
    private final Consumer<String> onFreshCreate;
    private final Set<String> createdNames;

    private WriteContext(
        T original,
        Set<String> ownedNames,
        Consumer<String> onFreshCreate,
        Set<String> createdNames) {
      this.original = original;
      this.ownedNames = ownedNames;
      this.onFreshCreate = onFreshCreate;
      this.createdNames = createdNames;
    }

    static <T> WriteContext<T> untracked(T original) {
      return new WriteContext<>(original, Set.of(), name -> {}, new HashSet<>());
    }

    public T original() {
      return original;
    }

    public <U> WriteContext<U> withOriginal(U convertedOriginal) {
      return new WriteContext<>(convertedOriginal, ownedNames, onFreshCreate, createdNames);
    }

    boolean owns(String canonicalName) {
      return ownedNames.contains(canonicalName);
    }

    void freshCreated(String name) {
      onFreshCreate.accept(name);
      createdNames.add(name);
    }
  }

  public void recordWrite(
      UUID owner, SecretInventory original, SecretInventory input, SecretInventory stored) {
    recordWrite(owner, original, input, stored, WriteContext.untracked(null));
  }

  public void recordWrite(
      UUID owner,
      SecretInventory original,
      SecretInventory input,
      SecretInventory stored,
      WriteContext<?> context) {
    State state = load(stored.root());
    Owner previous = state.owners().get(owner);
    Set<String> scalars = new HashSet<>();
    if (previous != null) {
      scalars.addAll(previous.scalars());
    } else if (original != null) {
      state.owned().addAll(original.storedMaps());
      scalars.addAll(original.storedScalars());
    }
    state.owned().addAll(stored.writtenSecretsFor(input.writtenMaps()));
    scalars.addAll(stored.writtenSecretsFor(input.writtenScalars()));
    // Generated scalar keys use the same post-commit reference cleanup as map entries. Older
    // ledgers kept them among the owner's deterministic scalars until hard deletion.
    Set<String> generatedNames = new HashSet<>();
    context.createdNames.forEach(name -> generatedNames.add(manager.canonicalSecretName(name)));
    if (original != null) {
      original
          .referencesBySlot()
          .forEach(
              (slot, ref) -> {
                if (manager.isGeneratedListReference(original.root(), slot, ref)) {
                  generatedNames.add(manager.canonicalSecretName(ref));
                }
              });
    }
    for (var iterator = scalars.iterator(); iterator.hasNext(); ) {
      String name = iterator.next();
      if (generatedNames.contains(manager.canonicalSecretName(name))) {
        state.owned().add(name);
        iterator.remove();
      }
    }
    state.owners().put(owner, new Owner(stored.references(), scalars));
    state
        .cleanupRoots()
        .addAll(
            references.rootsReleasedBy(
                stored.root(), priorReferences(previous, original), stored.references()));
    save(stored.root(), state);
  }

  public void removeOwner(UUID owner, SecretInventory deleted) {
    State state = load(deleted.root());
    Owner previous = state.owners().remove(owner);
    if (previous == null) {
      state.owned().addAll(deleted.storedMaps());
      state.owned().addAll(deleted.storedScalars());
    } else {
      state.owned().addAll(previous.scalars());
    }
    state
        .cleanupRoots()
        .addAll(
            references.rootsReleasedBy(
                deleted.root(), priorReferences(previous, deleted), Set.of()));
    save(deleted.root(), state);
  }

  /** A borrowed key remains owned by its original configuration. */
  public boolean recordReleasedReferences(SecretInventory before, Set<String> remaining) {
    Set<String> released =
        references.rootsReleasedBy(before.root(), before.references(), remaining);
    if (!released.isEmpty()) {
      State state = load(before.root());
      state.cleanupRoots().addAll(released);
      save(before.root(), state);
    }
    return !released.isEmpty();
  }

  private static Set<String> priorReferences(Owner previous, SecretInventory original) {
    Set<String> references = new HashSet<>();
    if (previous != null) {
      references.addAll(previous.references());
    }
    if (original != null) {
      references.addAll(original.references());
    }
    return references;
  }

  public UUID recordWorkflowDeletion(UUID id, SecretInventory deleted) {
    removeOwner(id, deleted);
    UUID marker = namespaceId(deleted.root());
    dao.insert(marker, DELETED_WORKFLOW, DELETED_WORKFLOW, JsonUtils.pojoToJson(deleted.root()));
    return marker;
  }

  private void cleanDeletedWorkflow(UUID marker) {
    String json = dao.getExtensionForUpdate(marker, DELETED_WORKFLOW);
    if (json != null) {
      cleanNamespace(JsonUtils.readValue(json, String.class));
      dao.delete(marker, DELETED_WORKFLOW);
    }
  }

  public void cleanDeletedWorkflows(CollectionDAO collection, Iterable<UUID> markers) {
    for (UUID marker : markers) {
      try {
        inOwnershipTransaction(
            collection,
            ledger -> {
              ledger.cleanDeletedWorkflow(marker);
              return null;
            });
      } catch (RuntimeException e) {
        // Each root has its own transaction. A provider failure keeps its marker for another pass.
        LOG.warn(
            "Workflow credential cleanup {} remains pending ({})",
            marker,
            e.getClass().getSimpleName());
      }
    }
  }

  private <R> R inOwnershipTransaction(
      CollectionDAO collection, Function<SecretMapOwnership, R> work) {
    return collection.inTransaction(
        transaction -> {
          SecretMapOwnership ledger =
              new SecretMapOwnership(transaction.entityExtensionDAO(), manager);
          ledger.lock();
          return work.apply(ledger);
        });
  }

  private List<UUID> nextWorkflowCleanupPage() {
    String cursor = dao.getExtension(LOCK_ID, WORKFLOW_CURSOR);
    String after = cursor == null ? "" : JsonUtils.readValue(cursor, String.class);
    List<String> ids = dao.listExtensionIds(DELETED_WORKFLOW, after, WORKFLOW_PAGE_SIZE);
    if (ids.isEmpty() && !after.isEmpty()) {
      ids = dao.listExtensionIds(DELETED_WORKFLOW, "", WORKFLOW_PAGE_SIZE);
    }
    if (ids.size() == WORKFLOW_PAGE_SIZE) {
      dao.insert(LOCK_ID, WORKFLOW_CURSOR, WORKFLOW_CURSOR, JsonUtils.pojoToJson(ids.getLast()));
    } else if (cursor != null) {
      dao.delete(LOCK_ID, WORKFLOW_CURSOR);
    }
    return ids.stream().map(UUID::fromString).toList();
  }

  public void clean(String root) {
    cleanNamespace(root);
    if (!dao.listExtensionIds(DELETED_WORKFLOW, "", 1).isEmpty()) {
      // The current root commits before recovery, and a persistent provider error cannot starve
      // markers on later pages. The cursor and each completed marker commit independently.
      PostCommitActionQueue.runOrDefer(
          () -> {
            CollectionDAO collection = Entity.getCollectionDAO();
            List<UUID> page =
                inOwnershipTransaction(collection, SecretMapOwnership::nextWorkflowCleanupPage);
            cleanDeletedWorkflows(collection, page);
          });
    }
  }

  private void cleanNamespace(String root) {
    State state = load(root);
    List<Cleanup> cleanups = new ArrayList<>();
    for (String retiredRoot : state.cleanupRoots()) {
      cleanups.add(pendingCleanup(retiredRoot, load(retiredRoot)));
    }
    state.cleanupRoots().clear();
    cleanups.add(pendingCleanup(root, state));

    // All of these namespaces share the same ownership lock and transaction.
    Set<String> candidates = new HashSet<>();
    cleanups.forEach(cleanup -> candidates.addAll(cleanup.candidates()));
    Set<String> unreferenced =
        candidates.isEmpty() ? Set.of() : references.unreferenced(candidates);
    for (Cleanup cleanup : cleanups) {
      for (String name : cleanup.candidates()) {
        String canonical = manager.canonicalSecretName(name);
        if (unreferenced.contains(canonical)) {
          manager.deleteStoredSecret(name);
          cleanup.state().owned().remove(name);
          references.forget(canonical);
        } else {
          references.defer(canonical, cleanup.root());
        }
      }
      save(cleanup.root(), cleanup.state());
    }
  }

  private record Cleanup(String root, State state, Set<String> candidates) {}

  private Cleanup pendingCleanup(String root, State state) {
    if (state.owned().isEmpty()) {
      return new Cleanup(root, state, Set.of());
    }
    Set<String> liveReferences = new HashSet<>();
    state
        .owners()
        .values()
        .forEach(
            owner ->
                owner
                    .references()
                    .forEach(ref -> liveReferences.add(manager.canonicalSecretName(ref))));
    Set<String> candidates = new HashSet<>();
    for (String owned : state.owned()) {
      if (!liveReferences.contains(manager.canonicalSecretName(owned))) {
        candidates.add(owned);
      }
    }
    return new Cleanup(root, state, candidates);
  }

  private State load(String root) {
    String json = dao.getExtensionForUpdate(namespaceId(root), EXTENSION);
    return json == null
        ? new State(new HashSet<>(), new HashMap<>(), new HashSet<>())
        : JsonUtils.readValue(json, State.class);
  }

  private void save(String root, State state) {
    if (state.owned().isEmpty() && state.owners().isEmpty() && state.cleanupRoots().isEmpty()) {
      dao.delete(namespaceId(root), EXTENSION);
    } else {
      dao.insert(namespaceId(root), EXTENSION, EXTENSION, JsonUtils.pojoToJson(state));
    }
  }

  private static UUID namespaceId(String root) {
    return UUID.nameUUIDFromBytes((EXTENSION + ":" + root).getBytes(StandardCharsets.UTF_8));
  }

  private record Owner(Set<String> references, Set<String> scalars) {}

  private record State(Set<String> owned, Map<UUID, Owner> owners, Set<String> cleanupRoots) {
    private State {
      // Existing namespace records predate cross-config retirement.
      cleanupRoots = cleanupRoots == null ? new HashSet<>() : cleanupRoots;
    }
  }
}
