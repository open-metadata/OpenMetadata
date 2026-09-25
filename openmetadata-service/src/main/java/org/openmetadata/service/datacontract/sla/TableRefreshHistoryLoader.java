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

import static org.openmetadata.service.jdbi3.TimeSeriesDAOs.ProfilerDataTimeSeriesDAO.SYSTEM_PROFILE_EXTENSION;
import static org.openmetadata.service.jdbi3.TimeSeriesDAOs.ProfilerDataTimeSeriesDAO.TABLE_COLUMN_PROFILE_EXTENSION;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
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
import org.openmetadata.service.jdbi3.EntityProfileRepository;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO.OrderBy;
import org.openmetadata.service.jdbi3.TimeSeriesDAOs.ProfilerDataTimeSeriesDAO;

/**
 * Reads a table's refresh time from what the profiler and ingestion already store, best source
 * first: the SLA column's newest value in each profile, then the writes the table's system metrics
 * record, then the last update its life cycle records.
 */
public final class TableRefreshHistoryLoader implements RefreshHistoryLoader {
  private static final Set<DmlOperationType> WRITES =
      EnumSet.of(DmlOperationType.INSERT, DmlOperationType.UPDATE, DmlOperationType.WRITE);

  private final ProfilerDataTimeSeriesDAO profiles;
  private final Clock clock;

  public TableRefreshHistoryLoader(ProfilerDataTimeSeriesDAO profiles, Clock clock) {
    this.profiles = profiles;
    this.clock = clock;
  }

  @Override
  public Optional<RefreshHistory> load(
      Table table, String slaColumnFqn, Instant since, ZoneId zone) {
    return Optional.ofNullable(slaColumnFqn)
        .flatMap(column -> columnHistory(column, since, zone))
        .or(() -> systemHistory(table.getFullyQualifiedName(), since))
        .or(() -> lifeCycleHistory(table));
  }

  private Optional<RefreshHistory> columnHistory(String columnFqn, Instant since, ZoneId zone) {
    List<Observation> observations =
        records(columnFqn, TABLE_COLUMN_PROFILE_EXTENSION, since, ColumnProfile.class).stream()
            .flatMap(profile -> columnObservation(profile, zone).stream())
            .toList();
    return history(RefreshedAtSource.SLA_COLUMN_PROFILE, observations);
  }

  private static Optional<Observation> columnObservation(ColumnProfile profile, ZoneId zone) {
    return RefreshTimes.parse(profile.getMax(), zone)
        .map(newest -> new Observation(Instant.ofEpochMilli(profile.getTimestamp()), newest));
  }

  private Optional<RefreshHistory> systemHistory(String tableFqn, Instant since) {
    List<Observation> observations =
        records(tableFqn, SYSTEM_PROFILE_EXTENSION, since, SystemProfile.class).stream()
            .filter(profile -> WRITES.contains(profile.getOperation()))
            .map(profile -> Instant.ofEpochMilli(profile.getTimestamp()))
            .map(written -> new Observation(written, written))
            .toList();
    return history(RefreshedAtSource.SYSTEM_PROFILE, observations);
  }

  private static Optional<RefreshHistory> lifeCycleHistory(Table table) {
    List<Observation> observations =
        Optional.ofNullable(table.getLifeCycle())
            .map(LifeCycle::getUpdated)
            .map(AccessDetails::getTimestamp)
            .map(Instant::ofEpochMilli)
            .map(updated -> List.of(new Observation(updated, updated)))
            .orElse(List.of());
    return history(RefreshedAtSource.LIFE_CYCLE, observations);
  }

  /** The newest record, whenever it was taken, and every record taken since {@code since}. */
  private <T> List<T> records(String fqn, String extension, Instant since, Class<T> type) {
    List<String> rows = new ArrayList<>();
    Optional.ofNullable(profiles.getLatestExtension(fqn, extension)).ifPresent(rows::add);
    rows.addAll(
        profiles.listBetweenTimestampsByOrder(
            fqn, extension, since.toEpochMilli(), clock.millis(), OrderBy.DESC));
    return rows.stream().map(toProfileData(type)).toList();
  }

  private static <T> Function<String, T> toProfileData(Class<T> type) {
    return json ->
        type.cast(
            EntityProfileRepository.deserializeProfileData(
                    JsonUtils.readValue(json, EntityProfile.class))
                .getProfileData());
  }

  private static Optional<RefreshHistory> history(
      RefreshedAtSource source, List<Observation> observations) {
    return observations.isEmpty()
        ? Optional.empty()
        : Optional.of(new RefreshHistory(source, observations));
  }
}
