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

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.MaxLatency;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssue;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueCategory;
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
    assertEquals("6", freshness.getValue());
    assertEquals("hour", freshness.getUnit());
    assertEquals("updated_at", freshness.getElement());
  }

  private static ContractSLA toSla(ODCSSlaProperty property) {
    return ODCSSlaMapper.toContractSla(List.of(property), new ODCSImportIssues());
  }
}
