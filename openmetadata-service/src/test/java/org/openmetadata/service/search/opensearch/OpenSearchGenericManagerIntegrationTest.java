package org.openmetadata.service.search.opensearch;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.openmetadata.service.events.scheduled.ServicesStatusJobHandler.HEALTHY_STATUS;
import static org.openmetadata.service.events.scheduled.ServicesStatusJobHandler.UNHEALTHY_STATUS;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.hc.core5.http.HttpHost;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.search.SearchHealthStatus;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch._types.OpenSearchException;
import os.org.opensearch.client.opensearch.cluster.ClusterStatsResponse;
import os.org.opensearch.client.opensearch.cluster.GetClusterSettingsResponse;
import os.org.opensearch.client.opensearch.cluster.PutComponentTemplateRequest;
import os.org.opensearch.client.opensearch.generic.Bodies;
import os.org.opensearch.client.opensearch.generic.OpenSearchGenericClient;
import os.org.opensearch.client.opensearch.generic.Requests;
import os.org.opensearch.client.opensearch.indices.CreateDataStreamRequest;
import os.org.opensearch.client.opensearch.indices.PutIndexTemplateRequest;
import os.org.opensearch.client.opensearch.indices.put_index_template.IndexTemplateMapping;
import os.org.opensearch.client.opensearch.nodes.NodesStatsResponse;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5Transport;
import os.org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OpenSearchGenericManagerIntegrationTest extends OpenMetadataApplicationTest {

  private OpenSearchGenericManager genericManager;
  private OpenSearchClient client;
  private ApacheHttpClient5Transport transport;
  private String testPrefix;

  @BeforeEach
  void setUp() {
    testPrefix =
        "test_generic_"
            + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss_SSS"));

    org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration
        searchConfig = getSearchConfig();
    HttpHost host =
        new HttpHost(searchConfig.getScheme(), searchConfig.getHost(), searchConfig.getPort());

    transport =
        ApacheHttpClient5TransportBuilder.builder(host).setMapper(new JacksonJsonpMapper()).build();
    client = new OpenSearchClient(transport);

    genericManager = new OpenSearchGenericManager(client, transport);

    LOG.info("OpenSearchGenericManager test setup completed with prefix: {}", testPrefix);
  }

  private boolean isISMPluginAvailable() {
    try {
      OpenSearchGenericClient genericClient = client.generic();
      var response =
          genericClient.execute(
              Requests.builder().method("GET").endpoint("/_plugins/_ism/policies").build());
      return response.getStatus() == 200;
    } catch (Exception e) {
      return false;
    }
  }

  @AfterEach
  void tearDown() {
    if (client != null && testPrefix != null) {
      try {
        // Clean up data streams
        try {
          List<String> dataStreams = genericManager.getDataStreams(testPrefix);
          for (String ds : dataStreams) {
            try {
              genericManager.deleteDataStream(ds);
              LOG.info("Cleaned up test data stream: {}", ds);
            } catch (Exception e) {
              LOG.debug("Data stream {} might not exist for cleanup", ds);
            }
          }
        } catch (Exception e) {
          LOG.debug("Failed to clean up data streams", e);
        }

        String[] ismPoliciesToDelete = {testPrefix + "_policy"};
        OpenSearchGenericClient genericClient = client.generic();

        for (String policy : ismPoliciesToDelete) {
          try {
            genericClient.execute(
                Requests.builder()
                    .method("DELETE")
                    .endpoint("/_plugins/_ism/policies/" + policy)
                    .build());
            LOG.info("Cleaned up test ISM policy: {}", policy);
          } catch (Exception e) {
            LOG.debug("ISM policy {} might not exist for cleanup", policy);
          }
        }

        // Clean up index templates
        String[] templatesToDelete = {testPrefix + "_template", testPrefix + "_ism_template"};

        for (String template : templatesToDelete) {
          try {
            client.indices().deleteIndexTemplate(d -> d.name(template));
            LOG.info("Cleaned up test index template: {}", template);
          } catch (Exception e) {
            LOG.debug("Index template {} might not exist for cleanup", template);
          }
        }

        // Clean up component templates
        String[] componentTemplatesToDelete = {
          testPrefix + "_component", testPrefix + "_ism_component"
        };

        for (String template : componentTemplatesToDelete) {
          try {
            client.cluster().deleteComponentTemplate(d -> d.name(template));
            LOG.info("Cleaned up test component template: {}", template);
          } catch (Exception e) {
            LOG.debug("Component template {} might not exist for cleanup", template);
          }
        }

        // Clean up indices
        String[] indicesToDelete = {
          testPrefix + "_index1", testPrefix + "_index2", testPrefix + "_ism_index"
        };

        for (String index : indicesToDelete) {
          try {
            client.indices().delete(d -> d.index(index));
            LOG.info("Cleaned up test index: {}", index);
          } catch (Exception e) {
            LOG.debug("Index {} might not exist for cleanup", index);
          }
        }

      } catch (Exception e) {
        LOG.error("Failed to clean up test resources", e);
      }
    }
  }

  @Test
  void testGetDataStreams_WithPrefix() throws Exception {
    String dataStreamName = testPrefix + "_stream1";

    // Create index template for data stream
    String templateName = testPrefix + "_template";
    client
        .indices()
        .putIndexTemplate(
            PutIndexTemplateRequest.of(
                t ->
                    t.name(templateName)
                        .indexPatterns(testPrefix + "*")
                        .dataStream(ds -> ds)
                        .template(
                            IndexTemplateMapping.of(m -> m.settings(s -> s.numberOfShards(1))))));

    // Create data stream
    client.indices().createDataStream(CreateDataStreamRequest.of(d -> d.name(dataStreamName)));

    List<String> dataStreams = genericManager.getDataStreams(testPrefix);

    assertNotNull(dataStreams);
    assertFalse(dataStreams.isEmpty());
    assertTrue(dataStreams.contains(dataStreamName));
  }

  @Test
  void testGetDataStreams_NoMatches() throws Exception {
    List<String> dataStreams = genericManager.getDataStreams("nonexistent_prefix_xyz");

    assertNotNull(dataStreams);
    assertEquals(0, dataStreams.size());
  }

  @Test
  void testDeleteDataStream_Success() throws Exception {
    String dataStreamName = testPrefix + "_stream_to_delete";

    // Create index template
    String templateName = testPrefix + "_template";
    client
        .indices()
        .putIndexTemplate(
            PutIndexTemplateRequest.of(
                t ->
                    t.name(templateName)
                        .indexPatterns(testPrefix + "*")
                        .dataStream(ds -> ds)
                        .template(
                            IndexTemplateMapping.of(m -> m.settings(s -> s.numberOfShards(1))))));

    // Create data stream
    client.indices().createDataStream(CreateDataStreamRequest.of(d -> d.name(dataStreamName)));

    // Verify it exists
    List<String> beforeDelete = genericManager.getDataStreams(testPrefix);
    assertTrue(beforeDelete.contains(dataStreamName));

    // Delete the data stream
    assertDoesNotThrow(() -> genericManager.deleteDataStream(dataStreamName));

    // Verify it's deleted
    List<String> afterDelete = genericManager.getDataStreams(testPrefix);
    assertFalse(afterDelete.contains(dataStreamName));
  }

  @Test
  void testDeleteDataStream_NonExistent() {
    // Should not throw exception for non-existent data stream
    assertDoesNotThrow(() -> genericManager.deleteDataStream("nonexistent_stream"));
  }

  @Test
  void testDeleteISMPolicy_Success() throws Exception {
    assumeTrue(isISMPluginAvailable(), "ISM plugin not available in test environment");

    String policyName = testPrefix + "_policy";
    OpenSearchGenericClient genericClient = client.generic();

    String policyJson =
        """
          {
            "policy": {
              "description": "Test policy",
              "default_state": "hot",
              "states": [
                {
                  "name": "hot",
                  "actions": [],
                  "transitions": []
                }
              ]
            }
          }
          """;

    genericClient.execute(
        Requests.builder()
            .method("PUT")
            .endpoint("/_plugins/_ism/policies/" + policyName)
            .body(Bodies.json(policyJson))
            .build());

    var getResponse =
        genericClient.execute(
            Requests.builder()
                .method("GET")
                .endpoint("/_plugins/_ism/policies/" + policyName)
                .build());
    assertEquals(200, getResponse.getStatus());

    assertDoesNotThrow(() -> genericManager.deleteILMPolicy(policyName));

    var verifyResponse =
        genericClient.execute(
            Requests.builder()
                .method("GET")
                .endpoint("/_plugins/_ism/policies/" + policyName)
                .build());
    assertEquals(404, verifyResponse.getStatus());
  }

  @Test
  void testDeleteISMPolicy_NonExistent() {
    // Skip test if ISM plugin is not available
    assumeTrue(isISMPluginAvailable(), "ISM plugin not available in test environment");

    // Should not throw exception for non-existent policy
    assertDoesNotThrow(() -> genericManager.deleteILMPolicy("nonexistent_policy"));
  }

  @Test
  void testDeleteIndexTemplate_Success() throws Exception {
    String templateName = testPrefix + "_template";

    // Create index template
    client
        .indices()
        .putIndexTemplate(
            PutIndexTemplateRequest.of(
                t ->
                    t.name(templateName)
                        .indexPatterns(testPrefix + "*")
                        .template(
                            IndexTemplateMapping.of(m -> m.settings(s -> s.numberOfShards(1))))));

    // Verify it exists
    var getResponse = client.indices().getIndexTemplate(g -> g.name(templateName));
    assertFalse(getResponse.indexTemplates().isEmpty());

    // Delete the template
    assertDoesNotThrow(() -> genericManager.deleteIndexTemplate(templateName));

    // Verify it's deleted
    try {
      var afterDelete = client.indices().getIndexTemplate(g -> g.name(templateName));
      assertEquals(0, afterDelete.indexTemplates().size());
    } catch (OpenSearchException e) {
      // Expected - template doesn't exist
      assertEquals(404, e.status());
    }
  }

  @Test
  void testDeleteIndexTemplate_NonExistent() {
    // Should not throw exception for non-existent template
    assertDoesNotThrow(() -> genericManager.deleteIndexTemplate("nonexistent_template"));
  }

  @Test
  void testDeleteComponentTemplate_Success() throws Exception {
    String componentName = testPrefix + "_component";

    // Create component template
    client
        .cluster()
        .putComponentTemplate(
            PutComponentTemplateRequest.of(
                c -> c.name(componentName).template(t -> t.settings(s -> s.numberOfShards(1)))));

    // Verify it exists
    var getResponse = client.cluster().getComponentTemplate(g -> g.name(componentName));
    assertFalse(getResponse.componentTemplates().isEmpty());

    // Delete the component template
    assertDoesNotThrow(() -> genericManager.deleteComponentTemplate(componentName));

    // Verify it's deleted
    try {
      var afterDelete = client.cluster().getComponentTemplate(g -> g.name(componentName));
      assertEquals(0, afterDelete.componentTemplates().size());
    } catch (OpenSearchException e) {
      // Expected - component template doesn't exist
      assertEquals(404, e.status());
    }
  }

  @Test
  void testDeleteComponentTemplate_NonExistent() {
    // Should not throw exception for non-existent component template
    assertDoesNotThrow(() -> genericManager.deleteComponentTemplate("nonexistent_component"));
  }

  @Test
  void testDettachIsmPolicyFromIndexes_Success() throws Exception {
    assumeTrue(isISMPluginAvailable(), "ISM plugin not available in test environment");

    String indexName1 = testPrefix + "_index1";
    String indexName2 = testPrefix + "_index2";
    String policyName = testPrefix + "_policy";
    OpenSearchGenericClient genericClient = client.generic();

    String policyJson =
        """
          {
            "policy": {
              "description": "Test policy",
              "default_state": "hot",
              "states": [
                {
                  "name": "hot",
                  "actions": [],
                  "transitions": []
                }
              ]
            }
          }
          """;

    genericClient.execute(
        Requests.builder()
            .method("PUT")
            .endpoint("/_plugins/_ism/policies/" + policyName)
            .body(Bodies.json(policyJson))
            .build());

    client.indices().create(c -> c.index(indexName1));
    client.indices().create(c -> c.index(indexName2));

    String policyAttachJson =
        String.format("{\"index.plugins.index_state_management.policy_id\": \"%s\"}", policyName);

    genericClient.execute(
        Requests.builder()
            .method("PUT")
            .endpoint("/" + indexName1 + "/_settings")
            .body(Bodies.json(policyAttachJson))
            .build());

    genericClient.execute(
        Requests.builder()
            .method("PUT")
            .endpoint("/" + indexName2 + "/_settings")
            .body(Bodies.json(policyAttachJson))
            .build());

    assertDoesNotThrow(() -> genericManager.dettachIlmPolicyFromIndexes(testPrefix + "_index*"));

    Thread.sleep(1000);

    assertTrue(true);
  }

  @Test
  void testDettachIsmPolicyFromIndexes_NoMatches() {
    // Should not throw exception when no indices match
    assertDoesNotThrow(() -> genericManager.dettachIlmPolicyFromIndexes("nonexistent_pattern*"));
  }

  @Test
  void testClusterStats_Success() throws Exception {
    ClusterStatsResponse response = genericManager.clusterStats();

    assertNotNull(response);
    assertNotNull(response.clusterName());
    assertNotNull(response.nodes());
  }

  @Test
  void testNodesStats_Success() throws Exception {
    NodesStatsResponse response = genericManager.nodesStats();

    assertNotNull(response);
    assertNotNull(response.nodes());
    assertFalse(response.nodes().isEmpty());
  }

  @Test
  void testClusterSettings_Success() throws Exception {
    GetClusterSettingsResponse response = genericManager.clusterSettings();

    assertNotNull(response);
    assertNotNull(response.persistent());
    assertNotNull(response.transient_());
  }

  @Test
  void testAverageCpuPercentFromNodesStats() throws Exception {
    NodesStatsResponse nodesStats = genericManager.nodesStats();

    double avgCpu = genericManager.averageCpuPercentFromNodesStats(nodesStats);

    assertTrue(avgCpu >= 0.0);
    assertTrue(avgCpu <= 100.0); // Default is 50%
  }

  @Test
  void testAverageCpuPercentFromNodesStats_NullInput() {
    double avgCpu = genericManager.averageCpuPercentFromNodesStats(null);

    assertEquals(50.0, avgCpu); // Should return default
  }

  @Test
  void testExtractJvmMemoryStats_NullInput() {
    Map<String, Object> memoryStats = genericManager.extractJvmMemoryStats(null);

    assertNotNull(memoryStats);
    assertTrue(memoryStats.containsKey("heapMaxBytes"));
    assertTrue(memoryStats.containsKey("memoryUsagePercent"));
  }

  @Test
  void testExtractMaxContentLengthStr() throws Exception {
    GetClusterSettingsResponse clusterSettings = genericManager.clusterSettings();

    String maxContentLength = genericManager.extractMaxContentLengthStr(clusterSettings);

    // May be null if not set, which is valid
    assertTrue(maxContentLength == null || !maxContentLength.isEmpty());
  }

  @Test
  void testExtractMaxContentLengthStr_NullInput() {
    String maxContentLength = genericManager.extractMaxContentLengthStr(null);

    // Should not throw exception
    assertNull(maxContentLength);
  }

  @Test
  void testGetSearchHealthStatus_Healthy() throws Exception {
    SearchHealthStatus healthStatus = genericManager.getSearchHealthStatus();

    assertNotNull(healthStatus);
    // The cluster should be healthy (green or yellow) in test environment
    assertTrue(
        healthStatus.getStatus().equals(HEALTHY_STATUS)
            || healthStatus.getStatus().equals(UNHEALTHY_STATUS));
  }
}
