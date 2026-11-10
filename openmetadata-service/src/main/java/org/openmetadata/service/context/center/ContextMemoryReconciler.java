package org.openmetadata.service.context.center;

import java.util.ArrayList;
import java.util.Comparator;
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
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;

/**
 * Reconciles a freshly-derived set of knowledge pills against the pills already linked to a Context
 * Center source, instead of deleting and recreating them wholesale on every run. Matching happens
 * in two passes — exact normalized question and answer first, for every pill, then word-overlap
 * similarity that never pairs two pills whose numbers conflict — so a re-derived
 * fact keeps its pill identity (and the usageCount/lastUsedAt retrieval telemetry that rides it)
 * even when the model rephrases the question between runs. An extracted pill still Approved or
 * Unprocessed that is no longer derived from its last source is hard-deleted; a shared pill is
 * detached from only the changed source. So is one held in Draft for a review, which closes with
 * it, though re-extraction never rewrites it. A pill a person decided, by editing it (sourceType
 * flipped to Manual) or by a review that moved it to any other stage, is left untouched:
 * re-extraction never rewrites it, approves it again or releases it. A derived value no pill claims
 * that resembles a Draft or decided pill may be that pill reworded, so it starts Unprocessed: one
 * clearing the identity bar with no conflicting number, and beside a correction also any with a
 * conflicting number whose question alone clears the bar, however low the whole pair scores, so a
 * correction holds every such value it does not claim. Two answers the source gives to one question
 * stay two pills for review. Equivalent file-derived facts may be linked to more than one source;
 * retiring one source preserves the memory while another still references it.
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
    Map<String, ContextMemory> derivedByQuestion = indexByFact(derived);
    List<ContextMemory> existing =
        memoryRepository.listExtractedMemories(sourceRef.getId(), sourceType);
    ReconciliationPlan plan = new ReconciliationPlan();

    List<ContextMemory> unmatched = planExactMatches(sourceRef, derivedByQuestion, existing, plan);
    planSimilarMatches(sourceRef, derivedByQuestion, unmatched, plan);
    planHolds(existing, derivedByQuestion, plan);
    planNewMemories(sourceRef, derivedByQuestion, plan);
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
      ContextMemory match = derivedByQuestion.remove(factKey(pill));
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
    // Extracted pills claim their rewordings first, so a pill a person corrected takes only what
    // they leave and never swallows another value the document gives for the same fact.
    List<ContextMemory> ordered = new ArrayList<>(unmatched);
    ordered.sort(Comparator.comparing(ContextMemoryReconciler::isHumanOwned));
    for (ContextMemory pill : ordered) {
      ContextMemory match = removeMostSimilar(derivedByQuestion, pill);
      if (match == null) {
        if (isReleasedWhenUnclaimed(pill)) {
          planRelease(sourceRef, pill, plan);
        }
      } else {
        planMatchedMemory(sourceRef, pill, match, derivedByQuestion, plan);
      }
    }
  }

  /**
   * Runs after both passes, so an exactly matched pill holds too and nothing claimed is held. A
   * value resembling a Draft or decided pill may be that pill reworded, so it must not ground
   * unreviewed.
   */
  private static void planHolds(
      List<ContextMemory> existing,
      Map<String, ContextMemory> derivedByQuestion,
      ReconciliationPlan plan) {
    for (ContextMemory pill : existing) {
      derivedByQuestion.entrySet().stream()
          .filter(entry -> MemoryReviewHolds.holds(pill, entry.getValue()))
          .map(Map.Entry::getKey)
          .forEach(plan.heldForReview::add);
    }
  }

  private void planNewMemories(
      EntityReference sourceRef,
      Map<String, ContextMemory> derivedByQuestion,
      ReconciliationPlan plan) {
    for (Map.Entry<String, ContextMemory> entry : derivedByQuestion.entrySet()) {
      ContextMemory pill = entry.getValue();
      ContextMemory equivalent = duplicateFinder.findEquivalent(pill);
      if (equivalent == null || plan.changingIds.contains(equivalent.getId())) {
        planCreate(pill, plan.heldForReview.contains(entry.getKey()), plan);
      } else {
        plan.writes.add(() -> memoryRepository.linkExtractedMemory(equivalent.getId(), sourceRef));
        plan.kept++;
      }
    }
  }

  /** A value held for review starts Unprocessed, whatever stage extraction derived it in. */
  private void planCreate(ContextMemory pill, boolean heldForReview, ReconciliationPlan plan) {
    if (heldForReview) {
      pill.setEntityStatus(ContextMemoryStatus.UNPROCESSED);
    }
    plan.writes.add(
        () -> memoryRepository.create(null, pill.withUpdatedAt(System.currentTimeMillis())));
    plan.created++;
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
    plan.writes.add(() -> release(memory, sourceRef));
    plan.changingIds.add(memory.getId());
    plan.deleted++;
  }

  /** Like this run's other conditional writes, a release a decision overtook leaves the link. */
  private void release(ContextMemory memory, EntityReference sourceRef) {
    try {
      memoryRepository.releaseExtractedMemory(memory.getId(), sourceRef);
    } catch (PreconditionFailedException e) {
      LOG.info("Memory {} changed while its source was re-extracted; link left", memory.getId());
    }
  }

  private boolean releaseSharedIfChanged(
      EntityReference sourceRef,
      ContextMemory existing,
      ContextMemory derived,
      Map<String, ContextMemory> unmatched,
      ReconciliationPlan plan) {
    if (sameClaim(existing, derived)
        || !memoryRepository.hasOtherSources(existing.getId(), sourceRef)) {
      return false;
    }
    planRelease(sourceRef, existing, plan);
    unmatched.put(factKey(derived), derived);
    return true;
  }

  /** Keyed by question and answer, so two answers the document gives to one question both stay. */
  private Map<String, ContextMemory> indexByFact(List<ContextMemory> derived) {
    Map<String, ContextMemory> byFact = new LinkedHashMap<>();
    for (ContextMemory pill : derived) {
      byFact.putIfAbsent(factKey(pill), pill);
    }
    return byFact;
  }

  private record Candidate(String key, double score, boolean conflicting, boolean sameQuestion) {}

  /**
   * Claims and returns the remaining candidate most similar to {@code pill}, or null when it may
   * claim none. Always the best match above the bar rather than the first, so a loose bar cannot
   * let a weaker candidate take a pill a closer one should own. A changed number is a different
   * claim, never the same pill reworded, and a pill the engine does not maintain claims only its
   * own question's rewording. A pill a person corrected also claims the document's value for its
   * own question when that is the only one left, so the value is never recreated beside the
   * correction and no other fact is taken for it.
   */
  private static ContextMemory removeMostSimilar(
      Map<String, ContextMemory> derivedByQuestion, ContextMemory pill) {
    List<Candidate> clearing = candidatesClearingTheBar(derivedByQuestion, pill);
    Candidate best =
        clearing.stream()
            .filter(
                candidate ->
                    !candidate.conflicting() && (isEngineManaged(pill) || candidate.sameQuestion()))
            .max(Comparator.comparingDouble(Candidate::score))
            .orElse(null);
    if (best == null && isHumanOwned(pill)) {
      List<Candidate> ownQuestion = clearing.stream().filter(Candidate::sameQuestion).toList();
      best = ownQuestion.size() == 1 ? ownQuestion.getFirst() : null;
    }
    return best == null ? null : derivedByQuestion.remove(best.key());
  }

  private static List<Candidate> candidatesClearingTheBar(
      Map<String, ContextMemory> derivedByQuestion, ContextMemory pill) {
    List<Candidate> clearing = new ArrayList<>();
    for (Map.Entry<String, ContextMemory> entry : derivedByQuestion.entrySet()) {
      ContextMemory candidate = entry.getValue();
      double score =
          MemoryTextSimilarity.weighted(
              pill.getQuestion(), pill.getAnswer(), candidate.getQuestion(), candidate.getAnswer());
      if (score >= MemoryTextSimilarity.IDENTITY_THRESHOLD) {
        clearing.add(candidateFor(entry.getKey(), score, pill, candidate));
      }
    }
    return clearing;
  }

  private static Candidate candidateFor(
      String key, double score, ContextMemory pill, ContextMemory candidate) {
    return new Candidate(
        key,
        score,
        MemoryTextSimilarity.hasConflictingNumbers(pill.getAnswer(), candidate.getAnswer()),
        MemoryTextSimilarity.sameQuestion(pill.getQuestion(), candidate.getQuestion()));
  }

  /**
   * Plans an in-place update from the newly-derived match, preserving id/name/telemetry.
   * Returns true only when something actually changed, so an unchanged pill keeps its embedding
   * instead of being needlessly re-indexed.
   */
  private boolean planUpdate(
      ContextMemory existing, ContextMemory derived, ReconciliationPlan plan) {
    boolean contentChanged = !sameContent(existing, derived);
    boolean changed = contentChanged || needsMetadataRepair(existing);
    if (changed) {
      ContextMemory updated = JsonUtils.deepCopy(existing, ContextMemory.class);
      if (!sameClaim(existing, derived) && derived.getEntityStatus() != null) {
        // A reviewing provider derives Unprocessed, so a changed claim is reviewed again; a
        // reworded title or summary is the same claim and keeps the stage it was reviewed in.
        updated.setEntityStatus(derived.getEntityStatus());
      }
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
      plan.writes.add(() -> updateIfCurrent(existing, updated));
      plan.changingIds.add(existing.getId());
    }
    return changed;
  }

  /**
   * Stamped when the write runs, not when it was planned, so a reconciliation run reading past this
   * write's time never misses it; and conditional, so a review decided while the source was being
   * re-extracted is not overwritten by the snapshot this plan was made from.
   */
  private void updateIfCurrent(ContextMemory existing, ContextMemory updated) {
    updated.setUpdatedAt(System.currentTimeMillis());
    try {
      memoryRepository.updateIfCurrent(null, existing, updated, Entity.ADMIN_USER_NAME);
    } catch (PreconditionFailedException e) {
      LOG.info("Memory {} changed while its source was re-extracted; left as is", existing.getId());
    }
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

  private static boolean sameClaim(ContextMemory a, ContextMemory b) {
    return factKey(a).equals(factKey(b));
  }

  private static boolean isHumanOwned(ContextMemory pill) {
    return pill.getSourceType() == ContextMemorySourceType.MANUAL;
  }

  private static boolean isAutomated(ContextMemory pill) {
    return pill.getSourceType() == ContextMemorySourceType.FILE_EXTRACTION
        || pill.getSourceType() == ContextMemorySourceType.PAGE_EXTRACTION;
  }

  private static boolean isEngineManaged(ContextMemory pill) {
    return MemoryReviewHolds.isEngineManaged(pill);
  }

  /** A pill the engine maintains leaves with its fact, and so does one held in Draft. */
  private static boolean isReleasedWhenUnclaimed(ContextMemory pill) {
    return isEngineManaged(pill) || isHeldInDraft(pill);
  }

  /** Draft holds an extracted pill for a review that has not decided; releasing it closes it. */
  private static boolean isHeldInDraft(ContextMemory pill) {
    return isAutomated(pill) && pill.getEntityStatus() == ContextMemoryStatus.DRAFT;
  }

  private static String questionKey(ContextMemory pill) {
    return normalized(pill.getQuestion());
  }

  /** Where a document says a value is written is no part of the claim, so it is left out. */
  private static String factKey(ContextMemory pill) {
    return questionKey(pill)
        + '\n'
        + normalized(MemoryTextSimilarity.withoutCitations(pill.getAnswer()));
  }

  private static String normalized(String text) {
    return text == null ? "" : text.trim().toLowerCase(Locale.ROOT);
  }

  private static final class ReconciliationPlan {
    private final List<Runnable> writes = new ArrayList<>();
    private final Set<UUID> changingIds = new HashSet<>();

    /** Fact keys of unclaimed derived values resembling a Draft or decided pill. */
    private final Set<String> heldForReview = new HashSet<>();

    private int created;
    private int updated;
    private int kept;
    private int deleted;
  }
}
