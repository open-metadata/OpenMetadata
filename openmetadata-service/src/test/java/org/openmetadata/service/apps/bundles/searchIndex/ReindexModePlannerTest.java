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

package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.apps.bundles.searchIndex.ReindexModePlanner.Mode.IN_PLACE;
import static org.openmetadata.service.apps.bundles.searchIndex.ReindexModePlanner.Mode.NEW_INDEX;
import static org.openmetadata.service.apps.bundles.searchIndex.ReindexModePlanner.Mode.SKIP;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexModePlanner.LiveIndexState;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexModePlanner.Mode;
import org.openmetadata.service.search.IndexMappingVersionTracker.MappingDriftState;

class ReindexModePlannerTest {
  private static final String PIPELINE_STATUS = "pipelineStatus";

  @Test
  void anUnchangedLiveIndexIsRewrittenInPlace() {
    assertEquals(Map.of(Entity.DASHBOARD, IN_PLACE), plan(new State(), Entity.DASHBOARD));
  }

  @Test
  void aChangedMissingOrUntrackedDefinitionBuildsANewIndex() {
    assertEquals(
        Map.of(Entity.DASHBOARD, NEW_INDEX),
        plan(new State().drift(MappingDriftState.STALE), Entity.DASHBOARD));
    assertEquals(
        Map.of(Entity.DASHBOARD, NEW_INDEX),
        plan(new State().drift(MappingDriftState.UNTRACKED), Entity.DASHBOARD));
    assertEquals(
        Map.of(Entity.DASHBOARD, NEW_INDEX), plan(new State().missing(), Entity.DASHBOARD));
    assertEquals(
        Map.of(Entity.DASHBOARD, NEW_INDEX),
        plan(new State().embeddingsChanged(), Entity.DASHBOARD));
  }

  @Test
  void documentsWithoutADatabaseSourceAreLeftAlone() {
    assertEquals(Map.of(PIPELINE_STATUS, SKIP), plan(new State(), PIPELINE_STATUS));
    assertEquals(Map.of(Entity.TABLE_COLUMN, SKIP), plan(new State(), Entity.TABLE_COLUMN));
  }

  @Test
  void columnsAreRebuiltIntoANewIndexWheneverTablesAreReindexed() {
    assertEquals(
        Map.of(Entity.TABLE, IN_PLACE, Entity.TABLE_COLUMN, NEW_INDEX),
        plan(new State(), Entity.TABLE, Entity.TABLE_COLUMN));
  }

  @Test
  void forcingRecreatesEveryIndexTheDatabaseCanRefill() {
    final Map<String, Mode> forced =
        ReindexModePlanner.plan(
            new LinkedHashSet<>(List.of(Entity.DASHBOARD, PIPELINE_STATUS)), new State(), true);

    assertEquals(Map.of(Entity.DASHBOARD, NEW_INDEX, PIPELINE_STATUS, SKIP), forced);
  }

  private static Map<String, Mode> plan(final State state, final String... entityTypes) {
    return ReindexModePlanner.plan(new LinkedHashSet<>(List.of(entityTypes)), state, false);
  }

  /** A live index that is current, present and embedded with the configured model. */
  private static final class State implements LiveIndexState {
    private MappingDriftState drift = MappingDriftState.CURRENT;
    private boolean exists = true;
    private boolean embeddingsMatch = true;

    State drift(final MappingDriftState state) {
      drift = state;
      return this;
    }

    State missing() {
      exists = false;
      return this;
    }

    State embeddingsChanged() {
      embeddingsMatch = false;
      return this;
    }

    @Override
    public MappingDriftState drift(final String entityType) {
      return drift;
    }

    @Override
    public boolean exists(final String entityType) {
      return exists;
    }

    @Override
    public boolean embeddingSettingsMatch(final String entityType) {
      return embeddingsMatch;
    }

    @Override
    public boolean hasReader(final String entityType) {
      return !Set.of(PIPELINE_STATUS, Entity.TABLE_COLUMN).contains(entityType);
    }
  }
}
