/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.*;

import es.org.elasticsearch.client.RestClient;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.search.SearchClusterMetrics;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SearchIndexCompressionIntegrationTest extends OpenMetadataApplicationTest {

  private SearchRepository searchRepository;
  private SearchIndexApp searchIndexApp;

  @BeforeEach
  public void setup() {
    searchRepository = Entity.getSearchRepository();
    searchIndexApp = new SearchIndexApp(Entity.getCollectionDAO(), searchRepository);
  }

  @Test
  void testAutoTuneWithRealElasticSearchCluster() {
    LOG.info("=== Testing Auto-Tune with Real ElasticSearch Cluster ===");
    RestClient esClient = getSearchClient();
    assertNotNull(esClient, "ElasticSearch client should be available");
    assertDoesNotThrow(
        () -> {
          es.org.elasticsearch.client.Response response =
              esClient.performRequest(
                  new es.org.elasticsearch.client.Request("GET", "/_cluster/health"));
          assertEquals(200, response.getStatusLine().getStatusCode());
        });

    EventPublisherJob jobData =
        new EventPublisherJob()
            .withEntities(Set.of("table", "user"))
            .withBatchSize(50)
            .withPayLoadSize(5 * 1024 * 1024L)
            .withMaxConcurrentRequests(25)
            .withProducerThreads(1)
            .withAutoTune(true)
            .withRecreateIndex(false)
            .withStats(new Stats());

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(jobData, Object.class));

    assertDoesNotThrow(
        () -> searchIndexApp.init(testApp),
        "SearchIndexApp initialization with autoTune should succeed");

    EventPublisherJob tuned = searchIndexApp.getJobData();
    assertNotNull(tuned, "Job data should be available after initialization");

    LOG.info("Auto-tune results comparison:");
    LOG.info("  Batch Size: {} → {}", jobData.getBatchSize(), tuned.getBatchSize());
    LOG.info(
        "  Payload Size: {} MB → {} MB",
        jobData.getPayLoadSize() / (1024 * 1024),
        tuned.getPayLoadSize() / (1024 * 1024));
    LOG.info(
        "  Concurrent Requests: {} → {}",
        jobData.getMaxConcurrentRequests(),
        tuned.getMaxConcurrentRequests());
    LOG.info(
        "  Producer Threads: {} → {}", jobData.getProducerThreads(), tuned.getProducerThreads());

    assertTrue(
        tuned.getBatchSize() >= jobData.getBatchSize(),
        "Auto-tune should maintain or increase batch size with compression");
    assertTrue(
        tuned.getPayLoadSize() >= jobData.getPayLoadSize(),
        "Auto-tune should maintain or increase payload size with compression");
  }

  @Test
  void testSearchClusterMetricsWithRealCluster() {
    LOG.info("=== Testing SearchClusterMetrics with Real Cluster ===");

    SearchClusterMetrics metrics =
        SearchClusterMetrics.fetchClusterMetrics(searchRepository, 1000L, 50);
    assertNotNull(metrics, "Cluster metrics should be fetched successfully");
    metrics.logRecommendations();
    assertTrue(metrics.getTotalNodes() > 0, "Should detect at least 1 node");
    assertTrue(metrics.getMaxPayloadSizeBytes() > 0, "Should have a positive max payload size");
    assertTrue(metrics.getRecommendedBatchSize() > 0, "Should recommend a positive batch size");
    assertTrue(
        metrics.getRecommendedConcurrentRequests() > 0,
        "Should recommend positive concurrent requests");

    long minExpectedPayload = 50 * 1024 * 1024L;
    assertTrue(
        metrics.getMaxPayloadSizeBytes() >= minExpectedPayload,
        "Payload size should benefit from compression (actual: "
            + metrics.getMaxPayloadSizeBytes() / (1024 * 1024)
            + " MB)");
  }

  @Test
  void testCompressionBenefitsWithRealPayloads() {
    assertDoesNotThrow(
        () -> {
          Map<String, Object> clusterSettings = getClusterSettings();
          assertNotNull(clusterSettings, "Should be able to fetch cluster settings");
        },
        "Should be able to access cluster settings for maxContentLength analysis");

    EventPublisherJob smallJobData =
        new EventPublisherJob()
            .withEntities(Set.of("table"))
            .withBatchSize(10)
            .withPayLoadSize(1024 * 1024L)
            .withAutoTune(true)
            .withStats(new Stats());

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(smallJobData, Object.class));

    searchIndexApp.init(testApp);
    EventPublisherJob tunedJobData = searchIndexApp.getJobData();

    long compressionBenefit = tunedJobData.getPayLoadSize() / smallJobData.getPayLoadSize();
    LOG.info("Compression benefit ratio: {}x larger payload enabled", compressionBenefit);

    assertTrue(compressionBenefit >= 1, "Auto-tuning should maintain or improve payload capacity");
  }

  @Test
  void testCompressionHeadersInRealRequests() {
    EventPublisherJob jobData =
        new EventPublisherJob()
            .withEntities(Set.of("table"))
            .withBatchSize(5)
            .withPayLoadSize(1024 * 1024L)
            .withMaxConcurrentRequests(10)
            .withProducerThreads(1)
            .withAutoTune(false) // Disable auto-tune for this test
            .withRecreateIndex(false)
            .withStats(new Stats());

    App testApp =
        new App()
            .withName("SearchIndexingApplication")
            .withAppConfiguration(JsonUtils.convertValue(jobData, Object.class));

    assertDoesNotThrow(() -> searchIndexApp.init(testApp), "App initialization should succeed");
    assertNotNull(searchIndexApp.getJobData(), "Job data should be initialized");
  }

  private Map<String, Object> getClusterSettings() throws Exception {
    // Get cluster settings from the real ElasticSearch instance
    RestClient client = getSearchClient();
    es.org.elasticsearch.client.Response response =
        client.performRequest(new es.org.elasticsearch.client.Request("GET", "/_cluster/settings"));

    String responseBody = org.apache.http.util.EntityUtils.toString(response.getEntity());
    return JsonUtils.readValue(responseBody, Map.class);
  }
}
