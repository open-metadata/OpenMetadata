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
import org.openmetadata.schema.entity.context.ContextMemoryScope;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
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
 * derived from its last source is hard-deleted; a shared pill is detached from only the changed
 * source. A pill a human has edited (sourceType flipped to Manual) is left untouched, and so is one
 * moved out of Approved: re-extraction never rewrites it or approves it again. Equivalent
 * file-derived facts may be linked to more than one source; retiring one source preserves the
 * memory while another still references it.
 */
@Slf4j
public class ContextMemoryReconciler {
  private final ContextMemoryRepository memoryRepository;
  private final DuplicateFinder duplicateFinder;

  @FunctionalInterface
  public interface DuplicateFinder {
    ContextMemory findEquivalent(ContextMemory derived);
  }

  public ContextMemoryReconciler(ContextMemoryRepository memoryRepository) {
    this(memoryRepository, ignored -> null);
  }

  public ContextMemoryReconciler(
      ContextMemoryRepository memoryRepository, DuplicateFinder duplicateFinder) {
    this.memoryRepository = memoryRepository;
    this.duplicateFinder = duplicateFinder;
  }

  /** Counts of what the run did, by reconciliation outcome. */
  public record ReconcileResult(int created, int updated, int kept, int deleted) {}

  public ReconcileResult reuseExtractedFrom(
      EntityReference sourceRef, EntityReference existingSourceRef) {
    List<ContextMemory> existing =
        memoryRepository.listExtractedMemories(
            existingSourceRef.getId(), existingSourceRef.getType());
    if (existing.isEmpty() || existing.stream().anyMatch(pill -> !isReusableFileMemory(pill))) {
      return null;
    }
    for (ContextMemory pill : existing) {
      memoryRepository.linkExtractedMemory(pill.getId(), sourceRef);
    }
    return new ReconcileResult(0, 0, existing.size(), 0);
  }

  private boolean isReusableFileMemory(ContextMemory pill) {
    return pill.getSourceType() == ContextMemorySourceType.FILE_EXTRACTION
        && pill.getEntityStatus() == ContextMemoryStatus.APPROVED
        && pill.getMemoryScope() == ContextMemoryScope.ENTITY_SCOPED
        && pill.getShareConfig() != null
        && pill.getShareConfig().getVisibility() == MemoryVisibility.ENTITY;
  }

  public ReconcileResult reconcile(
      EntityReference sourceRef, String sourceType, List<ContextMemory> derived) {
    Map<String, ContextMemory> derivedByQuestion = indexByQuestion(derived);
    List<ContextMemory> existing =
        memoryRepository.listExtractedMemories(sourceRef.getId(), sourceType);
    ReconciliationPlan plan = new ReconciliationPlan();

    List<ContextMemory> unmatched = planExactMatches(sourceRef, derivedByQuestion, existing, plan);
    planSimilarMatches(sourceRef, derivedByQuestion, unmatched, plan);
    planNewMemories(sourceRef, derivedByQuestion.values(), plan);
    // ADR:2026-10-27-memory-reconciliation-resolves-comparisons-before-writes
    plan.writes.forEach(Runnable::run);

    LOG.info(
        "Reconciled pills for {} {}: {} created, {} updated, {} kept, {} deleted",
        sourceRef.getType(),
        sourceRef.getId(),
        plan.created,
        plan.updated,
        plan.kept,
        plan.deleted);
    return new ReconcileResult(plan.created, plan.updated, plan.kept, plan.deleted);
  }

  private List<ContextMemory> planExactMatches(
      EntityReference sourceRef,
      Map<String, ContextMemory> derivedByQuestion,
      List<ContextMemory> existing,
      ReconciliationPlan plan) {
    List<ContextMemory> unmatched = new ArrayList<>();
    for (ContextMemory pill : existing) {
      ContextMemory match = derivedByQuestion.remove(questionKey(pill));
      if (match == null) {
        unmatched.add(pill);
      } else {
        planMatchedMemory(sourceRef, pill, match, derivedByQuestion, plan);
      }
    }
    return unmatched;
  }

  private void planSimilarMatches(
      EntityReference sourceRef,
      Map<String, ContextMemory> derivedByQuestion,
      List<ContextMemory> unmatched,
      ReconciliationPlan plan) {
    for (ContextMemory pill : unmatched) {
      ContextMemory match = removeMostSimilar(derivedByQuestion, pill);
      if (match == null) {
        if (isAutomated(pill)) {
          planRelease(sourceRef, pill, plan);
        }
      } else {
        planMatchedMemory(sourceRef, pill, match, derivedByQuestion, plan);
      }
    }
  }

