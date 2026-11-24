package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.CreateType;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.CreateDashboardDataModel.DashboardServiceType;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateFile;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateStoredProcedure;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.StoredProcedureCode;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.CreateDriveService;
import org.openmetadata.schema.api.services.CreateDriveService.DriveServiceType;
import org.openmetadata.schema.api.services.CreatePipelineService;
import org.openmetadata.schema.api.services.CreatePipelineService.PipelineServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.entity.type.Category;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.services.connections.dashboard.MetabaseConnection;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.services.connections.drive.GoogleDriveConnection;
import org.openmetadata.schema.services.connections.pipeline.AirflowConnection;
import org.openmetadata.schema.type.ChartType;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DashboardConnection;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.DriveConnection;
import org.openmetadata.schema.type.PipelineConnection;
import org.openmetadata.schema.type.StoredProcedureLanguage;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * A hard delete removes the FQN-keyed rows of the deleted entity only. FQNs are unique within a
 * type, so an entity of another type that shares the name, or whose FQN nests under the deleted
 * one, keeps its tags and custom properties.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class HardDeleteCleanupIT {
  private static final String PERSONAL_TAG = "PersonalData.Personal";
  private static final String TIER_TAG = "Tier.Tier2";
  private static final List<String> TABLE_TAGS = List.of(PERSONAL_TAG, TIER_TAG);
  private static final Map<String, String> HARD_DELETE = Map.of("hardDelete", "true");
  private static final Map<String, String> RECURSIVE_HARD_DELETE =
      Map.of("hardDelete", "true", "recursive", "true");
  private static final Duration ASYNC_DELETE_TIMEOUT = Duration.ofMinutes(2);

  @Test
  void deletingAUserNamedLikeAServiceKeepsTheServicesTags(TestNamespace ns) {
    String sharedName = "hd_svc_" + UUID.randomUUID().toString().substring(0, 8);
    Table table = createTaggedTable(ns, sharedName);
    User namesake = createUserNamed(sharedName);

    SdkClients.adminClient().users().delete(namesake.getId().toString(), HARD_DELETE);

    assertKeepsItsTags(table);
  }

  @Test
  void deletingATypeNamedLikeAServiceKeepsTheServicesTags(TestNamespace ns) throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    String sharedName = "hdType" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    Table table = createTaggedTable(ns, sharedName);
    Type namesake =
        admin
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                "/v1/metadata/types",
                new CreateType()
                    .withName(sharedName)
                    .withCategory(Category.Field)
                    .withDescription("Field type named like a service")
                    .withSchema(typeByName(admin, "integer").getSchema()),
                Type.class);

    admin
        .getHttpClient()
        .execute(HttpMethod.DELETE, "/v1/metadata/types/" + namesake.getId(), null, Type.class);

    assertKeepsItsTags(table);
  }

  @Test
  void deletingAUserNamedLikeAnEntityTypeKeepsItsCustomProperties() throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    String typeName = Entity.CHART;
    String propertyName = "hdKeep" + UUID.randomUUID().toString().substring(0, 8);
    Type chartType = typeByName(admin, typeName);
    admin
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/metadata/types/" + chartType.getId(),
            new CustomProperty()
                .withName(propertyName)
                .withDescription("Custom property that must survive")
                .withPropertyType(typeByName(admin, "string").getEntityReference()),
            Type.class);
    User namesake = createUserNamed(typeName);

    admin.users().delete(namesake.getId().toString(), HARD_DELETE);

    String chartWithProperties =
        admin
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/metadata/types/name/" + typeName + "?fields=customProperties",
                null);
    assertTrue(
        JsonUtils.readValue(chartWithProperties, Type.class).getCustomProperties().stream()
            .anyMatch(property -> propertyName.equals(property.getName())),
        "The chart custom property must survive deleting a user named " + typeName);
  }

  /** The UI hard-deletes a service recursively through the async endpoint. */
  @Test
  void asyncHardDeleteOfAPipelineServiceNamedLikeADatabaseServiceKeepsTheDatabaseTags(
      TestNamespace ns) {
    String sharedName = uniqueName("hd_dbx_");
    Table table = createTaggedTable(ns, sharedName);
    PipelineService namesake = createPipelineService(ns, sharedName);
    createPipeline(namesake, "ingest_job", List.of());

    hardDeleteAsync("services/pipelineServices", namesake.getId());

    assertKeepsItsTags(table);
  }

  @Test
  void hardDeletingADatabaseServiceKeepsItsNamesakesTagsAndRemovesItsOwn(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String sharedName = uniqueName("hd_dbx_");
    Table table = createTaggedTable(ns, sharedName);
    PipelineService namesake = createPipelineService(ns, sharedName);
    Pipeline pipeline =
        createPipeline(namesake, "etl_job", List.of(classificationTag(PERSONAL_TAG)));

    admin.databaseServices().delete(table.getService().getId().toString(), RECURSIVE_HARD_DELETE);

    assertEquals(
        List.of(PERSONAL_TAG),
        tagFqns(admin.pipelines().get(pipeline.getId().toString(), "tags").getTags()));
    assertHasNoTagsOfItsOwn(createTable(ns, sharedName, List.of()));
  }

  /** A metric's FQN is its bare name, so "service.db" hashes like the service's database. */
  @Test
  void hardDeletingADatabaseServiceKeepsTheTagsOfAMetricNamedLikeItsDatabaseAndRemovesItsOwn(
      TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String serviceName = uniqueName("hd_sales_");
    Table table = createTaggedTable(ns, serviceName);
    Metric namedLikeTheDatabase =
        admin
            .metrics()
            .create(
                new CreateMetric()
                    .withName(table.getDatabase().getFullyQualifiedName())
                    .withTags(List.of(classificationTag(PERSONAL_TAG))));

    try {
      admin.databaseServices().delete(table.getService().getId().toString(), RECURSIVE_HARD_DELETE);

      assertEquals(
          List.of(PERSONAL_TAG),
          tagFqns(admin.metrics().get(namedLikeTheDatabase.getId().toString(), "tags").getTags()));
      assertHasNoTagsOfItsOwn(createTable(ns, serviceName, List.of()));
    } finally {
      admin.metrics().delete(namedLikeTheDatabase.getId().toString(), HARD_DELETE);
    }
  }

  @Test
  void hardDeletingAStoredProcedureNamedLikeATableKeepsTheTablesTags(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Table table = createTaggedTable(ns, uniqueName("hd_sp_"));
    StoredProcedure namesake =
        admin
            .storedProcedures()
            .create(
                new CreateStoredProcedure()
                    .withName(table.getName())
                    .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
                    .withStoredProcedureCode(
                        new StoredProcedureCode()
                            .withCode("SELECT 1")
                            .withLanguage(StoredProcedureLanguage.SQL)));

    admin.storedProcedures().delete(namesake.getId().toString(), HARD_DELETE);

    assertKeepsItsTags(table);
  }

  /** A metric's FQN is its bare name, so it can equal a table column's FQN. */
  @Test
  void hardDeletingAMetricNamedLikeAColumnKeepsTheColumnsTags(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Table table = createTaggedTable(ns, uniqueName("hd_col_"));
    Metric namedLikeTheColumn =
        admin
            .metrics()
            .create(new CreateMetric().withName(table.getColumns().get(0).getFullyQualifiedName()));

    admin.metrics().delete(namedLikeTheColumn.getId().toString(), HARD_DELETE);

    assertKeepsItsTags(table);
  }

  /** A Drive file's columns carry tags outside ChildFieldResolver, and share FQNs the same way. */
  @Test
  void hardDeletingAMetricNamedLikeAFileColumnKeepsTheColumnsTags(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    DriveService drive = createDriveService(ns, uniqueName("hd_drive_"));
    File file =
        admin
            .files()
            .create(
                new CreateFile()
                    .withName("ledger")
                    .withService(drive.getFullyQualifiedName())
                    .withColumns(List.of(taggedColumn())));
    Metric namedLikeTheColumn =
        admin
            .metrics()
            .create(new CreateMetric().withName(file.getColumns().get(0).getFullyQualifiedName()));

    admin.metrics().delete(namedLikeTheColumn.getId().toString(), HARD_DELETE);

    File reloaded = admin.files().get(file.getId().toString(), "columns,tags");
    assertEquals(List.of(PERSONAL_TAG), tagFqns(reloaded.getColumns().get(0).getTags()));
  }

  /** Data models nest under {@code <service>.model}, the FQN of a chart named "model". */
  @Test
  void hardDeletingAChartNamedModelKeepsTheTagsOfTheServicesDataModels(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    DashboardService service = createDashboardService(ns, uniqueName("hd_dash_"));
    DashboardDataModel dataModel =
        admin
            .dashboardDataModels()
            .create(
                new CreateDashboardDataModel()
                    .withName("orders")
                    .withService(service.getFullyQualifiedName())
                    .withDataModelType(DataModelType.LookMlView)
                    .withTags(List.of(classificationTag(PERSONAL_TAG)))
                    .withColumns(List.of(taggedColumn())));
    Chart namedLikeTheModelsSegment =
        createChartNamedModel(service, List.of(classificationTag(PERSONAL_TAG)));

    admin.charts().delete(namedLikeTheModelsSegment.getId().toString(), HARD_DELETE);

    DashboardDataModel reloaded =
        admin.dashboardDataModels().get(dataModel.getId().toString(), "tags,columns");
    assertEquals(List.of(PERSONAL_TAG), tagFqns(reloaded.getTags()));
    assertEquals(List.of(PERSONAL_TAG), tagFqns(reloaded.getColumns().get(0).getTags()));
    Chart recreated = createChartNamedModel(service, List.of());
    assertEquals(
        List.of(),
        ownTagFqns(admin.charts().get(recreated.getId().toString(), "tags").getTags()),
        "A chart re-created at the deleted FQN must not inherit the deleted chart's tags");
  }

  private static Chart createChartNamedModel(DashboardService service, List<TagLabel> tags) {
    return SdkClients.adminClient()
        .charts()
        .create(
            new CreateChart()
                .withName("model")
                .withService(service.getFullyQualifiedName())
                .withChartType(ChartType.Bar)
                .withTags(tags));
  }

  /** A metric's FQN is its bare name, so "glossary.term" hashes like the glossary term's FQN. */
  @Test
  void hardDeletingAGlossaryKeepsTheTagsOfAMetricNamedLikeOneOfItsTerms(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Glossary glossary =
        ns.trackRoot(
            Entity.GLOSSARY,
            admin
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(uniqueName("hdGlossary"))
                        .withDescription("Glossary whose term shares a metric's FQN")));
    GlossaryTerm term =
        admin
            .glossaryTerms()
            .create(
                new CreateGlossaryTerm()
                    .withName("revenue")
                    .withGlossary(glossary.getFullyQualifiedName())
                    .withDescription("Term named like a metric"));
    Metric metric =
        admin
            .metrics()
            .create(
                new CreateMetric()
                    .withName(term.getFullyQualifiedName())
                    .withTags(List.of(classificationTag(PERSONAL_TAG))));

    try {
      admin.glossaries().delete(glossary.getId().toString(), RECURSIVE_HARD_DELETE);

      assertEquals(
          List.of(PERSONAL_TAG),
          tagFqns(admin.metrics().get(metric.getId().toString(), "tags").getTags()));
    } finally {
      admin.metrics().delete(metric.getId().toString(), HARD_DELETE);
    }
  }

  private static Table createTaggedTable(TestNamespace ns, String serviceName) {
    return createTable(
        ns, serviceName, TABLE_TAGS.stream().map(HardDeleteCleanupIT::classificationTag).toList());
  }

  private static Table createTable(TestNamespace ns, String serviceName, List<TagLabel> tags) {
    OpenMetadataClient admin = SdkClients.adminClient();
    DatabaseService service =
        ns.trackRoot(
            Entity.DATABASE_SERVICE,
            admin
                .databaseServices()
                .create(
                    new CreateDatabaseService()
                        .withName(serviceName)
                        .withServiceType(DatabaseServiceType.Postgres)
                        .withConnection(
                            new DatabaseConnection()
                                .withConfig(
                                    new PostgresConnection()
                                        .withHostPort("localhost:5432")
                                        .withUsername("reader")))));
    Database database =
        admin
            .databases()
            .create(
                new CreateDatabase().withName("db").withService(service.getFullyQualifiedName()));
    DatabaseSchema schema =
        admin
            .databaseSchemas()
            .create(
                new CreateDatabaseSchema()
                    .withName("sch")
                    .withDatabase(database.getFullyQualifiedName()));
    boolean tagged = !tags.isEmpty();
    return admin
        .tables()
        .create(
            new CreateTable()
                .withName("customers")
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withTags(tags)
                .withColumns(
                    List.of(
                        tagged
                            ? taggedColumn()
                            : new Column().withName("email").withDataType(ColumnDataType.STRING))));
  }

  private static Column taggedColumn() {
    return new Column()
        .withName("email")
        .withDataType(ColumnDataType.STRING)
        .withTags(List.of(classificationTag(PERSONAL_TAG)));
  }

  private static PipelineService createPipelineService(TestNamespace ns, String name) {
    return ns.trackRoot(
        Entity.PIPELINE_SERVICE,
        SdkClients.adminClient()
            .pipelineServices()
            .create(
                new CreatePipelineService()
                    .withName(name)
                    .withServiceType(PipelineServiceType.Airflow)
                    .withConnection(
                        new PipelineConnection()
                            .withConfig(
                                new AirflowConnection()
                                    .withHostPort(URI.create("http://localhost:8080"))))));
  }

  private static Pipeline createPipeline(
      PipelineService service, String name, List<TagLabel> tags) {
    return SdkClients.adminClient()
        .pipelines()
        .create(
            new CreatePipeline()
                .withName(name)
                .withService(service.getFullyQualifiedName())
                .withTags(tags));
  }

  private static DriveService createDriveService(TestNamespace ns, String name) {
    return ns.trackRoot(
        Entity.DRIVE_SERVICE,
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                "/v1/services/driveServices",
                new CreateDriveService()
                    .withName(name)
                    .withServiceType(DriveServiceType.GoogleDrive)
                    .withConnection(new DriveConnection().withConfig(new GoogleDriveConnection())),
                DriveService.class));
  }

  private static DashboardService createDashboardService(TestNamespace ns, String name) {
    return ns.trackRoot(
        Entity.DASHBOARD_SERVICE,
        SdkClients.adminClient()
            .dashboardServices()
            .create(
                new CreateDashboardService()
                    .withName(name)
                    .withServiceType(DashboardServiceType.Metabase)
                    .withConnection(
                        new DashboardConnection()
                            .withConfig(
                                new MetabaseConnection()
                                    .withHostPort(URI.create("http://localhost:3000"))
                                    .withUsername("admin")))));
  }

  private static void hardDeleteAsync(String collection, UUID id) {
    OpenMetadataClient admin = SdkClients.adminClient();
    admin
        .getHttpClient()
        .execute(
            HttpMethod.DELETE,
            "/v1/" + collection + "/async/" + id + "?hardDelete=true&recursive=true",
            null,
            Object.class);
    Awaitility.await("async hard delete of " + collection + " " + id)
        .atMost(ASYNC_DELETE_TIMEOUT)
        .pollInterval(Duration.ofMillis(250))
        .until(() -> isGone(admin, "/v1/" + collection + "/" + id + "?include=all"));
  }

  private static boolean isGone(OpenMetadataClient admin, String path) {
    boolean gone = false;
    try {
      admin.getHttpClient().execute(HttpMethod.GET, path, null, Object.class);
    } catch (OpenMetadataException e) {
      gone = e.getStatusCode() == 404;
    }
    return gone;
  }

  private static void assertHasNoTagsOfItsOwn(Table recreated) {
    Table reloaded =
        SdkClients.adminClient().tables().get(recreated.getId().toString(), "tags,columns");
    assertEquals(
        List.of(),
        ownTagFqns(reloaded.getTags()),
        "A table re-created at a deleted FQN must not inherit the deleted table's tags");
    assertEquals(List.of(), ownTagFqns(reloaded.getColumns().get(0).getTags()));
  }

  private static void assertKeepsItsTags(Table table) {
    Table reloaded =
        SdkClients.adminClient().tables().get(table.getId().toString(), "tags,columns");
    assertEquals(TABLE_TAGS, tagFqns(reloaded.getTags()));
    assertEquals(List.of(PERSONAL_TAG), tagFqns(reloaded.getColumns().get(0).getTags()));
  }

  private static User createUserNamed(String name) {
    return SdkClients.adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(name)
                .withEmail(
                    name + "_" + UUID.randomUUID().toString().substring(0, 6) + "@test.org"));
  }

  private static Type typeByName(OpenMetadataClient client, String name) {
    return JsonUtils.readValue(
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/metadata/types/name/" + name, null),
        Type.class);
  }

  private static String uniqueName(String prefix) {
    return prefix + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
  }

  private static TagLabel classificationTag(String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static List<String> tagFqns(List<TagLabel> tags) {
    return tags.stream().map(TagLabel::getTagFQN).sorted().toList();
  }

  /**
   * Leaves out DERIVED labels, which a read propagates from the parent: a database that shares its
   * FQN with a metric shows the metric's tags, and passes them down to its tables.
   */
  private static List<String> ownTagFqns(List<TagLabel> tags) {
    return tagFqns(
        tags.stream().filter(tag -> tag.getLabelType() != TagLabel.LabelType.DERIVED).toList());
  }
}
