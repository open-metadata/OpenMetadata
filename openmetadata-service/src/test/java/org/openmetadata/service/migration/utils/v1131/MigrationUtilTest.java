package org.openmetadata.service.migration.utils.v1131;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.MlFeatureSource;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.Task;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.resources.databases.DatasourceConfig;

/**
 * Tests the one-time child-FQN repair migration. The DB is mocked at the DAO boundary; the real
 * repair logic, JSON (de)serialization, and per-row resilience are exercised. Because this runs
 * during an upgrade, the key property is that a single bad row never aborts the migration.
 */
class MigrationUtilTest {

  // Legacy form: a child named a"b was stored with a backslash-escaped, unparseable FQN segment.
  private static final String CORRUPT_NAME = "a\"b";
  private static final String CORRUPT_TASK_FQN = "svc.pipeA.a\\\"b";
  private static final String REPAIRED_TASK_FQN = "svc.pipeA.\"a\"\"b\"";

  // Mirrors MigrationUtil.PAGE_SIZE (private); the repair loop pages each table in chunks of this.
  private static final int PAGE_SIZE = 1000;

  private CollectionDAO collectionDAO;
  private CollectionDAO.TableDAO tableDAO;
  private CollectionDAO.DataModelDAO dashboardDataModelDAO;
  private CollectionDAO.ContainerDAO containerDAO;
  private CollectionDAO.WorksheetDAO worksheetDAO;
  private CollectionDAO.TopicDAO topicDAO;
  private CollectionDAO.SearchIndexDAO searchIndexDAO;
  private CollectionDAO.APIEndpointDAO apiEndpointDAO;
  private CollectionDAO.MlModelDAO mlModelDAO;
  private CollectionDAO.PipelineDAO pipelineDAO;

  @BeforeEach
  void setUp() {
    collectionDAO = mock(CollectionDAO.class);
    tableDAO = mock(CollectionDAO.TableDAO.class);
    dashboardDataModelDAO = mock(CollectionDAO.DataModelDAO.class);
    containerDAO = mock(CollectionDAO.ContainerDAO.class);
    worksheetDAO = mock(CollectionDAO.WorksheetDAO.class);
    topicDAO = mock(CollectionDAO.TopicDAO.class);
    searchIndexDAO = mock(CollectionDAO.SearchIndexDAO.class);
    apiEndpointDAO = mock(CollectionDAO.APIEndpointDAO.class);
    mlModelDAO = mock(CollectionDAO.MlModelDAO.class);
    pipelineDAO = mock(CollectionDAO.PipelineDAO.class);
    when(collectionDAO.tableDAO()).thenReturn(tableDAO);
    when(collectionDAO.dashboardDataModelDAO()).thenReturn(dashboardDataModelDAO);
    when(collectionDAO.containerDAO()).thenReturn(containerDAO);
    when(collectionDAO.worksheetDAO()).thenReturn(worksheetDAO);
    when(collectionDAO.topicDAO()).thenReturn(topicDAO);
    when(collectionDAO.searchIndexDAO()).thenReturn(searchIndexDAO);
    when(collectionDAO.apiEndpointDAO()).thenReturn(apiEndpointDAO);
    when(collectionDAO.mlModelDAO()).thenReturn(mlModelDAO);
    when(collectionDAO.pipelineDAO()).thenReturn(pipelineDAO);
  }

  @Test
  void coversEveryEntityTypeWithDerivedChildFqns() {
    Set<String> repairedTypes =
        MigrationUtil.repairChildFqns(collectionDAO).stream()
            .map(MigrationUtil.RepairSummary::entityType)
            .collect(Collectors.toSet());

    assertEquals(
        Set.of(
            Entity.TABLE,
            Entity.DASHBOARD_DATA_MODEL,
            Entity.CONTAINER,
            Entity.WORKSHEET,
            Entity.TOPIC,
            Entity.SEARCH_INDEX,
            Entity.API_ENDPOINT,
            Entity.MLMODEL,
            Entity.PIPELINE),
        repairedTypes);
  }

