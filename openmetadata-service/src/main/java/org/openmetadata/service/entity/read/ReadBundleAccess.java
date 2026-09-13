package org.openmetadata.service.entity.read;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.FIELD_VOTES;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Votes;

/** Reads exact request-bundle coverage while preserving field-specific fallback metrics. */
@Slf4j
public final class ReadBundleAccess {
  private final String entityType;
  private final Supplier<ReadBundle> bundles;
  private final BiConsumer<String, String> fallback;

  public ReadBundleAccess(
      final String entityType,
      final Supplier<ReadBundle> bundles,
      final BiConsumer<String, String> fallback) {
    this.entityType = entityType;
    this.bundles = bundles;
    this.fallback = fallback;
  }

  public Optional<List<EntityReference>> relations(
      final EntityInterface entity, final String field, final Include include) {
    if (entity == null || entity.getId() == null) {
      return Optional.empty();
    }
    final ReadBundle bundle = bundles.get();
    if (bundle == null) {
      fallback.accept(field, "no_bundle");
      return Optional.empty();
    }
    final Optional<List<EntityReference>> references =
        bundle.getRelations(entity.getId(), field, include);
    if (references.isEmpty()) {
      recordMissingRelation(entity, field, include, bundle);
    }
    return references;
  }

  private void recordMissingRelation(
      final EntityInterface entity,
      final String field,
      final Include include,
      final ReadBundle bundle) {
    final Include requested = include == null ? ALL : include;
    final Set<Include> loaded = bundle.getLoadedIncludesForField(entity.getId(), field);
    final boolean mismatch = !loaded.isEmpty() && !loaded.contains(requested);
    if (mismatch) {
      LOG.debug(
          "ReadBundle include mismatch for {}:{} field={} requestedInclude={} loadedIncludes={}. Falling back to DAO.",
          entityType,
          entity.getId(),
          field,
          requested,
          loaded);
    }
    fallback.accept(field, mismatch ? "include_mismatch" : "not_loaded");
  }

  public Optional<Votes> votes(final EntityInterface entity) {
    if (entity == null || entity.getId() == null) {
      return Optional.empty();
    }
    final ReadBundle bundle = bundles.get();
    if (bundle == null) {
      fallback.accept(FIELD_VOTES, "no_bundle");
      return Optional.empty();
    }
    final Optional<Votes> votes = bundle.getVotes(entity.getId());
    if (votes.isEmpty()) {
      fallback.accept(FIELD_VOTES, "not_loaded");
    }
    return votes;
  }
}
