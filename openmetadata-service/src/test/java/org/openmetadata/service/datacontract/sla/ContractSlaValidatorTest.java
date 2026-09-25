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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.MaxLatency;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.api.data.Retention;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.datacontract.SlaValidation;
import org.openmetadata.schema.entity.datacontract.SlaValidation.RefreshedAtSource;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.datacontract.sla.RefreshHistory.Observation;

class ContractSlaValidatorTest {
  private static final String TABLE_FQN = "svc.db.sch.orders";
  private static final Instant NOW = Instant.parse("2026-09-25T14:00:00Z");
  private static final ZoneId NEW_YORK = ZoneId.of("America/New_York");

  private RefreshHistory history;
  private String requestedColumn;
  private Instant requestedSince;
  private ZoneId requestedZone;

  private final ContractSlaValidator validator =
      new ContractSlaValidator(
          Clock.fixed(NOW, ZoneOffset.UTC),
          ref -> table(),
          (table, column, since, zone) -> {
            requestedColumn = column;
            requestedSince = since;
            requestedZone = zone;
            return Optional.ofNullable(history);
          });

  @Test
  void contractWithoutACheckableRequirementHasNoSlaValidation() {
    assertNull(validator.validate(contract(null)));
    assertNull(
        validator.validate(
            contract(
                new ContractSLA()
                    .withRetention(new Retention().withPeriod(30).withUnit(Retention.Unit.DAY)))));
  }

  @Test
  void slaOfAContractOnAnotherEntityIsNotEvaluated() {
    DataContract contract =
        contract(daily())
            .withEntity(new EntityReference().withId(UUID.randomUUID()).withType("topic"));

    SlaValidation validation = validator.validate(contract);

    assertEquals(ContractSlaValidator.TABLES_ONLY, validation.getMessage());
    assertNull(validation.getRefreshFrequencyMet());
  }

  @Test
  void tableWithoutAnyRefreshRecordIsNotEvaluatedRatherThanMissed() {
    SlaValidation validation = validator.validate(contract(daily()));

    assertEquals(ContractSlaValidator.NO_REFRESH_TIME, validation.getMessage());
    assertNull(validation.getRefreshFrequencyMet());
  }

  @Test
  void refreshWithinTheIntervalMeetsTheRefreshFrequency() {
    history = systemWrites(NOW.minus(Duration.ofHours(20)));

    SlaValidation validation = validator.validate(contract(daily()));

    assertEquals(Boolean.TRUE, validation.getRefreshFrequencyMet());
    assertEquals(NOW.minus(Duration.ofHours(20)).toEpochMilli(), validation.getLastRefreshedAt());
    assertEquals(RefreshedAtSource.SYSTEM_PROFILE, validation.getRefreshedAtSource());
    assertNull(validation.getMessage());
  }

  @Test
  void refreshOlderThanTheIntervalMissesTheRefreshFrequency() {
    history = systemWrites(NOW.minus(Duration.ofHours(30)));

    SlaValidation validation = validator.validate(contract(daily()));

    assertEquals(Boolean.FALSE, validation.getRefreshFrequencyMet());
    assertTrue(validation.getMessage().contains("more than 1 day ago"), validation.getMessage());
  }

  @Test
  void monthlyRefreshFollowsTheCalendar() {
    Instant endOfJanuary = Instant.parse("2026-01-31T12:00:00Z");
    ContractSlaValidator onLastDayOfFebruary =
        new ContractSlaValidator(
            Clock.fixed(Instant.parse("2026-02-28T12:00:00Z"), ZoneOffset.UTC),
            ref -> table(),
            (table, column, since, zone) -> Optional.of(systemWrites(endOfJanuary)));

    SlaValidation validation =
        onLastDayOfFebruary.validate(
            contract(
                sla(new RefreshFrequency().withInterval(1).withUnit(RefreshFrequency.Unit.MONTH))));

    assertEquals(Boolean.TRUE, validation.getRefreshFrequencyMet());
  }

  @Test
  void latencyIsHowOldTheNewestDataWasWhenProfiled() {
    Instant profiledAt = NOW.minus(Duration.ofHours(1));
    history = columnProfile(profiledAt, profiledAt.minus(Duration.ofHours(4)));

    SlaValidation withinFiveHours = validator.validate(contract(maxLatency(5)));
    SlaValidation overThreeHours = validator.validate(contract(maxLatency(3)));

    assertEquals(Boolean.TRUE, withinFiveHours.getLatencyMet());
    assertEquals((int) Duration.ofHours(4).toMillis(), withinFiveHours.getActualLatency());
    assertEquals(Boolean.FALSE, overThreeHours.getLatencyMet());
    assertTrue(overThreeHours.getMessage().contains("240 minutes"), overThreeHours.getMessage());
  }

  @Test
  void latencyNeedsTheSlaColumnProfile() {
    history = systemWrites(NOW.minus(Duration.ofHours(1)));

    SlaValidation validation = validator.validate(contract(maxLatency(5)));

    assertNull(validation.getLatencyMet());
    assertTrue(validation.getMessage().startsWith("Latency is not evaluated"));
  }

  @Test
  void dataRefreshedThatDayBeforeTheDeadlineIsAvailable() {
    // 14:00Z is 10:00 in New York, an hour after today's 09:00 deadline
    history = systemWrites(Instant.parse("2026-09-25T12:30:00Z"));

    SlaValidation validation = validator.validate(contract(availableBy("09:00")));

    assertEquals(Boolean.TRUE, validation.getAvailabilityMet());
    assertEquals(NEW_YORK, requestedZone);
  }

