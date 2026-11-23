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
import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;
import static org.openmetadata.service.util.AsyncService.DatabaseOperation.BULK_ASSET_OPERATION;

import io.dropwizard.lifecycle.Managed;
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
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO.TargetHolder;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Shows a glossary term's pending labels once the term is approved
 * (ADR:2026-11-06-only-approved-glossary-terms-can-be-newly-applied-to-an-asset). A label is
 * pending when a write applied the term before it was Approved. Approval adds the term to each
 * asset holding pending labels as an ordinary edit by the governance bot, in batches, so the asset
 * records a version and a change event and updates its cache, search document and RDF the way any
 * edit does.
 *
 * <p>Pending labels of an Approved term are shown again whenever they are found: an asset whose
 * edit fails is retried, a write that held the term while its approval committed checks the term
 * once it commits, and the server sweeps for them when it starts, so neither a restart nor that race
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

  /** Sweeps for pending labels of Approved terms once the server is up. */
  @Override
  public void start() {
    AsyncService.getInstance()
        .executeDatabaseTask(
            BULK_ASSET_OPERATION, "glossaryTermPendingSweep", GlossaryTermPendingLabels::sweep);
  }

  @Override
  public void stop() {
    // The sweep runs once on the shared database executor, which the server stops.
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

  // The delay waits on the shared executor; the job itself edits assets, so it takes one of the
  // bounded database permits and cannot drain the connection pool when many terms are approved.
  private static void schedule(String termFqn, int attempt, long delaySeconds) {
    CompletableFuture.runAsync(
        () ->
            AsyncService.getInstance()
                .executeDatabaseTask(BULK_ASSET_OPERATION, termFqn, () -> apply(termFqn, attempt)),
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

  /** How many assets a pass showed the term on, and whether every one went through. */
  public record Outcome(int shown, boolean complete) {}

  /**
   * Shows the term on every asset it is pending on, batch by batch. Each asset is an ordinary edit
   * through the entity pipeline, so it records a version and a change event and updates the cache,
   * search and RDF; its pending rows turn into shown ones as the edit writes the term. An asset
   * whose edit fails stays pending for a retry; one the edit refuses, as when the term would be
   * mutually exclusive with a tag the asset shows, stays pending without one.
   */
  public static Outcome applyApproved(String termFqn) {
    String termHash = FullyQualifiedName.buildHash(termFqn);
    int shown = 0;
    boolean complete = true;
    String after = "";
    List<String> targets = dao().listPendingTargetHashes(GLOSSARY, termHash, after, BATCH_SIZE);
    while (!targets.isEmpty()) {
      Outcome batch = showBatch(termFqn, termHash, targets);
      shown += batch.shown();
      complete &= batch.complete();
      after = targets.getLast();
      targets = dao().listPendingTargetHashes(GLOSSARY, termHash, after, BATCH_SIZE);
    }
    LOG.info("Showed approved glossary term {} on {} assets", termFqn, shown);
    return new Outcome(shown, complete);
  }

  private static Outcome showBatch(String termFqn, String termHash, List<String> targets) {
    Map<String, TagLabel> labelsByTarget = new HashMap<>();
    dao()
        .listPendingLabels(GLOSSARY, termHash, targets)
        .forEach(row -> labelsByTarget.put(row.getKey(), termLabel(termFqn, row.getValue())));
    int shown = 0;
    boolean complete = true;
    for (TargetHolder holder :
        labelsByTarget.isEmpty() ? Set.<TargetHolder>of() : holders(targets)) {
      try {
        shown += showOnHolder(termFqn, holder, labelsByTarget);
      } catch (EntityNotFoundException gone) {
        // A deleted asset keeps its pending rows; the startup sweep shows them if it is restored.
        LOG.debug(
            "Skipped glossary term {} on missing {} {}", termFqn, holder.entityType(), holder.id());
      } catch (RuntimeException e) {
        complete = false;
        LOG.warn(
            "Could not show glossary term {} on {} {}; it stays pending",
            termFqn,
            holder.entityType(),
            holder.id(),
            e);
      }
    }
    return new Outcome(shown, complete);
  }

  // One edit for all the asset's targets; if the asset refuses it, one edit per target. Any other
  // failure, from either, is the caller's to count.
  private static int showOnHolder(
      String termFqn, TargetHolder holder, Map<String, TagLabel> labelsByTarget) {
    int shown;
    try {
      shown =
          Entity.getEntityRepository(holder.entityType())
                  .showApprovedTerm(holder.id(), labelsByTarget, GOVERNANCE_BOT)
              ? 1
              : 0;
    } catch (IllegalArgumentException refused) {
      shown = showTargetByTarget(termFqn, holder, labelsByTarget);
    }
    return shown;
  }

  /**
   * After the asset refused the term on all its targets at once, as when it would be mutually
   * exclusive with a tag one of them shows, shows it on each target alone, so only the targets that
   * refuse it stay pending. Returns 1 when any target took it.
   */
  private static int showTargetByTarget(
      String termFqn, TargetHolder holder, Map<String, TagLabel> labelsByTarget) {
    EntityRepository<?> repository = Entity.getEntityRepository(holder.entityType());
    boolean anyShown = false;
    for (String target : repository.ownTargetFqns(holder.id())) {
      TagLabel label = labelsByTarget.get(FullyQualifiedName.buildHash(target));
      if (label != null) {
        try {
          String hash = FullyQualifiedName.buildHash(target);
          anyShown |= repository.showApprovedTerm(holder.id(), Map.of(hash, label), GOVERNANCE_BOT);
        } catch (IllegalArgumentException refused) {
          LOG.warn(
              "Kept glossary term {} pending on {}: {}", termFqn, target, refused.getMessage());
        }
      }
    }
    return anyShown ? 1 : 0;
  }

  // The label keeps what it was applied with: its type, reason and metadata. An automated one, as
  // ingestion sends, comes back suggested for the owner to confirm.
  private static TagLabel termLabel(String termFqn, TagLabel pending) {
    return pending
        .withTagFQN(termFqn)
        .withSource(TagLabel.TagSource.GLOSSARY)
        .withState(
            pending.getLabelType() == TagLabel.LabelType.AUTOMATED
                ? TagLabel.State.SUGGESTED
                : TagLabel.State.CONFIRMED);
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
    Set<String> pending = Set.copyOf(targets);
    Map<UUID, EntityReference> assets = new LinkedHashMap<>();
    for (TargetHolder holder : targets.isEmpty() ? Set.<TargetHolder>of() : holders(targets)) {
      try {
        if (holdsAnyOf(holder, pending)) {
          assets.putIfAbsent(
              holder.id(),
              Entity.getEntityReferenceById(holder.entityType(), holder.id(), Include.NON_DELETED));
        }
      } catch (RuntimeException e) {
        LOG.debug("Pending target holder {} {} is gone", holder.entityType(), holder.id());
      }
    }
    String next = targets.size() == limit ? targets.getLast() : null;
    return new ResultList<>(List.copyOf(assets.values()), null, next, assets.size());
  }

  // A candidate matches a target by FQN prefix. It holds the target only when the target is the
  // entity itself or one of its own fields: an entity above the target, or one whose FQN merely
  // runs into a field's (a metric named like a column), does not.
  private static boolean holdsAnyOf(TargetHolder holder, Set<String> targets) {
    EntityRepository<?> repository = Entity.getEntityRepository(holder.entityType());
    return targets.contains(holder.hash())
        || (repository.hasTaggedFields()
            && repository.ownTargetFqns(holder.id()).stream()
                .map(FullyQualifiedName::buildHash)
                .anyMatch(targets::contains));
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

  private static TagUsageDAO dao() {
    return Entity.getCollectionDAO().tagUsageDAO();
  }
}
