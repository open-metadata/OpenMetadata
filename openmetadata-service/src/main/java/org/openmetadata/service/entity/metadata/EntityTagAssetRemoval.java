package org.openmetadata.service.entity.metadata;

import java.util.function.Consumer;
import java.util.function.Supplier;
import org.openmetadata.service.entity.metadata.EntityTagWriter.Target;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.util.PostCommitActionQueue;
import org.openmetadata.service.util.RequestEntityCache;

/** Removes persisted asset tags and publishes fresh projections after the owning transaction. */
public final class EntityTagAssetRemoval {
  private final Supplier<TagUsageDAO> tags;
  private final Consumer<Target> invalidate;
  private final Consumer<Target> reindex;

  public EntityTagAssetRemoval(
      final Supplier<TagUsageDAO> tags,
      final Consumer<Target> invalidate,
      final Consumer<Target> reindex) {
    this.tags = tags;
    this.invalidate = invalidate;
    this.reindex = reindex;
  }

  public void remove(
      final String tagFqn,
      final String targetFqn,
      final Target entity,
      final boolean dryRun,
      final Runnable recordSuccess) {
    if (!dryRun) {
      tags.get().deleteTagsByTagAndTargetEntity(tagFqn, targetFqn);
    }
    recordSuccess.run();
    if (!dryRun) {
      RequestEntityCache.invalidate(entity.type(), entity.id(), entity.fqn());
      PostCommitActionQueue.runOrDefer(() -> publish(entity));
    }
  }

  private void publish(final Target entity) {
    invalidate.accept(entity);
    reindex.accept(entity);
  }
}
