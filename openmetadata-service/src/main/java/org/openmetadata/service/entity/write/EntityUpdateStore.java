package org.openmetadata.service.entity.write;

import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import java.util.function.BiConsumer;
import java.util.function.Consumer;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.history.EntityVersionPolicy;
import org.openmetadata.service.entity.history.EntityVersionStore;

/** Persists version decisions within an already-open update transaction. */
public final class EntityUpdateStore<T extends EntityInterface> {
  public record Rows<T>(Consumer<T> current, BiConsumer<T, Double> optimistic) {}

  private final EntityVersionStore<T> history;
  private final Rows<T> rows;

  public EntityUpdateStore(final EntityVersionStore<T> history, final Rows<T> rows) {
    this.history = history;
    this.rows = rows;
  }

  public void store(final EntityMutationState<T> state, final boolean optimistic) {
    final boolean checkVersion =
        optimistic
            && !EntityVersionPolicy.isConsolidating(
                state.getPrevious(), state.getChangeDescription());
    updateVersion(state);
    if (state.isVersionChanged()) {
      storeVersionChange(state, checkVersion);
    } else {
      storeWithoutVersionChange(state, checkVersion);
    }
  }

  private void updateVersion(final EntityMutationState<T> state) {
    try (var ignored = phase("storeUpdateVersioning")) {
      state.setVersionChanged(
          EntityVersionPolicy.updateVersion(
              state.getOriginal(),
              state.getUpdated(),
              state.getChangeDescription(),
              state.getOriginal().getVersion(),
              state.isMajorVersionChange()));
    }
  }

  private void storeVersionChange(final EntityMutationState<T> state, final boolean optimistic) {
    try (var ignored = phase("storeUpdateHistory")) {
      history.insert(state.getOriginal());
    }
    storeCurrent(state, optimistic);
  }

  private void storeWithoutVersionChange(
      final EntityMutationState<T> state, final boolean optimistic) {
    EntityVersionPolicy.retainUnversionedAudit(
        state.getOriginal(),
        state.getUpdated(),
        state.getChangeDescription(),
        state.isEntityChanged());
    if (state.isEntityChanged()) {
      storeCurrent(state, optimistic);
    } else if (state.getPrevious() != null
        && state.getPrevious().getVersion().equals(state.getUpdated().getVersion())) {
      storeCurrent(state, false);
      try (var ignored = phase("storeUpdateHistoryCleanup")) {
        history.remove(state.getOriginal().getId(), state.getUpdated().getVersion());
      }
    }
  }

  private void storeCurrent(final EntityMutationState<T> state, final boolean optimistic) {
    try (var ignored = phase(optimistic ? "storeUpdateCurrentOptimistic" : "storeUpdateCurrent")) {
      if (optimistic) {
        rows.optimistic().accept(state.getUpdated(), state.getOriginal().getVersion());
      } else {
        rows.current().accept(state.getUpdated());
      }
      state.setEntityStored(true);
    }
  }
}
