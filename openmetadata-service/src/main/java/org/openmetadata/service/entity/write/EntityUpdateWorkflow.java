package org.openmetadata.service.entity.write;

import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.history.EntityVersionPolicy;
import org.openmetadata.service.entity.history.EntityVersionStore;

/** Orders incremental diff, session consolidation and persistence inside the caller's flush. */
@Slf4j
public final class EntityUpdateWorkflow<T extends EntityInterface> {
  public interface Session<T extends EntityInterface> extends EntityMutationState<T> {
    boolean canConsolidateChanges();

    void applyChanges(boolean importMode, boolean consolidatingChanges);
  }

  private final EntityVersionStore<T> history;
  private final EntityUpdateStore<T> store;

  public EntityUpdateWorkflow(
      final EntityVersionStore<T> history, final EntityUpdateStore<T> store) {
    this.history = history;
    this.store = store;
  }

  public void flush(final Session<T> session, final boolean optimistic, final boolean importMode) {
    if (canConsolidate(session)) {
      consolidate(session, importMode);
    } else {
      diff(session, importMode);
      try (var ignored =
          phase(
              importMode
                  ? "entityUpdateIncrementalChangeImport"
                  : "entityUpdateIncrementalChange")) {
        captureIncremental(session, true);
      }
    }
    try (var ignored = phase(optimistic ? "entityUpdateStoreOptimistic" : "entityUpdateStore")) {
      store.store(session, optimistic);
    }
  }

  private boolean canConsolidate(final Session<T> session) {
    try (var ignored = phase("entityUpdateConsolidate")) {
      return session.canConsolidateChanges();
    }
  }

  private void consolidate(final Session<T> session, final boolean importMode) {
    try (var ignored =
        phase(
            importMode ? "entityUpdateIncrementalChangeImport" : "entityUpdateIncrementalChange")) {
      session.setChangeDescription(new ChangeDescription());
      session.applyChanges(importMode, false);
      captureIncremental(session, false);
    }
    try (var ignored = phase(importMode ? "entityUpdateRevertImport" : "entityUpdateRevert")) {
      revert(session, importMode);
    }
    // The final comparison spans the whole session, including fields outside the current PATCH.
    session.setPatchedFields(null);
    diff(session, importMode);
  }

  private void diff(final Session<T> session, final boolean importMode) {
    session.setChangeDescription(new ChangeDescription());
    try (var ignored = phase(importMode ? "entityUpdateDiffImport" : "entityUpdateDiff")) {
      session.applyChanges(importMode, false);
    }
  }

  private void revert(final Session<T> session, final boolean importMode) {
    final T requested = session.getUpdated();
    session.setPrevious(history.previous(session.getOriginal()));
    if (session.getPrevious() != null) {
      restorePreviousRelationships(session, importMode);
      session.setUpdated(requested);
      session.applyChanges(importMode, false);
      session.setOriginal(session.getPrevious());
      session.setEntityChanged(false);
    }
  }

  private void restorePreviousRelationships(final Session<T> session, final boolean importMode) {
    LOG.debug(
        "In session change consolidation. Reverting to previous version {}",
        session.getPrevious().getVersion());
    session.setChangeDescription(new ChangeDescription());
    session.setUpdated(session.getPrevious());
    session.applyChanges(importMode, true);
    LOG.debug(
        "In session change consolidation. Reverting to previous version {} completed",
        session.getPrevious().getVersion());
  }

  private void captureIncremental(final EntityMutationState<T> state, final boolean copy) {
    final ChangeDescription incremental =
        copy
            ? JsonUtils.deepCopy(state.getChangeDescription(), ChangeDescription.class)
            : state.getChangeDescription();
    state.setIncrementalChangeDescription(incremental);
    incremental.setPreviousVersion(state.getOriginal().getVersion());
    state.getUpdated().setIncrementalChangeDescription(incremental);
  }

  public void updateWithDeferredStore(final Session<T> session) {
    session.setChangeDescription(new ChangeDescription());
    try (var ignored = phase("entityUpdateDiffDeferred")) {
      session.applyChanges(false, false);
    }
    try (var ignored = phase("entityUpdateIncrementalChangeDeferred")) {
      captureIncremental(session, true);
    }
    updateDeferredVersion(session);
  }

  private void updateDeferredVersion(final EntityMutationState<T> state) {
    state.setVersionChanged(
        EntityVersionPolicy.updateVersion(
            state.getOriginal(),
            state.getUpdated(),
            state.getChangeDescription(),
            state.getOriginal().getVersion(),
            state.isMajorVersionChange()));
    if (!state.isVersionChanged()) {
      EntityVersionPolicy.retainUnversionedAudit(
          state.getOriginal(),
          state.getUpdated(),
          state.getChangeDescription(),
          state.isEntityChanged());
    }
  }
}
