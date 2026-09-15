package org.openmetadata.service.context.center;

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.entity.context.ContextMemory;

/**
 * Finds stored memories that resemble a freshly-derived candidate, so reconciliation can catch a
 * duplicate that lives on a different source. Recall only — the reconciler applies the
 * deterministic similarity gate; a probe must never be the thing that decides.
 */
public interface MemoryDuplicateProbe {

  /** The slice of a search hit the duplicate gate needs. */
  record ProbeHit(UUID id, String question, String answer, String sourceType) {}

  /** Best-effort: a failing search returns an empty list, never throws. */
  List<ProbeHit> findSimilar(ContextMemory candidate);
}
