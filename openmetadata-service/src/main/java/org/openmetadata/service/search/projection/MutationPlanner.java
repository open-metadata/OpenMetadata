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

import java.util.LinkedHashSet;
import java.util.Set;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;

/**
 * Decides what a change becomes: a full upsert or a narrowed merge.
 *
 * <p>This is what replaces {@code PARTIAL_SCRIPT_SUPPORTED_FIELDS}. The allowlist stops being a
 * hand-maintained set of seven field names and becomes "every field whose lineage is declared", which
 * grows as specs grow. The bias is the important part: anything unrecognised falls back to a full
 * write, so an undeclared or newly-added field degrades to correct-but-slower, never to a wrong
 * document.
 *
 * <p>Both live and reindex go through here. Reindex passes a null change description and gets {@code
 * Upsert(ALL)}; live passes the change description and usually gets a merge. Same planner, same
 * projector, one mutation type — which is what makes a doc-semantics bug impossible to fix in one path
 * and not the other.
 */
public final class MutationPlanner {

  /** Why a plan came out the way it did — worth surfacing, since the fallback is the metered case. */
  public enum Reason {
    NO_CHANGE_DESCRIPTION,
    NO_CHANGED_FIELDS,
    UNDECLARED_FIELD,
    DECLARED_LINEAGE
  }

  public record Mutation(FieldMask mask, Reason reason) {
    public boolean isFullUpsert() {
      return mask instanceof FieldMask.All;
    }
  }

  private final ProjectionSpec spec;

  public MutationPlanner(ProjectionSpec spec) {
    this.spec = spec;
  }

  /**
   * Whether a write covering {@code mask} must reproject rather than run a painless script.
   *
   * <p>Cascades are the caller that matters here: an update-by-query is the only way to touch a
   * million children without reading them, but it can only recompute what the stored document
   * carries. If the mask reaches a path declared in {@link ProjectionSpec#requiresReprojection()},
   * scripting it produces a plausible wrong value, so the cascade has to rebuild those documents
   * instead.
   */
  public boolean requiresReprojection(FieldMask mask) {
    return spec.requiresReprojection().stream().anyMatch(mask::covers);
  }

  public Mutation plan(ChangeDescription changeDescription) {
    if (changeDescription == null) {
      return new Mutation(FieldMask.all(), Reason.NO_CHANGE_DESCRIPTION);
    }
    Set<String> changed = changedFieldNames(changeDescription);
    if (changed.isEmpty()) {
      return new Mutation(FieldMask.all(), Reason.NO_CHANGED_FIELDS);
    }
    Set<String> docPaths = new LinkedHashSet<>();
    for (String field : changed) {
      if (!spec.declares(field)) {
        // One unknown field forces a full write for the whole change: the unknown field may feed a
        // path none of the known ones do, and guessing narrower would silently stale that path.
        return new Mutation(FieldMask.all(), Reason.UNDECLARED_FIELD);
      }
      docPaths.addAll(spec.docPathsFor(field));
    }
    return new Mutation(FieldMask.of(docPaths), Reason.DECLARED_LINEAGE);
  }

  /**
   * Field names touched by a change, normalised to their top-level entity field.
   *
   * <p>Nested names arrive as {@code columns.description}; the lineage is declared against {@code
   * columns}, so the prefix is what matters here.
   */
  private static Set<String> changedFieldNames(ChangeDescription changeDescription) {
    Set<String> names = new LinkedHashSet<>();
    addNames(names, changeDescription.getFieldsAdded());
    addNames(names, changeDescription.getFieldsUpdated());
    addNames(names, changeDescription.getFieldsDeleted());
    return names;
  }

  private static void addNames(Set<String> names, java.util.List<FieldChange> changes) {
    if (changes == null) {
      return;
    }
    for (FieldChange change : changes) {
      if (change != null && change.getName() != null) {
        names.add(FieldMask.topLevelKeyOf(change.getName()));
      }
    }
  }
}
