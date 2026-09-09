package org.openmetadata.service.context.center;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;

/**
 * Reconciles a freshly-derived set of knowledge pills against the pills already linked to a Context
 * Center source, instead of deleting and recreating them wholesale on every run. Matching happens
 * in two passes — exact normalized question first, then word-overlap similarity — so a re-derived
 * fact keeps its pill identity (and the usageCount/lastUsedAt retrieval telemetry that rides it)
 * even when the model rephrases the question between runs. An automated pill that is no longer
 * derived from the source is hard-deleted (these pills are regenerable from the source, so a
 * tombstone would only leave an invisible row polluting search and counts). A pill a human has
 * edited (sourceType flipped to Manual) is left untouched. Before creating a genuinely new pill,
 * a best-effort search probe checks whether another source already carries the same fact, so two
 * documents stating one policy yield one pill, not two.
 */
@Slf4j
public class ContextMemoryReconciler {
  private final ContextMemoryRepository memoryRepository;
  private final MemoryDuplicateProbe duplicateProbe;

  public ContextMemoryReconciler(ContextMemoryRepository memoryRepository) {
    this(memoryRepository, new SearchMemoryDuplicateProbe());
  }

  ContextMemoryReconciler(
      ContextMemoryRepository memoryRepository, MemoryDuplicateProbe duplicateProbe) {
    this.memoryRepository = memoryRepository;
    this.duplicateProbe = duplicateProbe;
  }

  /** Counts of what the run did, by reconciliation outcome. */
  public record ReconcileResult(
      int created, int updated, int kept, int deleted, int skippedDuplicates) {}

  public ReconcileResult reconcile(
      EntityReference sourceRef, String sourceType, List<ContextMemory> derived) {
    Map<String, ContextMemory> derivedByQuestion = indexByQuestion(derived);
    List<ContextMemory> existing =
        memoryRepository.listExtractedMemories(sourceRef.getId(), sourceType);
    Counts counts = new Counts();

    // Pass 1: exact normalized-question match. Always claim the matching question, even for a
    // human-owned (Manual) pill: it stops a re-derived duplicate from being created alongside it.
    // Only automated pills are then updated; a pill a human edited is left exactly as-is.
    List<ContextMemory> unmatched = new ArrayList<>();
    for (ContextMemory pill : existing) {
      ContextMemory match = derivedByQuestion.remove(questionKey(pill));
      if (match == null) {
        unmatched.add(pill);
      } else if (isAutomated(pill)) {
        if (applyDerived(pill, match)) {
          counts.updated++;
        } else {
          counts.kept++;
        }
      }
    }

    // Pass 2: similarity match for rephrased questions — the same fact reworded keeps its pill
    // identity instead of being retired and recreated. Runs before retirement so a rephrase can
    // never look like a removal.
    for (ContextMemory pill : unmatched) {
      ContextMemory match = removeMostSimilar(derivedByQuestion, pill);
      if (match == null) {
        if (isAutomated(pill)) {
          deleteRetired(pill);
          counts.deleted++;
        }
      } else if (isAutomated(pill)) {
        if (applyDerived(pill, match)) {
          counts.updated++;
        } else {
          counts.kept++;
        }
      }
    }

    // Pass 3: genuinely new candidates. Skip one that another source already carries.
    Set<UUID> thisSourcePillIds = new HashSet<>();
    existing.forEach(pill -> thisSourcePillIds.add(pill.getId()));
    for (ContextMemory pill : derivedByQuestion.values()) {
      if (duplicateElsewhere(pill, thisSourcePillIds)) {
        counts.skippedDuplicates++;
      } else {
        memoryRepository.create(null, pill);
        counts.created++;
      }
    }

    LOG.info(
        "Reconciled pills for {} {}: {} created, {} updated, {} kept, {} deleted, {} duplicates skipped",
        sourceRef.getType(),
        sourceRef.getId(),
        counts.created,
        counts.updated,
        counts.kept,
        counts.deleted,
        counts.skippedDuplicates);
    return new ReconcileResult(
        counts.created, counts.updated, counts.kept, counts.deleted, counts.skippedDuplicates);
  }

  /**
   * Hard-deletes an automated pill the source no longer yields. These pills are regenerable from the
   * source, so removing the row (and its search/vector index entry) is cleaner than an invisible
   * ARCHIVED tombstone that would still pollute retrieval and counts.
   */
  private void deleteRetired(ContextMemory pill) {
    memoryRepository.delete(Entity.ADMIN_USER_NAME, pill.getId(), false, true);
  }

  private Map<String, ContextMemory> indexByQuestion(List<ContextMemory> derived) {
    Map<String, ContextMemory> byQuestion = new LinkedHashMap<>();
    for (ContextMemory pill : derived) {
      byQuestion.putIfAbsent(questionKey(pill), pill);
    }
    return byQuestion;
  }

