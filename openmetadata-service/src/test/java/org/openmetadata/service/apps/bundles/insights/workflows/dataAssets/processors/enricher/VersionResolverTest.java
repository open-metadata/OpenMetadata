/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.EntityRepository;

class VersionResolverTest {
  private static final long ONE_DAY = 86_400_000L;
  private static final long TODAY = Instant.parse("2026-01-15T00:00:00Z").toEpochMilli();
  private static final long END = TODAY + ONE_DAY - 1;
  private static final UUID ID = UUID.randomUUID();
  private final EntityRepository<?> repository = mock(EntityRepository.class);
  private final VersionResolver resolver = new VersionResolver(entityType -> repository);

  @BeforeAll
  static void registerEntityType() {
    EntityInterface.ENTITY_TYPE_TO_CLASS_MAP.putIfAbsent("table", Table.class);
  }

  @Test
  void entityUnchangedBeforeWindow_returnsOneWindowCoveringFullRange() {
    Table entity = table(0.1, TODAY - 5 * ONE_DAY, TODAY - 5 * ONE_DAY);
    List<VersionedWindow> windows = resolver.resolve(entity, context(TODAY - ONE_DAY));

    assertEquals(1, windows.size());
    assertSame(entity, windows.getFirst().entity());
    assertEquals(VersionShape.LATEST_HYDRATED, windows.getFirst().shape());
    assertEquals(List.of(TODAY, TODAY - ONE_DAY), days(windows));
  }

  @Test
  void lifecycleOnlyUpdate_preservesYesterdayForAnExistingInitialVersion() {
    Table entity = table(0.1, TODAY + 3_600_000, TODAY - 10 * ONE_DAY);
    history(entity);

    assertEquals(List.of(TODAY, TODAY - ONE_DAY), days(resolve(entity, TODAY - ONE_DAY)));
  }

  @Test
  void entityCreatedToday_doesNotGainYesterdaySnapshot() {
    Table entity = table(0.1, TODAY + 3_600_000, TODAY + 3_600_000);
    history(entity);

    assertEquals(List.of(TODAY), days(resolve(entity, TODAY - ONE_DAY)));
  }

  @Test
  void entityCreatedWithinBackfill_stopsAtCreationDay() {
    Table entity = table(0.1, TODAY + 3_600_000, TODAY - 2 * ONE_DAY + 3_600_000);
    history(entity);

    assertEquals(
        List.of(TODAY, TODAY - ONE_DAY, TODAY - 2 * ONE_DAY),
        days(resolve(entity, TODAY - 7 * ONE_DAY)));
  }

  @Test
  void entityCreatedBeforeBackfill_stopsAtWindowStart() {
    Table entity = table(0.1, TODAY + 3_600_000, TODAY - 10 * ONE_DAY);
    history(entity);

    assertEquals(
        List.of(TODAY, TODAY - ONE_DAY, TODAY - 2 * ONE_DAY),
        days(resolve(entity, TODAY - 2 * ONE_DAY)));
  }

  @Test
  void sameDayVersionTransitions_useOldestVersionForUncoveredDays() {
    Table latest = table(0.2, TODAY + 7_200_000, TODAY - 10 * ONE_DAY);
    Table oldest = table(0.1, TODAY + 3_600_000, null);
    history(latest, oldest);

    List<VersionedWindow> windows = resolve(latest, TODAY - ONE_DAY);

    assertEquals(List.of(TODAY, TODAY - ONE_DAY), days(windows));
    assertEquals(0.2, windows.getFirst().entity().getVersion());
    assertEquals(VersionShape.LATEST_HYDRATED, windows.getFirst().shape());
    assertEquals(0.1, windows.getLast().entity().getVersion());
    assertEquals(VersionShape.HISTORICAL_RAW, windows.getLast().shape());
  }

  @Test
  void historyBridgingWindow_hasNoDuplicateDays() {
    Table latest = table(0.2, TODAY + 3_600_000, TODAY - 10 * ONE_DAY);
    Table oldest = table(0.1, TODAY - 5 * ONE_DAY, null);
    history(latest, oldest);

    assertEquals(List.of(TODAY, TODAY - ONE_DAY), days(resolve(latest, TODAY - ONE_DAY)));
  }

