/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.search.projection;

/**
 * Who owns a document path, and therefore what a rebuild is allowed to do to it.
 *
 * <p>This is the concept the audit forced. "One projector, two masks" assumes every field is a pure
 * function of the entity, so a full rebuild is always safe — and that is false. The codebase already
 * knew it and worked around it twice, per-field and without shared vocabulary: the bulk sinks splice
 * cached embeddings back into a rebuilt document, and {@code documentUpdateScript} is
 * presence-preserving so a routine rebuild does not clobber fenced relationship fields.
 *
 * <p>The rule that makes rebuilds safe: {@code Upsert(ALL)} is authoritative for {@link #DERIVED}
 * only. {@link #FENCED} is written solely under its ordinal CAS. {@link #CARRIED} is spliced from the
 * existing document or regenerated — never written empty.
 */
public enum FieldOwnership {
  /**
   * A pure function of the entity and its parents — recompute and overwrite. {@code description},
   * {@code owners}, {@code tags}, {@code tier}, {@code fqnParts}, {@code columns}.
   */
  DERIVED,

  /**
   * Owned by a specific writer and ordered by a monotonic ordinal, not versioned on the entity. Never
   * overwritten blindly; a writer that does not hold the ordinal must preserve what is there. {@code
   * testSuites} + {@code testSuitesRevision}, {@code tests} + {@code testsRevision}.
   */
  FENCED,

  /**
   * Not reconstructible from the entity at acceptable cost — read forward from the existing document
   * or regenerate. {@code embedding}, {@code fingerprint}, {@code lineageSqlQueries}.
   */
  CARRIED
}
