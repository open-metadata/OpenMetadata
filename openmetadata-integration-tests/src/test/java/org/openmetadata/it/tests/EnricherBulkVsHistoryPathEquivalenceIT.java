package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.END_TIMESTAMP_KEY;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.START_TIMESTAMP_KEY;
import static org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow.ENTITY_TYPE_FIELDS_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.ContainerServiceTestFactory;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.MlModelServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.factories.SearchServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.api.data.CreateStoredProcedure;
import org.openmetadata.schema.api.data.StoredProcedureCode;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.SearchIndexDataType;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.StoredProcedureLanguage;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.fluent.Charts;
import org.openmetadata.sdk.fluent.Containers;
import org.openmetadata.sdk.fluent.DashboardDataModels;
import org.openmetadata.sdk.fluent.Dashboards;
import org.openmetadata.sdk.fluent.DataProducts;
import org.openmetadata.sdk.fluent.MlModels;
import org.openmetadata.sdk.fluent.Pipelines;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.Topics;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsEntityEnricherProcessor;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil;

/**
 * Path-equivalence test for the two ways the DataAssetsWorkflow can hand a hydrated entity to the
 * enricher:
 *
 * <ol>
 *   <li>the keyset batch path ({@code setFieldsInBulk}), which loads the entity in bulk with all
 *       fields, and
 *   <li>the version-history path ({@code listVersionsWithOffset(...).versions.getFirst()}), which
 *       reaches into {@code EntityRepository} and returns the latest hydrated entity from the
 *       version-history accessor.
 * </ol>
 *
 * <p>Both paths produce the <strong>latest hydrated version</strong> of the entity — same fields,
 * same references, fully resolved. This test asserts that enriching either form yields identical
 * DI documents, which is the safety net for the optimization that skips the version-history call
 * when the keyset batch already has the entity.
 *
 * <p><strong>What this test does NOT cover</strong> (intentionally — different concern):
 *
 * <ul>
 *   <li>Enriching <em>historical raw rows</em> from {@code entity_extension} where references are
 *       stored bare (e.g. an owner as {@code {id, type}} without FQN). Those are at indices 1+ of
 *       the version list; this test only ever looks at index 0.
 *   <li>Multi-day backfill fan-out across a window with version transitions.
 *   <li>Step-level failure isolation (a step throwing — covered by the unit-level {@code
 *       EnrichmentPipelineTest}).
 *   <li>Absolute correctness of snapshot field values (this test only asserts <em>equality between
 *       paths</em>, not that either path produces the expected value).
 * </ul>
 *
 * <p>End-to-end enricher behavior, regression coverage for the historical-row codepath, and
 * absolute content assertions live in {@code DataInsightsEnricherBehaviorIT}.
 */
@ExtendWith(TestNamespaceExtension.class)
class EnricherBulkVsHistoryPathEquivalenceIT {

  private static DataInsightsEntityEnricherProcessor enricher;

  // DI config fields per entity type (from dataInsights/config.json)
  private static final List<String> COMMON_FIELDS =
      List.of(
          "id",
          "description",
          "displayName",
          "name",
          "deleted",
          "version",
          "owners",
          "tags",
          "extension",
          "votes",
          "fullyQualifiedName",
          "domains",
          "dataProducts",
          "certification");

  private static final Map<String, List<String>> ENTITY_SPECIFIC_FIELDS =
      Map.ofEntries(
          Map.entry(
              "table",
              List.of(
                  "tableType",
                  "columns",
                  "databaseSchema",
                  "tableConstraint",
                  "database",
                  "service",
                  "serviceType")),
          Map.entry("topic", List.of("service", "serviceType")),
          Map.entry("chart", List.of("service", "serviceType", "chartType")),
          Map.entry("dashboard", List.of("service", "serviceType", "dashboardType")),
          Map.entry("pipeline", List.of("service", "serviceType", "pipelineStatus", "tasks")),
          Map.entry(
              "storedProcedure",
              List.of(
                  "storedProcedureType", "databaseSchema", "database", "service", "serviceType")),
          Map.entry(
              "container",
              List.of(
                  "service",
                  "serviceType",
                  "numberOfObjects",
                  "size",
                  "fileFormats",
                  "parent",
                  "children",
                  "prefix")),
          Map.entry("searchIndex", List.of("service", "serviceType", "indexType", "fields")),
          Map.entry(
              "dashboardDataModel",
              List.of("service", "serviceType", "dataModelType", "project", "columns")),
          Map.entry(
              "mlmodel",
              List.of(
                  "service",
                  "serviceType",
                  "mlStore",
                  "algorithm",
                  "mlFeatures",
                  "mlHyperParameters",
                  "target",
                  "dashboard",
                  "server")),
          Map.entry("dataProduct", List.of("experts", "domains", "assets")),
          Map.entry("databaseSchema", List.of("database", "service", "serviceType")),
          Map.entry("database", List.of("service", "serviceType")));

