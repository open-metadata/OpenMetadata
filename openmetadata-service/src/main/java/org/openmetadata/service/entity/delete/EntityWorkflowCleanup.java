package org.openmetadata.service.entity.delete;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;

/** Cancels workflow instances only after the entity transaction commits. */
@Slf4j
public final class EntityWorkflowCleanup {
  private final BooleanSupplier initialized;
  private final Consumer<Collection<UUID>> cancel;
  private final Consumer<Runnable> afterCommit;

  public EntityWorkflowCleanup(
      final BooleanSupplier initialized,
      final Consumer<Collection<UUID>> cancel,
      final Consumer<Runnable> afterCommit) {
    this.initialized = initialized;
    this.cancel = cancel;
    this.afterCommit = afterCommit;
  }

  public void cancel(final Collection<UUID> ids) {
    if (nullOrEmpty(ids) || !initialized.getAsBoolean()) {
      return;
    }
    final List<UUID> snapshot = new ArrayList<>(ids);
    afterCommit.accept(() -> cancelAfterCommit(snapshot));
  }

  private void cancelAfterCommit(final List<UUID> ids) {
    try (var ignored = phase("bulkHardDeleteWorkflows")) {
      cancel.accept(ids);
    } catch (RuntimeException exception) {
      LOG.warn(
          "Failed to cancel workflow instances for {} entities: {}",
          ids.size(),
          exception.getMessage());
    }
  }
}
