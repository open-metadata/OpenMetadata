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
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.secrets.SecretsManager.SecretInventory;

/** Ownership survives entity deletion and aliases; callers hold the lock in their DB transaction. */
public final class SecretMapOwnership {
  private static final String EXTENSION = "secrets.mapOwnership";
  private static final UUID LOCK_ID = namespaceId("lock");
  private static final ThreadLocal<Map<Handle, WriteInputs>> WRITE_INPUTS = new ThreadLocal<>();
  private final EntityExtensionDAO dao;
  private final SecretsManager manager;

  public SecretMapOwnership(EntityExtensionDAO dao, SecretsManager manager) {
    this.dao = dao;
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
    private final Handle handle;

    private WriteInputs(Handle handle) {
      this.handle = handle;
      handle.afterCommit(this::clear);
      handle.afterRollback(this::restore);
    }

    private void capture(List<? extends EntityInterface<?>> entities) {
      entities.forEach(entity -> snapshots.computeIfAbsent(entity, JsonUtils::toTokenBuffer));
    }

    private void restore() {
      try {
        snapshots.forEach(JsonUtils::overwriteFromTokenBuffer);
      } finally {
        clear();
      }
    }

    private void clear() {
      snapshots.clear();
      Map<Handle, WriteInputs> transactions = WRITE_INPUTS.get();
      transactions.remove(handle);
      if (transactions.isEmpty()) {
        WRITE_INPUTS.remove();
      }
    }
  }

  public void lock() {
    // A stable row also serializes namespace creation and cleanup after its entity row disappears.
    dao.insert(LOCK_ID, EXTENSION, EXTENSION, "{}");
  }

  public void recordWrite(
      UUID owner, SecretInventory original, SecretInventory input, SecretInventory stored) {
    State state = load(stored.root());
    Owner previous = state.owners().get(owner);
    Set<String> scalars = new HashSet<>();
    if (previous != null) {
      scalars.addAll(previous.scalars());
    } else if (original != null) {
      state.owned().addAll(original.storedMaps());
      scalars.addAll(original.storedScalars());
    }
    state.owned().addAll(input.writtenMaps());
    scalars.addAll(input.writtenScalars());
    state.owners().put(owner, new Owner(stored.references(), scalars));
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
    save(deleted.root(), state);
  }

  public void clean(String root) {
    State state = load(root);
    Set<String> removed = new HashSet<>(state.owned());
    state.owners().values().forEach(owner -> removed.removeAll(owner.references()));
    removed.forEach(manager::deleteStoredSecret);
    state.owned().removeAll(removed);
    save(root, state);
  }

  private State load(String root) {
    String json = dao.getExtensionForUpdate(namespaceId(root), EXTENSION);
    return json == null
        ? new State(new HashSet<>(), new HashMap<>())
        : JsonUtils.readValue(json, State.class);
  }

  private void save(String root, State state) {
    if (state.owned().isEmpty() && state.owners().isEmpty()) {
      dao.delete(namespaceId(root), EXTENSION);
    } else {
      dao.insert(namespaceId(root), EXTENSION, EXTENSION, JsonUtils.pojoToJson(state));
    }
  }

  private static UUID namespaceId(String root) {
    return UUID.nameUUIDFromBytes((EXTENSION + ":" + root).getBytes(StandardCharsets.UTF_8));
  }

  private record Owner(Set<String> references, Set<String> scalars) {}

  private record State(Set<String> owned, Map<UUID, Owner> owners) {}
}