  @BeforeAll
  static void setupAll() {
    SdkClients.adminClient();
    enricher = new DataInsightsEntityEnricherProcessor(0);
  }

  private SharedEntities shared() {
    return SharedEntities.get();
  }

  private Map<String, Object> buildContextData(String entityType, Long startTs, Long endTs) {
    List<String> fields = new ArrayList<>(COMMON_FIELDS);
    fields.addAll(ENTITY_SPECIFIC_FIELDS.getOrDefault(entityType, List.of()));

    Map<String, Object> ctx = new HashMap<>();
    ctx.put(ENTITY_TYPE_KEY, entityType);
    ctx.put(START_TIMESTAMP_KEY, startTs);
    ctx.put(END_TIMESTAMP_KEY, endTs);
    ctx.put(ENTITY_TYPE_FIELDS_KEY, fields);
    return ctx;
  }

  @SuppressWarnings("unchecked")
  private <T extends EntityInterface> T loadViaBulkPath(String entityType, T entity) {
    EntityRepository<T> repo = (EntityRepository<T>) Entity.getEntityRepository(entityType);
    EntityUtil.Fields allFields = repo.getFields("*");
    T raw = repo.findByName(entity.getFullyQualifiedName(), Include.NON_DELETED, false);
    repo.setFieldsInBulk(allFields, List.of(raw));
    return raw;
  }

  @SuppressWarnings("unchecked")
  private <T extends EntityInterface> T loadViaVersionPath(
      String entityType, T entity, Class<T> clazz) {
    EntityRepository<T> repo = (EntityRepository<T>) Entity.getEntityRepository(entityType);
    EntityRepository.EntityHistoryWithOffset history =
        repo.listVersionsWithOffset(entity.getId(), 100, 0);
    List<Object> versions = history.entityHistory().getVersions();
    assertFalse(versions.isEmpty(), "Version history should have at least the current version");
    return JsonUtils.readOrConvertValue(versions.getFirst(), clazz);
  }

  private <T extends EntityInterface> void assertBothPathsProduceIdenticalDiDocs(
      String entityType, T entity, Class<T> clazz) throws Exception {
    Long now = System.currentTimeMillis();
    Long endTs = TimestampUtils.getEndOfDayTimestamp(now);
    Long startTs = TimestampUtils.getStartOfDayTimestamp(TimestampUtils.subtractDays(now, 1));

    T batchEntity = loadViaBulkPath(entityType, entity);
    Map<String, Object> ctxA = buildContextData(entityType, startTs, endTs);
    List<Map<String, Object>> diDocsA = enricher.enrichSingle(batchEntity, ctxA);

    T versionEntity = loadViaVersionPath(entityType, entity, clazz);
    Map<String, Object> ctxB = buildContextData(entityType, startTs, endTs);
    List<Map<String, Object>> diDocsB = enricher.enrichSingle(versionEntity, ctxB);

    assertEquals(diDocsA.size(), diDocsB.size(), entityType + ": snapshot count must match");
    for (int i = 0; i < diDocsA.size(); i++) {
      Map<String, Object> docA = diDocsA.get(i);
      Map<String, Object> docB = diDocsB.get(i);
      assertEquals(
          docA.keySet(), docB.keySet(), entityType + ": key sets must match for doc #" + i);
      for (String key : docA.keySet()) {
        String jsonA = JsonUtils.pojoToJson(docA.get(key));
        String jsonB = JsonUtils.pojoToJson(docB.get(key));
        assertEquals(jsonA, jsonB, entityType + ": field '" + key + "' differs in doc #" + i);
      }
    }
  }

