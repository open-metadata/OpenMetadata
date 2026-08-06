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

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.search.projection.MutationPlanner.Mutation;
import org.openmetadata.service.search.projection.MutationPlanner.Reason;

/**
 * The planner's whole value is which way it fails. Every branch that cannot prove a narrow write is
 * safe must widen to a full one, because a wrong narrow write leaves a stale path in the document
 * whereas a needless full write only costs time.
 */
class MutationPlannerTest {

  private final MutationPlanner planner = new MutationPlanner(new DefaultProjectionSpec());

  @Test
  @DisplayName("no change description means reindex, which rebuilds everything")
  void nullChangeDescriptionUpserts() {
    Mutation mutation = planner.plan(null);
    assertThat(mutation.isFullUpsert()).isTrue();
    assertThat(mutation.reason()).isEqualTo(Reason.NO_CHANGE_DESCRIPTION);
  }

  @Test
  @DisplayName("an empty change description upserts rather than writing nothing")
  void emptyChangeDescriptionUpserts() {
    Mutation mutation = planner.plan(new ChangeDescription());
    assertThat(mutation.isFullUpsert()).isTrue();
    assertThat(mutation.reason()).isEqualTo(Reason.NO_CHANGED_FIELDS);
  }

  @Test
  @DisplayName("a declared field narrows to exactly its declared paths")
  void declaredFieldMerges() {
    Mutation mutation = planner.plan(updated("description"));

    assertThat(mutation.isFullUpsert()).isFalse();
    assertThat(mutation.reason()).isEqualTo(Reason.DECLARED_LINEAGE);
    assertThat(mutation.mask().covers("description")).isTrue();
    assertThat(mutation.mask().covers("descriptionSources")).isTrue();
    assertThat(mutation.mask().covers("owners")).isFalse();
  }

  @Test
  @DisplayName("one undeclared field widens the whole change, not just its own paths")
  void undeclaredFieldForcesFullUpsert() {
    ChangeDescription change = updated("description");
    change.getFieldsUpdated().add(new FieldChange().withName("somethingNobodyDeclared"));

    Mutation mutation = planner.plan(change);

    // Narrowing to description's paths would silently stale whatever the unknown field feeds.
    assertThat(mutation.isFullUpsert()).isTrue();
    assertThat(mutation.reason()).isEqualTo(Reason.UNDECLARED_FIELD);
  }

  @Test
  @DisplayName("a nested field name resolves to the entity field its lineage is declared against")
  void nestedFieldNameResolvesToItsTopLevelField() {
    // Change descriptions record nested edits as "tags.tagFQN"; the lineage is declared on "tags".
    Mutation mutation = planner.plan(updated("tags.tagFQN"));

    assertThat(mutation.reason()).isEqualTo(Reason.DECLARED_LINEAGE);
    assertThat(mutation.mask().covers("tier")).isTrue();
  }

  @Test
  @DisplayName("masks union across several declared fields")
  void severalDeclaredFieldsUnion() {
    ChangeDescription change = updated("description");
    change.getFieldsUpdated().add(new FieldChange().withName("owners"));

    Mutation mutation = planner.plan(change);

    assertThat(mutation.isFullUpsert()).isFalse();
    assertThat(mutation.mask().covers("description")).isTrue();
    assertThat(mutation.mask().covers("owners")).isTrue();
  }

  @Test
  @DisplayName("fenced and carried paths are outside a rebuild's authority")
  void rebuildAuthorityExcludesFencedAndCarried() {
    ProjectionSpec spec = new DefaultProjectionSpec();
    assertThat(DocumentProjector.REBUILD_AUTHORITY).containsExactly(FieldOwnership.DERIVED);
    assertThat(spec.ownershipOf("embedding")).isEqualTo(FieldOwnership.CARRIED);
    assertThat(spec.ownershipOf("testSuitesRevision")).isEqualTo(FieldOwnership.FENCED);
    // Nested paths inherit their top-level key's ownership, so a sub-field cannot smuggle a write
    // in.
    assertThat(spec.ownershipOf("testSuites.id")).isEqualTo(FieldOwnership.FENCED);
    assertThat(spec.ownershipOf("description")).isEqualTo(FieldOwnership.DERIVED);
  }

  @Test
  @DisplayName("ALL absorbs any union; a subset covers only its own top-level keys")
  void maskAlgebra() {
    FieldMask subset = FieldMask.of(Set.of("description"));
    assertThat(subset.union(FieldMask.all()).covers("anything")).isTrue();
    assertThat(FieldMask.all().union(subset).covers("anything")).isTrue();
    assertThat(subset.union(FieldMask.of(Set.of("owners"))).covers("owners")).isTrue();
    // tier.tagFQN is covered by the key "tier" — sub-field masking would imply a merge the writer
    // cannot perform, since a top-level key is always replaced wholesale.
    assertThat(FieldMask.of(Set.of("tier")).covers("tier.tagFQN")).isTrue();
    assertThat(subset.covers("descriptionSources")).isFalse();
  }

  private static ChangeDescription updated(String fieldName) {
    return new ChangeDescription()
        .withFieldsUpdated(
            new java.util.ArrayList<>(List.of(new FieldChange().withName(fieldName))));
  }
}
