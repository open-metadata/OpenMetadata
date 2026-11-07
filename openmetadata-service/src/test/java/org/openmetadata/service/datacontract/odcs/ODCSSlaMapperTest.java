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

package org.openmetadata.service.datacontract.odcs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.MaxLatency;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssue;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueCategory;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueSeverity;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSSlaProperty;

class ODCSSlaMapperTest {

  @Test
  void freshnessBecomesTheRefreshFrequencyOnItsColumn() {
    ContractSLA sla =
        toSla(
            new ODCSSlaProperty()
                .withProperty("freshness")
                .withValue("2")
                .withUnit("d")
                .withElement("ORDERS.UPDATED_AT"));

    assertEquals(2, sla.getRefreshFrequency().getInterval());
    assertEquals(RefreshFrequency.Unit.DAY, sla.getRefreshFrequency().getUnit());
    assertEquals("UPDATED_AT", sla.getColumnName());
  }

  @Test
  void valueThatIsNotAWholeNumberIsLeftOutInsteadOfBecomingZero() {
    ODCSImportIssues issues = new ODCSImportIssues();

    ContractSLA sla =
        ODCSSlaMapper.toContractSla(
            List.of(new ODCSSlaProperty().withProperty("freshness").withValue("1.5").withUnit("h")),
            issues);

    assertNull(sla.getRefreshFrequency());
    assertEquals("slaProperties[0].value", issues.toList().getFirst().getPath());
  }

  @Test
  void unitTheSlaFieldDoesNotOfferIsLeftOutInsteadOfFailingTheImport() {
    ODCSImportIssues issues = new ODCSImportIssues();

    ContractSLA sla =
        ODCSSlaMapper.toContractSla(
            List.of(
                new ODCSSlaProperty().withProperty("freshness").withValue("30").withUnit("minutes"),
                new ODCSSlaProperty().withProperty("latency").withValue("30").withUnit("minutes")),
            issues);

    assertNull(sla.getRefreshFrequency());
    assertEquals(MaxLatency.Unit.MINUTE, sla.getMaxLatency().getUnit());
    assertTrue(issues.toList().getFirst().getMessage().contains("hour, day, week, month, year"));
  }

  @Test
  void unknownTimezoneKeepsTheAvailabilityTimeWithoutATimezone() {
    ODCSImportIssues issues = new ODCSImportIssues();

    ContractSLA sla =
        ODCSSlaMapper.toContractSla(
            List.of(
                new ODCSSlaProperty()
                    .withProperty("availabilityTime")
                    .withValue("05:00")
                    .withValueExt("Mars/Phobos")),
            issues);

    assertEquals("05:00", sla.getAvailabilityTime());
    assertNull(sla.getTimezone());
    assertEquals(ODCSImportIssueCategory.SLA, issues.toList().getFirst().getCategory());
  }

  @Test
  void availabilityStringsAreImportedWithoutCoercion() {
    ODCSImportIssues issues = new ODCSImportIssues();
    String timezone = ContractSLA.Timezone.values()[0].value();
    ContractSLA sla =
        ODCSSlaMapper.toContractSla(
            List.of(
                new ODCSSlaProperty()
                    .withProperty("availabilityTime")
                    .withValue("09:00 UTC")
                    .withValueExt(timezone)),
            issues);

    assertEquals("09:00 UTC", sla.getAvailabilityTime());
    assertEquals(timezone, sla.getTimezone().value());
    assertTrue(issues.toList().isEmpty());
  }

  @ParameterizedTest
  @MethodSource("nonStringValues")
  void nonStringAvailabilityIsOmittedAndReported(Object value) {
    ODCSImportIssues issues = new ODCSImportIssues();
    ContractSLA sla =
        ODCSSlaMapper.toContractSla(
            List.of(new ODCSSlaProperty().withProperty("availabilityTime").withValue(value)),
            issues);

    assertNull(sla.getAvailabilityTime());
    assertStringWarning(issues, "value");
  }

  @ParameterizedTest
  @MethodSource("nonStringValues")
  void nonStringTimezoneIsOmittedAndReported(Object value) {
    ODCSImportIssues issues = new ODCSImportIssues();
    ContractSLA sla =
        ODCSSlaMapper.toContractSla(
            List.of(
                new ODCSSlaProperty()
                    .withProperty("availabilityTime")
                    .withValue("05:00")
                    .withValueExt(value)),
            issues);

    assertEquals("05:00", sla.getAvailabilityTime());
    assertNull(sla.getTimezone());
    assertStringWarning(issues, "valueExt");
  }

  private static Stream<Object> nonStringValues() {
    return Stream.of(500, 5.5, true, false, List.of("05:00"), Map.of("time", "05:00"));
  }

