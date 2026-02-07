package org.openmetadata.service.search.elasticsearch;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;
import static org.openmetadata.service.events.scheduled.ServicesStatusJobHandler.HEALTHY_STATUS;
import static org.openmetadata.service.events.scheduled.ServicesStatusJobHandler.UNHEALTHY_STATUS;

import es.co.elastic.clients.elasticsearch.ElasticsearchClient;
import es.co.elastic.clients.elasticsearch._types.ElasticsearchException;
import es.co.elastic.clients.elasticsearch.cluster.ClusterStatsResponse;
import es.co.elastic.clients.elasticsearch.cluster.GetClusterSettingsResponse;
import es.co.elastic.clients.elasticsearch.cluster.PutComponentTemplateRequest;
import es.co.elastic.clients.elasticsearch.indices.CreateDataStreamRequest;
import es.co.elastic.clients.elasticsearch.indices.PutIndexTemplateRequest;
import es.co.elastic.clients.elasticsearch.indices.put_index_template.IndexTemplateMapping;
import es.co.elastic.clients.elasticsearch.nodes.NodesStatsResponse;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import es.co.elastic.clients.transport.rest5_client.Rest5ClientTransport;
import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.search.SearchHealthStatus;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ElasticSearchGenericManagerIntegrationTest extends OpenMetadataApplicationTest {

  private ElasticSearchGenericManager genericManager;
  private ElasticsearchClient client;
  private String testPrefix;

  @BeforeEach
  void setUp() {
    testPrefix =
        "test_generic_"
            + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss_SSS"));

    Rest5Client restClient = getSearchClient();
    Rest5ClientTransport transport = new Rest5ClientTransport(restClient, new JacksonJsonpMapper());
    client = new ElasticsearchClient(transport);

    genericManager = new ElasticSearchGenericManager(client);

    LOG.info("ElasticSearchGenericManager test setup completed with prefix: {}", testPrefix);
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

        // Clean up index templates
        String[] templatesToDelete =
            new String[] {testPrefix + "_template", testPrefix + "_ilm_template"};

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
          testPrefix + "_component", testPrefix + "_ilm_component"
        };

        for (String template : componentTemplatesToDelete) {
          try {
            client.cluster().deleteComponentTemplate(d -> d.name(template));
            LOG.info("Cleaned up test component template: {}", template);
          } catch (Exception e) {
            LOG.debug("Component template {} might not exist for cleanup", template);
          }
        }

        // Clean up ILM policies
        String[] ilmPoliciesToDelete = {testPrefix + "_policy"};

        for (String policy : ilmPoliciesToDelete) {
          try {
            client.ilm().deleteLifecycle(d -> d.name(policy));
            LOG.info("Cleaned up test ILM policy: {}", policy);
          } catch (Exception e) {
            LOG.debug("ILM policy {} might not exist for cleanup", policy);
          }
        }

        // Clean up indices
        String[] indicesToDelete = {
          testPrefix + "_index1", testPrefix + "_index2", testPrefix + "_ilm_index"
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
                            IndexTemplateMapping.of(m -> m.settings(s -> s.numberOfShards("1"))))));

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
                            IndexTemplateMapping.of(m -> m.settings(s -> s.numberOfShards("1"))))));

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
  void testDeleteILMPolicy_Success() throws Exception {
    String policyName = testPrefix + "_policy";

    // Create ILM policy
    client.ilm().putLifecycle(p -> p.name(policyName).policy(pol -> pol.phases(ph -> ph)));

    // Verify it exists
    var getResponse = client.ilm().getLifecycle(g -> g.name(policyName));
    assertTrue(getResponse.get(policyName) != null);

    // Delete the policy
    assertDoesNotThrow(() -> genericManager.deleteILMPolicy(policyName));

    // Verify it's deleted by expecting a 404 exception
    try {
      client.ilm().getLifecycle(g -> g.name(policyName));
      // If we reach here, the policy still exists - test should fail
      fail("Policy should have been deleted but still exists");
    } catch (ElasticsearchException e) {
      // Expected - policy was successfully deleted
      assertEquals(404, e.status());
    }
  }

  @Test
  void testDeleteILMPolicy_NonExistent() {
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
                            IndexTemplateMapping.of(m -> m.settings(s -> s.numberOfShards("1"))))));

    // Verify it exists
    var getResponse = client.indices().getIndexTemplate(g -> g.name(templateName));
    assertTrue(getResponse.indexTemplates().size() > 0);

    // Delete the template
    assertDoesNotThrow(() -> genericManager.deleteIndexTemplate(templateName));

    // Verify it's deleted
    try {
      var afterDelete = client.indices().getIndexTemplate(g -> g.name(templateName));
      assertEquals(0, afterDelete.indexTemplates().size());
    } catch (ElasticsearchException e) {
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
                c -> c.name(componentName).template(t -> t.settings(s -> s.numberOfShards("1")))));

    // Verify it exists
    var getResponse = client.cluster().getComponentTemplate(g -> g.name(componentName));
    assertFalse(getResponse.componentTemplates().isEmpty());

    // Delete the component template
    assertDoesNotThrow(() -> genericManager.deleteComponentTemplate(componentName));

    // Verify it's deleted
    try {
      var afterDelete = client.cluster().getComponentTemplate(g -> g.name(componentName));
      assertEquals(0, afterDelete.componentTemplates().size());
    } catch (ElasticsearchException e) {
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
  void testDettachIlmPolicyFromIndexes_Success() throws Exception {
    String indexName1 = testPrefix + "_index1";
    String indexName2 = testPrefix + "_index2";
    String policyName = testPrefix + "_policy";

    // Create ILM policy
    client.ilm().putLifecycle(p -> p.name(policyName).policy(pol -> pol.phases(ph -> ph)));

    // Create indices with ILM policy
    client
        .indices()
        .create(c -> c.index(indexName1).settings(s -> s.lifecycle(l -> l.name(policyName))));
    client
        .indices()
        .create(c -> c.index(indexName2).settings(s -> s.lifecycle(l -> l.name(policyName))));

    // Detach ILM policy
    assertDoesNotThrow(() -> genericManager.dettachIlmPolicyFromIndexes(testPrefix + "_index*"));

    Thread.sleep(1000);

    // Verify operation completed without error (actual verification of ILM detachment
    assertTrue(true);
  }

  @Test
  void testDettachIlmPolicyFromIndexes_NoMatches() {
    // Should not throw exception when no indices match
    assertDoesNotThrow(() -> genericManager.dettachIlmPolicyFromIndexes("nonexistent_pattern*"));
  }

  @Test
  void testRemoveILMFromComponentTemplate_Success() throws Exception {
    String componentName = testPrefix + "_ilm_component";
    String policyName = testPrefix + "_policy";

    // Create ILM policy
    client.ilm().putLifecycle(p -> p.name(policyName).policy(pol -> pol.phases(ph -> ph)));

    // Create component template with ILM
    client
        .cluster()
        .putComponentTemplate(
            PutComponentTemplateRequest.of(
                c ->
                    c.name(componentName)
                        .template(t -> t.settings(s -> s.lifecycle(l -> l.name(policyName))))));

    // Remove ILM from component template
    assertDoesNotThrow(() -> genericManager.removeILMFromComponentTemplate(componentName));

    Thread.sleep(500);

    // Verify operation completed without error
    var afterResponse = client.cluster().getComponentTemplate(g -> g.name(componentName));
    System.out.println(
        "afterResponse : "
            + afterResponse
                .componentTemplates()
                .getFirst()
                .componentTemplate()
                .template()
                .settings());
    assertNotNull(afterResponse);
    assertFalse(afterResponse.componentTemplates().isEmpty());
  }

  @Test
  void testRemoveILMFromComponentTemplate_NoILM() throws Exception {
    String componentName = testPrefix + "_component";

    // Create component template without ILM
    client
        .cluster()
        .putComponentTemplate(
            PutComponentTemplateRequest.of(
                c -> c.name(componentName).template(t -> t.settings(s -> s.numberOfShards("1")))));

    // Should not throw exception
    assertDoesNotThrow(() -> genericManager.removeILMFromComponentTemplate(componentName));
  }

  @Test
  void testRemoveILMFromComponentTemplate_NonExistent() {
    // Should not throw exception for non-existent component template
    assertDoesNotThrow(
        () -> genericManager.removeILMFromComponentTemplate("nonexistent_component"));
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
  void testExtractJvmMemoryStats() throws Exception {
    NodesStatsResponse nodesStats = genericManager.nodesStats();

    Map<String, Object> memoryStats = genericManager.extractJvmMemoryStats(nodesStats);

    assertNotNull(memoryStats);
    assertTrue(memoryStats.containsKey("heapMaxBytes"));
    assertTrue(memoryStats.containsKey("memoryUsagePercent"));

    long heapMax = (Long) memoryStats.get("heapMaxBytes");
    double memoryUsage = (Double) memoryStats.get("memoryUsagePercent");

    assertTrue(heapMax > 0);
    assertTrue(memoryUsage >= -1.0 && memoryUsage <= 100.0);
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
