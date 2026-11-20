/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.jdbi3;

import static java.util.stream.Collectors.joining;

import io.dropwizard.lifecycle.Managed;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO.TargetHolder;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.search.SearchIndexRetryQueue;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Shows a glossary term's pending labels once the term is approved
 * (ADR:2026-11-06-only-approved-glossary-terms-can-be-newly-applied-to-an-asset). A label is
 * pending when a write applied the term before it was Approved. Approval flips the term's pending
 * labels in batches, then refreshes the cache and the search document of every entity holding one
 * of their targets.
 *
 * <p>Pending labels of an Approved term are shown again whenever they are found: a batch that
 * fails is retried, a write that held the term while its approval committed checks the term once
 * it commits, and the server sweeps for them when it starts, so neither a restart nor that race
 * leaves a label hidden.
 */
@Slf4j
public final class GlossaryTermPendingLabels implements Managed {
  static final int BATCH_SIZE = 500;
  static final int MAX_ATTEMPTS = 3;
  static final long RETRY_DELAY_SECONDS = 60;
  static final int SWEEP_PAGE = 1_000;
  // Bounds hashes x probed tables, which become bind variables of one query.
  static final int MAX_PROBE_BINDINGS = 20_000;
  private static final int GLOSSARY = TagLabel.TagSource.GLOSSARY.ordinal();
  private static final String SHOW_PENDING_LABELS = "showPendingGlossaryTermLabels";

  /** Sweeps for pending labels of Approved terms once the server is up. */
  @Override
  public void start() {
    AsyncService.getInstance().getExecutorService().submit(GlossaryTermPendingLabels::sweep);
  }

  @Override
  public void stop() {
    // The sweep runs once on the shared executor, which the server stops.
  }

  /** Shows the term's pending labels in the background, retrying batches that fail. */
  public static void showWhenApproved(GlossaryTerm term) {
    schedule(term.getFullyQualifiedName(), 1, 0);
  }

  /**
   * Drops the term's pending labels on an asset: on the entity and its own inline fields, or on a
   * single column and the columns nested in it. Other entities nested under its FQN keep theirs. A
   * pending term is not shown, so removing the term from an asset (the term's {@code assets/remove})
   * is how a client takes it back.
   */
  public static void dropPendingOn(GlossaryTerm term, EntityReference asset) {
    String termFqn = term.getFullyQualifiedName();
    // Only nested columns sit under a column's FQN, so its subtree is its own.
    if (Entity.TABLE_COLUMN.equals(asset.getType())) {
      dao().deletePendingUnder(GLOSSARY, termFqn, asset.getFullyQualifiedName());
    } else {
      List<String> targets =
          List.copyOf(Entity.getEntityRepository(asset.getType()).ownTargetFqns(asset.getId()));
      if (!targets.isEmpty()) {
        dao().deletePendingOnTargets(GLOSSARY, termFqn, targets);
      }
    }
  }

  /** Drops the term's pending labels: a rejected term is never shown on them. */
  public static void dropRejected(GlossaryTerm term) {
    int dropped =
        dao().deletePending(GLOSSARY, FullyQualifiedName.buildHash(term.getFullyQualifiedName()));
    LOG.info("Dropped {} pending labels of rejected glossary term {}", dropped, term.getName());
  }

  /**
   * Shows the pending labels of any of {@code termFqns} that is Approved by now. A write calls this
   * after it commits the labels it held, so a term approved while the write ran is not missed.
   */
  public static void showIfApproved(Set<String> termFqns) {
    if (!termFqns.isEmpty()) {
      TagLabelUtil.getGlossaryTerms(List.copyOf(termFqns)).stream()
          .filter(term -> term.getEntityStatus() == EntityStatus.APPROVED)
          .forEach(GlossaryTermPendingLabels::showWhenApproved);
    }
  }

  /** Shows the pending labels of every Approved term that still has some, page by page. */
  static void sweep() {
    try {
      int checked = 0;
      List<String> page = dao().listPendingTermFqns(GLOSSARY, "", SWEEP_PAGE);
      while (!page.isEmpty()) {
        showIfApproved(new HashSet<>(page));
        checked += page.size();
        page = dao().listPendingTermFqns(GLOSSARY, page.getLast(), SWEEP_PAGE);
      }
      LOG.info("Checked {} glossary terms with pending labels", checked);
    } catch (RuntimeException e) {
      LOG.error("Could not sweep pending glossary term labels", e);
    }
  }

