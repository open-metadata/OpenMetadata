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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.TIMESTAMP_KEY;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Stamps each daily table snapshot with the table's data quality health on that day. It runs after
 * materialization rather than as an {@link EnrichmentStep}: health moves with test runs, not with
 * the entity versions a snapshot is cut from, so one version can cover days of differing health.
 *
 * <p>Matches the Data Quality page: a table with tests is unhealthy when the latest result of any
 * of its test cases, as of the day's end, failed or aborted. Tables without results get no status.
 */
public final class DataQualityStatusResolver {

  public static final String DATA_QUALITY_STATUS_KEY = "dataQualityStatus";
  static final String HEALTHY = "Healthy";
  static final String UNHEALTHY = "Unhealthy";
  private static final Set<String> UNHEALTHY_STATUSES =
      Set.of(TestCaseStatus.Failed.value(), TestCaseStatus.Aborted.value());

  private final CollectionDAO collectionDAO;

  public DataQualityStatusResolver(CollectionDAO collectionDAO) {
    this.collectionDAO = collectionDAO;
  }

  /** The table's basic test suite holds all its test cases; tables without one have no tests. */
  public void stamp(EntityInterface<?> entity, List<Map<String, Object>> snapshots) {
    if (entity instanceof Table table && table.getTestSuite() != null) {
      String testSuiteId = table.getTestSuite().getId().toString();
      snapshots.forEach(snapshot -> stampDay(testSuiteId, snapshot));
    }
  }

  private void stampDay(String testSuiteId, Map<String, Object> snapshot) {
    long asOf = TimestampUtils.getEndOfDayTimestamp((Long) snapshot.get(TIMESTAMP_KEY));
    healthOf(
            collectionDAO
                .testCaseResultTimeSeriesDao()
                .listLatestTestCaseStatusesAsOf(testSuiteId, asOf))
        .ifPresent(status -> snapshot.put(DATA_QUALITY_STATUS_KEY, status));
  }

  static Optional<String> healthOf(List<String> latestStatuses) {
    if (nullOrEmpty(latestStatuses)) {
      return Optional.empty();
    }
    boolean isUnhealthy = latestStatuses.stream().anyMatch(UNHEALTHY_STATUSES::contains);
    return Optional.of(isUnhealthy ? UNHEALTHY : HEALTHY);
  }
}
