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
import static org.assertj.core.api.Assertions.assertThatCode;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;

/**
 * The gate's contract is that it does nothing. It sits on the hottest write path in the product, so
 * "off by default" and "cannot throw" are the two properties that matter; the counters it emits when
 * enabled are diagnostics, not behaviour.
 */
class ProjectionRolloutTest {

  private final MutationPlanner planner = new MutationPlanner(new DefaultProjectionSpec());

  @Test
  @DisplayName("shadow accounting is off unless explicitly enabled")
  void offByDefault() {
    // Asserted rather than assumed: a default-on flag here would change the hottest write path's
    // behaviour the moment this branch merged, which is exactly what phase 4 is supposed to gate.
    assertThat(System.getProperty(ProjectionRollout.SHADOW_PROPERTY)).isNull();
    assertThat(ProjectionRollout.shadowEnabled()).isFalse();
  }

  @Test
  @DisplayName("recording never throws, whatever it is handed")
  void recordingIsAlwaysSafe() {
    // Observation must not be able to break the write it observes, so every shape has to be inert —
    // including the nulls and the change description that makes the planner widen.
    assertThatCode(
            () -> {
              ProjectionRollout.recordShadowComparison(planner, null, true);
              ProjectionRollout.recordShadowComparison(planner, null, false);
              ProjectionRollout.recordShadowComparison(planner, new ChangeDescription(), true);
              ProjectionRollout.recordShadowComparison(planner, undeclaredChange(), false);
              ProjectionRollout.recordShadowComparison(null, undeclaredChange(), false);
            })
        .doesNotThrowAnyException();
  }

  private static ChangeDescription undeclaredChange() {
    return new ChangeDescription()
        .withFieldsUpdated(List.of(new FieldChange().withName("nobodyDeclaredThis")));
  }
}
