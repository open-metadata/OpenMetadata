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

import java.util.Map;
import java.util.Set;

/**
 * Lineage that holds for every entity type, transcribed from what the two write paths do today.
 *
 * <p>Scope is deliberately the fields whose behaviour is already established, not a guess at all of
 * them. The seven in {@code PARTIAL_SCRIPT_SUPPORTED_FIELDS} are here because the live path already
 * writes them partially, and the tag family is here because {@code TAG_RESEPARATION_SCRIPT} and
 * {@code ParseTags} already agree on what {@code tags} produces (see {@link TagDocInvariant}).
 * Anything absent degrades to a full write, so growing this map is safe and shrinking it is safe —
 * the only unsafe edit is declaring a lineage narrower than reality, which is what the projection
 * parity property test exists to catch.
 *
 * <p>Per-entity specs should compose with this one rather than replace it; entity-specific paths
 * (a table's {@code columns}, a topic's {@code messageSchema}) belong next to their index class.
 */
public class DefaultProjectionSpec implements ProjectionSpec {

  /**
   * {@code tags} feeds the derived tag fields as well as itself — that relationship is what {@link
   * TagDocInvariant} renders into both Java and painless, and declaring it here keeps a partial tag
   * write from leaving {@code tier} describing the previous tag set.
   *
   * <p>{@code tagSources} and {@code tierSources} are listed <b>in addition to</b> {@link
   * TagDocInvariant#produces()} rather than inside it, and the difference is not cosmetic. The
   * projection parity property test found them: they are label-type counts computed by {@code
   * populateCommonFields}, so a rebuild gets them right, but {@code TAG_RESEPARATION_SCRIPT} — the
   * painless half of the invariant — does not compute them. Declaring them in {@code produces()} would
   * claim the painless rendering maintains them when it does not, so they belong here, and a live
   * cascade that leans on the postlude alone still leaves them stale. That is a phase 5 gap, recorded
   * rather than papered over.
   */
  private static final Map<String, Set<String>> LINEAGE =
      Map.ofEntries(
          Map.entry("description", Set.of("description", "descriptionSources")),
          Map.entry("displayName", Set.of("displayName")),
          Map.entry("followers", Set.of("followers")),
          Map.entry("usageSummary", Set.of("usageSummary")),
          Map.entry("extension", Set.of("extension")),
          Map.entry("queryUsedIn", Set.of("queryUsedIn")),
          Map.entry("votes", Set.of("votes", "totalVotes")),
          Map.entry("pipelineStatus", Set.of("pipelineStatus")),
          Map.entry("owners", Set.of("owners")),
          Map.entry("domains", Set.of("domains")),
          Map.entry("tags", tagLineage()),
          Map.entry("certification", Set.of("certification")),
          Map.entry("deleted", Set.of("deleted")));

  /**
   * Ownership overrides. Everything unlisted is {@link FieldOwnership#DERIVED}.
   *
   * <p>These are the paths the codebase already protects ad hoc — the embedding splice in the bulk
   * sinks, the presence-preserving {@code documentUpdateScript} for fenced relationship fields, and
   * the lineage SQL the live script accumulates across edges. Naming them here is what lets a rebuild
   * stop destroying them by construction rather than by remembering to.
   */
  private static final Map<String, FieldOwnership> OWNERSHIP =
      Map.ofEntries(
          Map.entry("embedding", FieldOwnership.CARRIED),
          Map.entry("fingerprint", FieldOwnership.CARRIED),
          Map.entry("lineageSqlQueries", FieldOwnership.CARRIED),
          Map.entry("testSuites", FieldOwnership.FENCED),
          Map.entry("testSuitesRevision", FieldOwnership.FENCED),
          Map.entry("tests", FieldOwnership.FENCED),
          Map.entry("testsRevision", FieldOwnership.FENCED));

  /** {@code fqnHash} rides along because phase 4 of the doc build derives it from the FQN. */
  private static final Set<String> ALWAYS_PROJECTED =
      Set.of("id", "updatedAt", "updatedBy", "version", "fullyQualifiedName", "fqnHash");

  private static Set<String> tagLineage() {
    Set<String> paths = new java.util.LinkedHashSet<>(TagDocInvariant.INSTANCE.produces());
    paths.add("tagSources");
    paths.add("tierSources");
    return Set.copyOf(paths);
  }

  @Override
  public Set<String> docPathsFor(String entityField) {
    return LINEAGE.getOrDefault(entityField, Set.of());
  }

  @Override
  public boolean declares(String entityField) {
    return LINEAGE.containsKey(entityField);
  }

  @Override
  public Set<String> alwaysProjected() {
    return ALWAYS_PROJECTED;
  }

  /**
   * {@code tagSources} / {@code tierSources} are label-type counts, and they are not recomputable
   * from the stored document.
   *
   * <p>{@code SearchIndexUtils.processTagAndTierSources} counts the entity's tags <em>and each
   * column's tags separately</em>, summing repeats — a tag on three columns contributes three. The
   * document's {@code tags} array is the output of {@code mergeChildTags}, which dedupes by {@code
   * tagFQN}, so the same situation appears there once. The pre-dedup per-column structure the counts
   * are derived from simply is not in the document, so no painless script recovers them, however
   * carefully written.
   *
   * <p>This is why they are declared here rather than added to {@code TAG_RESEPARATION_SCRIPT}:
   * scripting them would produce numbers that look right and are wrong on any column-bearing entity,
   * which is worse than leaving them to a reprojection.
   */
  private static final Set<String> REQUIRES_REPROJECTION = Set.of("tagSources", "tierSources");

  @Override
  public Set<String> requiresReprojection() {
    return REQUIRES_REPROJECTION;
  }

  @Override
  public FieldOwnership ownershipOf(String docPath) {
    return OWNERSHIP.getOrDefault(FieldMask.topLevelKeyOf(docPath), FieldOwnership.DERIVED);
  }
}
