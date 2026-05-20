package org.openmetadata.it.factories;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.openmetadata.it.factories.EntityLoadSpec.EntityKind;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.api.data.CreateStoredProcedure;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.data.StoredProcedureCode;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.APIRequestMethod;
import org.openmetadata.schema.type.ChartType;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.SearchIndexDataType;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.StoredProcedureLanguage;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Tables;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Bulk-creates OM entities for tests that need a populated server (search-index reindex,
 * scale, perf scenarios). Mirrors {@code perf-test.sh}'s shape but in Java so it works
 * inside JUnit setup without shelling out.
 *
 * <p>Per kind: builds shared parent infrastructure once (one DatabaseService → Database →
 * Schema for all tables, one MessagingService for all topics, etc.), then dispatches N
 * entity-creates across an {@link ExecutorService} sized by {@code parallelWorkers}.
 *
 * <p>Each kind produces a deterministic name pattern ({@code <ns-prefix>_<kind>_<index>})
 * so a re-run inside the same {@link TestNamespace} would conflict — assume a fresh
 * namespace per test method.
 *
 * <p>Dispatch order respects prerequisites: services and parent containers run first,
 * then leaf entities, then quality + lineage which reference already-created assets.
 * Time-series telemetry kinds ({@code TEST_CASE_RESULT}, web analytics, cost analysis,
 * {@code ENTITY_REPORT_DATA}) are declared in {@link EntityKind} for parity with
 * {@code perf-test.sh} but are not yet implemented — their endpoints don't follow the
 * entity-resource shape this loader is built around. Track via the no-op branches in
 * {@link #load} and add as needed.
 */
public final class EntityLoader {

  private static final Logger LOG = LoggerFactory.getLogger(EntityLoader.class);
  private static final long FUTURE_TIMEOUT_SECONDS = 600;
  private static final String EMAIL_DOMAIN = "@loader.openmetadata.test";

  private EntityLoader() {}

  public static EntityLoadSummary load(final EntityLoadSpec spec, final TestNamespace ns) {
    LOG.info(
        "EntityLoader starting: total={} parallelWorkers={}", spec.total(), spec.parallelWorkers());
    final Instant start = Instant.now();
    final EntityLoadSummary.Builder summary = new EntityLoadSummary.Builder();
    final ExecutorService executor = Executors.newFixedThreadPool(spec.parallelWorkers());
    try {
      runAssetKinds(spec, ns, executor, summary);
      runTaxonomyKinds(spec, ns, executor, summary);
      runOrgKinds(spec, ns, executor, summary);
      runGovernanceKinds(spec, ns, executor, summary);
      runQualityKinds(spec, ns, executor, summary);
      runGraphKinds(spec, ns, executor, summary);
      runTimeSeriesKinds(spec, summary);
    } finally {
      shutdown(executor);
    }
    final EntityLoadSummary built = summary.build(Duration.between(start, Instant.now()));
    LOG.info(
        "EntityLoader done: created={} columns={} duration={}",
        built.totalEntities(),
        built.totalColumns(),
        built.totalDuration());
    return built;
  }

  private static void runAssetKinds(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    runIfRequested(EntityKind.TABLE, spec, summary, () -> loadTables(spec, ns, executor, summary));
    runIfRequested(EntityKind.TOPIC, spec, summary, () -> loadTopics(spec, ns, executor, summary));
    runIfRequested(
        EntityKind.DASHBOARD, spec, summary, () -> loadDashboards(spec, ns, executor, summary));
    runIfRequested(EntityKind.CHART, spec, summary, () -> loadCharts(spec, ns, executor, summary));
    runIfRequested(
        EntityKind.DASHBOARD_DATA_MODEL,
        spec,
        summary,
        () -> loadDashboardDataModels(spec, ns, executor, summary));
    runIfRequested(
        EntityKind.PIPELINE, spec, summary, () -> loadPipelines(spec, ns, executor, summary));
    runIfRequested(
        EntityKind.ML_MODEL, spec, summary, () -> loadMlModels(spec, ns, executor, summary));
    runIfRequested(
        EntityKind.CONTAINER, spec, summary, () -> loadContainers(spec, ns, executor, summary));
    runIfRequested(
        EntityKind.SEARCH_INDEX,
        spec,
        summary,
        () -> loadSearchIndexes(spec, ns, executor, summary));
    runIfRequested(
        EntityKind.API_COLLECTION,
        spec,
        summary,
        () -> loadApiCollections(spec, ns, executor, summary));
    runIfRequested(
        EntityKind.API_ENDPOINT,
        spec,
        summary,
        () -> loadApiEndpoints(spec, ns, executor, summary));
    runIfRequested(
        EntityKind.STORED_PROCEDURE,
        spec,
        summary,
        () -> loadStoredProcedures(spec, ns, executor, summary));
    runIfRequested(EntityKind.QUERY, spec, summary, () -> loadQueries(spec, ns, executor, summary));
  }

  private static void runTaxonomyKinds(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    runIfRequested(
        EntityKind.GLOSSARY, spec, summary, () -> loadGlossaries(spec, ns, executor, summary));
    runIfRequested(
        EntityKind.GLOSSARY_TERM,
        spec,
        summary,
        () -> loadGlossaryTerms(spec, ns, executor, summary));
    runIfRequested(
        EntityKind.CLASSIFICATION,
        spec,
        summary,
        () -> loadClassifications(spec, ns, executor, summary));
    runIfRequested(EntityKind.TAG, spec, summary, () -> loadTags(spec, ns, executor, summary));
  }

  private static void runOrgKinds(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    runIfRequested(EntityKind.USER, spec, summary, () -> loadUsers(spec, ns, executor, summary));
    runIfRequested(EntityKind.TEAM, spec, summary, () -> loadTeams(spec, ns, executor, summary));
  }

  private static void runGovernanceKinds(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    runIfRequested(
        EntityKind.DOMAIN, spec, summary, () -> loadDomains(spec, ns, executor, summary));
    runIfRequested(
        EntityKind.DATA_PRODUCT,
        spec,
        summary,
        () -> loadDataProducts(spec, ns, executor, summary));
  }

  private static void runQualityKinds(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    runIfRequested(
        EntityKind.TEST_SUITE, spec, summary, () -> loadTestSuites(spec, ns, executor, summary));
    runIfRequested(
        EntityKind.TEST_CASE, spec, summary, () -> loadTestCases(spec, ns, executor, summary));
  }

  private static void runGraphKinds(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    runIfRequested(
        EntityKind.LINEAGE_EDGE,
        spec,
        summary,
        () -> loadLineageEdges(spec, ns, executor, summary));
  }

  private static void runTimeSeriesKinds(
      final EntityLoadSpec spec, final EntityLoadSummary.Builder summary) {
    warnIfRequested(EntityKind.TEST_CASE_RESULT, spec);
    warnIfRequested(EntityKind.ENTITY_REPORT_DATA, spec);
    warnIfRequested(EntityKind.WEB_ANALYTIC_VIEW, spec);
    warnIfRequested(EntityKind.WEB_ANALYTIC_ACTIVITY, spec);
    warnIfRequested(EntityKind.RAW_COST_ANALYSIS, spec);
    warnIfRequested(EntityKind.AGG_COST_ANALYSIS, spec);
  }

  private static void warnIfRequested(final EntityKind kind, final EntityLoadSpec spec) {
    if (spec.countOf(kind) > 0) {
      LOG.warn(
          "Requested {} {} but EntityLoader does not yet implement time-series loaders;"
              + " skipping. Track parity gap with perf-test.sh.",
          spec.countOf(kind),
          kind);
    }
  }

  private static void runIfRequested(
      final EntityKind kind,
      final EntityLoadSpec spec,
      final EntityLoadSummary.Builder summary,
      final Runnable loader) {
    final int requested = spec.countOf(kind);
    if (requested <= 0) {
      return;
    }
    final Instant start = Instant.now();
    LOG.info("Loading {} {}", requested, kind);
    loader.run();
    summary.recordKindDuration(kind, Duration.between(start, Instant.now()));
  }

  // ---------------- Asset loaders ----------------

  private static void loadTables(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final String schemaFqn = ensureTablesSchema(ns).getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.TABLE);
    final int columns = spec.columnsPerTable();
    final String namePrefix = ns.prefix("table") + "_";

    final List<Future<Void>> futures = new ArrayList<>(count);
    for (int i = 0; i < count; i++) {
      final int index = i;
      futures.add(
          executor.submit(
              () -> {
                Tables.create()
                    .name(namePrefix + index)
                    .inSchema(schemaFqn)
                    .withColumns(buildColumns(columns))
                    .execute();
                return null;
              }));
    }
    awaitAll(futures, EntityKind.TABLE);
    summary.recordCreated(EntityKind.TABLE, count);
    summary.recordColumns(count * columns);
  }

  private static void loadTopics(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final MessagingService service = MessagingServiceTestFactory.createKafka(ns);
    final String serviceFqn = service.getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.TOPIC);
    final String namePrefix = ns.prefix("topic") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.TOPIC,
        index ->
            SdkClients.adminClient()
                .topics()
                .create(
                    new CreateTopic()
                        .withName(namePrefix + index)
                        .withService(serviceFqn)
                        .withPartitions(1)));
    summary.recordCreated(EntityKind.TOPIC, count);
  }

  private static void loadDashboards(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final String serviceFqn = ensureDashboardService(ns).getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.DASHBOARD);
    final String namePrefix = ns.prefix("dashboard") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.DASHBOARD,
        index ->
            SdkClients.adminClient()
                .dashboards()
                .create(
                    new CreateDashboard().withName(namePrefix + index).withService(serviceFqn)));
    summary.recordCreated(EntityKind.DASHBOARD, count);
  }

  private static void loadCharts(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final String serviceFqn = ensureDashboardService(ns).getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.CHART);
    final String namePrefix = ns.prefix("chart") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.CHART,
        index ->
            SdkClients.adminClient()
                .charts()
                .create(
                    new CreateChart()
                        .withName(namePrefix + index)
                        .withService(serviceFqn)
                        .withChartType(ChartType.Bar)));
    summary.recordCreated(EntityKind.CHART, count);
  }

  private static void loadDashboardDataModels(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final String serviceFqn = ensureDashboardService(ns).getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.DASHBOARD_DATA_MODEL);
    final int columns = spec.columnsPerDataModel();
    final String namePrefix = ns.prefix("data_model") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.DASHBOARD_DATA_MODEL,
        index -> {
          final CreateDashboardDataModel request = new CreateDashboardDataModel();
          request.setName(namePrefix + index);
          request.setService(serviceFqn);
          request.setDataModelType(DataModelType.MetabaseDataModel);
          request.setColumns(buildColumns(columns));
          SdkClients.adminClient().dashboardDataModels().create(request);
        });
    summary.recordCreated(EntityKind.DASHBOARD_DATA_MODEL, count);
  }

  private static void loadPipelines(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final PipelineService service = PipelineServiceTestFactory.createAirflow(ns);
    final String serviceFqn = service.getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.PIPELINE);
    final String namePrefix = ns.prefix("pipeline") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.PIPELINE,
        index ->
            SdkClients.adminClient()
                .pipelines()
                .create(new CreatePipeline().withName(namePrefix + index).withService(serviceFqn)));
    summary.recordCreated(EntityKind.PIPELINE, count);
  }

  private static void loadMlModels(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final MlModelService service = MlModelServiceTestFactory.createMlflow(ns);
    final String serviceFqn = service.getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.ML_MODEL);
    final String namePrefix = ns.prefix("ml_model") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.ML_MODEL,
        index -> {
          final CreateMlModel request = new CreateMlModel();
          request.setName(namePrefix + index);
          request.setService(serviceFqn);
          request.setAlgorithm("regression");
          SdkClients.adminClient().mlModels().create(request);
        });
    summary.recordCreated(EntityKind.ML_MODEL, count);
  }

  private static void loadContainers(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final StorageService service = StorageServiceTestFactory.createS3(ns);
    final String serviceFqn = service.getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.CONTAINER);
    final String namePrefix = ns.prefix("container") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.CONTAINER,
        index -> {
          final CreateContainer request = new CreateContainer();
          request.setName(namePrefix + index);
          request.setService(serviceFqn);
          SdkClients.adminClient().containers().create(request);
        });
    summary.recordCreated(EntityKind.CONTAINER, count);
  }

  private static void loadSearchIndexes(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final SearchService service = SearchServiceTestFactory.createElasticSearch(ns);
    final String serviceFqn = service.getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.SEARCH_INDEX);
    final String namePrefix = ns.prefix("search_index") + "_";
    final List<SearchIndexField> fields = defaultSearchIndexFields();

    submitBatch(
        executor,
        count,
        EntityKind.SEARCH_INDEX,
        index -> {
          final CreateSearchIndex request = new CreateSearchIndex();
          request.setName(namePrefix + index);
          request.setService(serviceFqn);
          request.setFields(fields);
          SdkClients.adminClient().searchIndexes().create(request);
        });
    summary.recordCreated(EntityKind.SEARCH_INDEX, count);
  }

  private static void loadApiCollections(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final ApiService service = APIServiceTestFactory.createRest(ns);
    final String serviceFqn = service.getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.API_COLLECTION);
    final String namePrefix = ns.prefix("api_collection") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.API_COLLECTION,
        index ->
            SdkClients.adminClient()
                .apiCollections()
                .create(
                    new CreateAPICollection()
                        .withName(namePrefix + index)
                        .withService(serviceFqn)
                        .withEndpointURL(URI.create("https://loader.test/api/" + index))));
    summary.recordCreated(EntityKind.API_COLLECTION, count);
  }

  private static void loadApiEndpoints(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final String parentCollectionFqn = ensureParentApiCollection(ns).getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.API_ENDPOINT);
    final String namePrefix = ns.prefix("api_endpoint") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.API_ENDPOINT,
        index ->
            SdkClients.adminClient()
                .apiEndpoints()
                .create(
                    new CreateAPIEndpoint()
                        .withName(namePrefix + index)
                        .withApiCollection(parentCollectionFqn)
                        .withEndpointURL(URI.create("https://loader.test/api/ep/" + index))
                        .withRequestMethod(APIRequestMethod.GET)));
    summary.recordCreated(EntityKind.API_ENDPOINT, count);
  }

  private static void loadStoredProcedures(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final String schemaFqn = ensureTablesSchema(ns).getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.STORED_PROCEDURE);
    final String namePrefix = ns.prefix("stored_proc") + "_";
    final StoredProcedureCode code =
        new StoredProcedureCode()
            .withCode("CREATE OR REPLACE PROCEDURE noop() AS $$ BEGIN RETURN; END; $$;")
            .withLanguage(StoredProcedureLanguage.SQL);

    submitBatch(
        executor,
        count,
        EntityKind.STORED_PROCEDURE,
        index -> {
          final CreateStoredProcedure request = new CreateStoredProcedure();
          request.setName(namePrefix + index);
          request.setDatabaseSchema(schemaFqn);
          request.setStoredProcedureCode(code);
          SdkClients.adminClient().storedProcedures().create(request);
        });
    summary.recordCreated(EntityKind.STORED_PROCEDURE, count);
  }

  private static void loadQueries(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final Table table = ensureQueryTable(ns);
    final int count = spec.countOf(EntityKind.QUERY);
    final String namePrefix = ns.prefix("query") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.QUERY,
        index ->
            SdkClients.adminClient()
                .queries()
                .create(
                    new CreateQuery()
                        .withName(namePrefix + index)
                        .withQuery("SELECT " + index + " AS n")
                        .withQueryUsedIn(List.of(table.getEntityReference()))));
    summary.recordCreated(EntityKind.QUERY, count);
  }

  // ---------------- Taxonomy loaders ----------------

  private static void loadGlossaries(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.GLOSSARY);
    final String namePrefix = ns.prefix("glossary") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.GLOSSARY,
        index ->
            SdkClients.adminClient()
                .glossaries()
                .create(new CreateGlossary().withName(namePrefix + index)));
    summary.recordCreated(EntityKind.GLOSSARY, count);
  }

  private static void loadGlossaryTerms(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final Glossary parent = ensureParentGlossary(ns);
    final int count = spec.countOf(EntityKind.GLOSSARY_TERM);
    final String namePrefix = ns.prefix("term") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.GLOSSARY_TERM,
        index ->
            SdkClients.adminClient()
                .glossaryTerms()
                .create(
                    new CreateGlossaryTerm()
                        .withName(namePrefix + index)
                        .withGlossary(parent.getFullyQualifiedName())
                        .withDescription("Loader term " + index)));
    summary.recordCreated(EntityKind.GLOSSARY_TERM, count);
  }

  private static void loadClassifications(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.CLASSIFICATION);
    final String namePrefix = ns.prefix("classification") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.CLASSIFICATION,
        index ->
            SdkClients.adminClient()
                .classifications()
                .create(
                    new CreateClassification()
                        .withName(namePrefix + index)
                        .withDescription("Loader classification " + index)));
    summary.recordCreated(EntityKind.CLASSIFICATION, count);
  }

  private static void loadTags(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final Classification parent = ensureParentClassification(ns);
    final int count = spec.countOf(EntityKind.TAG);
    final String namePrefix = ns.prefix("tag") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.TAG,
        index ->
            SdkClients.adminClient()
                .tags()
                .create(
                    new CreateTag()
                        .withName(namePrefix + index)
                        .withClassification(parent.getName())
                        .withDescription("Loader tag " + index)));
    summary.recordCreated(EntityKind.TAG, count);
  }

  // ---------------- Org loaders ----------------

  private static void loadUsers(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.USER);
    final String namePrefix = ns.prefix("user") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.USER,
        index -> {
          final String name = namePrefix + index;
          SdkClients.adminClient()
              .users()
              .create(new CreateUser().withName(name).withEmail(name + EMAIL_DOMAIN));
        });
    summary.recordCreated(EntityKind.USER, count);
  }

  private static void loadTeams(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.TEAM);
    final String namePrefix = ns.prefix("team") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.TEAM,
        index ->
            SdkClients.adminClient()
                .teams()
                .create(
                    new CreateTeam()
                        .withName(namePrefix + index)
                        .withDisplayName(namePrefix + index)
                        .withTeamType(TeamType.GROUP)));
    summary.recordCreated(EntityKind.TEAM, count);
  }

  // ---------------- Governance loaders ----------------

  private static void loadDomains(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.DOMAIN);
    final String namePrefix = ns.prefix("domain") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.DOMAIN,
        index ->
            SdkClients.adminClient()
                .domains()
                .create(
                    new CreateDomain()
                        .withName(namePrefix + index)
                        .withDomainType(DomainType.AGGREGATE)
                        .withDescription("Loader domain " + index)));
    summary.recordCreated(EntityKind.DOMAIN, count);
  }

  private static void loadDataProducts(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final Domain parent = ensureParentDomain(ns);
    final int count = spec.countOf(EntityKind.DATA_PRODUCT);
    final String namePrefix = ns.prefix("data_product") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.DATA_PRODUCT,
        index ->
            SdkClients.adminClient()
                .dataProducts()
                .create(
                    new CreateDataProduct()
                        .withName(namePrefix + index)
                        .withDomains(List.of(parent.getFullyQualifiedName()))
                        .withDescription("Loader data product " + index)));
    summary.recordCreated(EntityKind.DATA_PRODUCT, count);
  }

  // ---------------- Quality loaders ----------------

  private static void loadTestSuites(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.TEST_SUITE);
    final String namePrefix = ns.prefix("test_suite") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.TEST_SUITE,
        index -> {
          final CreateTestSuite request = new CreateTestSuite();
          request.setName(namePrefix + index);
          request.setDescription("Loader test suite " + index);
          SdkClients.adminClient().testSuites().create(request);
        });
    summary.recordCreated(EntityKind.TEST_SUITE, count);
  }

  private static void loadTestCases(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final Table table = ensureQueryTable(ns);
    final String entityLink = "<#E::table::" + table.getFullyQualifiedName() + ">";
    final int count = spec.countOf(EntityKind.TEST_CASE);
    final String namePrefix = ns.prefix("test_case") + "_";

    submitBatch(
        executor,
        count,
        EntityKind.TEST_CASE,
        index ->
            SdkClients.adminClient()
                .testCases()
                .create(
                    new CreateTestCase()
                        .withName(namePrefix + index)
                        .withEntityLink(entityLink)
                        .withTestDefinition("tableRowCountToEqual")));
    summary.recordCreated(EntityKind.TEST_CASE, count);
  }

  // ---------------- Graph loaders ----------------

  private static void loadLineageEdges(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final List<Table> nodes = ensureLineageNodes(ns, spec.countOf(EntityKind.LINEAGE_EDGE) + 1);
    final int count = spec.countOf(EntityKind.LINEAGE_EDGE);
    final OpenMetadataClient client = SdkClients.adminClient();

    submitBatch(
        executor,
        count,
        EntityKind.LINEAGE_EDGE,
        index -> {
          final Table from = nodes.get(index);
          final Table to = nodes.get(index + 1);
          client
              .lineage()
              .addLineage(
                  new AddLineage()
                      .withEdge(
                          new EntitiesEdge()
                              .withFromEntity(from.getEntityReference())
                              .withToEntity(to.getEntityReference())));
        });
    summary.recordCreated(EntityKind.LINEAGE_EDGE, count);
  }

  // ---------------- Prerequisite helpers ----------------

  private static DatabaseSchema ensureTablesSchema(final TestNamespace ns) {
    final DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    return DatabaseSchemaTestFactory.createSimple(ns, service);
  }

  private static DashboardService ensureDashboardService(final TestNamespace ns) {
    return DashboardServiceTestFactory.createMetabase(ns);
  }

  private static org.openmetadata.schema.entity.data.APICollection ensureParentApiCollection(
      final TestNamespace ns) {
    final ApiService service = APIServiceTestFactory.createRest(ns);
    final CreateAPICollection request =
        new CreateAPICollection()
            .withName(ns.prefix("api_collection_parent"))
            .withService(service.getFullyQualifiedName())
            .withEndpointURL(URI.create("https://loader.test/api/parent"));
    return SdkClients.adminClient().apiCollections().create(request);
  }

  private static Glossary ensureParentGlossary(final TestNamespace ns) {
    return SdkClients.adminClient()
        .glossaries()
        .create(new CreateGlossary().withName(ns.prefix("glossary_parent")));
  }

  private static Classification ensureParentClassification(final TestNamespace ns) {
    return SdkClients.adminClient()
        .classifications()
        .create(
            new CreateClassification()
                .withName(ns.prefix("classification_parent"))
                .withDescription("Loader parent classification"));
  }

  private static Domain ensureParentDomain(final TestNamespace ns) {
    return SdkClients.adminClient()
        .domains()
        .create(
            new CreateDomain()
                .withName(ns.prefix("domain_parent"))
                .withDomainType(DomainType.AGGREGATE)
                .withDescription("Loader parent domain"));
  }

  private static Table ensureQueryTable(final TestNamespace ns) {
    return TableTestFactory.createSimple(ns, ensureTablesSchema(ns).getFullyQualifiedName());
  }

  private static List<Table> ensureLineageNodes(final TestNamespace ns, final int requiredCount) {
    final String schemaFqn = ensureTablesSchema(ns).getFullyQualifiedName();
    final List<Table> nodes = new ArrayList<>(requiredCount);
    for (int i = 0; i < requiredCount; i++) {
      nodes.add(
          TableTestFactory.createSimpleWithName(
              ns.prefix("lineage_node_" + i + "_" + UUID.randomUUID()), ns, schemaFqn));
    }
    return nodes;
  }

  // ---------------- Shared utilities ----------------

  @FunctionalInterface
  private interface IndexedAction {
    void run(int index) throws Exception;
  }

  private static void submitBatch(
      final ExecutorService executor,
      final int count,
      final EntityKind kind,
      final IndexedAction action) {
    final List<Future<Void>> futures = new ArrayList<>(count);
    for (int i = 0; i < count; i++) {
      final int index = i;
      futures.add(
          executor.submit(
              () -> {
                action.run(index);
                return null;
              }));
    }
    awaitAll(futures, kind);
  }

  private static List<Column> buildColumns(final int n) {
    final List<Column> columns = new ArrayList<>(n);
    for (int i = 0; i < n; i++) {
      columns.add(new Column().withName("col_" + i).withDataType(ColumnDataType.STRING));
    }
    return columns;
  }

  private static List<SearchIndexField> defaultSearchIndexFields() {
    return List.of(
        new SearchIndexField().withName("id").withDataType(SearchIndexDataType.TEXT),
        new SearchIndexField().withName("name").withDataType(SearchIndexDataType.KEYWORD));
  }

  private static void awaitAll(final List<Future<Void>> futures, final EntityKind kind) {
    for (final Future<Void> f : futures) {
      try {
        f.get(FUTURE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
      } catch (final InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new IllegalStateException("Interrupted while loading " + kind, e);
      } catch (final ExecutionException e) {
        throw new IllegalStateException("Failed to load " + kind, e.getCause());
      } catch (final java.util.concurrent.TimeoutException e) {
        throw new IllegalStateException("Timed out loading " + kind, e);
      }
    }
  }

  private static void shutdown(final ExecutorService executor) {
    executor.shutdown();
    try {
      if (!executor.awaitTermination(30, TimeUnit.SECONDS)) {
        executor.shutdownNow();
      }
    } catch (final InterruptedException e) {
      Thread.currentThread().interrupt();
      executor.shutdownNow();
    }
  }
}