  private void planNewMemories(
      EntityReference sourceRef, Iterable<ContextMemory> derived, ReconciliationPlan plan) {
    for (ContextMemory pill : derived) {
      ContextMemory equivalent = duplicateFinder.findEquivalent(pill);
      if (equivalent == null || plan.changingIds.contains(equivalent.getId())) {
        plan.writes.add(() -> memoryRepository.create(null, pill));
        plan.created++;
      } else {
        plan.writes.add(() -> memoryRepository.linkExtractedMemory(equivalent.getId(), sourceRef));
        plan.kept++;
      }
    }
  }

  private void planMatchedMemory(
      EntityReference sourceRef,
      ContextMemory existing,
      ContextMemory derived,
      Map<String, ContextMemory> unmatched,
      ReconciliationPlan plan) {
    if (isEngineManaged(existing)
        && !releaseSharedIfChanged(sourceRef, existing, derived, unmatched, plan)) {
      if (planUpdate(existing, derived, plan)) {
        plan.updated++;
      } else {
        plan.kept++;
      }
    }
  }

  private void planRelease(
      EntityReference sourceRef, ContextMemory memory, ReconciliationPlan plan) {
    plan.writes.add(() -> memoryRepository.releaseExtractedMemory(memory.getId(), sourceRef));
    plan.changingIds.add(memory.getId());
    plan.deleted++;
  }

  private boolean releaseSharedIfChanged(
      EntityReference sourceRef,
      ContextMemory existing,
      ContextMemory derived,
      Map<String, ContextMemory> unmatched,
      ReconciliationPlan plan) {
    if (sameContent(existing, derived)
        || !memoryRepository.hasOtherSources(existing.getId(), sourceRef)) {
      return false;
    }
    planRelease(sourceRef, existing, plan);
    unmatched.put(questionKey(derived), derived);
    return true;
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
   * Plans an in-place update from the newly-derived match, preserving id/name/telemetry.
   * Returns true only when something actually changed, so an unchanged pill keeps its embedding
   * instead of being needlessly re-indexed.
   */
  private boolean planUpdate(
      ContextMemory existing, ContextMemory derived, ReconciliationPlan plan) {
    boolean changed = !sameContent(existing, derived) || needsMetadataRepair(existing);
    if (changed) {
      ContextMemory updated = JsonUtils.deepCopy(existing, ContextMemory.class);
      updated.setTitle(derived.getTitle());
      updated.setQuestion(derived.getQuestion());
      updated.setAnswer(derived.getAnswer());
      updated.setSummary(derived.getSummary());
      updated.setMemoryType(derived.getMemoryType());
      if (updated.getMemoryScope() == null) {
        updated.setMemoryScope(derived.getMemoryScope());
      }
      if (updated.getPrimaryEntity() == null) {
        updated.setPrimaryEntity(derived.getPrimaryEntity());
      }
      if (needsVisibilityRepair(updated)) {
        updated.setShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY));
      }
      updated.setUpdatedBy(Entity.ADMIN_USER_NAME);
      updated.setUpdatedAt(System.currentTimeMillis());
      plan.writes.add(
          () -> memoryRepository.update(null, existing, updated, Entity.ADMIN_USER_NAME));
      plan.changingIds.add(existing.getId());
    }
    return changed;
  }

  private boolean needsMetadataRepair(ContextMemory memory) {
    return memory.getMemoryScope() == null
        || memory.getPrimaryEntity() == null
        || needsVisibilityRepair(memory);
  }

  private boolean needsVisibilityRepair(ContextMemory memory) {
    MemoryShareConfig config = memory.getShareConfig();
    return config == null
        || config.getVisibility() == null
        || (config.getVisibility() == MemoryVisibility.SHARED
            && (config.getSharedWith() == null || config.getSharedWith().isEmpty()));
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

  /**
   * The engine only maintains Approved pills. Extraction creates every pill Approved, so any other
   * stage was a reviewer's decision that re-extracting the same fact must not undo.
   */
  private boolean isEngineManaged(ContextMemory pill) {
    return isAutomated(pill) && pill.getEntityStatus() == ContextMemoryStatus.APPROVED;
  }

  private String questionKey(ContextMemory pill) {
    String question = pill.getQuestion();
    return question == null ? "" : question.trim().toLowerCase(Locale.ROOT);
  }

  private static final class ReconciliationPlan {
    private final List<Runnable> writes = new ArrayList<>();
    private final Set<UUID> changingIds = new HashSet<>();
    private int created;
    private int updated;
    private int kept;
    private int deleted;
  }
}