  private static void schedule(String termFqn, int attempt, long delaySeconds) {
    CompletableFuture.runAsync(
        () -> apply(termFqn, attempt),
        CompletableFuture.delayedExecutor(
            delaySeconds, TimeUnit.SECONDS, AsyncService.getInstance().getExecutorService()));
  }

  // Each attempt re-reads the term: one deprecated or rejected since its approval is not shown.
  private static void apply(String termFqn, int attempt) {
    boolean complete;
    try {
      complete = !isApproved(termFqn) || applyApproved(termFqn).complete();
    } catch (RuntimeException e) {
      LOG.error("Could not show the pending labels of glossary term {}", termFqn, e);
      complete = false;
    }
    if (!complete && attempt < MAX_ATTEMPTS) {
      schedule(termFqn, attempt + 1, RETRY_DELAY_SECONDS);
    }
  }

  /** How many pending labels a pass showed, and whether every batch went through. */
  public record Outcome(int shown, boolean complete) {}

  /**
   * Shows every pending label of the term, batch by batch. A batch that fails is left pending for a
   * retry; a label that would be mutually exclusive with a term its target already shows stays
   * pending.
   */
  public static Outcome applyApproved(String termFqn) {
    TagLabel label = termLabel(termFqn);
    String termHash = FullyQualifiedName.buildHash(termFqn);
    int shown = 0;
    boolean complete = true;
    String after = "";
    List<String> targets = dao().listPendingTargetHashes(GLOSSARY, termHash, after, BATCH_SIZE);
    while (!targets.isEmpty()) {
      try {
        shown += showBatch(termHash, label, targets);
      } catch (RuntimeException e) {
        complete = false;
        LOG.warn("Could not show a batch of glossary term {}; it stays pending", termFqn, e);
      }
      after = targets.getLast();
      targets = dao().listPendingTargetHashes(GLOSSARY, termHash, after, BATCH_SIZE);
    }
    LOG.info("Showed {} pending labels of approved glossary term {}", shown, termFqn);
    return new Outcome(shown, complete);
  }

  // Holders are resolved before the flip, so a batch whose holders cannot be found stays pending
  // rather than showing labels on entities whose cache and search document are not refreshed.
  private static int showBatch(String termHash, TagLabel label, List<String> targets) {
    List<String> showable = withoutExclusiveConflicts(label, targets);
    Set<TargetHolder> holders = showable.isEmpty() ? Set.of() : holders(showable);
    int shown = showable.isEmpty() ? 0 : dao().confirmPending(GLOSSARY, termHash, showable);
    if (shown > 0) {
      refreshHolders(holders);
    }
    return shown;
  }

  // The term joins the labels each target already shows, with the tags those terms imply, as a
  // write applying it would be checked; a target where they would be mutually exclusive keeps the
  // label pending. Implied tags are fetched once for the batch.
  private static List<String> withoutExclusiveConflicts(TagLabel label, List<String> targets) {
    Map<String, List<TagLabel>> shownByTarget = dao().getTagsByTargetFQNHashes(targets);
    List<TagLabel> allLabels = new ArrayList<>(List.of(label));
    shownByTarget.values().forEach(allLabels::addAll);
    Map<String, List<TagLabel>> implied = TagLabelUtil.fetchImpliedTags(allLabels);
    List<String> showable = new ArrayList<>();
    for (String target : targets) {
      List<TagLabel> labels = new ArrayList<>(shownByTarget.getOrDefault(target, List.of()));
      labels.add(label);
      try {
        TagLabelUtil.checkMutuallyExclusiveForUserAppliedTags(labels, implied);
        showable.add(target);
      } catch (IllegalArgumentException conflict) {
        LOG.warn("Kept glossary term {} pending on {}: {}", label.getTagFQN(), target, conflict);
      }
    }
    return showable;
  }

  // Entities are cached, and indexed for search, with their labels, so each one holding a target
  // that now shows the term is evicted and indexed again. A document that fails to index goes on
  // the search retry queue, so search catches up with the API rather than staying stale.
  private static void refreshHolders(Set<TargetHolder> holders) {
    for (TargetHolder holder : holders) {
      EntityReference ref = null;
      try {
        ref = Entity.getEntityReferenceById(holder.entityType(), holder.id(), Include.ALL);
        EntityRepository.invalidateCacheForEntity(
            holder.entityType(), holder.id(), ref.getFullyQualifiedName());
        Entity.getSearchRepository().updateEntity(ref);
      } catch (RuntimeException e) {
        LOG.warn("Could not refresh {} {}", holder.entityType(), holder.id(), e);
        // An entity that no longer exists has no document to catch up.
        if (ref != null) {
          SearchIndexRetryQueue.enqueue(
              holder.id().toString(),
              ref.getFullyQualifiedName(),
              holder.entityType(),
              SearchIndexRetryQueue.failureReason(SHOW_PENDING_LABELS, e));
        }
      }
    }
  }

