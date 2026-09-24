package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.List;
import java.util.function.Predicate;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;

/**
 * Integration tests for the pipeline-as-annotator lineage scenario.
 *
 * <p>When a pipeline is used as an edge annotation (not a lineage node) between a table and topic,
 * two bugs were observed:
 *
 * <ul>
 *   <li>Bug #1: Service nodes (databaseService, messagingService, pipelineService) appeared in
 *       entity-level lineage views, making graphs noisy.
 *   <li>Bug #2: The pipeline service had no service-level edges, so the "By Service" view was
 *       empty.
 * </ul>
 *
 * <p>Topology: {@code table → topic} (annotated with {@code pipeline})
 */
@Execution(ExecutionMode.SAME_THREAD)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class LineagePipelineAnnotatorIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final int RESHAPE_ATTEMPTS = 5;
  private OpenMetadataClient client;
  private TestNamespace namespace;

  private DatabaseService dbService;
  private MessagingService messagingService;
  private PipelineService pipelineService;
  private Table table;
  private Topic topic;
  private Pipeline pipeline;

  @BeforeAll
  void setUp() throws Exception {
    client = SdkClients.adminClient();
    namespace = new TestNamespace("LineagePipelineAnnotatorIT");

    dbService = DatabaseServiceTestFactory.createPostgres(namespace);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(namespace, dbService);
    table = createTable(schema.getFullyQualifiedName());

    messagingService = MessagingServiceTestFactory.createKafka(namespace);
    topic = createTopic(messagingService.getFullyQualifiedName());

    pipelineService = PipelineServiceTestFactory.createAirflow(namespace);
    pipeline = createPipeline(pipelineService.getFullyQualifiedName());

    addLineageWithPipelineAnnotator(table, topic, pipeline);
    waitForEntityLineageIndexed();
    waitForServiceLineageIndexed();
  }

  @AfterAll
  void tearDown() {
    safeDeletePipeline(pipeline);
    safeDeleteTopic(topic);
    safeDeleteTable(table);
  }

  @Test
  void entityLineage_ServiceNodesAreAbsent() throws Exception {
    JsonNode nodes = searchLineageNodes(table.getFullyQualifiedName(), "table", 1, 1);

    assertNotNull(nodes);
    assertFalse(
        nodes.has(dbService.getFullyQualifiedName()),
        "DatabaseService should not appear in entity-level lineage");
    assertFalse(
        nodes.has(messagingService.getFullyQualifiedName()),
        "MessagingService should not appear in entity-level lineage");
    assertFalse(
        nodes.has(pipelineService.getFullyQualifiedName()),
        "PipelineService should not appear in entity-level lineage");
  }

  @Test
  void entityLineage_DownstreamTopicIsPresent() throws Exception {
    JsonNode nodes = searchLineageNodes(table.getFullyQualifiedName(), "table", 0, 1);

    assertNotNull(nodes);
    assertTrue(
        nodes.has(topic.getFullyQualifiedName()),
        "Topic should appear as downstream node in entity-level lineage");
  }

  @Test
  void entityLineage_PipelineAnnotationPreservedOnEdge() throws Exception {
    JsonNode downstreamEdges =
        searchLineage(table.getFullyQualifiedName(), "table", 0, 1).get("downstreamEdges");

    assertNotNull(downstreamEdges, "downstreamEdges should not be null");
    assertTrue(
        edgeHasPipelineAnnotation(downstreamEdges, pipeline.getFullyQualifiedName()),
        "Entity edge should carry the pipeline annotation");
  }

  @Test
  void serviceLineage_PipelineServiceConnectedToBothServices() throws Exception {
    JsonNode nodes =
        searchLineageNodes(pipelineService.getFullyQualifiedName(), "pipelineService", 1, 1);

    assertNotNull(nodes, "nodes should not be null for pipeline service lineage");
    assertTrue(
        nodes.has(dbService.getFullyQualifiedName()),
        "DatabaseService should appear in pipeline service lineage");
    assertTrue(
        nodes.has(messagingService.getFullyQualifiedName()),
        "MessagingService should appear in pipeline service lineage");
  }

  @Test
  void serviceLineage_DatabaseServiceHasPipelineServiceDownstream() throws Exception {
    JsonNode nodes = searchLineageNodes(dbService.getFullyQualifiedName(), "databaseService", 0, 1);

    assertNotNull(nodes);
    assertTrue(
        nodes.has(pipelineService.getFullyQualifiedName()),
        "PipelineService should appear as downstream of database service");
  }

  @Test
  void serviceLineage_MessagingServiceHasPipelineServiceUpstream() throws Exception {
    JsonNode nodes =
        searchLineageNodes(messagingService.getFullyQualifiedName(), "messagingService", 1, 0);

    assertNotNull(nodes);
    assertTrue(
        nodes.has(pipelineService.getFullyQualifiedName()),
        "PipelineService should appear as upstream of messaging service");
  }

  /**
   * The pipeline-annotated edge must be projected as dbService → pipelineService → messagingService
   * only. A direct dbService → messagingService edge alongside it would draw two parallel paths for
   * one flow of data, which is what customers see as duplicated lines in the service view.
   */
  @Test
  void serviceLineage_NoDirectEdgeBypassingPipelineService() throws Exception {
    JsonNode oneHop =
        searchLineageNodes(dbService.getFullyQualifiedName(), "databaseService", 0, 1);

    assertNotNull(oneHop);
    assertTrue(
        oneHop.has(pipelineService.getFullyQualifiedName()),
        "PipelineService should be the only downstream of the database service");
    assertFalse(
        oneHop.has(messagingService.getFullyQualifiedName()),
        "MessagingService must not be directly downstream of the database service - "
            + "the edge is annotated with a pipeline, so it routes through the pipeline service");
  }

  /** Routing through the pipeline must not lose reachability: the target is still two hops away. */
  @Test
  void serviceLineage_TargetServiceStillReachableThroughPipeline() throws Exception {
    JsonNode twoHops =
        searchLineageNodes(dbService.getFullyQualifiedName(), "databaseService", 0, 2);

    assertNotNull(twoHops);
    assertTrue(
        twoHops.has(messagingService.getFullyQualifiedName()),
        "MessagingService should still be reachable downstream via the pipeline service");
  }

  // --- Helpers ---

  private JsonNode searchLineageNodes(String fqn, String type, int upDepth, int downDepth)
      throws Exception {
    return searchLineage(fqn, type, upDepth, downDepth).get("nodes");
  }

  private JsonNode searchLineage(String fqn, String type, int upDepth, int downDepth)
      throws Exception {
    String[] result = {null};
    Awaitility.await("searchLineage for " + fqn)
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              result[0] = client.lineage().searchLineage(fqn, type, upDepth, downDepth, false);
              return result[0] != null;
            });
    return MAPPER.readTree(result[0]);
  }

  private boolean edgeHasPipelineAnnotation(JsonNode edgeMap, String pipelineFqn) {
    var edgeIter = edgeMap.elements();
    while (edgeIter.hasNext()) {
      JsonNode edge = edgeIter.next();
      JsonNode pipelineNode = edge.path("pipeline");
      if (!pipelineNode.isMissingNode() && !pipelineNode.isNull()) {
        String annotatedFqn = pipelineNode.path("fullyQualifiedName").asText("");
        if (annotatedFqn.equals(pipelineFqn)) {
          return true;
        }
      }
    }
    return false;
  }

  private void addLineageWithPipelineAnnotator(Table from, Topic to, Pipeline pipe) {
    LineageDetails details =
        new LineageDetails()
            .withSource(LineageDetails.Source.PIPELINE_LINEAGE)
            .withPipeline(pipe.getEntityReference());
    addLineage(from, to, details);
  }

  private void addLineage(Table from, Topic to, LineageDetails details) {
    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(from.getEntityReference())
                    .withToEntity(to.getEntityReference())
                    .withLineageDetails(details));

    Awaitility.await("Add lineage " + from.getName() + " → " + to.getName())
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              client.lineage().addLineage(addLineage);
              return true;
            });
  }

  private void waitForEntityLineageIndexed() {
    Awaitility.await("Wait for entity lineage in ES")
        .atMost(Duration.ofSeconds(90))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptions()
        .until(
            () -> {
              String result =
                  client
                      .lineage()
                      .searchLineage(table.getFullyQualifiedName(), "table", 0, 1, false);
              JsonNode nodes = MAPPER.readTree(result).get("nodes");
              return nodes != null && nodes.has(topic.getFullyQualifiedName());
            });
  }

  private void waitForServiceLineageIndexed() {
    Awaitility.await("Wait for service lineage in ES")
        .atMost(Duration.ofSeconds(90))
        .pollInterval(Duration.ofSeconds(3))
        .ignoreExceptions()
        .until(
            () -> {
              String result =
                  client
                      .lineage()
                      .searchLineage(
                          pipelineService.getFullyQualifiedName(), "pipelineService", 1, 1, false);
              JsonNode nodes = MAPPER.readTree(result).get("nodes");
              return nodes != null
                  && nodes.has(dbService.getFullyQualifiedName())
                  && nodes.has(messagingService.getFullyQualifiedName());
            });
  }

  private Table createTable(String schemaFqn) {
    return client
        .tables()
        .create(
            new CreateTable()
                .withName(namespace.prefix("source_table"))
                .withDatabaseSchema(schemaFqn)
                .withColumns(List.of(new ColumnBuilder("id", "VARCHAR").dataLength(256).build())));
  }

  private Topic createTopic(String serviceFqn) {
    CreateTopic request = new CreateTopic();
    request.setName(namespace.prefix("target_topic"));
    request.setService(serviceFqn);
    request.setPartitions(1);
    return client.topics().create(request);
  }

  private Pipeline createPipeline(String serviceFqn) {
    CreatePipeline request = new CreatePipeline();
    request.setName(namespace.prefix("etl_pipeline"));
    request.setService(serviceFqn);
    return client.pipelines().create(request);
  }

  private void safeDeleteTable(Table t) {
    if (t != null) {
      try {
        client.tables().delete(t.getId());
      } catch (Exception e) {
        // Ignore cleanup failures
      }
    }
  }

  private void safeDeleteTopic(Topic t) {
    if (t != null) {
      try {
        client.topics().delete(t.getId());
      } catch (Exception e) {
        // Ignore cleanup failures
      }
    }
  }

  private void safeDeletePipeline(Pipeline p) {
    if (p != null) {
      try {
        client.pipelines().delete(p.getId());
      } catch (Exception e) {
        // Ignore cleanup failures
      }
    }
  }

  /**
   * #21460: attaching a pipeline to an existing edge moves it off the direct service edge and onto
   * the pipeline hops. Both updates land on the target service's search doc, and search removals
   * are asynchronous, so a hop written after the release can lose a version conflict and never
   * reach the service view. The outcome is timing-dependent, so the reshape is repeated on fresh
   * services to give a lost hop room to surface.
   */
  @Test
  void serviceLineage_ReshapedEdgeShowsPipelineHopInSearch() {
    for (int attempt = 1; attempt <= RESHAPE_ATTEMPTS; attempt++) {
      assertReshapeReachesSearch(attempt);
    }
  }

  private void assertReshapeReachesSearch(int attempt) {
    DatabaseService reshapeDbService = DatabaseServiceTestFactory.createPostgres(namespace);
    MessagingService reshapeMessagingService = MessagingServiceTestFactory.createKafka(namespace);
    PipelineService reshapePipelineService = PipelineServiceTestFactory.createAirflow(namespace);
    DatabaseSchema reshapeSchema =
        DatabaseSchemaTestFactory.createSimple(namespace, reshapeDbService);
    Table source = createTable(reshapeSchema.getFullyQualifiedName());
    Topic target = createTopic(reshapeMessagingService.getFullyQualifiedName());
    Pipeline reshapePipeline = createPipeline(reshapePipelineService.getFullyQualifiedName());
    String dbServiceFqn = reshapeDbService.getFullyQualifiedName();
    String pipelineServiceFqn = reshapePipelineService.getFullyQualifiedName();

    addLineage(source, target, new LineageDetails());
    awaitServiceView(
        reshapeMessagingService,
        nodes -> nodes.has(dbServiceFqn),
        "direct service edge before the reshape, attempt " + attempt);

    addLineageWithPipelineAnnotator(source, target, reshapePipeline);
    awaitServiceView(
        reshapeMessagingService,
        nodes -> nodes.has(pipelineServiceFqn),
        "pipeline hop written by the reshape, attempt " + attempt);
    awaitServiceView(
        reshapeMessagingService,
        nodes -> !nodes.has(dbServiceFqn),
        "direct service edge released by the reshape, attempt " + attempt);
  }

  private void awaitServiceView(
      MessagingService targetService, Predicate<JsonNode> expectedNodes, String expectation) {
    Awaitility.await(expectation)
        .atMost(Duration.ofSeconds(20))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () ->
                expectedNodes.test(
                    MAPPER
                        .readTree(
                            client
                                .lineage()
                                .searchLineage(
                                    targetService.getFullyQualifiedName(),
                                    "messagingService",
                                    1,
                                    0,
                                    false))
                        .path("nodes")));
  }
}
