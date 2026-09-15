package org.openmetadata.service.entity.cache;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.entity.write.DeferredCacheInvalidations.Invalidator;
import org.openmetadata.service.jdbi3.EntityDAO.EntityIdFqnPair;

/** Resolves rename and tag invalidation targets without extending transaction lifetimes. */
@Slf4j
public final class EntityCacheTargets {
  @FunctionalInterface
  public interface Descendants {
    List<EntityIdFqnPair> find(String type, String prefix);
  }

  @FunctionalInterface
  public interface TaggedPage {
    List<EntityReference> find(String tagFqn, int offset) throws IOException;
  }

  public interface SearchDeferral {
    boolean active();

    void defer(Runnable search, String tagFqn);
  }

  private final Descendants descendants;
  private final TaggedPage taggedPage;
  private final SearchDeferral deferral;
  private final Invalidator invalidator;

  public EntityCacheTargets(
      final Descendants descendants,
      final TaggedPage taggedPage,
      final SearchDeferral deferral,
      final Invalidator invalidator) {
    this.descendants = descendants;
    this.taggedPage = taggedPage;
    this.deferral = deferral;
    this.invalidator = invalidator;
  }

  public List<EntityIdFqnPair> beforeRename(final String type, final String prefix) {
    final List<EntityIdFqnPair> affected =
        type == null || nullOrEmpty(prefix) ? List.of() : descendants(type, prefix);
    evict(type, affected);
    if (!affected.isEmpty()) {
      LOG.info(
          "Invalidated cache for {} descendants of rename cascade: type={} prefix={}",
          affected.size(),
          type,
          prefix);
    }
    return affected;
  }

  public void afterRename(final String type, final List<EntityIdFqnPair> affected) {
    if (type != null && !nullOrEmpty(affected)) {
      evict(type, affected);
      LOG.debug(
          "Post-rename-write re-invalidated cache for {} descendants: type={}",
          affected.size(),
          type);
    }
  }

  private void evict(final String type, final List<EntityIdFqnPair> affected) {
    for (final EntityIdFqnPair row : affected) {
      invalidator.invalidate(type, row.id, row.fqn);
    }
  }

  public int tagged(final String tagFqn) {
    int result = 0;
    if (!nullOrEmpty(tagFqn)) {
      if (deferral.active()) {
        deferral.defer(() -> walkTaggedEntities(tagFqn), tagFqn);
      } else {
        result = walkTaggedEntities(tagFqn);
      }
    }
    return result;
  }

  public int tagged(final Collection<String> tagFqns) {
    int total = 0;
    if (!nullOrEmpty(tagFqns)) {
      for (final String fqn : tagFqns) {
        total += tagged(fqn);
      }
      if (total > 0) {
        LOG.info(
            "Invalidated cache for {} entities across {} renamed tag FQNs", total, tagFqns.size());
      }
    }
    return total;
  }

  public int taggedDescendants(final String type, final String prefix) {
    final List<String> fqns = new ArrayList<>();
    if (type != null && !nullOrEmpty(prefix)) {
      fqns.add(prefix);
      for (final EntityIdFqnPair descendant : descendants(type, prefix)) {
        if (descendant.fqn != null && !descendant.fqn.equals(prefix)) {
          fqns.add(descendant.fqn);
        }
      }
    }
    return tagged(fqns);
  }

  private List<EntityIdFqnPair> descendants(final String type, final String prefix) {
    try {
      return descendants.find(type, prefix);
    } catch (RuntimeException exception) {
      LOG.warn(
          "Failed to enumerate descendants for cache invalidation: type={} prefix={}",
          type,
          prefix,
          exception);
      return List.of();
    }
  }

  private int walkTaggedEntities(final String tagFqn) {
    int total = 0;
    List<EntityReference> page = page(tagFqn, total);
    while (!page.isEmpty()) {
      for (final EntityReference reference : page) {
        invalidator.invalidate(
            reference.getType(), reference.getId(), reference.getFullyQualifiedName());
        total++;
      }
      page = page(tagFqn, total);
    }
    if (total > 0) {
      LOG.info("Invalidated cache for {} entities tagged with: {}", total, tagFqn);
    }
    return total;
  }

  private List<EntityReference> page(final String tagFqn, final int offset) {
    try {
      return taggedPage.find(tagFqn, offset);
    } catch (IOException | RuntimeException exception) {
      LOG.warn("Search-based cache invalidation failed for tag={}", tagFqn, exception);
      return List.of();
    }
  }
}
