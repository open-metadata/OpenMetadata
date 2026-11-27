package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.apache.commons.csv.CSVRecord;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.factories.APIServiceTestFactory;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.MlModelServiceTestFactory;
import org.openmetadata.it.factories.SearchServiceTestFactory;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.LineageCsvExport;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.APIRequestMethod;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.MlFeatureDataType;
import org.openmetadata.schema.type.SchemaType;
import org.openmetadata.schema.type.SearchIndexDataType;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;

/**
 * Column lineage between every pair of the eight asset types the lineage page draws column edges
 * for. Each type keeps its "columns" somewhere else (table and data model columns, container data
 * model columns, topic and API endpoint schema fields, search index fields, ML features, dashboard
 * charts), and the server silently drops a column endpoint it cannot resolve, so every pair has to
 * be checked on its own.
 *
 * <p>Each pair runs what the lineage page runs: add the edge with one column mapping, read it back
 * from {@code /getLineage}, export it as CSV, remove the column mapping by re-saving the edge
 * without it, then delete the edge.
 */
@Execution(ExecutionMode.CONCURRENT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class LineageColumnMatrixIT {

  private static final List<String> COLUMN_LINEAGE_TYPES =
      List.of(
          Entity.TABLE,
          Entity.CONTAINER,
          Entity.TOPIC,
          Entity.API_ENDPOINT,
          Entity.DASHBOARD,
          Entity.DASHBOARD_DATA_MODEL,
          Entity.SEARCH_INDEX,
          Entity.MLMODEL);
  private static final String CHILD_NAME = "matrix_col";
  private static final Duration INDEX_TIMEOUT = Duration.ofSeconds(90);

  private final OpenMetadataClient client = SdkClients.adminClient();
  private TestNamespace ns;
  private DatabaseSchema schema;
  private String messagingService;
  private String storageService;
  private DashboardService dashboardService;
  private String searchService;
  private String apiCollection;
  private String mlModelService;

  /** An asset and the FQN of the one child the edge maps. */
  private record ColumnEndpoint(EntityReference entity, String column) {}

  @BeforeAll
  void createServices() {
    ns = new TestNamespace("LineageColumnMatrixIT");
    schema =
        DatabaseSchemaTestFactory.createSimple(ns, DatabaseServiceTestFactory.createPostgres(ns));
    messagingService = MessagingServiceTestFactory.createKafka(ns).getFullyQualifiedName();
    storageService = StorageServiceTestFactory.createS3(ns).getFullyQualifiedName();
    dashboardService = DashboardServiceTestFactory.createLooker(ns);
    searchService = SearchServiceTestFactory.createElasticSearch(ns).getFullyQualifiedName();
    mlModelService = MlModelServiceTestFactory.createMlflow(ns).getFullyQualifiedName();
    apiCollection = createApiCollection().getFullyQualifiedName();
  }

  static Stream<Arguments> everySourceTargetPair() {
    return COLUMN_LINEAGE_TYPES.stream()
        .flatMap(from -> COLUMN_LINEAGE_TYPES.stream().map(to -> Arguments.of(from, to)));
  }

  @ParameterizedTest(name = "{0} -> {1}")
  @MethodSource("everySourceTargetPair")
  void columnLineage_everySourceTargetPair(String fromType, String toType) throws Exception {
    ColumnEndpoint from = createEndpoint(fromType);
    ColumnEndpoint to = createEndpoint(toType);
    String pair = from.column() + "->" + to.column();

    saveEdge(from, to, List.of(columnLineage(from, to)));
    awaitCanvasColumnPairs(from, to, Set.of(pair));
    assertExportedColumnPair(from, to);

    saveEdge(from, to, List.of());
    awaitCanvasColumnPairs(from, to, Set.of());

    deleteEdge(from, to);
    assertFalse(storedEdgeExists(from, to), "Deleted edge " + pair + " is still stored");
  }

  private ColumnEndpoint createEndpoint(String type) {
    String name = type + "_" + ns.uniqueShortId();
    return switch (type) {
      case Entity.TABLE -> table(name);
      case Entity.CONTAINER -> container(name);
      case Entity.TOPIC -> topic(name);
      case Entity.API_ENDPOINT -> apiEndpoint(name);
      case Entity.DASHBOARD -> dashboard(name);
      case Entity.DASHBOARD_DATA_MODEL -> dashboardDataModel(name);
      case Entity.SEARCH_INDEX -> searchIndex(name);
      case Entity.MLMODEL -> mlModel(name);
      default -> throw new IllegalArgumentException("No column lineage fixture for " + type);
    };
  }

  private ColumnEndpoint table(String name) {
    Table table =
        client
            .tables()
            .create(
                new CreateTable()
                    .withName(name)
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withColumns(List.of(column())));
    return endpoint(table, table.getColumns().getFirst().getFullyQualifiedName());
  }

  private ColumnEndpoint container(String name) {
    Container container =
        client
            .containers()
            .create(
                new CreateContainer()
                    .withName(name)
                    .withService(storageService)
                    .withDataModel(new ContainerDataModel().withColumns(List.of(column()))));
    return endpoint(
        container, container.getDataModel().getColumns().getFirst().getFullyQualifiedName());
  }

  private ColumnEndpoint topic(String name) {
    Topic topic =
        client
            .topics()
            .create(
                new CreateTopic()
                    .withName(name)
                    .withService(messagingService)
                    .withPartitions(1)
                    .withMessageSchema(
                        new MessageSchema()
                            .withSchemaType(SchemaType.Avro)
                            .withSchemaFields(List.of(field()))));
    return endpoint(
        topic, topic.getMessageSchema().getSchemaFields().getFirst().getFullyQualifiedName());
  }

  private ColumnEndpoint apiEndpoint(String name) {
    APIEndpoint endpoint =
        client
            .apiEndpoints()
            .create(
                new CreateAPIEndpoint()
                    .withName(name)
                    .withApiCollection(apiCollection)
                    .withEndpointURL(URI.create("https://localhost:8585/api/v1/" + name))
                    .withRequestMethod(APIRequestMethod.GET)
                    .withResponseSchema(new APISchema().withSchemaFields(List.of(field()))));
    return endpoint(
        endpoint,
        endpoint.getResponseSchema().getSchemaFields().getFirst().getFullyQualifiedName());
  }

  private ColumnEndpoint dashboard(String name) {
    Chart chart =
        client
            .charts()
            .create(
                new CreateChart()
                    .withName(name + "_chart")
                    .withService(dashboardService.getFullyQualifiedName()));
    Dashboard dashboard =
        client
            .dashboards()
            .create(
                new CreateDashboard()
                    .withName(name)
                    .withService(dashboardService.getFullyQualifiedName())
                    .withCharts(List.of(chart.getFullyQualifiedName())));
    return endpoint(dashboard, chart.getFullyQualifiedName());
  }

  private ColumnEndpoint dashboardDataModel(String name) {
    DashboardDataModel dataModel =
        client
            .dashboardDataModels()
            .create(
                new CreateDashboardDataModel()
                    .withName(name)
                    .withService(dashboardService.getFullyQualifiedName())
                    .withDataModelType(DataModelType.LookMlView)
                    .withColumns(List.of(column())));
    return endpoint(dataModel, dataModel.getColumns().getFirst().getFullyQualifiedName());
  }

  private ColumnEndpoint searchIndex(String name) {
    SearchIndex searchIndex =
        client
            .searchIndexes()
            .create(
                new CreateSearchIndex()
                    .withName(name)
                    .withService(searchService)
                    .withFields(
                        List.of(
                            new SearchIndexField()
                                .withName(CHILD_NAME)
                                .withDataType(SearchIndexDataType.KEYWORD))));
    return endpoint(searchIndex, searchIndex.getFields().getFirst().getFullyQualifiedName());
  }

  private ColumnEndpoint mlModel(String name) {
    MlModel mlModel =
        client
            .mlModels()
            .create(
                new CreateMlModel()
                    .withName(name)
                    .withService(mlModelService)
                    .withAlgorithm("regression")
                    .withMlFeatures(
                        List.of(
                            new MlFeature()
                                .withName(CHILD_NAME)
                                .withDataType(MlFeatureDataType.Numerical))));
    return endpoint(mlModel, mlModel.getMlFeatures().getFirst().getFullyQualifiedName());
  }

  private APICollection createApiCollection() {
    return client
        .apiCollections()
        .create(
            new CreateAPICollection()
                .withName(ns.shortPrefix("matrix_api"))
                .withService(APIServiceTestFactory.createRest(ns).getFullyQualifiedName())
                .withEndpointURL(URI.create("https://localhost:8585/api/v1")));
  }

  private static ColumnEndpoint endpoint(EntityInterface<?> entity, String column) {
    return new ColumnEndpoint(entity.getEntityReference(), column);
  }

  private static Column column() {
    return new Column()
        .withName(CHILD_NAME)
        .withDataType(ColumnDataType.VARCHAR)
        .withDataLength(64);
  }

  private static Field field() {
    return new Field().withName(CHILD_NAME).withDataType(FieldDataType.STRING);
  }

  private static ColumnLineage columnLineage(ColumnEndpoint from, ColumnEndpoint to) {
    return new ColumnLineage().withFromColumns(List.of(from.column())).withToColumn(to.column());
  }

  /** The PUT the lineage page sends to add a column mapping, and to remove it again. */
  private void saveEdge(ColumnEndpoint from, ColumnEndpoint to, List<ColumnLineage> columns) {
    client
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(from.entity())
                        .withToEntity(to.entity())
                        .withLineageDetails(new LineageDetails().withColumnsLineage(columns))));
  }

  private void awaitCanvasColumnPairs(
      ColumnEndpoint from, ColumnEndpoint to, Set<String> expectedPairs) {
    Awaitility.await("canvas edge carries " + expectedPairs)
        .atMost(INDEX_TIMEOUT)
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(() -> Optional.of(expectedPairs).equals(canvasColumnPairs(from, to)));
  }

  /** The column pairs on the from -> to edge of the canvas graph, empty when there is no edge. */
  private Optional<Set<String>> canvasColumnPairs(ColumnEndpoint from, ColumnEndpoint to) {
    EntityReference root = from.entity();
    JsonNode lineage =
        JsonUtils.readTree(
            client
                .lineage()
                .searchLineage(root.getFullyQualifiedName(), root.getType(), 0, 1, false));
    return StreamSupport.stream(lineage.path("downstreamEdges").spliterator(), false)
        .filter(edge -> isEdge(edge, from, to))
        .findFirst()
        .map(LineageColumnMatrixIT::columnPairs);
  }

  private static boolean isEdge(JsonNode edge, ColumnEndpoint from, ColumnEndpoint to) {
    String fromId = edge.path("fromEntity").path("id").asText();
    String toId = edge.path("toEntity").path("id").asText();
    return from.entity().getId().toString().equals(fromId)
        && to.entity().getId().toString().equals(toId);
  }

  private static Set<String> columnPairs(JsonNode edge) {
    Set<String> pairs = new HashSet<>();
    for (JsonNode column : edge.path("columns")) {
      String toColumn = column.path("toColumn").asText();
      column
          .path("fromColumns")
          .forEach(fromColumn -> pairs.add(fromColumn.asText() + "->" + toColumn));
    }
    return pairs;
  }

  private void assertExportedColumnPair(ColumnEndpoint from, ColumnEndpoint to) throws Exception {
    List<CSVRecord> rows =
        LineageCsvExport.edgeRows(
            from.entity().getType(),
            from.entity().getFullyQualifiedName(),
            to.entity().getFullyQualifiedName());
    assertTrue(
        rows.stream()
            .anyMatch(
                row ->
                    from.column().equals(row.get("fromChildEntityFQN"))
                        && to.column().equals(row.get("toChildEntityFQN"))),
        "Exported CSV has no row mapping " + from.column() + " -> " + to.column() + ": " + rows);
  }

  private void deleteEdge(ColumnEndpoint from, ColumnEndpoint to) {
    client.lineage().deleteLineage(typedId(from.entity()), typedId(to.entity()));
  }

  private static String typedId(EntityReference entity) {
    return entity.getType() + ":" + entity.getId();
  }

  private boolean storedEdgeExists(ColumnEndpoint from, ColumnEndpoint to) {
    EntityReference root = from.entity();
    EntityLineage lineage =
        JsonUtils.readValue(
            client.lineage().getEntityLineage(root.getType(), root.getId().toString(), "0", "1"),
            EntityLineage.class);
    return lineage.getDownstreamEdges().stream()
        .anyMatch(
            edge ->
                root.getId().equals(edge.getFromEntity())
                    && to.entity().getId().equals(edge.getToEntity()));
  }
}
