package org.openmetadata.service.secrets;

import com.fasterxml.jackson.databind.util.TokenBuffer;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.secrets.SecretsManager.SecretInventory;

/** Ownership survives entity deletion and aliases; callers hold the lock in their DB transaction. */
@Slf4j
public final class SecretMapOwnership {
  private static final String EXTENSION = "secrets.mapOwnership";
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

  public void clean(String root) {
    State state = load(root);
    for (String retiredRoot : state.cleanupRoots()) {
      cleanOwned(retiredRoot, load(retiredRoot));
    }
    state.cleanupRoots().clear();
    cleanOwned(root, state);
  }

  private void cleanOwned(String root, State state) {
    Set<String> liveReferences = new HashSet<>();
    state
        .owners()
        .values()
        .forEach(
            owner ->
                owner
                    .references()
                    .forEach(ref -> liveReferences.add(manager.canonicalSecretName(ref))));
    Set<String> removed = new HashSet<>();
    for (String owned : state.owned()) {
      if (!liveReferences.contains(manager.canonicalSecretName(owned))) {
        removed.add(owned);
      }
    }
    if (!removed.isEmpty()) {
      Set<String> unreferenced = references.unreferenced(removed);
      for (String name : removed) {
        String canonical = manager.canonicalSecretName(name);
        if (unreferenced.contains(canonical)) {
          manager.deleteStoredSecret(name);
          state.owned().remove(name);
          references.forget(canonical);
        } else {
          references.defer(canonical, root);
        }
      }
    }
    save(root, state);
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