  @Test
  void dataStillFromYesterdayAtTheDeadlineIsNotAvailable() {
    history =
        systemWrites(Instant.parse("2026-09-24T12:30:00Z"), Instant.parse("2026-09-25T13:30:00Z"));

    SlaValidation validation = validator.validate(contract(availableBy("09:00")));

    assertEquals(Boolean.FALSE, validation.getAvailabilityMet());
    assertTrue(
        validation.getMessage().contains("no data from 2026-09-25"), validation.getMessage());
    assertEquals(Instant.parse("2026-09-24T04:00:00Z"), requestedSince);
  }

  @Test
  void beforeTodaysDeadlineYesterdaysIsChecked() {
    // 14:00Z is 10:00 in New York, before today's 11:00 deadline
    history = systemWrites(Instant.parse("2026-09-24T14:30:00Z"));

    SlaValidation validation = validator.validate(contract(availableBy("11:00")));

    assertEquals(Boolean.TRUE, validation.getAvailabilityMet());
  }

  @Test
  void availabilityWithoutARefreshRecordedByTheDeadlineIsNotEvaluated() {
    history = systemWrites(Instant.parse("2026-09-25T13:30:00Z"));

    SlaValidation validation = validator.validate(contract(availableBy("09:00")));

    assertNull(validation.getAvailabilityMet());
    assertTrue(validation.getMessage().startsWith("Availability is not evaluated"));
  }

  @Test
  void availabilityTimeThatIsNotATimeOfDayIsReported() {
    history = systemWrites(NOW);

    SlaValidation validation = validator.validate(contract(availableBy("morning")));

    assertNull(validation.getAvailabilityMet());
    assertTrue(validation.getMessage().contains("'morning' is not a time of day"));
  }

  @Test
  void slaColumnNamedByItsNameIsLookedUpByFqn() {
    history = systemWrites(NOW);

    validator.validate(contract(daily().withColumnName("UPDATED_AT")));

    assertEquals(TABLE_FQN + ".updated_at", requestedColumn);
  }

  @Test
  void retentionIsReportedAsNotChecked() {
    history = systemWrites(NOW);

    SlaValidation validation =
        validator.validate(
            contract(
                daily().withRetention(new Retention().withPeriod(7).withUnit(Retention.Unit.DAY))));

    assertEquals("Retention is not checked.", validation.getMessage());
  }

  @Test
  void timeZoneLabelUsesTheRegionWhenItIsAZoneAndTheOffsetOtherwise() {
    assertEquals(Optional.of(NEW_YORK), SlaTimeZone.parse("GMT-05:00 (America/New York)"));
    assertEquals(Optional.of(ZoneId.of("+03:00")), SlaTimeZone.parse("GMT+03:00 (Asia/Iran)"));
    assertEquals(Optional.of(ZoneId.of("UTC")), SlaTimeZone.parse("UTC"));
    assertFalse(SlaTimeZone.parse("Mars/Olympus").isPresent());
  }

  @Test
  void profiledMaximumIsReadAsAPointInTime() {
    assertEquals(
        Optional.of(Instant.parse("2026-09-25T10:00:00Z")),
        RefreshTimes.parse("2026-09-25T12:00:00+02:00", NEW_YORK));
    assertEquals(
        Optional.of(Instant.parse("2026-09-25T14:00:00Z")),
        RefreshTimes.parse("2026-09-25 10:00:00", NEW_YORK));
    assertEquals(
        Optional.of(Instant.parse("2026-09-25T04:00:00Z")),
        RefreshTimes.parse("2026-09-25", NEW_YORK));
    assertFalse(RefreshTimes.parse(1727258400000L, NEW_YORK).isPresent());
    assertFalse(RefreshTimes.parse("not a date", NEW_YORK).isPresent());
  }

  private static RefreshHistory systemWrites(Instant... writes) {
    return new RefreshHistory(
        RefreshedAtSource.SYSTEM_PROFILE,
        List.of(writes).stream().map(write -> new Observation(write, write)).toList());
  }

  private static RefreshHistory columnProfile(Instant profiledAt, Instant newestValue) {
    return new RefreshHistory(
        RefreshedAtSource.SLA_COLUMN_PROFILE, List.of(new Observation(profiledAt, newestValue)));
  }

  private static ContractSLA daily() {
    return sla(new RefreshFrequency().withInterval(1).withUnit(RefreshFrequency.Unit.DAY));
  }

  private static ContractSLA sla(RefreshFrequency frequency) {
    return new ContractSLA().withRefreshFrequency(frequency);
  }

  private static ContractSLA maxLatency(int hours) {
    return new ContractSLA()
        .withMaxLatency(new MaxLatency().withValue(hours).withUnit(MaxLatency.Unit.HOUR));
  }

  private static ContractSLA availableBy(String time) {
    return new ContractSLA()
        .withAvailabilityTime(time)
        .withTimezone(ContractSLA.Timezone.fromValue("GMT-05:00 (America/New York)"));
  }

  private static DataContract contract(ContractSLA sla) {
    return new DataContract()
        .withName("orders_contract")
        .withEntity(new EntityReference().withId(UUID.randomUUID()).withType("table"))
        .withSla(sla);
  }

  private static Table table() {
    return new Table()
        .withFullyQualifiedName(TABLE_FQN)
        .withColumns(
            List.of(new Column().withName("updated_at").withDataType(ColumnDataType.TIMESTAMP)));
  }
}
