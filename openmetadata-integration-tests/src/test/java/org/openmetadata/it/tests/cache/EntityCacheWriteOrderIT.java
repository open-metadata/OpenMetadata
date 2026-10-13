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
package org.openmetadata.it.tests.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
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
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ChartRepository;
import org.openmetadata.service.util.PostCommitActionQueue;
import org.openmetadata.service.util.RequestEntityCache;

/**
 * Two writers can commit in one order and finish their post-commit cache work in the other: the
 * earlier committer is often still dispatching its lifecycle and search work when the later one is
 * done. While each writer pushed its own copy of the entity into Redis, whichever finished last
 * decided what the cache held, so reads could serve the older committed state until the next write
 * or the cache repair pass.
 *
 * <p>Holding the first writer's post-commit actions until the second writer has committed replays
 * that ordering on demand.
 */
@ExtendWith(TestNamespaceExtension.class)
class EntityCacheWriteOrderIT {

  @BeforeAll
  static void requireRedis() {
    Assumptions.assumeTrue(
        TestSuiteBootstrap.isRedisEnabled(),
        "Cache write-order tests require cacheProvider=redis (set by -Pcache-tests"
            + " or -Ppostgres-os-redis, or pass -DcacheProvider=redis directly)");
  }

  @Test
  void writerFinishingLast_doesNotLeaveTheOlderStateInTheCache(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);
    Chart chart =
        client
            .charts()
            .create(
                new CreateChart()
                    .withName(ns.prefix("writeOrderChart"))
                    .withService(service.getFullyQualifiedName())
                    .withChartType(ChartType.Bar)
                    .withDescription("created"));
    String chartId = chart.getId().toString();
    client.charts().get(chartId);
    client.charts().getByName(chart.getFullyQualifiedName());

    List<Runnable> earlierWritersCacheWork =
        updateDescriptionHoldingPostCommitWork(chart.getId(), "earlier writer");
    Chart laterWrite = client.charts().get(chartId);
    laterWrite.setDescription("later writer");
    client.charts().update(chartId, laterWrite);
    PostCommitActionQueue.run(earlierWritersCacheWork);

    assertEquals(
        "later writer",
        client.charts().get(chartId).getDescription(),
        "GET by id must serve the last committed write, not the writer that finished last");
    assertEquals(
        "later writer",
        client.charts().getByName(chart.getFullyQualifiedName()).getDescription(),
        "GET by name must serve the last committed write, not the writer that finished last");
  }

  /** Commits an update on this thread and returns its post-commit actions without running them. */
  private static List<Runnable> updateDescriptionHoldingPostCommitWork(
      UUID chartId, String description) {
    ChartRepository repository = (ChartRepository) Entity.getEntityRepository(Entity.CHART);
    boolean ownsQueue = PostCommitActionQueue.begin();
    try {
      Chart original = repository.get(null, chartId, repository.getFields("*"));
      Chart updated = JsonUtils.deepCopy(original, Chart.class).withDescription(description);
      repository.update(null, original, updated, "admin");
      return PostCommitActionQueue.drain();
    } finally {
      if (ownsQueue) {
        PostCommitActionQueue.clear();
      }
      RequestEntityCache.clear();
    }
  }
}