  @Test
  void repairsUnparseableTaskFqnAndPersistsOnlyChangedPipelines() {
    givenPage(
        pipelineDAO,
        pipelineJson("svc.pipeA", task(CORRUPT_NAME, CORRUPT_TASK_FQN)),
        pipelineJson("svc.pipeB", task("t1", "svc.pipeB.t1")));

    MigrationUtil.repairChildFqns(collectionDAO);

    ArgumentCaptor<Pipeline> captor = ArgumentCaptor.forClass(Pipeline.class);
    verify(pipelineDAO, times(1)).update(captor.capture());
    assertEquals(
        REPAIRED_TASK_FQN, captor.getValue().getTasks().getFirst().getFullyQualifiedName());
  }

  @Test
  void leavesValidTaskFqnsUntouched() {
    givenPage(
        pipelineDAO,
        pipelineJson("svc.pipeA", task("t1", "svc.pipeA.t1"), task("t2", "svc.pipeA.t2")));

    MigrationUtil.repairChildFqns(collectionDAO);

    verify(pipelineDAO, never()).update(any());
  }

  @Test
  void repairsNullTaskFqnWithoutNpe() {
    givenPage(pipelineDAO, pipelineJson("svc.pipeA", task("t1", null)));

    assertDoesNotThrow(() -> MigrationUtil.repairChildFqns(collectionDAO));

    ArgumentCaptor<Pipeline> captor = ArgumentCaptor.forClass(Pipeline.class);
    verify(pipelineDAO).update(captor.capture());
    assertEquals("svc.pipeA.t1", captor.getValue().getTasks().getFirst().getFullyQualifiedName());
  }

  @Test
  void doesNotAbortWhenARowIsUnreadableJson() {
    givenPage(
        pipelineDAO,
        pipelineJson("svc.pipeA", task(CORRUPT_NAME, CORRUPT_TASK_FQN)),
        "{ not valid pipeline json",
        pipelineJson("svc.pipeC", task("t", "svc.pipeC.t")));

    assertDoesNotThrow(() -> MigrationUtil.repairChildFqns(collectionDAO));

    verify(pipelineDAO, times(1)).update(any());
  }

  @Test
  void doesNotAbortWhenUpdateThrows() {
    givenPage(
        pipelineDAO,
        pipelineJson("svc.pipeA", task(CORRUPT_NAME, CORRUPT_TASK_FQN)),
        pipelineJson("svc.pipeB", task("c\"d", "svc.pipeB.c\\\"d")));
    doThrow(new RuntimeException("db unavailable")).doNothing().when(pipelineDAO).update(any());

    assertDoesNotThrow(() -> MigrationUtil.repairChildFqns(collectionDAO));

    verify(pipelineDAO, times(2)).update(any());
  }

  @Test
  void doesNotCountFailedPersistAsRepaired() {
    givenPage(pipelineDAO, pipelineJson("svc.pipeA", task(CORRUPT_NAME, CORRUPT_TASK_FQN)));
    doThrow(new RuntimeException("db unavailable")).when(pipelineDAO).update(any());

    MigrationUtil.RepairSummary summary = repairAndSummarize(Entity.PIPELINE);

    assertEquals(1, summary.scanned());
    assertEquals(0, summary.repairedEntities());
    assertEquals(0, summary.repairedChildren());
    assertEquals(1, summary.failedEntities());
  }

  @Test
  void skipsPipelineWithNoTasks() {
    Pipeline pipeline =
        new Pipeline().withId(UUID.randomUUID()).withName("p").withFullyQualifiedName("svc.pipeA");
    givenPage(pipelineDAO, JsonUtils.pojoToJson(pipeline));

    MigrationUtil.repairChildFqns(collectionDAO);

    verify(pipelineDAO, never()).update(any());
  }

  @Test
  void handlesEmptyEntityTables() {
    List<MigrationUtil.RepairSummary> summaries =
        assertDoesNotThrow(() -> MigrationUtil.repairChildFqns(collectionDAO));

    assertEquals(9, summaries.size());
    summaries.forEach(summary -> assertEquals(0, summary.scanned()));
    verify(pipelineDAO, never()).update(any());
    verify(tableDAO, never()).update(any());
  }

