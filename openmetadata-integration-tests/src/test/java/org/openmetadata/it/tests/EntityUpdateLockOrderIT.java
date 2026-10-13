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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Duration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.JdbiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.ChartType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil;

/**
 * An update that returns an entity to its previous version within the same session deletes that
 * version's history row and rewrites the entity row; a version bump inserts the history row and
 * then rewrites the entity row. Taken in opposite orders, overlapping updates by the same user
 * deadlocked: Postgres broke the cycle only after its one-second deadlock timeout, and the retry
 * then committed the two requests in the reverse of their original order.
 *
 * <p>This holds the history row the way a concurrent bump does and checks that the reverting update
 * waits for it before it locks the entity row.
 */
@ExtendWith(TestNamespaceExtension.class)
class EntityUpdateLockOrderIT {

  @Test
  void revertingUpdate_waitsForTheHistoryRowBeforeLockingTheEntityRow(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);
    Chart chart =
        client
            .charts()
            .create(
                new CreateChart()
                    .withName(ns.prefix("lockOrderChart"))
                    .withService(service.getFullyQualifiedName())
                    .withChartType(ChartType.Bar)
                    .withDescription("original"));
    String chartId = chart.getId().toString();
    // Stores the version-0.1 history row that setting the description back will delete.
    updateDescription(client, chartId, "bumped");

    ExecutorService reverter = Executors.newSingleThreadExecutor();
    try (Handle historyHolder = TestSuiteBootstrap.getJdbi().open()) {
      historyHolder.begin();
      int heldRows =
          historyHolder
              .createQuery(
                  "SELECT 1 FROM entity_extension WHERE id = :id AND extension = :extension"
                      + " FOR UPDATE")
              .bind("id", chartId)
              .bind("extension", EntityUtil.getVersionExtension(Entity.CHART, 0.1))
              .mapTo(Integer.class)
              .list()
              .size();
      assertEquals(1, heldRows, "The first update must have stored the version-0.1 history row");

      Future<?> reverting = reverter.submit(() -> updateDescription(client, chartId, "original"));
      Awaitility.await("the reverting update must not lock the chart row while it waits")
          .during(Duration.ofSeconds(2))
          .atMost(Duration.ofSeconds(15))
          .pollInterval(Duration.ofMillis(100))
          .until(() -> !reverting.isDone() && isChartRowLockable(chartId));

      historyHolder.commit();
      reverting.get(1, TimeUnit.MINUTES);
    } finally {
      reverter.shutdownNow();
    }
    assertEquals("original", client.charts().get(chartId).getDescription());
  }

  private static void updateDescription(
      OpenMetadataClient client, String chartId, String description) {
    Chart chart = client.charts().get(chartId);
    chart.setDescription(description);
    client.charts().update(chartId, chart);
  }

  private static boolean isChartRowLockable(String chartId) {
    try (Handle probe = TestSuiteBootstrap.getJdbi().open()) {
      return probe.inTransaction(
          transaction ->
              transaction
                      .createQuery("SELECT id FROM chart_entity WHERE id = :id FOR UPDATE NOWAIT")
                      .bind("id", chartId)
                      .mapTo(String.class)
                      .list()
                      .size()
                  == 1);
    } catch (JdbiException locked) {
      return false;
    }
  }
}