  // ======== Table (250k — largest entity type) ========

  @Test
  void table(TestNamespace ns) throws Exception {
    DatabaseService svc = DatabaseServiceTestFactory.create(ns, "Postgres");
    Database db = DatabaseTestFactory.create(ns, svc.getFullyQualifiedName());
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, db.getFullyQualifiedName());

    TagLabel tierTag =
        new TagLabel()
            .withTagFQN("Tier.Tier2")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);

    Table table =
        Tables.create()
            .name(ns.shortPrefix("tbl"))
            .inSchema(schema.getFullyQualifiedName())
            .withDescription("DI test table")
            .withDisplayName("DI Test Table")
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                    new Column()
                        .withName("email")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255)
                        .withDescription("email col"),
                    new Column().withName("score").withDataType(ColumnDataType.DOUBLE)))
            .withTags(List.of(shared().PERSONAL_DATA_TAG_LABEL, tierTag))
            .execute();

    table =
        Tables.find(table.getId().toString())
            .fetch()
            .withOwners(List.of(shared().USER1_REF))
            .withDomains(List.of(shared().DOMAIN.getEntityReference()))
            .save()
            .get();

    assertNotNull(table.getId());
    assertBothPathsProduceIdenticalDiDocs(Entity.TABLE, table, Table.class);
  }

  // ======== Topic (40k) ========

  @Test
  void topic(TestNamespace ns) throws Exception {
    MessagingService svc = MessagingServiceTestFactory.createKafka(ns);

    var topic =
        Topics.create()
            .name(ns.shortPrefix("topic"))
            .in(svc.getFullyQualifiedName())
            .withDescription("DI test topic")
            .withPartitions(3)
            .execute();

    assertBothPathsProduceIdenticalDiDocs(
        Entity.TOPIC, topic, org.openmetadata.schema.entity.data.Topic.class);
  }

  // ======== Chart (40k) ========

  @Test
  void chart(TestNamespace ns) throws Exception {
    DashboardService svc = DashboardServiceTestFactory.createMetabase(ns);

    var chart =
        Charts.create()
            .name(ns.shortPrefix("chart"))
            .in(svc.getFullyQualifiedName())
            .withDescription("DI test chart")
            .execute();

    assertBothPathsProduceIdenticalDiDocs(
        Entity.CHART, chart, org.openmetadata.schema.entity.data.Chart.class);
  }

  // ======== Dashboard (20k) ========

  @Test
  void dashboard(TestNamespace ns) throws Exception {
    DashboardService svc = DashboardServiceTestFactory.createMetabase(ns);

    var dashboard =
        Dashboards.create()
            .name(ns.shortPrefix("dash"))
            .in(svc.getFullyQualifiedName())
            .withDescription("DI test dashboard")
            .execute();

    assertBothPathsProduceIdenticalDiDocs(
        Entity.DASHBOARD, dashboard, org.openmetadata.schema.entity.data.Dashboard.class);
  }

  // ======== Pipeline (10k) ========

  @Test
  void pipeline(TestNamespace ns) throws Exception {
    PipelineService svc = PipelineServiceTestFactory.createAirflow(ns);

    var pipeline =
        Pipelines.create()
            .name(ns.shortPrefix("pipe"))
            .in(svc.getFullyQualifiedName())
            .withDescription("DI test pipeline")
            .execute();

    assertBothPathsProduceIdenticalDiDocs(
        Entity.PIPELINE, pipeline, org.openmetadata.schema.entity.data.Pipeline.class);
  }

  // ======== Stored Procedure (10k) ========

  @Test
  void storedProcedure(TestNamespace ns) throws Exception {
    DatabaseService svc = DatabaseServiceTestFactory.create(ns, "Postgres");
    Database db = DatabaseTestFactory.create(ns, svc.getFullyQualifiedName());
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, db.getFullyQualifiedName());

    CreateStoredProcedure request = new CreateStoredProcedure();
    request.setName(ns.shortPrefix("sp"));
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setDescription("DI test stored procedure");
    request.setStoredProcedureCode(
        new StoredProcedureCode().withCode("SELECT 1").withLanguage(StoredProcedureLanguage.SQL));

    StoredProcedure sp = SdkClients.adminClient().storedProcedures().create(request);

    assertBothPathsProduceIdenticalDiDocs(Entity.STORED_PROCEDURE, sp, StoredProcedure.class);
  }

  // ======== Container (7.5k) ========

  @Test
  void container(TestNamespace ns) throws Exception {
    StorageService svc = ContainerServiceTestFactory.createS3(ns);

    var container =
        Containers.create()
            .name(ns.shortPrefix("cont"))
            .in(svc.getFullyQualifiedName())
            .withDescription("DI test container")
            .execute();

    assertBothPathsProduceIdenticalDiDocs(
        Entity.CONTAINER, container, org.openmetadata.schema.entity.data.Container.class);
  }

  // ======== Search Index (5k) ========

  @Test
  void searchIndex(TestNamespace ns) throws Exception {
    SearchService svc = SearchServiceTestFactory.createElasticSearch(ns);

    CreateSearchIndex request = new CreateSearchIndex();
    request.setName(ns.shortPrefix("idx"));
    request.setService(svc.getFullyQualifiedName());
    request.setDescription("DI test search index");
    request.setFields(
        List.of(
            new SearchIndexField().withName("id").withDataType(SearchIndexDataType.TEXT),
            new SearchIndexField().withName("name").withDataType(SearchIndexDataType.KEYWORD)));

    SearchIndex idx = SdkClients.adminClient().searchIndexes().create(request);

    assertBothPathsProduceIdenticalDiDocs(Entity.SEARCH_INDEX, idx, SearchIndex.class);
  }

  // ======== Dashboard Data Model (500) ========

  @Test
  void dashboardDataModel(TestNamespace ns) throws Exception {
    DashboardService svc = DashboardServiceTestFactory.createMetabase(ns);

    var model =
        DashboardDataModels.create()
            .name(ns.shortPrefix("ddm"))
            .in(svc.getFullyQualifiedName())
            .withDescription("DI test data model")
            .withDataModelType(DataModelType.MetabaseDataModel)
            .withColumns(
                List.of(
                    new Column()
                        .withName("dim1")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(100)))
            .execute();

    assertBothPathsProduceIdenticalDiDocs(
        Entity.DASHBOARD_DATA_MODEL,
        model,
        org.openmetadata.schema.entity.data.DashboardDataModel.class);
  }

  // ======== ML Model (5k) ========

  @Test
  void mlModel(TestNamespace ns) throws Exception {
    MlModelService svc = MlModelServiceTestFactory.createMlflow(ns);

    var mlModel =
        MlModels.create()
            .name(ns.shortPrefix("ml"))
            .in(svc.getFullyQualifiedName())
            .withDescription("DI test ML model")
            .execute();

    assertBothPathsProduceIdenticalDiDocs(
        Entity.MLMODEL, mlModel, org.openmetadata.schema.entity.data.MlModel.class);
  }

  // ======== Data Product (50) ========

  @Test
  void dataProduct(TestNamespace ns) throws Exception {
    var dp =
        DataProducts.create()
            .name(ns.shortPrefix("dp"))
            .withDescription("DI test data product")
            .in(shared().DOMAIN.getFullyQualifiedName())
            .execute();

    assertBothPathsProduceIdenticalDiDocs(
        Entity.DATA_PRODUCT, dp, org.openmetadata.schema.entity.domains.DataProduct.class);
  }

  // ======== Database Schema (50) ========

  @Test
  void databaseSchema(TestNamespace ns) throws Exception {
    DatabaseService svc = DatabaseServiceTestFactory.create(ns, "Postgres");
    Database db = DatabaseTestFactory.create(ns, svc.getFullyQualifiedName());

    var schema =
        org.openmetadata.sdk.fluent.DatabaseSchemas.create()
            .name(ns.shortPrefix("sch"))
            .in(db.getFullyQualifiedName())
            .execute();

    assertBothPathsProduceIdenticalDiDocs(Entity.DATABASE_SCHEMA, schema, DatabaseSchema.class);
  }
}
