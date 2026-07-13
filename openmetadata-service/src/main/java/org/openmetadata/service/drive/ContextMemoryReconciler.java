package org.openmetadata.service.drive;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
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
 * Center source, instead of deleting and recreating them wholesale on every run. Matching by
 * normalized question preserves pill identity — and the usageCount/lastUsedAt retrieval telemetry
 * that rides it — across re-extractions. An automated pill that is no longer derived from the
 * source is hard-deleted (these pills are regenerable from the source, so a tombstone would only
 * leave an invisible row polluting search and counts). A pill a human has edited (sourceType
 * flipped to Manual) is left untouched.
 */
@Slf4j
public class ContextMemoryReconciler {
  private final ContextMemoryRepository memoryRepository;

  public ContextMemoryReconciler(ContextMemoryRepository memoryRepository) {
    this.memoryRepository = memoryRepository;
  }

  /** Counts of what the run did, by reconciliation outcome. */
  public record ReconcileResult(int created, int updated, int kept, int deleted) {}

  public ReconcileResult reconcile(
      EntityReference sourceRef, String sourceType, List<ContextMemory> derived) {
    Map<String, ContextMemory> derivedByQuestion = indexByQuestion(derived);
    List<ContextMemory> existing =
        memoryRepository.listExtractedMemories(sourceRef.getId(), sourceType);
    Counts counts = new Counts();
    for (ContextMemory pill : existing) {
      reconcileExisting(pill, derivedByQuestion, counts);
    }
    for (ContextMemory pill : derivedByQuestion.values()) {
      memoryRepository.create(null, pill);
      counts.created++;
    }
    LOG.info(
        "Reconciled pills for {} {}: {} created, {} updated, {} kept, {} deleted",
        sourceRef.getType(),
        sourceRef.getId(),
        counts.created,
        counts.updated,
        counts.kept,
        counts.deleted);
    return new ReconcileResult(counts.created, counts.updated, counts.kept, counts.deleted);
  }

  private void reconcileExisting(
      ContextMemory pill, Map<String, ContextMemory> derivedByQuestion, Counts counts) {
    // Always claim the matching question, even for a human-owned (Manual) pill: it stops a
    // re-derived duplicate from being created alongside it. Only automated pills are then updated
    // or deleted; a pill a human edited (sourceType flipped to Manual) is left exactly as-is.
    ContextMemory match = derivedByQuestion.remove(questionKey(pill));
    if (isAutomated(pill)) {
      if (match == null) {
        deleteRetired(pill);
        counts.deleted++;
      } else if (applyDerived(pill, match)) {
        counts.updated++;
      } else {
        counts.kept++;
      }
    }
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
        && Objects.equals(a.getAnswer(), b.getAnswer())
        && Objects.equals(a.getSummary(), b.getSummary())
        && Objects.equals(a.getMemoryType(), b.getMemoryType());
  }

  private boolean isAutomated(ContextMemory pill) {
    return pill.getSourceType() == ContextMemorySourceType.FILE_EXTRACTION
        || pill.getSourceType() == ContextMemorySourceType.PAGE_EXTRACTION;
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
  }
}
