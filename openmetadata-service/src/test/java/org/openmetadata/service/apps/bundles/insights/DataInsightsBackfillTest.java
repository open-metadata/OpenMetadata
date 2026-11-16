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
package org.openmetadata.service.apps.bundles.insights;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.entity.applications.configuration.internal.AppAnalyticsConfig;
import org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.WebAnalyticsWorkflow;

class DataInsightsBackfillTest {
  @ParameterizedTest
  @CsvSource({",", ",2026-01-15", "2026-01-14,", "' ',2026-01-15", "2026-01-14,' '"})
  void missingDatesAreRejectedBeforeConstructingAWorkflow(String startDate, String endDate) {
    assertThrows(
        IllegalArgumentException.class, () -> new DataInsightsApp.Backfill(startDate, endDate));
  }

  @Test
  void reversedRangeIsRejected() {
    assertThrows(
        IllegalArgumentException.class,
        () -> new DataInsightsApp.Backfill("2026-01-15", "2026-01-14"));
  }

  @ParameterizedTest
  @CsvSource({"2026-01-14,2026-01-15", "2026-01-15,2026-01-15"})
  void validRangeConstructsWebAnalyticsWorkflow(String startDate, String endDate) {
    assertDoesNotThrow(
        () ->
            new WebAnalyticsWorkflow(
                new AppAnalyticsConfig().withEnabled(false),
                1768435200000L,
                100,
                Optional.of(new DataInsightsApp.Backfill(startDate, endDate))));
  }
}
