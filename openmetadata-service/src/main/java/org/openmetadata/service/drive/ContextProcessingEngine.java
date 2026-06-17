package org.openmetadata.service.drive;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.data.ExtractionStats;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.drive.ContextMemoryExtractor.DeriveResult;
import org.openmetadata.service.drive.ContextMemoryReconciler.ReconcileResult;

/**
 * Shared core of Context Center knowledge-pill extraction. Given a source entity (a ContextFile, a
 * Page, ...) it loads the source text, skips work when the content is unchanged (hash gate),
 * derives pills via the LLM, reconciles them against the source's existing pills, and stamps the
 * source's extractionStats. Subclasses supply the per-source bits: how to load the text and its
 * hash, where the extractionStats live, the entity type, and the sourceType to tag pills with.
 */
@Slf4j
public abstract class ContextProcessingEngine {
  protected final ContextMemoryExtractor extractor;
  protected final ContextMemoryReconciler reconciler;

  protected ContextProcessingEngine(
      ContextMemoryExtractor extractor, ContextMemoryReconciler reconciler) {
    this.extractor = extractor;
    this.reconciler = reconciler;
  }

  /** A source's current text, a stable hash of it, and the reference pills are linked back to. */
  public record Source(String text, String hash, EntityReference sourceRef) {}

  /** Outcome of a runExtraction call: a skip (unchanged content) or a processed run with stats. */
  public record ExtractionOutcome(
      boolean skipped, ExtractionStats stats, ReconcileResult reconciled) {
    static ExtractionOutcome skip() {
      return new ExtractionOutcome(true, null, null);
    }

    static ExtractionOutcome processed(ExtractionStats stats, ReconcileResult reconciled) {
      return new ExtractionOutcome(false, stats, reconciled);
    }
  }

  /**
   * Runs the full pipeline for one source. Skips when the content hash matches the last successful
   * run (so the LLM is never called for unchanged content) and when a never-extracted source is
   * empty. A source that was previously extracted and has since been emptied is NOT skipped: it is
   * reconciled against an empty derived set so its now-stale pills are archived rather than left
   * ACTIVE forever.
   */
  public final ExtractionOutcome runExtraction(UUID entityId) {
    ExtractionOutcome outcome = ExtractionOutcome.skip();
    Source source = loadSource(entityId);
    if (source != null) {
      ExtractionStats previous = loadStats(entityId);
      if (shouldProcess(source, previous)) {
        outcome = extractAndReconcile(entityId, source);
      }
    }
    return outcome;
  }

  private boolean shouldProcess(Source source, ExtractionStats previous) {
    boolean hasContent = source.text() != null && !source.text().isBlank();
    boolean everExtracted = previous != null;
    boolean changed = previous == null || !source.hash().equals(previous.getSourceHash());
    return (hasContent || everExtracted) && changed;
  }

  private ExtractionOutcome extractAndReconcile(UUID entityId, Source source) {
    DeriveResult derived = extractor.derive(source.text(), source.sourceRef(), sourceType());
    ReconcileResult reconciled =
        reconciler.reconcile(source.sourceRef(), entityType(), derived.memories());
    ExtractionStats stats =
        new ExtractionStats()
            .withChunksTotal(derived.chunksTotal())
            .withChunksProcessed(derived.chunksProcessed())
            .withPillsCreated(reconciled.created())
            .withLastExtractedAt(System.currentTimeMillis())
            .withSourceHash(source.hash());
    stampStats(entityId, stats);
    return ExtractionOutcome.processed(stats, reconciled);
  }

  protected abstract Source loadSource(UUID entityId);

  protected abstract ExtractionStats loadStats(UUID entityId);

  protected abstract void stampStats(UUID entityId, ExtractionStats stats);

  protected abstract String entityType();

  protected abstract ContextMemorySourceType sourceType();
}