  /**
   * The assets the term's approval will show it on, a page at a time: each entity holding one of
   * its pending targets, the entity's own or one of its fields'. {@code after} is the cursor the
   * previous page returned.
   */
  public static ResultList<EntityReference> pendingAssets(String termFqn, String after, int limit) {
    List<String> targets =
        dao()
            .listPendingTargetHashes(
                GLOSSARY, FullyQualifiedName.buildHash(termFqn), after == null ? "" : after, limit);
    Map<UUID, EntityReference> assets = new LinkedHashMap<>();
    for (TargetHolder holder : targets.isEmpty() ? Set.<TargetHolder>of() : holders(targets)) {
      try {
        assets.putIfAbsent(
            holder.id(),
            Entity.getEntityReferenceById(holder.entityType(), holder.id(), Include.NON_DELETED));
      } catch (RuntimeException e) {
        LOG.debug("Pending target holder {} {} is gone", holder.entityType(), holder.id());
      }
    }
    String next = targets.size() == limit ? targets.getLast() : null;
    return new ResultList<>(List.copyOf(assets.values()), null, next, assets.size());
  }

  /**
   * The entities whose FQN hash is a target's hash or one of its prefixes: the entity a label is on,
   * or the one whose field it is on. Two entity types can share an FQN; both are refreshed. The
   * hashes are probed in chunks, so a query never binds more than {@link #MAX_PROBE_BINDINGS}.
   */
  static Set<TargetHolder> holders(List<String> targetHashes) {
    Set<String> hashes = new HashSet<>();
    targetHashes.forEach(
        hash -> {
          hashes.add(hash);
          hashes.addAll(FqnKeyedRowCleanup.properPrefixes(hash));
        });
    Map<HolderTable, String> tables = holderTables();
    Set<TargetHolder> holders = new HashSet<>();
    if (!tables.isEmpty()) {
      int chunkSize = Math.max(1, MAX_PROBE_BINDINGS / tables.size());
      List<String> all = List.copyOf(hashes);
      for (int start = 0; start < all.size(); start += chunkSize) {
        holders.addAll(probe(tables, all.subList(start, Math.min(start + chunkSize, all.size()))));
      }
    }
    return holders;
  }

  private static List<TargetHolder> probe(Map<HolderTable, String> tables, List<String> hashes) {
    Map<String, String> bindings = new LinkedHashMap<>();
    hashes.forEach(hash -> bindings.put("h" + bindings.size(), hash));
    String inList = bindings.keySet().stream().map(name -> ":" + name).collect(joining(", "));
    String probes =
        tables.entrySet().stream()
            .map(
                table ->
                    "(SELECT '%s' AS entityType, id, %s AS hash FROM %s WHERE %s IN (%s))"
                        .formatted(
                            table.getValue(),
                            table.getKey().hashColumn(),
                            table.getKey().name(),
                            table.getKey().hashColumn(),
                            inList))
            .collect(joining(" UNION ALL "));
    return dao().listTargetHolders(probes, bindings);
  }

  private record HolderTable(String name, String hashColumn) {}

  // The tables of taggable entity types, each with the entity type stored in it.
  private static Map<HolderTable, String> holderTables() {
    Map<HolderTable, String> tables = new HashMap<>();
    for (EntityRepository<?> repository : Entity.getEntityRepositories()) {
      EntityDAO<?> entityDao = repository.getDao();
      if (repository.isSupportsTags() && entityDao != null && entityDao.getTableName() != null) {
        tables.putIfAbsent(
            new HolderTable(entityDao.getTableName(), entityDao.getNameHashColumn()),
            repository.getEntityType());
      }
    }
    return tables;
  }

  private static boolean isApproved(String termFqn) {
    return TagLabelUtil.getGlossaryTerms(List.of(termFqn)).stream()
        .anyMatch(term -> term.getEntityStatus() == EntityStatus.APPROVED);
  }

  private static TagLabel termLabel(String termFqn) {
    return new TagLabel()
        .withTagFQN(termFqn)
        .withSource(TagLabel.TagSource.GLOSSARY)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static TagUsageDAO dao() {
    return Entity.getCollectionDAO().tagUsageDAO();
  }
}