  @Test
  void backfillsDatabaseMetadataSourceConfigTypeWithMySqlJsonSet() {
    Handle handle = mock(Handle.class);
    when(handle.execute(anyString())).thenReturn(2);

    try (MockedStatic<DatasourceConfig> ds = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig cfg = mock(DatasourceConfig.class);
      ds.when(DatasourceConfig::getInstance).thenReturn(cfg);
      when(cfg.isMySQL()).thenReturn(true);

      MigrationUtil.backfillDatabaseMetadataSourceConfigType(handle);
    }

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle).execute(sqlCaptor.capture());
    String sql = sqlCaptor.getValue();
    assertTrue(sql.contains("JSON_SET(i.json, '$.sourceConfig.config.type', 'DatabaseMetadata')"));
    assertTrue(sql.contains("er.fromEntity = 'databaseService'"));
    assertTrue(sql.contains("i.json ->> '$.pipelineType' = 'metadata'"));
  }

  @Test
  void backfillsDatabaseMetadataSourceConfigTypeWithPostgresJsonbSet() {
    Handle handle = mock(Handle.class);
    when(handle.execute(anyString())).thenReturn(2);

    try (MockedStatic<DatasourceConfig> ds = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig cfg = mock(DatasourceConfig.class);
      ds.when(DatasourceConfig::getInstance).thenReturn(cfg);
      when(cfg.isMySQL()).thenReturn(false);

      MigrationUtil.backfillDatabaseMetadataSourceConfigType(handle);
    }

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle).execute(sqlCaptor.capture());
    String sql = sqlCaptor.getValue();
    assertTrue(
        sql.contains(
            "jsonb_set(i.json, '{sourceConfig,config,type}', '\"DatabaseMetadata\"'::jsonb, true)"));
    assertTrue(sql.contains("er.fromentity = 'databaseService'"));
    assertTrue(sql.contains("i.json ->> 'pipelineType' = 'metadata'"));
  }

  @Test
  void scansEveryPageAdvancingOffsetUntilAnEmptyPage() {
    String firstPage = pipelineJson("svc.pipeA", task(CORRUPT_NAME, CORRUPT_TASK_FQN));
    String secondPage = pipelineJson("svc.pipeZ", task(CORRUPT_NAME, CORRUPT_TASK_FQN));
    when(pipelineDAO.listAfterWithOffset(PAGE_SIZE, 0)).thenReturn(List.of(firstPage));
    when(pipelineDAO.listAfterWithOffset(PAGE_SIZE, PAGE_SIZE)).thenReturn(List.of(secondPage));
    when(pipelineDAO.listAfterWithOffset(PAGE_SIZE, 2 * PAGE_SIZE)).thenReturn(List.of());

    MigrationUtil.repairChildFqns(collectionDAO);

    ArgumentCaptor<Pipeline> captor = ArgumentCaptor.forClass(Pipeline.class);
    verify(pipelineDAO, times(2)).update(captor.capture());
    assertEquals(
        List.of("svc.pipeA", "svc.pipeZ"),
        captor.getAllValues().stream().map(Pipeline::getFullyQualifiedName).toList());
    verify(pipelineDAO).listAfterWithOffset(PAGE_SIZE, PAGE_SIZE);
    verify(pipelineDAO).listAfterWithOffset(PAGE_SIZE, 2 * PAGE_SIZE);
  }

  @Test
  void repairsCorruptTableColumnFqnsIncludingNestedChildren() {
    Column child = column("c1", "svc.db.sch.tbl.a\\\"b.c1");
    Column corrupt = column(CORRUPT_NAME, "svc.db.sch.tbl.a\\\"b").withChildren(List.of(child));
    Column valid = column("ok", "svc.db.sch.tbl.ok");
    givenPage(tableDAO, tableJson("svc.db.sch.tbl", corrupt, valid));

    MigrationUtil.RepairSummary summary = repairAndSummarize(Entity.TABLE);

    ArgumentCaptor<Table> captor = ArgumentCaptor.forClass(Table.class);
    verify(tableDAO, times(1)).update(captor.capture());
    Column repaired = captor.getValue().getColumns().getFirst();
    assertEquals("svc.db.sch.tbl.\"a\"\"b\"", repaired.getFullyQualifiedName());
    assertEquals(
        "svc.db.sch.tbl.\"a\"\"b\".c1", repaired.getChildren().getFirst().getFullyQualifiedName());
    assertEquals(
        "svc.db.sch.tbl.ok", captor.getValue().getColumns().getLast().getFullyQualifiedName());
    assertEquals(2, summary.repairedChildren());
    assertEquals(1, summary.repairedEntities());
  }

  @Test
  void recordsUnrepairableEmptyColumnNameAsFailureWithoutPersisting() {
    givenPage(tableDAO, tableJson("svc.db.sch.tbl", column("", "svc.db.sch.tbl.")));

    MigrationUtil.RepairSummary summary = repairAndSummarize(Entity.TABLE);

    verify(tableDAO, never()).update(any());
    assertEquals(1, summary.failedEntities());
    assertEquals(0, summary.repairedEntities());
    assertEquals(0, summary.repairedChildren());
  }

  @Test
  void repairsDashboardDataModelColumnFqns() {
    DashboardDataModel dataModel =
        new DashboardDataModel()
            .withId(UUID.randomUUID())
            .withName("dm")
            .withFullyQualifiedName("svc.model.dm")
            .withColumns(List.of(column(CORRUPT_NAME, "svc.model.dm.a\\\"b")));
    givenPage(dashboardDataModelDAO, JsonUtils.pojoToJson(dataModel));

    MigrationUtil.repairChildFqns(collectionDAO);

    ArgumentCaptor<DashboardDataModel> captor = ArgumentCaptor.forClass(DashboardDataModel.class);
    verify(dashboardDataModelDAO, times(1)).update(captor.capture());
    assertEquals(
        "svc.model.dm.\"a\"\"b\"",
        captor.getValue().getColumns().getFirst().getFullyQualifiedName());
  }

  @Test
  void repairsContainerDataModelColumnFqnsAndSkipsContainersWithoutDataModel() {
    Container corrupt =
        container("svc.contA")
            .withDataModel(
                new ContainerDataModel()
                    .withColumns(List.of(column(CORRUPT_NAME, "svc.contA.a\\\"b"))));
    Container noDataModel = container("svc.contB");
    givenPage(containerDAO, JsonUtils.pojoToJson(corrupt), JsonUtils.pojoToJson(noDataModel));

    MigrationUtil.repairChildFqns(collectionDAO);

    ArgumentCaptor<Container> captor = ArgumentCaptor.forClass(Container.class);
    verify(containerDAO, times(1)).update(captor.capture());
    assertEquals(
        "svc.contA.\"a\"\"b\"",
        captor.getValue().getDataModel().getColumns().getFirst().getFullyQualifiedName());
  }

  @Test
  void repairsWorksheetColumnFqns() {
    Worksheet worksheet =
        new Worksheet()
            .withId(UUID.randomUUID())
            .withName("w")
            .withFullyQualifiedName("svc.sheet.w")
            .withColumns(List.of(column(CORRUPT_NAME, "svc.sheet.w.a\\\"b")));
    givenPage(worksheetDAO, JsonUtils.pojoToJson(worksheet));

    MigrationUtil.repairChildFqns(collectionDAO);

    ArgumentCaptor<Worksheet> captor = ArgumentCaptor.forClass(Worksheet.class);
    verify(worksheetDAO, times(1)).update(captor.capture());
    assertEquals(
        "svc.sheet.w.\"a\"\"b\"",
        captor.getValue().getColumns().getFirst().getFullyQualifiedName());
  }

  @Test
  void repairsTopicMessageSchemaFieldFqnsIncludingNestedChildrenAndSkipsTopicsWithoutSchema() {
    Field child = field("f1", "svc.topicA.a\\\"b.f1");
    Field corrupt = field(CORRUPT_NAME, "svc.topicA.a\\\"b").withChildren(List.of(child));
    Topic corruptTopic =
        topic("svc.topicA")
            .withMessageSchema(new MessageSchema().withSchemaFields(List.of(corrupt)));
    Topic noSchemaTopic = topic("svc.topicB");
    givenPage(topicDAO, JsonUtils.pojoToJson(corruptTopic), JsonUtils.pojoToJson(noSchemaTopic));

    MigrationUtil.repairChildFqns(collectionDAO);

    ArgumentCaptor<Topic> captor = ArgumentCaptor.forClass(Topic.class);
    verify(topicDAO, times(1)).update(captor.capture());
    Field repaired = captor.getValue().getMessageSchema().getSchemaFields().getFirst();
    assertEquals("svc.topicA.\"a\"\"b\"", repaired.getFullyQualifiedName());
    assertEquals(
        "svc.topicA.\"a\"\"b\".f1", repaired.getChildren().getFirst().getFullyQualifiedName());
  }

  @Test
  void repairsSearchIndexFieldFqnsIncludingNestedChildren() {
    SearchIndexField child = searchIndexField("f1", "svc.idx.a\\\"b.f1");
    SearchIndexField corrupt =
        searchIndexField(CORRUPT_NAME, "svc.idx.a\\\"b").withChildren(List.of(child));
    SearchIndex searchIndex =
        new SearchIndex()
            .withId(UUID.randomUUID())
            .withName("idx")
            .withFullyQualifiedName("svc.idx")
            .withFields(List.of(corrupt));
    givenPage(searchIndexDAO, JsonUtils.pojoToJson(searchIndex));

    MigrationUtil.repairChildFqns(collectionDAO);

    ArgumentCaptor<SearchIndex> captor = ArgumentCaptor.forClass(SearchIndex.class);
    verify(searchIndexDAO, times(1)).update(captor.capture());
    SearchIndexField repaired = captor.getValue().getFields().getFirst();
    assertEquals("svc.idx.\"a\"\"b\"", repaired.getFullyQualifiedName());
    assertEquals(
        "svc.idx.\"a\"\"b\".f1", repaired.getChildren().getFirst().getFullyQualifiedName());
  }

  @Test
  void repairsApiEndpointFieldFqnsUnderRequestAndResponseSchemaParents() {
    APIEndpoint endpoint =
        new APIEndpoint()
            .withId(UUID.randomUUID())
            .withName("ep")
            .withFullyQualifiedName("svc.coll.ep")
            .withRequestSchema(
                new APISchema()
                    .withSchemaFields(
                        List.of(field(CORRUPT_NAME, "svc.coll.ep.requestSchema.a\\\"b"))))
            .withResponseSchema(
                new APISchema()
                    .withSchemaFields(List.of(field("c\"d", "svc.coll.ep.responseSchema.c\\\"d"))));
    givenPage(apiEndpointDAO, JsonUtils.pojoToJson(endpoint));

    MigrationUtil.RepairSummary summary = repairAndSummarize(Entity.API_ENDPOINT);

    ArgumentCaptor<APIEndpoint> captor = ArgumentCaptor.forClass(APIEndpoint.class);
    verify(apiEndpointDAO, times(1)).update(captor.capture());
    assertEquals(
        "svc.coll.ep.requestSchema.\"a\"\"b\"",
        captor.getValue().getRequestSchema().getSchemaFields().getFirst().getFullyQualifiedName());
    assertEquals(
        "svc.coll.ep.responseSchema.\"c\"\"d\"",
        captor.getValue().getResponseSchema().getSchemaFields().getFirst().getFullyQualifiedName());
    assertEquals(2, summary.repairedChildren());
  }

  @Test
  void repairsMlFeatureAndFeatureSourceFqns() {
    MlFeatureSource sourceWithDataSource =
        new MlFeatureSource()
            .withName("s\"1")
            .withFullyQualifiedName("svc.db.sch.tbl.s\\\"1")
            .withDataSource(new EntityReference().withFullyQualifiedName("svc.db.sch.tbl"));
    MlFeatureSource sourceWithoutDataSource =
        new MlFeatureSource().withName("s\"2").withFullyQualifiedName("s\"2");
    MlFeature feature =
        new MlFeature()
            .withName(CORRUPT_NAME)
            .withFullyQualifiedName("svc.model.a\\\"b")
            .withFeatureSources(List.of(sourceWithDataSource, sourceWithoutDataSource));
    MlModel mlModel =
        new MlModel()
            .withId(UUID.randomUUID())
            .withName("model")
            .withFullyQualifiedName("svc.model")
            .withMlFeatures(List.of(feature));
    givenPage(mlModelDAO, JsonUtils.pojoToJson(mlModel));

    MigrationUtil.RepairSummary summary = repairAndSummarize(Entity.MLMODEL);

    ArgumentCaptor<MlModel> captor = ArgumentCaptor.forClass(MlModel.class);
    verify(mlModelDAO, times(1)).update(captor.capture());
    MlFeature repaired = captor.getValue().getMlFeatures().getFirst();
    assertEquals("svc.model.\"a\"\"b\"", repaired.getFullyQualifiedName());
    assertEquals(
        "svc.db.sch.tbl.\"s\"\"1\"",
        repaired.getFeatureSources().getFirst().getFullyQualifiedName());
    assertEquals("\"s\"\"2\"", repaired.getFeatureSources().getLast().getFullyQualifiedName());
    assertEquals(3, summary.repairedChildren());
  }

  private MigrationUtil.RepairSummary repairAndSummarize(String entityType) {
    return MigrationUtil.repairChildFqns(collectionDAO).stream()
        .filter(summary -> summary.entityType().equals(entityType))
        .findFirst()
        .orElseThrow();
  }

  private void givenPage(EntityDAO<?> entityDAO, String... jsons) {
    when(entityDAO.listAfterWithOffset(anyInt(), anyInt()))
        .thenAnswer(inv -> (int) inv.getArgument(1) == 0 ? List.of(jsons) : List.of());
  }

  private String pipelineJson(String fqn, Task... tasks) {
    Pipeline pipeline =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("p")
            .withFullyQualifiedName(fqn)
            .withTasks(List.of(tasks));
    return JsonUtils.pojoToJson(pipeline);
  }

  private Task task(String name, String fullyQualifiedName) {
    return new Task().withName(name).withFullyQualifiedName(fullyQualifiedName);
  }

  private String tableJson(String fqn, Column... columns) {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("tbl")
            .withFullyQualifiedName(fqn)
            .withColumns(List.of(columns));
    return JsonUtils.pojoToJson(table);
  }

  private Column column(String name, String fullyQualifiedName) {
    return new Column().withName(name).withFullyQualifiedName(fullyQualifiedName);
  }

  private Field field(String name, String fullyQualifiedName) {
    return new Field().withName(name).withFullyQualifiedName(fullyQualifiedName);
  }

  private SearchIndexField searchIndexField(String name, String fullyQualifiedName) {
    return new SearchIndexField().withName(name).withFullyQualifiedName(fullyQualifiedName);
  }

  private Container container(String fqn) {
    return new Container().withId(UUID.randomUUID()).withName("c").withFullyQualifiedName(fqn);
  }

  private Topic topic(String fqn) {
    return new Topic().withId(UUID.randomUUID()).withName("t").withFullyQualifiedName(fqn);
  }

  private CollectionDAO daoForPipelineEdgeBackfill(
      CollectionDAO.EntityRelationshipDAO relationshipDAO) {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    return collectionDAO;
  }

  @SuppressWarnings({"unchecked", "rawtypes"})
  private Handle handleWithPreflight(
      Optional<Integer> preflight, List<CollectionDAO.EntityRelationshipObject> scanBatch) {
    Handle handle = mock(Handle.class);
    Query preflightQuery = mock(Query.class);
    Query scanQuery = mock(Query.class);
    org.jdbi.v3.core.result.ResultIterable preflightResult =
        mock(org.jdbi.v3.core.result.ResultIterable.class);
    org.jdbi.v3.core.result.ResultIterable scanResult =
        mock(org.jdbi.v3.core.result.ResultIterable.class);

    when(handle.createQuery(anyString()))
        .thenAnswer(
            inv -> {
              String sql = inv.getArgument(0);
              return sql.contains("LIMIT 1") ? preflightQuery : scanQuery;
            });

    when(preflightQuery.bind(anyString(), anyInt())).thenReturn(preflightQuery);
    when(preflightQuery.mapTo(Integer.class)).thenReturn(preflightResult);
    when(preflightResult.findFirst()).thenReturn(preflight);

    when(scanQuery.bind(anyString(), anyInt())).thenReturn(scanQuery);
    when(scanQuery.bind(anyString(), anyLong())).thenReturn(scanQuery);
    when(scanQuery.bindList(anyString(), any(List.class))).thenReturn(scanQuery);
    when(scanQuery.map(any(RowMapper.class))).thenReturn(scanResult);
    when(scanResult.list()).thenReturn((List) scanBatch).thenReturn(List.of());

    return handle;
  }

  private EntityReference databaseServiceRef(UUID id) {
    return new EntityReference().withId(id).withType(Entity.DATABASE_SERVICE);
  }

  private EntityReference pipelineServiceRef(UUID id) {
    return new EntityReference().withId(id).withType(Entity.PIPELINE_SERVICE);
  }

  private Table tableWithService(UUID serviceId) {
    Table table = new Table();
    table.setId(UUID.randomUUID());
    table.setService(databaseServiceRef(serviceId));
    return table;
  }

  private Pipeline pipelineWithService(UUID serviceId) {
    Pipeline pipeline = new Pipeline();
    pipeline.setId(UUID.randomUUID());
    pipeline.setService(pipelineServiceRef(serviceId));
    return pipeline;
  }

  private CollectionDAO.EntityRelationshipObject lineageCandidate(
      UUID fromTableId, UUID toTableId, UUID pipelineId) {
    String json =
        "{\"pipeline\":{\"id\":\""
            + pipelineId
            + "\",\"type\":\"pipeline\"},\"createdBy\":\"admin\",\"createdAt\":1,\"updatedBy\":\"admin\",\"updatedAt\":2}";
    return CollectionDAO.EntityRelationshipObject.builder()
        .fromEntity(Entity.TABLE)
        .fromId(fromTableId.toString())
        .toEntity(Entity.TABLE)
        .toId(toTableId.toString())
        .relation(Relationship.UPSTREAM.ordinal())
        .json(json)
        .build();
  }

  @Test
  void migratePipelineServiceEdgesSkipsScanWhenPreflightFindsNoCandidates() {
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    CollectionDAO collectionDAO = daoForPipelineEdgeBackfill(relationshipDAO);
    Handle handle = handleWithPreflight(Optional.empty(), List.of());

    try (MockedStatic<DatasourceConfig> ds = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig cfg = mock(DatasourceConfig.class);
      ds.when(DatasourceConfig::getInstance).thenReturn(cfg);
      when(cfg.isMySQL()).thenReturn(true);

      assertDoesNotThrow(() -> MigrationUtil.migratePipelineServiceEdges(collectionDAO, handle));
    }

    verify(handle, times(1)).createQuery(anyString());
    verify(relationshipDAO, never())
        .insert(any(UUID.class), any(UUID.class), anyString(), anyString(), anyInt(), anyString());
  }

  @Test
  void migratePipelineServiceEdgesIsNoOpWhenScanReturnsEmpty() {
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    CollectionDAO collectionDAO = daoForPipelineEdgeBackfill(relationshipDAO);
    Handle handle = handleWithPreflight(Optional.of(1), List.of());

    try (MockedStatic<DatasourceConfig> ds = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig cfg = mock(DatasourceConfig.class);
      ds.when(DatasourceConfig::getInstance).thenReturn(cfg);
      when(cfg.isMySQL()).thenReturn(true);

      assertDoesNotThrow(() -> MigrationUtil.migratePipelineServiceEdges(collectionDAO, handle));
    }

    verify(relationshipDAO, never())
        .insert(any(UUID.class), any(UUID.class), anyString(), anyString(), anyInt(), anyString());
  }

  @Test
  void migratePipelineServiceEdgesCreatesTwoServiceEdgesForValidLineage() {
    UUID fromTableId = UUID.randomUUID();
    UUID toTableId = UUID.randomUUID();
    UUID pipelineId = UUID.randomUUID();
    UUID fromServiceId = UUID.randomUUID();
    UUID toServiceId = UUID.randomUUID();
    UUID pipelineServiceId = UUID.randomUUID();

    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(relationshipDAO.getRecord(any(UUID.class), any(UUID.class), anyInt())).thenReturn(null);
    CollectionDAO collectionDAO = daoForPipelineEdgeBackfill(relationshipDAO);

    Handle handle =
        handleWithPreflight(
            Optional.of(1), List.of(lineageCandidate(fromTableId, toTableId, pipelineId)));

    try (MockedStatic<DatasourceConfig> ds = mockStatic(DatasourceConfig.class);
        MockedStatic<Entity> entityStatic = mockStatic(Entity.class)) {
      DatasourceConfig cfg = mock(DatasourceConfig.class);
      ds.when(DatasourceConfig::getInstance).thenReturn(cfg);
      when(cfg.isMySQL()).thenReturn(false);

      entityStatic
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TABLE), eq(fromTableId), eq(Entity.FIELD_SERVICE), eq(Include.ALL)))
          .thenReturn(tableWithService(fromServiceId));
      entityStatic
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TABLE), eq(toTableId), eq(Entity.FIELD_SERVICE), eq(Include.ALL)))
          .thenReturn(tableWithService(toServiceId));
      entityStatic
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.PIPELINE),
                      eq(pipelineId),
                      eq(Entity.FIELD_SERVICE),
                      eq(Include.ALL)))
          .thenReturn(pipelineWithService(pipelineServiceId));

      assertDoesNotThrow(() -> MigrationUtil.migratePipelineServiceEdges(collectionDAO, handle));

      ArgumentCaptor<UUID> fromCaptor = ArgumentCaptor.forClass(UUID.class);
      ArgumentCaptor<UUID> toCaptor = ArgumentCaptor.forClass(UUID.class);
      verify(relationshipDAO, times(2))
          .insert(
              fromCaptor.capture(),
              toCaptor.capture(),
              anyString(),
              anyString(),
              eq(Relationship.UPSTREAM.ordinal()),
              anyString());

      List<UUID> fromIds = fromCaptor.getAllValues();
      List<UUID> toIds = toCaptor.getAllValues();
      assertEquals(fromServiceId, fromIds.get(0));
      assertEquals(pipelineServiceId, toIds.get(0));
      assertEquals(pipelineServiceId, fromIds.get(1));
      assertEquals(toServiceId, toIds.get(1));
    }
  }

  @Test
  void migratePipelineServiceEdgesIsIdempotentWhenEdgeAlreadyExists() {
    UUID fromTableId = UUID.randomUUID();
    UUID toTableId = UUID.randomUUID();
    UUID pipelineId = UUID.randomUUID();

    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    when(relationshipDAO.getRecord(any(UUID.class), any(UUID.class), anyInt()))
        .thenReturn(CollectionDAO.EntityRelationshipObject.builder().build());
    CollectionDAO collectionDAO = daoForPipelineEdgeBackfill(relationshipDAO);

    Handle handle =
        handleWithPreflight(
            Optional.of(1), List.of(lineageCandidate(fromTableId, toTableId, pipelineId)));

    try (MockedStatic<DatasourceConfig> ds = mockStatic(DatasourceConfig.class);
        MockedStatic<Entity> entityStatic = mockStatic(Entity.class)) {
      DatasourceConfig cfg = mock(DatasourceConfig.class);
      ds.when(DatasourceConfig::getInstance).thenReturn(cfg);
      when(cfg.isMySQL()).thenReturn(true);

      entityStatic
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TABLE), eq(fromTableId), eq(Entity.FIELD_SERVICE), eq(Include.ALL)))
          .thenReturn(tableWithService(UUID.randomUUID()));
      entityStatic
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TABLE), eq(toTableId), eq(Entity.FIELD_SERVICE), eq(Include.ALL)))
          .thenReturn(tableWithService(UUID.randomUUID()));
      entityStatic
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.PIPELINE),
                      eq(pipelineId),
                      eq(Entity.FIELD_SERVICE),
                      eq(Include.ALL)))
          .thenReturn(pipelineWithService(UUID.randomUUID()));

      assertDoesNotThrow(() -> MigrationUtil.migratePipelineServiceEdges(collectionDAO, handle));

      verify(relationshipDAO, never())
          .insert(
              any(UUID.class), any(UUID.class), anyString(), anyString(), anyInt(), anyString());
    }
  }
}
