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

package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.api.rdf.RdfProjectionState;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO.AppExtensionTimeSeries;

class RdfProjectionStateResolverTest {
  private final AppExtensionTimeSeries runStore = mock(AppExtensionTimeSeries.class);
  private final RdfProjectionStateResolver resolver = new RdfProjectionStateResolver(runStore);

  @AfterEach
  void resetRuntimeHealth() {
    RdfProjectionHealth.markReady();
  }

  @Test
  void reportsRebuildingUntilTheFirstPostMigrationRun() {
    when(runStore.listAppExtensionByName("RdfIndexApp", 1, 0, "status")).thenReturn(List.of());

    assertEquals(RdfProjectionState.REBUILDING, resolver.resolve());
  }

  @ParameterizedTest
  @MethodSource("projectionStates")
  void mapsLatestApplicationRunState(
      final AppRunRecord.Status runStatus, final RdfProjectionState expectedState) {
    final AppRunRecord run = new AppRunRecord().withStatus(runStatus);
    when(runStore.listAppExtensionByName("RdfIndexApp", 1, 0, "status"))
        .thenReturn(List.of(JsonUtils.pojoToJson(run)));

    assertEquals(expectedState, resolver.resolve());
  }

  @Test
  void reportsDegradedForMalformedRunState() {
    when(runStore.listAppExtensionByName("RdfIndexApp", 1, 0, "status"))
        .thenReturn(List.of("not-json"));

    assertEquals(RdfProjectionState.DEGRADED, resolver.resolve());
  }

  @Test
  void reportsDegradedWhenAnIncrementalWriteFailsAfterACompletedRebuild() {
    final AppRunRecord run = new AppRunRecord().withStatus(AppRunRecord.Status.COMPLETED);
    when(runStore.listAppExtensionByName("RdfIndexApp", 1, 0, "status"))
        .thenReturn(List.of(JsonUtils.pojoToJson(run)));
    RdfProjectionHealth.markDegraded();

    assertEquals(RdfProjectionState.DEGRADED, resolver.resolve());
  }

  private static Stream<Arguments> projectionStates() {
    return Stream.of(
        Arguments.of(AppRunRecord.Status.SUCCESS, RdfProjectionState.READY),
        Arguments.of(AppRunRecord.Status.COMPLETED, RdfProjectionState.READY),
        Arguments.of(AppRunRecord.Status.RUNNING, RdfProjectionState.REBUILDING),
        Arguments.of(AppRunRecord.Status.PENDING, RdfProjectionState.REBUILDING),
        Arguments.of(AppRunRecord.Status.FAILED, RdfProjectionState.DEGRADED),
        Arguments.of(AppRunRecord.Status.ACTIVE_ERROR, RdfProjectionState.DEGRADED));
  }
}