  @Test
  void nullAvailabilityFieldsStayAbsentWithoutWarnings() {
    ODCSImportIssues issues = new ODCSImportIssues();
    ContractSLA sla =
        ODCSSlaMapper.toContractSla(
            List.of(
                new ODCSSlaProperty()
                    .withProperty("availabilityTime")
                    .withValue(null)
                    .withValueExt(null)),
            issues);

    assertNull(sla.getAvailabilityTime());
    assertNull(sla.getTimezone());
    assertTrue(issues.toList().isEmpty());
  }

  private static void assertStringWarning(ODCSImportIssues issues, String field) {
    assertEquals(1, issues.toList().size());
    ODCSImportIssue issue = issues.toList().getFirst();
    assertEquals(ODCSImportIssueSeverity.WARNING, issue.getSeverity());
    assertEquals(ODCSImportIssueCategory.SLA, issue.getCategory());
    assertEquals("slaProperties[0]." + field, issue.getPath());
    assertTrue(issue.getMessage().contains("string"));
  }

  @Test
  void unknownSlaPropertyIsReported() {
    ODCSImportIssues issues = new ODCSImportIssues();

    ODCSSlaMapper.toContractSla(
        List.of(new ODCSSlaProperty().withProperty("throughput").withValue("100")), issues);

    ODCSImportIssue issue = issues.toList().getFirst();
    assertTrue(issue.getMessage().contains("throughput"));
  }

  @Test
  void refreshFrequencyIsExportedWithItsColumnAsElement() {
    ODCSSlaProperty freshness =
        ODCSSlaMapper.toOdcs(
                new ContractSLA()
                    .withRefreshFrequency(
                        new RefreshFrequency().withInterval(6).withUnit(RefreshFrequency.Unit.HOUR))
                    .withColumnName("updated_at"))
            .getFirst();

    assertEquals("freshness", freshness.getProperty());
    assertEquals(6, freshness.getValue());
    assertEquals("hour", freshness.getUnit());
    assertEquals("updated_at", freshness.getElement());
  }

  @Test
  void numericValueKeepsItsTypeInsteadOfBecomingText() {
    ContractSLA sla =
        toSla(new ODCSSlaProperty().withProperty("latency").withValue(1).withUnit("h"));

    assertEquals(1, sla.getMaxLatency().getValue());
    assertEquals(1, ODCSSlaMapper.toOdcs(sla).get(0).getValue());
  }

  @ParameterizedTest
  @MethodSource("unrepresentableNumbers")
  void unrepresentableNumberIsOmittedAndReported(Object value) {
    ODCSImportIssues issues = new ODCSImportIssues();
    ContractSLA sla =
        ODCSSlaMapper.toContractSla(
            List.of(new ODCSSlaProperty().withProperty("latency").withValue(value).withUnit("h")),
            issues);

    assertNull(sla.getMaxLatency());
    assertEquals(1, issues.toList().size());
    ODCSImportIssue issue = issues.toList().getFirst();
    assertEquals(ODCSImportIssueCategory.SLA, issue.getCategory());
    assertEquals("slaProperties[0].value", issue.getPath());
    assertTrue(issue.getMessage().contains("not imported"));
  }

  private static Stream<Object> unrepresentableNumbers() {
    return Stream.of(
        3_000_000_000L,
        -3_000_000_000L,
        (long) Integer.MAX_VALUE + 1,
        (long) Integer.MIN_VALUE - 1,
        new BigInteger("18446744073709551616"),
        new BigDecimal("3000000000"),
        new BigDecimal("2147483647.0000000001"),
        new BigDecimal("2147483646.9999999999"),
        new BigDecimal("-2147483648.0000000001"),
        new BigDecimal("2.00000000000000000001"),
        new BigDecimal("1E-400"),
        1e20,
        -1e20,
        Double.NaN,
        Double.POSITIVE_INFINITY,
        Double.NEGATIVE_INFINITY,
        1.5,
        "3000000000",
        "-3000000000");
  }

  @ParameterizedTest
  @MethodSource("intRangeWholeNumbers")
  void intRangeWholeNumberIsImportedWithoutWarnings(Number value) {
    ODCSImportIssues issues = new ODCSImportIssues();
    ContractSLA sla =
        ODCSSlaMapper.toContractSla(
            List.of(new ODCSSlaProperty().withProperty("latency").withValue(value).withUnit("h")),
            issues);

    assertEquals(value.intValue(), sla.getMaxLatency().getValue());
    assertTrue(issues.toList().isEmpty());
  }

  private static Stream<Number> intRangeWholeNumbers() {
    return Stream.of(
        Integer.MIN_VALUE,
        Integer.MAX_VALUE,
        (long) Integer.MIN_VALUE,
        (long) Integer.MAX_VALUE,
        (double) Integer.MIN_VALUE,
        (double) Integer.MAX_VALUE,
        BigInteger.valueOf(Integer.MAX_VALUE),
        new BigDecimal("2.0"),
        0,
        1.0);
  }

  private static ContractSLA toSla(ODCSSlaProperty property) {
    return ODCSSlaMapper.toContractSla(List.of(property), new ODCSImportIssues());
  }
}
