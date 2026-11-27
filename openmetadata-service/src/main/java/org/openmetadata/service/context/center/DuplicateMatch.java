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

package org.openmetadata.service.context.center;

import org.openmetadata.schema.entity.context.ContextMemory;

/**
 * What the duplicate check found for a fact a document states: a person's decision on a memory
 * covers every document that states its fact (ADR:2026-09-29-context-file-memory-reuse).
 */
public sealed interface DuplicateMatch {

  /** A memory already states the fact: the document links to it, in whatever stage it is. */
  record Equivalent(ContextMemory memory) implements DuplicateMatch {}

  /**
   * The document gives another value for a fact a person decided ({@link
   * MemoryReviewHolds#isDecided}), so its memory waits for review under every provider.
   */
  record ConflictsWithDecision(ContextMemory decided) implements DuplicateMatch {}

  /** No memory states the fact. */
  record None() implements DuplicateMatch {}
}
