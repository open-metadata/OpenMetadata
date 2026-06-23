/*
 * Copyright 2024 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.openmetadata.service.drive.memory;

import java.util.List;

/**
 * Grounding context supplied to the memory agent.
 *
 * <p>{@code terms}, {@code metrics}, and {@code glossaries} are cross-document candidates surfaced
 * by keyword search (glossaries are the full existing set, so the agent reuses one rather than
 * minting near-duplicates). {@code siblingTerms} are the terms already derived from OTHER memories
 * of the SAME source document — read straight from the repository so they are visible even before
 * the search index catches up; they give the agent concrete FQNs to relate to. {@code
 * siblingGlossaryFqn} is the glossary those siblings already live in, used to pin a document's whole
 * concept set into one glossary.
 */
public record MemoryContext(
    List<MemoryCandidate> terms,
    List<MemoryCandidate> metrics,
    List<MemoryCandidate> glossaries,
    List<MemoryCandidate> siblingTerms,
    String siblingGlossaryFqn) {

  /** Backward-compatible constructor for call sites that predate sibling grounding. */
  public MemoryContext(
      List<MemoryCandidate> terms,
      List<MemoryCandidate> metrics,
      List<MemoryCandidate> glossaries) {
    this(terms, metrics, glossaries, List.of(), null);
  }
}