  /**
   * Claims and returns the remaining candidate most similar to {@code pill}, or null when none
   * clears the identity bar. Always the best match above the bar rather than the first, so a loose
   * bar cannot let a weaker candidate take a pill a closer one should own. Claimed even for a Manual
   * pill, so a rephrased re-derivation cannot recreate a fact a human took ownership of.
   */
  private ContextMemory removeMostSimilar(
      Map<String, ContextMemory> derivedByQuestion, ContextMemory pill) {
    String bestKey = null;
    double bestScore = 0;
    for (Map.Entry<String, ContextMemory> entry : derivedByQuestion.entrySet()) {
      double score =
          MemoryTextSimilarity.weighted(
              pill.getQuestion(),
              pill.getAnswer(),
              entry.getValue().getQuestion(),
              entry.getValue().getAnswer());
      if (score >= MemoryTextSimilarity.IDENTITY_THRESHOLD && score > bestScore) {
        bestScore = score;
        bestKey = entry.getKey();
      }
    }
    return bestKey == null ? null : derivedByQuestion.remove(bestKey);
  }

  /**
   * True when another source's automated pill already states this fact. Recall comes from the
   * probe; the decision is the same deterministic word-overlap gate as the passes above. Manual
   * and chat-authored memories never suppress extraction — a user's private note must not silence
   * a document's knowledge.
   */
  private boolean duplicateElsewhere(ContextMemory candidate, Set<UUID> thisSourcePillIds) {
    for (MemoryDuplicateProbe.ProbeHit hit : duplicateProbe.findSimilar(candidate)) {
      if (thisSourcePillIds.contains(hit.id()) || !isAutomatedSourceType(hit.sourceType())) {
        continue;
      }
      double score =
          MemoryTextSimilarity.weighted(
              candidate.getQuestion(), candidate.getAnswer(), hit.question(), hit.answer());
      if (score >= MemoryTextSimilarity.DUPLICATE_THRESHOLD) {
        LOG.info(
            "Skipping duplicate pill '{}': memory {} already states it",
            candidate.getTitle(),
            hit.id());
        return true;
      }
    }
    return false;
  }

  /**
   * Updates an existing pill in place from its newly-derived match, preserving id/name/telemetry.
   * Returns true only when something actually changed, so an unchanged pill keeps its embedding
   * instead of being needlessly re-indexed.
   */
  private boolean applyDerived(ContextMemory existing, ContextMemory derived) {
    boolean changed =
        !sameContent(existing, derived) || existing.getStatus() != ContextMemoryStatus.ACTIVE;
    if (changed) {
      ContextMemory updated = JsonUtils.deepCopy(existing, ContextMemory.class);
      updated.setTitle(derived.getTitle());
      updated.setQuestion(derived.getQuestion());
      updated.setAnswer(derived.getAnswer());
      updated.setSummary(derived.getSummary());
      updated.setMemoryType(derived.getMemoryType());
      updated.setStatus(ContextMemoryStatus.ACTIVE);
      updated.setUpdatedBy(Entity.ADMIN_USER_NAME);
      updated.setUpdatedAt(System.currentTimeMillis());
      memoryRepository.update(null, existing, updated, Entity.ADMIN_USER_NAME);
    }
    return changed;
  }

  private boolean sameContent(ContextMemory a, ContextMemory b) {
    return Objects.equals(a.getTitle(), b.getTitle())
        && Objects.equals(a.getQuestion(), b.getQuestion())
        && Objects.equals(a.getAnswer(), b.getAnswer())
        && Objects.equals(a.getSummary(), b.getSummary())
        && Objects.equals(a.getMemoryType(), b.getMemoryType());
  }

  private boolean isAutomated(ContextMemory pill) {
    return pill.getSourceType() == ContextMemorySourceType.FILE_EXTRACTION
        || pill.getSourceType() == ContextMemorySourceType.PAGE_EXTRACTION;
  }

  private boolean isAutomatedSourceType(String sourceType) {
    return ContextMemorySourceType.FILE_EXTRACTION.value().equals(sourceType)
        || ContextMemorySourceType.PAGE_EXTRACTION.value().equals(sourceType);
  }

  private String questionKey(ContextMemory pill) {
    String question = pill.getQuestion();
    return question == null ? "" : question.trim().toLowerCase(Locale.ROOT);
  }

  /** Mutable tally threaded through reconciliation to keep each step a small single-purpose method. */
  private static final class Counts {
    private int created;
    private int updated;
    private int kept;
    private int deleted;
    private int skippedDuplicates;
  }
}
