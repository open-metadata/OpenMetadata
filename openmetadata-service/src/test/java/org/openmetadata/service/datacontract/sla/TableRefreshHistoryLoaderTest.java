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

package org.openmetadata.service.datacontract.sla;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.jdbi3.TimeSeriesDAOs.ProfilerDataTimeSeriesDAO.SYSTEM_PROFILE_EXTENSION;
import static org.openmetadata.service.jdbi3.TimeSeriesDAOs.ProfilerDataTimeSeriesDAO.TABLE_COLUMN_PROFILE_EXTENSION;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.CreateEntityProfile.ProfileTypeEnum;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.datacontract.SlaValidation.RefreshedAtSource;
import org.openmetadata.schema.type.AccessDetails;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.DmlOperationType;
import org.openmetadata.schema.type.EntityProfile;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.type.SystemProfile;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.datacontract.sla.RefreshHistory.Observation;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO.OrderBy;
import org.openmetadata.service.jdbi3.TimeSeriesDAOs.ProfilerDataTimeSeriesDAO;

/** The profiler time series is the database boundary; it returns stored profile rows. */
class TableRefreshHistoryLoaderTest {
  private static final String TABLE_FQN = "svc.db.sch.orders";
  private static final String COLUMN_FQN = TABLE_FQN + ".updated_at";
  private static final Instant NOW = Instant.parse("2026-09-25T14:00:00Z");
  private static final Instant SINCE = NOW.minusSeconds(86_400);

  private ProfilerDataTimeSeriesDAO profiles;
  private TableRefreshHistoryLoader loader;

  @BeforeEach
  void setUp() {
    profiles = mock(ProfilerDataTimeSeriesDAO.class);
    loader = new TableRefreshHistoryLoader(profiles, Clock.fixed(NOW, ZoneOffset.UTC));
  }

  @Test
  void slaColumnProfilesGiveTheNewestValueEachTimeTheColumnWasProfiled() {
    Instant firstProfile = NOW.minusSeconds(7_200);
    Instant secondProfile = NOW.minusSeconds(3_600);
    stored(
        COLUMN_FQN,
        TABLE_COLUMN_PROFILE_EXTENSION,
        columnProfile(secondProfile, "2026-09-25T12:30:00Z"),
        columnProfile(firstProfile, "2026-09-25T11:00:00Z"),
        columnProfile(firstProfile.minusSeconds(60), "not a time"));

    RefreshHistory history = loader.load(table(), COLUMN_FQN, SINCE, ZoneOffset.UTC).orElseThrow();

    assertEquals(RefreshedAtSource.SLA_COLUMN_PROFILE, history.source());
    assertEquals(
        List.of(
            new Observation(secondProfile, Instant.parse("2026-09-25T12:30:00Z")),
            new Observation(firstProfile, Instant.parse("2026-09-25T11:00:00Z"))),
        history.observations());
  }

  @Test
  void withoutAColumnProfileTheTablesWritesAreUsedAndDeletesIgnored() {
    Instant insert = NOW.minusSeconds(1_800);
    stored(
        TABLE_FQN,
        SYSTEM_PROFILE_EXTENSION,
        systemProfile(NOW.minusSeconds(600), DmlOperationType.DELETE),
        systemProfile(insert, DmlOperationType.INSERT));

    RefreshHistory history = loader.load(table(), COLUMN_FQN, SINCE, ZoneOffset.UTC).orElseThrow();

    assertEquals(RefreshedAtSource.SYSTEM_PROFILE, history.source());
    assertEquals(List.of(new Observation(insert, insert)), history.observations());
  }

  @Test
  void withoutProfilesTheLifeCycleUpdateIsUsed() {
    Instant updated = NOW.minusSeconds(5_000);
    Table table =
        table()
            .withLifeCycle(
                new LifeCycle()
                    .withUpdated(new AccessDetails().withTimestamp(updated.toEpochMilli())));

    RefreshHistory history = loader.load(table, null, SINCE, ZoneOffset.UTC).orElseThrow();

    assertEquals(RefreshedAtSource.LIFE_CYCLE, history.source());
    assertEquals(updated, history.newest().refreshedAt());
  }

  @Test
  void tableNothingRecordsHasNoHistory() {
    assertTrue(loader.load(table(), COLUMN_FQN, SINCE, ZoneOffset.UTC).isEmpty());
  }

  @Test
  void newestRecordIsIncludedEvenWhenOlderThanTheWindow() {
    Instant longAgo = NOW.minusSeconds(30 * 86_400L);
    when(profiles.getLatestExtension(TABLE_FQN, SYSTEM_PROFILE_EXTENSION))
        .thenReturn(systemProfile(longAgo, DmlOperationType.WRITE));

    Optional<RefreshHistory> history = loader.load(table(), null, SINCE, ZoneOffset.UTC);

    assertEquals(longAgo, history.orElseThrow().newest().refreshedAt());
  }

  /** Rows newest first, as the time series returns them; the newest is also the latest record. */
  private void stored(String fqn, String extension, String... rows) {
    when(profiles.getLatestExtension(fqn, extension)).thenReturn(rows[0]);
    when(profiles.listBetweenTimestampsByOrder(
            eq(fqn), eq(extension), anyLong(), anyLong(), eq(OrderBy.DESC)))
        .thenReturn(List.of(rows));
  }

  private static String columnProfile(Instant profiledAt, String max) {
    return profile(
        ProfileTypeEnum.COLUMN,
        profiledAt,
        new ColumnProfile()
            .withName("updated_at")
            .withTimestamp(profiledAt.toEpochMilli())
            .withMax(max));
  }

  private static String systemProfile(Instant at, DmlOperationType operation) {
    return profile(
        ProfileTypeEnum.SYSTEM,
        at,
        new SystemProfile()
            .withTimestamp(at.toEpochMilli())
            .withOperation(operation)
            .withRowsAffected(10));
  }

  private static String profile(ProfileTypeEnum type, Instant at, Object data) {
    return JsonUtils.pojoToJson(
        new EntityProfile()
            .withTimestamp(at.toEpochMilli())
            .withProfileType(type)
            .withProfileData(data));
  }

  private static Table table() {
    return new Table().withFullyQualifiedName(TABLE_FQN);
  }
}
