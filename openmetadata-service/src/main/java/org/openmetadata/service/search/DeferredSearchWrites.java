package org.openmetadata.service.search;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.OrderedLaneTask;
import org.openmetadata.service.util.LineageUtil;

/**
 * Queues the search writes a committed transaction captured, on their entities' lanes, so the
 * request returns without waiting for search. A failed write goes to the durable retry queue by the
 * entity it rewrites; a write captured with no locator already owns its recovery. Work captured to
 * run on commit runs here, in capture order, before the writes captured after it are queued.
 */
@Slf4j
public final class DeferredSearchWrites {
  private static final String LINEAGE_OPERATION = "lineage";

  private DeferredSearchWrites() {}

  public static void run(final List<SearchRepository.DeferredSearchWrite> writes) {
    for (final SearchRepository.DeferredSearchWrite write : writes) {
      if (write.runsOnCommit()) {
        runNow(write);
      } else {
        queue(
            new OrderedLaneTask(
                write::run,
                write.operation(),
                write.entityId(),
                write.entityFqn(),
                write.entityType()));
      }
    }
  }

  private static void runNow(final SearchRepository.DeferredSearchWrite write) {
    try {
      write.run();
    } catch (RuntimeException failure) {
      LOG.warn("Post-commit work '{}' failed", write.operation(), failure);
    }
  }

  public static void runLineage(final List<LineageUtil.DeferredLineageEsWrite> writes) {
    writes.forEach(write -> queue(lineageTask(write)));
  }

  /** A lineage write, on the lane of the entity whose document holds the edge. */
  public static OrderedLaneTask lineageTask(final LineageUtil.DeferredLineageEsWrite write) {
    final EntityReference entity = write.toEntity();
    return new OrderedLaneTask(
        write::run,
        LINEAGE_OPERATION,
        entity == null || entity.getId() == null ? null : entity.getId().toString(),
        entity == null ? null : entity.getFullyQualifiedName(),
        entity == null ? null : entity.getType());
  }

  private static void queue(final OrderedLaneTask write) {
    Entity.getSearchRepository().getLiveWrites().queueCommitted(write);
  }
}
