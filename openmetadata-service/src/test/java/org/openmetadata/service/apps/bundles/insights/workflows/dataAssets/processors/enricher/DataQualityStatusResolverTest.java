/*
 *  Copyright 2026 Collate.
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.DataQualityStatusResolver.DATA_QUALITY_STATUS_KEY;
import static org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.DataQualityStatusResolver.HEALTHY;
import static org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.DataQualityStatusResolver.UNHEALTHY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.TIMESTAMP_KEY;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TimeSeriesDAOs.TestCaseResultTimeSeriesDAO;

class DataQualityStatusResolverTest {

  private static final long TODAY = TimestampUtils.getStartOfDayTimestamp(1_791_849_600_000L);
  private static final long YESTERDAY = TimestampUtils.subtractDays(TODAY, 1);

  private final TestCaseResultTimeSeriesDAO resultDao = mock(TestCaseResultTimeSeriesDAO.class);
  private final DataQualityStatusResolver resolver = new DataQualityStatusResolver(collectionDao());

  @Test
  void healthFollowsTheLatestResultOfEveryTestCase() {
    assertEquals(Optional.of(HEALTHY), DataQualityStatusResolver.healthOf(List.of("Success")));
    assertEquals(
        Optional.of(HEALTHY), DataQualityStatusResolver.healthOf(List.of("Success", "Queued")));
    assertEquals(
        Optional.of(UNHEALTHY), DataQualityStatusResolver.healthOf(List.of("Success", "Failed")));
    assertEquals(Optional.of(UNHEALTHY), DataQualityStatusResolver.healthOf(List.of("Aborted")));
    assertEquals(Optional.empty(), DataQualityStatusResolver.healthOf(List.of()));
  }

  @Test
  void eachDayIsStampedWithTheHealthAsOfThatDaysEnd() {
    String suiteId = UUID.randomUUID().toString();
    when(resultDao.listLatestTestCaseStatusesAsOf(
            suiteId, TimestampUtils.getEndOfDayTimestamp(YESTERDAY)))
        .thenReturn(List.of("Success", "Failed"));
    when(resultDao.listLatestTestCaseStatusesAsOf(
            suiteId, TimestampUtils.getEndOfDayTimestamp(TODAY)))
        .thenReturn(List.of("Success", "Success"));
    Map<String, Object> today = snapshot(TODAY);
    Map<String, Object> yesterday = snapshot(YESTERDAY);

    resolver.stamp(tableWithSuite(suiteId), List.of(today, yesterday));

    assertEquals(HEALTHY, today.get(DATA_QUALITY_STATUS_KEY));
    assertEquals(UNHEALTHY, yesterday.get(DATA_QUALITY_STATUS_KEY));
  }

  @Test
  void dayBeforeTheFirstTestRunGetsNoStatus() {
    when(resultDao.listLatestTestCaseStatusesAsOf(anyString(), anyLong())).thenReturn(List.of());
    Map<String, Object> day = snapshot(TODAY);

    resolver.stamp(tableWithSuite(UUID.randomUUID().toString()), List.of(day));

    assertFalse(day.containsKey(DATA_QUALITY_STATUS_KEY));
  }

  @Test
  void tablesWithoutATestSuiteAndOtherAssetsAreLeftAlone() {
    Map<String, Object> table = snapshot(TODAY);
    Map<String, Object> dashboard = snapshot(TODAY);

    resolver.stamp(new Table().withId(UUID.randomUUID()), List.of(table));
    resolver.stamp(new Dashboard().withId(UUID.randomUUID()), List.of(dashboard));

    assertFalse(table.containsKey(DATA_QUALITY_STATUS_KEY));
    assertFalse(dashboard.containsKey(DATA_QUALITY_STATUS_KEY));
  }

  private CollectionDAO collectionDao() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.testCaseResultTimeSeriesDao()).thenReturn(resultDao);
    return collectionDAO;
  }

  private static Table tableWithSuite(String suiteId) {
    return new Table()
        .withId(UUID.randomUUID())
        .withTestSuite(
            new EntityReference().withId(UUID.fromString(suiteId)).withType("testSuite"));
  }

  private static Map<String, Object> snapshot(long dayStart) {
    Map<String, Object> snapshot = new HashMap<>();
    snapshot.put(TIMESTAMP_KEY, dayStart);
    return snapshot;
  }
}
