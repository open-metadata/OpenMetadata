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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO.TargetHolder;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Shows a glossary term's pending labels once the term is approved
 * (ADR:2026-11-06-only-approved-glossary-terms-can-be-newly-applied-to-an-asset). A label is
 * pending when a write applied the term before it was Approved. Approval flips the term's pending
 * labels to Confirmed in batches, then refreshes the cache and the search document of every entity
 * holding one of their targets. Each batch commits on its own, so a crash leaves only the rest of
 * the labels pending, and {@link #applyApproved} picks them up again.
 */
@Slf4j
public final class GlossaryTermPendingLabels {
  static final int BATCH_SIZE = 500;
  private static final int GLOSSARY = TagLabel.TagSource.GLOSSARY.ordinal();

  private GlossaryTermPendingLabels() {}

  /** Shows the term's pending labels in the background, after the approval commits. */
  public static void showWhenApproved(GlossaryTerm term) {
    String termFqn = term.getFullyQualifiedName();
    AsyncService.getInstance()
        .getExecutorService()
        .submit(
            () -> {
              try {
                applyApproved(termFqn);
              } catch (RuntimeException e) {
                LOG.error("Could not show the pending labels of glossary term {}", termFqn, e);
              }
            });
  }

  /** Drops the term's pending labels: a rejected term is never shown on them. */
  public static void dropRejected(GlossaryTerm term) {
    int dropped =
        dao().deletePending(GLOSSARY, FullyQualifiedName.buildHash(term.getFullyQualifiedName()));
    LOG.info("Dropped {} pending labels of rejected glossary term {}", dropped, term.getName());
  }

  /**
   * Shows every pending label of the term, batch by batch, and returns how many it showed. A label
   * that would be mutually exclusive with a term its target already shows stays pending.
   */
  public static int applyApproved(String termFqn) {
    TagLabel label = termLabel(termFqn);
    String termHash = FullyQualifiedName.buildHash(termFqn);
    int shown = 0;
    String after = "";
    List<String> targets = dao().listPendingTargetHashes(GLOSSARY, termHash, after, BATCH_SIZE);
    while (!targets.isEmpty()) {
      shown += showBatch(termHash, label, targets);
      after = targets.getLast();
      targets = dao().listPendingTargetHashes(GLOSSARY, termHash, after, BATCH_SIZE);
    }
    LOG.info("Showed {} pending labels of approved glossary term {}", shown, termFqn);
    return shown;
  }

  private static int showBatch(String termHash, TagLabel label, List<String> targets) {
    List<String> showable = withoutExclusiveConflicts(label, targets);
    int shown = showable.isEmpty() ? 0 : dao().confirmPending(GLOSSARY, termHash, showable);
    if (shown > 0) {
      refreshHolders(showable);
    }
    return shown;
  }

  // The term joins the labels each target already shows; a target where they would be mutually
  // exclusive keeps the label pending, as a write applying it there would be refused.
  private static List<String> withoutExclusiveConflicts(TagLabel label, List<String> targets) {
    Map<String, List<TagLabel>> shownByTarget = dao().getTagsByTargetFQNHashes(targets);
    List<String> showable = new ArrayList<>();
    for (String target : targets) {
      List<TagLabel> labels = new ArrayList<>(shownByTarget.getOrDefault(target, List.of()));
      labels.add(label);
      try {
        TagLabelUtil.checkMutuallyExclusive(labels);
        showable.add(target);
      } catch (IllegalArgumentException conflict) {
        LOG.warn("Kept glossary term {} pending on {}: {}", label.getTagFQN(), target, conflict);
      }
    }
    return showable;
  }

  // Entities are cached, and indexed for search, with their labels, so each one holding a target
  // that now shows the term is evicted and indexed again.
  private static void refreshHolders(List<String> targetHashes) {
    for (TargetHolder holder : holders(targetHashes)) {
      try {
        EntityReference ref =
            Entity.getEntityReferenceById(holder.entityType(), holder.id(), Include.ALL);
        EntityRepository.invalidateCacheForEntity(
            holder.entityType(), holder.id(), ref.getFullyQualifiedName());
        Entity.getSearchRepository().updateEntity(ref);
      } catch (RuntimeException e) {
        LOG.warn("Could not refresh {} {}", holder.entityType(), holder.id(), e);
      }
    }
  }

  /**
   * The entities whose FQN hash is a target's hash or one of its prefixes: the entity a label is on,
   * or the one whose field it is on. Two entity types can share an FQN; both are refreshed.
   */
  static Set<TargetHolder> holders(List<String> targetHashes) {
    Set<String> hashes = new HashSet<>();
    targetHashes.forEach(
        hash -> {
          hashes.add(hash);
          hashes.addAll(FqnKeyedRowCleanup.properPrefixes(hash));
        });
    Map<String, String> bindings = new LinkedHashMap<>();
    hashes.forEach(hash -> bindings.put("h" + bindings.size(), hash));
    String inList = bindings.keySet().stream().map(name -> ":" + name).collect(joining(", "));
    String probes =
        holderTables().entrySet().stream()
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
    return probes.isEmpty() ? Set.of() : new HashSet<>(dao().listTargetHolders(probes, bindings));
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
