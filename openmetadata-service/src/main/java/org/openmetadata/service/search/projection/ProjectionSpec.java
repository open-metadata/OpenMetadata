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

import java.util.Set;

/**
 * Declared lineage from an entity field to the document paths it feeds, plus who owns each path.
 *
 * <p>This replaces {@code PARTIAL_SCRIPT_SUPPORTED_FIELDS}: instead of a hand-maintained allowlist of
 * seven fields that may be written partially, the allowlist becomes "has a declared lineage", which
 * grows organically. The safety property is that rot is <em>safe</em> — an entity field with no entry
 * degrades to a full write via {@link MutationPlanner}, never to a wrong document.
 *
 * <p>Implementations belong next to the index class they describe, so the declaration cannot drift
 * away from the builder it documents.
 */
public interface ProjectionSpec {

  /**
   * Document paths that change when {@code entityField} changes.
   *
   * <p>An empty set means "unknown", which the planner must treat as a full write. It does not mean
   * "this field affects nothing" — a field that genuinely affects nothing still needs an explicit
   * empty declaration to be distinguishable, which is why {@link #declares(String)} exists.
   */
  Set<String> docPathsFor(String entityField);

  /** Whether a lineage is declared for this field at all. */
  boolean declares(String entityField);

  /**
   * Paths written on every projection regardless of mask — {@code updatedAt}, {@code version}, the
   * write ordinal. Without these a partial write could leave a document whose ordering fields
   * describe an older state than its content.
   */
  Set<String> alwaysProjected();

  /** Ownership of a document path; {@link FieldOwnership#DERIVED} unless declared otherwise. */
  default FieldOwnership ownershipOf(String docPath) {
    return FieldOwnership.DERIVED;
  }
}
