/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.processors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.WebAnalyticsWorkflow.USER_ACTIVITY_REPORT_DATA_KEY;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.analytics.WebAnalyticUserActivityReportData;
import org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.WebAnalyticsWorkflow;
import org.openmetadata.service.exception.SearchIndexException;

class WebAnalyticsUserActivityAggregatorTest {

  @Test
  void aggregatesSessionDurationsAndUpdatesStats() throws SearchIndexException {
    final UUID userId = UUID.randomUUID();
    final WebAnalyticsWorkflow.UserActivityData userActivityData =
        new WebAnalyticsWorkflow.UserActivityData(
            "test-user",
            userId,
            "test-team",
            Map.of(
                UUID.randomUUID(), List.of(1_000L, 3_500L),
                UUID.randomUUID(), List.of(10_000L, 15_900L)),
            4,
            2,
            15_900L);
    final Map<UUID, WebAnalyticUserActivityReportData> reportData = new HashMap<>();
    final Map<String, Object> contextData = new HashMap<>();
    contextData.put(USER_ACTIVITY_REPORT_DATA_KEY, reportData);
    final WebAnalyticsUserActivityAggregator aggregator = new WebAnalyticsUserActivityAggregator(1);

    final Map<UUID, WebAnalyticUserActivityReportData> result =
        aggregator.process(Map.of(userId, userActivityData), contextData);

    assertSame(reportData, result);
    assertEquals(7, result.get(userId).getTotalSessionDuration());
    assertEquals(4, result.get(userId).getTotalPageView());
    assertEquals(2, result.get(userId).getTotalSessions());
    assertEquals(15_900L, result.get(userId).getLastSession());
    assertEquals(1, aggregator.getStats().getSuccessRecords());
    assertEquals(0, aggregator.getStats().getFailedRecords());
  }

  @Test
  void rejectsTotalSessionDurationOutsideIntegerRange() {
    final UUID userId = UUID.randomUUID();
    final long overflowingDurationMillis = (Integer.MAX_VALUE + 1L) * 1000;
    final WebAnalyticsWorkflow.UserActivityData userActivityData =
        new WebAnalyticsWorkflow.UserActivityData(
            "test-user",
            userId,
            "test-team",
            Map.of(UUID.randomUUID(), List.of(0L, overflowingDurationMillis)),
            2,
            1,
            overflowingDurationMillis);
    final Map<String, Object> contextData = new HashMap<>();
    contextData.put(
        USER_ACTIVITY_REPORT_DATA_KEY, new HashMap<UUID, WebAnalyticUserActivityReportData>());

    final WebAnalyticsUserActivityAggregator aggregator = new WebAnalyticsUserActivityAggregator(1);

    assertThrows(
        SearchIndexException.class,
        () -> aggregator.process(Map.of(userId, userActivityData), contextData));
  }
}