  @Test
  void entityUpdatedExactlyOnWindowStart_doesNotShortCircuit() {
    Table latest = table(0.2, TODAY - ONE_DAY + 1, TODAY - 10 * ONE_DAY);
    Table oldest = table(0.1, TODAY - 5 * ONE_DAY, null);
    history(latest, oldest);

    List<VersionedWindow> windows = resolve(latest, TODAY - ONE_DAY);

    assertEquals(List.of(TODAY, TODAY - ONE_DAY), days(windows));
    assertEquals(TODAY - 1, windows.getFirst().windowStartTimestamp());
    assertEquals(0.2, windows.getFirst().entity().getVersion());
  }

  @Test
  void entityWithNullUpdatedAt_readsTimestampedHistory() {
    Table entity = table(0.1, null, TODAY - 10 * ONE_DAY);
    Table stored = table(0.1, TODAY + 3_600_000, TODAY - 10 * ONE_DAY);
    history(stored);

    assertEquals(List.of(TODAY, TODAY - ONE_DAY), days(resolve(entity, TODAY - ONE_DAY)));
  }

  @Test
  void legacyEntityWithoutCreationAudit_isNotBackdatedWithoutEvidence() {
    Table entity = table(0.1, TODAY + 3_600_000, null);
    history(entity);

    assertEquals(List.of(TODAY), days(resolve(entity, TODAY - ONE_DAY)));
  }

  @Test
  void emptyHistory_doesNotInventSnapshots() {
    Table entity = table(0.1, TODAY + 3_600_000, TODAY - 10 * ONE_DAY);
    history();

    assertEquals(List.of(), days(resolve(entity, TODAY - ONE_DAY)));
  }

  @Test
  void paginatedHistory_extendsTheOldestVersionAfterTheLastPage() {
    Table latest = table(0.2, TODAY + 7_200_000, TODAY - 10 * ONE_DAY);
    Table oldest = table(0.1, TODAY + 3_600_000, null);
    when(repository.listVersionsWithOffset(ID, 100, 0)).thenReturn(page(100, latest));
    when(repository.listVersionsWithOffset(ID, 100, 100)).thenReturn(page(200, oldest));
    when(repository.listVersionsWithOffset(ID, 100, 200)).thenReturn(page(300));

    List<VersionedWindow> windows = resolve(latest, TODAY - ONE_DAY);

    assertEquals(List.of(TODAY, TODAY - ONE_DAY), days(windows));
    assertEquals(0.1, windows.getLast().entity().getVersion());
    assertEquals(VersionShape.HISTORICAL_RAW, windows.getLast().shape());
  }

  private List<VersionedWindow> resolve(Table entity, long start) {
    return resolver.resolve(entity, context(start));
  }

  private EnrichmentContext context(long start) {
    return new EnrichmentContext("table", List.of("id", "version"), start, END);
  }

  private List<Long> days(List<VersionedWindow> windows) {
    return windows.stream()
        .flatMap(window -> new SnapshotMaterializer().materialize(window, Map.of()).stream())
        .map(snapshot -> (Long) snapshot.get("@timestamp"))
        .toList();
  }

  private void history(Table... versions) {
    when(repository.listVersionsWithOffset(ID, 100, 0)).thenReturn(page(100, versions));
    when(repository.listVersionsWithOffset(ID, 100, 100)).thenReturn(page(200));
  }

  private EntityRepository.EntityHistoryWithOffset page(int nextOffset, Table... versions) {
    List<Object> json =
        Arrays.stream(versions).map(JsonUtils::pojoToJson).map(value -> (Object) value).toList();
    return new EntityRepository.EntityHistoryWithOffset(
        new EntityHistory().withEntityType("table").withVersions(json), nextOffset);
  }

  private Table table(double version, Long updatedAt, Long createdAt) {
    return new Table()
        .withId(ID)
        .withName("my_table")
        .withVersion(version)
        .withUpdatedAt(updatedAt)
        .withCreatedAt(createdAt);
  }
}
