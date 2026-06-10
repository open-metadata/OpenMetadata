package org.openmetadata.it.factories;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadLocalRandom;
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
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.type.APIRequestMethod;
import org.openmetadata.schema.type.ChartType;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.SearchIndexDataType;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.StoredProcedureLanguage;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
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
 * then leaf entities, then quality + lineage which reference already-created assets, then
 * time-series telemetry which references collected test cases / tables. Mirrors
 * {@code perf-test.sh}'s phase layout (phases 1-7) so a Java UIIT can produce an
 * equivalent shape of data without shelling out to Python.
 */
public final class EntityLoader {

  private static final Logger LOG = LoggerFactory.getLogger(EntityLoader.class);
  private static final long FUTURE_TIMEOUT_SECONDS = 600;

  // Caps the per-load create concurrency. Defaults to unbounded (the spec's own value) so embedded
  // and local runs are unchanged; CI sets {@code -Djpw.loader.maxWorkers=N} (e.g. 8) so parallel
  // creates against a shared, proxy-fronted external cluster don't queue past the ingress timeout
  // and 504. Tune per run via the workflow input.
  private static final String MAX_WORKERS_PROPERTY = "jpw.loader.maxWorkers";

  // Children that hang off a single parent (glossary terms → glossary, tags →
  // classification, api endpoints → collection, data products → domain) serialize on the
  // parent's relationship row lock during create. Funnelling thousands through one parent
  // collapses our parallelism to ~1 under lock contention (worse with more workers).
  // perf-test.sh avoids this by spreading children across many parents — we do the same,
  // capping each parent at this many children.
  private static final int CHILDREN_PER_PARENT = 500;
  // RFC 5321 caps email local-part at 64 chars; Hibernate Validator's @Email enforces it.
  // Don't pack the namespace prefix into the local part — UUID hex is enough and short.
  private static final String EMAIL_DOMAIN = "@test.openmetadata.org";

  // Lineage mix mirrors perf-test.sh:2296-2298 — 60% table→table, 25% table→dashboard,
  // 15% pipeline→table. Ratios fall back gracefully when the dependent collected sets
  // are empty (no dashboards seeded → those edges become table→table; etc.).
  private static final double LINEAGE_RATIO_T2T = 0.60;
  private static final double LINEAGE_RATIO_T2D = 0.25;

  // Time-series endpoints used by perf-test.sh phase 7.
  private static final String DATA_INSIGHTS_PATH = "/v1/analytics/dataInsights/data";
  private static final String TEST_CASE_RESULT_PATH_PREFIX =
      "/v1/dataQuality/testCases/testCaseResults/";

  private EntityLoader() {}

  public static EntityLoadSummary load(final EntityLoadSpec spec, final TestNamespace ns) {
    final int workers = effectiveParallelWorkers(spec.parallelWorkers());
    LOG.info(
        "EntityLoader starting: total={} parallelWorkers={} (requested={})",
        spec.total(),
        workers,
        spec.parallelWorkers());
    final Instant start = Instant.now();
    final EntityLoadSummary.Builder summary = new EntityLoadSummary.Builder();
    final LoaderContext ctx = new LoaderContext();
    final ExecutorService executor = Executors.newFixedThreadPool(workers);
    try {
      runAssetKinds(spec, ns, executor, summary, ctx);
      runTaxonomyKinds(spec, ns, executor, summary);
      runOrgKinds(spec, ns, executor, summary);
      runGovernanceKinds(spec, ns, executor, summary);
      runQualityKinds(spec, ns, executor, summary, ctx);
      runGraphKinds(spec, ns, executor, summary, ctx);
      runTimeSeriesKinds(spec, executor, summary, ctx);
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

  /**
   * Caps the requested worker count by {@code -Djpw.loader.maxWorkers}. Unset (embedded/local) means
   * no cap — the spec's value is used verbatim.
   */
  private static int effectiveParallelWorkers(final int requested) {
    final Integer cap = Integer.getInteger(MAX_WORKERS_PROPERTY);
    return (cap != null && cap > 0) ? Math.min(requested, cap) : requested;
  }

  private static void runAssetKinds(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary,
      final LoaderContext ctx) {
    runIfRequested(
        EntityKind.TABLE, spec, summary, () -> loadTables(spec, ns, executor, summary, ctx));
    runIfRequested(EntityKind.TOPIC, spec, summary, () -> loadTopics(spec, ns, executor, summary));
    runIfRequested(
        EntityKind.DASHBOARD,
        spec,
        summary,
        () -> loadDashboards(spec, ns, executor, summary, ctx));
    runIfRequested(EntityKind.CHART, spec, summary, () -> loadCharts(spec, ns, executor, summary));
    runIfRequested(
        EntityKind.DASHBOARD_DATA_MODEL,
        spec,
        summary,
        () -> loadDashboardDataModels(spec, ns, executor, summary));
    runIfRequested(
        EntityKind.PIPELINE, spec, summary, () -> loadPipelines(spec, ns, executor, summary, ctx));
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
      final EntityLoadSummary.Builder summary,
      final LoaderContext ctx) {
    runIfRequested(
        EntityKind.TEST_SUITE, spec, summary, () -> loadTestSuites(spec, ns, executor, summary));
    runIfRequested(
        EntityKind.TEST_CASE, spec, summary, () -> loadTestCases(spec, ns, executor, summary, ctx));
  }

  private static void runGraphKinds(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary,
      final LoaderContext ctx) {
    runIfRequested(
        EntityKind.LINEAGE_EDGE,
        spec,
        summary,
        () -> loadLineageEdges(spec, ns, executor, summary, ctx));
  }

  private static void runTimeSeriesKinds(
      final EntityLoadSpec spec,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary,
      final LoaderContext ctx) {
    runIfRequested(
        EntityKind.TEST_CASE_RESULT,
        spec,
        summary,
        () -> loadTestCaseResults(spec, executor, summary, ctx));
    runIfRequested(
        EntityKind.ENTITY_REPORT_DATA,
        spec,
        summary,
        () -> loadEntityReportData(spec, executor, summary));
    runIfRequested(
        EntityKind.WEB_ANALYTIC_VIEW,
        spec,
        summary,
        () -> loadWebAnalyticViews(spec, executor, summary));
    runIfRequested(
        EntityKind.WEB_ANALYTIC_ACTIVITY,
        spec,
        summary,
        () -> loadWebAnalyticActivity(spec, executor, summary));
    runIfRequested(
        EntityKind.RAW_COST_ANALYSIS,
        spec,
        summary,
        () -> loadRawCostAnalysis(spec, executor, summary, ctx));
    runIfRequested(
        EntityKind.AGG_COST_ANALYSIS,
        spec,
        summary,
        () -> loadAggCostAnalysis(spec, executor, summary));
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
      final EntityLoadSummary.Builder summary,
      final LoaderContext ctx) {
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
                final Table created =
                    Tables.create()
                        .name(namePrefix + index)
                        .inSchema(schemaFqn)
                        .withColumns(buildColumns(columns))
                        .execute();
                ctx.recordTable(created);
                return null;
              }));
    }
    final int createdCount = awaitAll(futures, EntityKind.TABLE);
    summary.recordCreated(EntityKind.TABLE, createdCount);
    summary.recordColumns(createdCount * columns);
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

    final int createdCount =
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
    summary.recordCreated(EntityKind.TOPIC, createdCount);
  }

  private static void loadDashboards(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary,
      final LoaderContext ctx) {
    final String serviceFqn = ensureDashboardService(ns).getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.DASHBOARD);
    final String namePrefix = ns.prefix("dashboard") + "_";

    final int createdCount =
        submitBatch(
            executor,
            count,
            EntityKind.DASHBOARD,
            index ->
                ctx.recordDashboard(
                    SdkClients.adminClient()
                        .dashboards()
                        .create(
                            new CreateDashboard()
                                .withName(namePrefix + index)
                                .withService(serviceFqn))));
    summary.recordCreated(EntityKind.DASHBOARD, createdCount);
  }

  private static void loadCharts(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final String serviceFqn = ensureDashboardService(ns).getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.CHART);
    final String namePrefix = ns.prefix("chart") + "_";

    final int createdCount =
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
    summary.recordCreated(EntityKind.CHART, createdCount);
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

    final int createdCount =
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
    summary.recordCreated(EntityKind.DASHBOARD_DATA_MODEL, createdCount);
  }

  private static void loadPipelines(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary,
      final LoaderContext ctx) {
    final PipelineService service = PipelineServiceTestFactory.createAirflow(ns);
    final String serviceFqn = service.getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.PIPELINE);
    final String namePrefix = ns.prefix("pipeline") + "_";

    final int createdCount =
        submitBatch(
            executor,
            count,
            EntityKind.PIPELINE,
            index ->
                ctx.recordPipeline(
                    SdkClients.adminClient()
                        .pipelines()
                        .create(
                            new CreatePipeline()
                                .withName(namePrefix + index)
                                .withService(serviceFqn))));
    summary.recordCreated(EntityKind.PIPELINE, createdCount);
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

    final int createdCount =
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
    summary.recordCreated(EntityKind.ML_MODEL, createdCount);
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

    final int createdCount =
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
    summary.recordCreated(EntityKind.CONTAINER, createdCount);
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

    final int createdCount =
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
    summary.recordCreated(EntityKind.SEARCH_INDEX, createdCount);
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

    final int createdCount =
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
    summary.recordCreated(EntityKind.API_COLLECTION, createdCount);
  }

  private static void loadApiEndpoints(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.API_ENDPOINT);
    final List<String> collectionFqns = createApiCollectionParents(ns, parentCountFor(count));
    final String namePrefix = ns.prefix("api_endpoint") + "_";

    final int createdCount =
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
                            .withApiCollection(collectionFqns.get(index % collectionFqns.size()))
                            .withEndpointURL(URI.create("https://loader.test/api/ep/" + index))
                            .withRequestMethod(APIRequestMethod.GET)));
    summary.recordCreated(EntityKind.API_ENDPOINT, createdCount);
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

    final int createdCount =
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
    summary.recordCreated(EntityKind.STORED_PROCEDURE, createdCount);
  }

  private static void loadQueries(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    // Match perf-test.sh:2145-2151 — minimum-viable Query payload is name + query +
    // service. Earlier attempts also sent queryUsedIn with the table's EntityReference,
    // but EntityReference.type is @NotNull and the SDK-returned Table builds a reference
    // whose type field doesn't survive canonical-name lookup, producing 400s. We don't
    // need the queryUsedIn link for load coverage; the script doesn't set it either.
    final String serviceFqn = ensureTablesSchema(ns).getService().getFullyQualifiedName();
    final int count = spec.countOf(EntityKind.QUERY);
    final String namePrefix = ns.prefix("query") + "_";

    final int createdCount =
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
                            .withQuery("SELECT " + index + " AS n_" + System.nanoTime())
                            .withService(serviceFqn)));
    summary.recordCreated(EntityKind.QUERY, createdCount);
  }

  // ---------------- Taxonomy loaders ----------------

  private static void loadGlossaries(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.GLOSSARY);
    final String namePrefix = ns.prefix("glossary") + "_";

    final int createdCount =
        submitBatch(
            executor,
            count,
            EntityKind.GLOSSARY,
            index ->
                ns.trackRoot(
                    Entity.GLOSSARY,
                    SdkClients.adminClient()
                        .glossaries()
                        .create(
                            new CreateGlossary()
                                .withName(namePrefix + index)
                                .withDescription("Loader glossary " + index))));
    summary.recordCreated(EntityKind.GLOSSARY, createdCount);
  }

  private static void loadGlossaryTerms(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.GLOSSARY_TERM);
    final List<String> glossaryFqns = createGlossaryParents(ns, parentCountFor(count));
    final String namePrefix = ns.prefix("term") + "_";

    final int createdCount =
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
                            .withGlossary(glossaryFqns.get(index % glossaryFqns.size()))
                            .withDescription("Loader term " + index)));
    summary.recordCreated(EntityKind.GLOSSARY_TERM, createdCount);
  }

  private static void loadClassifications(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.CLASSIFICATION);
    final String namePrefix = ns.prefix("classification") + "_";

    final int createdCount =
        submitBatch(
            executor,
            count,
            EntityKind.CLASSIFICATION,
            index ->
                ns.trackRoot(
                    Entity.CLASSIFICATION,
                    SdkClients.adminClient()
                        .classifications()
                        .create(
                            new CreateClassification()
                                .withName(namePrefix + index)
                                .withDescription("Loader classification " + index))));
    summary.recordCreated(EntityKind.CLASSIFICATION, createdCount);
  }

  private static void loadTags(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.TAG);
    final List<String> classificationNames = createClassificationParents(ns, parentCountFor(count));
    final String namePrefix = ns.prefix("tag") + "_";

    final int createdCount =
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
                            .withClassification(
                                classificationNames.get(index % classificationNames.size()))
                            .withDescription("Loader tag " + index)));
    summary.recordCreated(EntityKind.TAG, createdCount);
  }

  // ---------------- Org loaders ----------------

  private static void loadUsers(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.USER);
    final String namePrefix = ns.prefix("user") + "_";

    final int createdCount =
        submitBatch(
            executor,
            count,
            EntityKind.USER,
            index -> {
              final String name = namePrefix + index;
              final String email =
                  "u" + UUID.randomUUID().toString().replace("-", "") + EMAIL_DOMAIN;
              SdkClients.adminClient()
                  .users()
                  .create(new CreateUser().withName(name).withEmail(email));
            });
    summary.recordCreated(EntityKind.USER, createdCount);
  }

  private static void loadTeams(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.TEAM);
    final String namePrefix = ns.prefix("team") + "_";

    final int createdCount =
        submitBatch(
            executor,
            count,
            EntityKind.TEAM,
            index ->
                ns.trackRoot(
                    Entity.TEAM,
                    SdkClients.adminClient()
                        .teams()
                        .create(
                            new CreateTeam()
                                .withName(namePrefix + index)
                                .withDisplayName(namePrefix + index)
                                .withTeamType(TeamType.GROUP))));
    summary.recordCreated(EntityKind.TEAM, createdCount);
  }

  // ---------------- Governance loaders ----------------

  private static void loadDomains(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.DOMAIN);
    final String namePrefix = ns.prefix("domain") + "_";

    final int createdCount =
        submitBatch(
            executor,
            count,
            EntityKind.DOMAIN,
            index ->
                ns.trackRoot(
                    Entity.DOMAIN,
                    SdkClients.adminClient()
                        .domains()
                        .create(
                            new CreateDomain()
                                .withName(namePrefix + index)
                                .withDomainType(DomainType.AGGREGATE)
                                .withDescription("Loader domain " + index))));
    summary.recordCreated(EntityKind.DOMAIN, createdCount);
  }

  private static void loadDataProducts(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.DATA_PRODUCT);
    final List<String> domainFqns = createDomainParents(ns, parentCountFor(count));
    final String namePrefix = ns.prefix("data_product") + "_";

    final int createdCount =
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
                            .withDomains(List.of(domainFqns.get(index % domainFqns.size())))
                            .withDescription("Loader data product " + index)));
    summary.recordCreated(EntityKind.DATA_PRODUCT, createdCount);
  }

  // ---------------- Quality loaders ----------------

  private static void loadTestSuites(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.TEST_SUITE);
    final String namePrefix = ns.prefix("test_suite") + "_";

    final int createdCount =
        submitBatch(
            executor,
            count,
            EntityKind.TEST_SUITE,
            index -> {
              final CreateTestSuite request = new CreateTestSuite();
              request.setName(namePrefix + index);
              request.setDescription("Loader test suite " + index);
              ns.trackRoot(
                  Entity.TEST_SUITE, SdkClients.adminClient().testSuites().create(request));
            });
    summary.recordCreated(EntityKind.TEST_SUITE, createdCount);
  }

  private static void loadTestCases(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary,
      final LoaderContext ctx) {
    final int count = spec.countOf(EntityKind.TEST_CASE);
    final String namePrefix = ns.prefix("test_case") + "_";

    // OM's TestCaseRepository locks per-table around the test-suite auto-create + attach
    // path and 409s when concurrent creates hit the SAME table. So we shard: one table
    // per worker (each table built by ShortStackFactory to keep the derived
    // <table.fqn>.testSuite name under MySQL's 256-char limit), each shard creates its
    // slice of test cases sequentially, and the shards run in parallel. No two threads
    // ever touch the same table, so the lock never contends.
    final int shards =
        Math.max(1, Math.min(effectiveParallelWorkers(spec.parallelWorkers()), count));
    final List<String> shardTableLinks = new ArrayList<>(shards);
    for (int s = 0; s < shards; s++) {
      shardTableLinks.add(
          "<#E::table::" + ShortStackFactory.table(ns).getFullyQualifiedName() + ">");
    }

    final List<Future<Void>> futures = new ArrayList<>(shards);
    for (int s = 0; s < shards; s++) {
      final int shard = s;
      futures.add(
          executor.submit(
              () -> {
                final String entityLink = shardTableLinks.get(shard);
                for (int i = shard; i < count; i += shards) {
                  ctx.recordTestCase(
                      SdkClients.adminClient()
                          .testCases()
                          .create(
                              new CreateTestCase()
                                  .withName(namePrefix + i)
                                  .withEntityLink(entityLink)
                                  .withTestDefinition("tableRowCountToEqual")
                                  .withParameterValues(
                                      List.of(
                                          new TestCaseParameterValue()
                                              .withName("value")
                                              .withValue(Integer.toString(i))))));
                }
                return null;
              }));
    }
    final int createdCount = awaitAll(futures, EntityKind.TEST_CASE);
    summary.recordCreated(EntityKind.TEST_CASE, createdCount);
  }

  // ---------------- Graph loaders ----------------

  /**
   * Mixed lineage shape from {@code perf-test.sh:2296-2322}: 60% table→table, 25%
   * table→dashboard, 15% pipeline→table. Dependent edge types fall back to table→table
   * when the relevant collected set is empty (e.g. no DASHBOARD seeded → those edges
   * become table→table), matching the script's fallback behaviour. If TABLE wasn't
   * seeded we synthesise a chain of N+1 tables so callers can request lineage
   * standalone, the same convenience the original loader offered.
   */
  private static void loadLineageEdges(
      final EntityLoadSpec spec,
      final TestNamespace ns,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary,
      final LoaderContext ctx) {
    final int count = spec.countOf(EntityKind.LINEAGE_EDGE);
    final List<EntityReference> tables = lineageTableNodes(ns, ctx, count + 1);
    final List<EntityReference> dashboards = ctx.dashboards();
    final List<EntityReference> pipelines = ctx.pipelines();
    final List<EntityReference[]> tasks = planLineageTasks(count, tables, dashboards, pipelines);
    final OpenMetadataClient client = SdkClients.adminClient();

    final int createdCount =
        submitBatch(
            executor,
            tasks.size(),
            EntityKind.LINEAGE_EDGE,
            index -> {
              final EntityReference[] pair = tasks.get(index);
              client
                  .lineage()
                  .addLineage(
                      new AddLineage()
                          .withEdge(
                              new EntitiesEdge().withFromEntity(pair[0]).withToEntity(pair[1])));
            });
    summary.recordCreated(EntityKind.LINEAGE_EDGE, createdCount);
  }

  private static List<EntityReference> lineageTableNodes(
      final TestNamespace ns, final LoaderContext ctx, final int minimumCount) {
    if (ctx.tables().size() >= minimumCount) {
      return ctx.tables();
    }
    // Caller asked for lineage without seeding tables; synthesise a chain. Mirrors the
    // single-kind fallback the original loader used so a {LINEAGE_EDGE: N} spec is
    // self-sufficient.
    final String schemaFqn = ensureTablesSchema(ns).getFullyQualifiedName();
    for (int i = 0; i < minimumCount; i++) {
      final Table table =
          TableTestFactory.createSimpleWithName(
              ns.prefix("lineage_node_" + i + "_" + UUID.randomUUID()), ns, schemaFqn);
      ctx.recordTable(table);
    }
    // recordTable populates ctx.tables() with type-bearing references, so just return
    // the now-populated context view rather than maintaining a parallel list whose refs
    // had null type.
    return ctx.tables();
  }

  private static List<EntityReference[]> planLineageTasks(
      final int count,
      final List<EntityReference> tables,
      final List<EntityReference> dashboards,
      final List<EntityReference> pipelines) {
    int t2tCount = (int) Math.round(count * LINEAGE_RATIO_T2T);
    int t2dCount = (int) Math.round(count * LINEAGE_RATIO_T2D);
    int p2tCount = count - t2tCount - t2dCount;
    if (dashboards.isEmpty()) {
      t2tCount += t2dCount;
      t2dCount = 0;
    }
    if (pipelines.isEmpty()) {
      t2tCount += p2tCount;
      p2tCount = 0;
    }
    final List<EntityReference[]> tasks = new ArrayList<>(count);
    for (int i = 0; i < t2tCount; i++) {
      tasks.add(
          new EntityReference[] {
            tables.get(i % tables.size()), tables.get((i + 1) % tables.size())
          });
    }
    for (int i = 0; i < t2dCount; i++) {
      tasks.add(
          new EntityReference[] {
            tables.get(i % tables.size()), dashboards.get(i % dashboards.size())
          });
    }
    for (int i = 0; i < p2tCount; i++) {
      tasks.add(
          new EntityReference[] {
            pipelines.get(i % pipelines.size()), tables.get((i + tables.size() / 2) % tables.size())
          });
    }
    return tasks;
  }

  // ---------------- Prerequisite helpers ----------------

  private static DatabaseSchema ensureTablesSchema(final TestNamespace ns) {
    final DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    return DatabaseSchemaTestFactory.createSimple(ns, service);
  }

  private static DashboardService ensureDashboardService(final TestNamespace ns) {
    return DashboardServiceTestFactory.createMetabase(ns);
  }

  /** Number of parents to spread {@code childCount} children across, capped per parent. */
  private static int parentCountFor(final int childCount) {
    return Math.max(1, (childCount + CHILDREN_PER_PARENT - 1) / CHILDREN_PER_PARENT);
  }

  private static List<String> createApiCollectionParents(final TestNamespace ns, final int n) {
    final ApiService service = APIServiceTestFactory.createRest(ns);
    final List<String> fqns = new ArrayList<>(n);
    for (int i = 0; i < n; i++) {
      fqns.add(
          SdkClients.adminClient()
              .apiCollections()
              .create(
                  new CreateAPICollection()
                      .withName(ns.prefix("api_collection_parent_" + i))
                      .withService(service.getFullyQualifiedName())
                      .withEndpointURL(URI.create("https://loader.test/api/parent/" + i)))
              .getFullyQualifiedName());
    }
    return fqns;
  }

  private static List<String> createGlossaryParents(final TestNamespace ns, final int n) {
    final List<String> fqns = new ArrayList<>(n);
    for (int i = 0; i < n; i++) {
      fqns.add(
          SdkClients.adminClient()
              .glossaries()
              .create(
                  new CreateGlossary()
                      .withName(ns.prefix("glossary_parent_" + i))
                      .withDescription("Loader parent glossary " + i))
              .getFullyQualifiedName());
    }
    return fqns;
  }

  private static List<String> createClassificationParents(final TestNamespace ns, final int n) {
    final List<String> names = new ArrayList<>(n);
    for (int i = 0; i < n; i++) {
      names.add(
          SdkClients.adminClient()
              .classifications()
              .create(
                  new CreateClassification()
                      .withName(ns.prefix("classification_parent_" + i))
                      .withDescription("Loader parent classification " + i))
              .getName());
    }
    return names;
  }

  private static List<String> createDomainParents(final TestNamespace ns, final int n) {
    final List<String> fqns = new ArrayList<>(n);
    for (int i = 0; i < n; i++) {
      fqns.add(
          SdkClients.adminClient()
              .domains()
              .create(
                  new CreateDomain()
                      .withName(ns.prefix("domain_parent_" + i))
                      .withDomainType(DomainType.AGGREGATE)
                      .withDescription("Loader parent domain " + i))
              .getFullyQualifiedName());
    }
    return fqns;
  }

  // ---------------- Shared utilities ----------------

  @FunctionalInterface
  private interface IndexedAction {
    void run(int index) throws Exception;
  }

  private static int submitBatch(
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
    return awaitAll(futures, kind);
  }

  private static List<Column> buildColumns(final int n) {
    final List<Column> columns = new ArrayList<>(n);
    for (int i = 0; i < n; i++) {
      columns.add(new Column().withName("col_" + i).withDataType(ColumnDataType.STRING));
    }
    return columns;
  }

  /**
   * Creates a single intentionally pathological "wide" table in one create call — a huge table
   * description plus a very large column count, each column carrying a sizable description. Used by
   * the static seed to stress single-document reindexing and {@code _source} size (the 413 /
   * immense-term / field-limit paths). The create payload scales with
   * {@code columnCount × columnDescriptionChars}, so a large count can exceed request/DB size limits
   * — the seed runner gives the JVM extra heap and exposes the sizes as tunable properties.
   */
  public static Table loadWideTable(
      final TestNamespace ns,
      final int columnCount,
      final int columnDescriptionChars,
      final int tableDescriptionChars) {
    final String schemaFqn = ensureTablesSchema(ns).getFullyQualifiedName();
    final String name = ns.prefix("wide_table") + "_0";
    LOG.info(
        "Creating wide table '{}': {} columns (columnDesc={}c, tableDesc={}c)",
        name,
        columnCount,
        columnDescriptionChars,
        tableDescriptionChars);
    final Table created =
        Tables.create()
            .name(name)
            .withDescription(repeatedText(tableDescriptionChars))
            .inSchema(schemaFqn)
            .withColumns(buildDescribedColumns(columnCount, columnDescriptionChars))
            .execute();
    return created;
  }

  private static List<Column> buildDescribedColumns(final int n, final int descriptionChars) {
    final String description = repeatedText(descriptionChars);
    final List<Column> columns = new ArrayList<>(n);
    for (int i = 0; i < n; i++) {
      columns.add(
          new Column()
              .withName("col_" + i)
              .withDataType(ColumnDataType.STRING)
              .withDescription(description));
    }
    return columns;
  }

  private static String repeatedText(final int targetChars) {
    final String unit = "lorem ipsum dolor sit amet ";
    final StringBuilder text = new StringBuilder(targetChars + unit.length());
    while (text.length() < targetChars) {
      text.append(unit);
    }
    text.setLength(Math.max(0, targetChars));
    return text.toString();
  }

  private static List<SearchIndexField> defaultSearchIndexFields() {
    return List.of(
        new SearchIndexField().withName("id").withDataType(SearchIndexDataType.TEXT),
        new SearchIndexField().withName("name").withDataType(SearchIndexDataType.KEYWORD));
  }

  /**
   * Waits for every create future and returns how many succeeded. Transient per-item failures
   * (a 504/timeout/409 from a shared, proxy-fronted cluster) are tolerated and logged rather than
   * aborting the whole batch on the first failure — otherwise a single failure mid-load would leave
   * a partial set (e.g. 100k requested, ~50k created). Only a total failure (nothing succeeded)
   * throws.
   */
  private static int awaitAll(final List<Future<Void>> futures, final EntityKind kind) {
    int succeeded = 0;
    int failed = 0;
    Throwable firstFailure = null;
    for (final Future<Void> f : futures) {
      try {
        f.get(FUTURE_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        succeeded++;
      } catch (final InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new IllegalStateException("Interrupted while loading " + kind, e);
      } catch (final ExecutionException | java.util.concurrent.TimeoutException e) {
        failed++;
        if (firstFailure == null) {
          firstFailure = (e instanceof ExecutionException) ? e.getCause() : e;
        }
      }
    }
    if (failed > 0) {
      LOG.warn(
          "{}: created {}/{} ({} failed) — first failure: {}",
          kind,
          succeeded,
          futures.size(),
          failed,
          firstFailure != null ? firstFailure.toString() : "unknown");
    }
    if (succeeded == 0 && !futures.isEmpty()) {
      throw new IllegalStateException("Failed to load any " + kind, firstFailure);
    }
    return succeeded;
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

  // ---------------- Time-series loaders (perf-test.sh phase 7) ----------------

  private static void loadTestCaseResults(
      final EntityLoadSpec spec,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary,
      final LoaderContext ctx) {
    final List<String> fqns = ctx.testCaseFqns();
    if (fqns.isEmpty()) {
      LOG.warn("Skipping testCaseResults: no test cases were created");
      return;
    }
    final int count = spec.countOf(EntityKind.TEST_CASE_RESULT);
    final long baseTs = System.currentTimeMillis();
    final String[] statuses = {"Success", "Failed", "Aborted"};

    final int createdCount =
        submitBatch(
            executor,
            count,
            EntityKind.TEST_CASE_RESULT,
            index -> {
              final String fqn = fqns.get(index % fqns.size());
              final String path =
                  TEST_CASE_RESULT_PATH_PREFIX + URLEncoder.encode(fqn, StandardCharsets.UTF_8);
              final Map<String, Object> body = new HashMap<>();
              body.put("timestamp", baseTs - (index * 3_600_000L));
              body.put("testCaseStatus", statuses[index % statuses.length]);
              body.put("result", "Loader result " + index);
              body.put(
                  "testResultValue",
                  List.of(Map.of("name", "value", "value", randomDoubleStr(0.0, 100.0))));
              httpPost(path, body);
            });
    summary.recordCreated(EntityKind.TEST_CASE_RESULT, createdCount);
  }

  private static void loadEntityReportData(
      final EntityLoadSpec spec,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.ENTITY_REPORT_DATA);
    final long baseTs = System.currentTimeMillis();
    final String[] entityTypes = {"table", "topic", "dashboard", "pipeline", "mlmodel"};

    final int createdCount =
        submitBatch(
            executor,
            count,
            EntityKind.ENTITY_REPORT_DATA,
            index -> {
              final int entityCount = ThreadLocalRandom.current().nextInt(1, 1001);
              final int hasOwner = ThreadLocalRandom.current().nextInt(0, entityCount + 1);
              final Map<String, Object> data = new HashMap<>();
              data.put("entityType", entityTypes[index % entityTypes.length]);
              data.put("entityTier", "Tier.Tier" + ((index % 5) + 1));
              data.put("serviceName", "loader-test-service");
              data.put("completedDescriptions", ThreadLocalRandom.current().nextInt(0, 101));
              data.put("missingDescriptions", ThreadLocalRandom.current().nextInt(0, 51));
              data.put("hasOwner", hasOwner);
              data.put("missingOwner", entityCount - hasOwner);
              data.put("entityCount", entityCount);
              httpPost(
                  DATA_INSIGHTS_PATH, dataInsightBody(baseTs, index, "entityReportData", data));
            });
    summary.recordCreated(EntityKind.ENTITY_REPORT_DATA, createdCount);
  }

  private static void loadWebAnalyticViews(
      final EntityLoadSpec spec,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.WEB_ANALYTIC_VIEW);
    final long baseTs = System.currentTimeMillis();

    final int createdCount =
        submitBatch(
            executor,
            count,
            EntityKind.WEB_ANALYTIC_VIEW,
            index -> {
              final Map<String, Object> data = new HashMap<>();
              data.put("entityType", "table");
              data.put("entityFqn", "loader-test-service.db.public.table_" + index);
              data.put("entityHref", "https://loader.test/table/" + index);
              data.put("owner", "user_" + (index % 50));
              data.put("views", ThreadLocalRandom.current().nextInt(1, 501));
              httpPost(
                  DATA_INSIGHTS_PATH,
                  dataInsightBody(
                      baseTs - (index * 60_000L), 0, "webAnalyticEntityViewReportData", data));
            });
    summary.recordCreated(EntityKind.WEB_ANALYTIC_VIEW, createdCount);
  }

  private static void loadWebAnalyticActivity(
      final EntityLoadSpec spec,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.WEB_ANALYTIC_ACTIVITY);
    final long baseTs = System.currentTimeMillis();

    final int createdCount =
        submitBatch(
            executor,
            count,
            EntityKind.WEB_ANALYTIC_ACTIVITY,
            index -> {
              final long ts = baseTs - (index * 60_000L);
              final Map<String, Object> data = new HashMap<>();
              data.put("userName", "loader_user_" + index);
              data.put("userId", UUID.randomUUID().toString());
              data.put("team", "loader-test-team");
              data.put("totalSessions", ThreadLocalRandom.current().nextInt(1, 21));
              data.put("totalSessionDuration", ThreadLocalRandom.current().nextInt(10, 3601));
              data.put("totalPageView", ThreadLocalRandom.current().nextInt(1, 101));
              data.put("lastSession", ts);
              httpPost(
                  DATA_INSIGHTS_PATH,
                  dataInsightBody(ts, 0, "webAnalyticUserActivityReportData", data));
            });
    summary.recordCreated(EntityKind.WEB_ANALYTIC_ACTIVITY, createdCount);
  }

  private static void loadRawCostAnalysis(
      final EntityLoadSpec spec,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary,
      final LoaderContext ctx) {
    final int count = spec.countOf(EntityKind.RAW_COST_ANALYSIS);
    final long baseTs = System.currentTimeMillis();
    final List<EntityReference> tables = ctx.tables();

    final int createdCount =
        submitBatch(
            executor,
            count,
            EntityKind.RAW_COST_ANALYSIS,
            index -> {
              final Map<String, Object> entityRef = new HashMap<>();
              if (tables.isEmpty()) {
                entityRef.put("id", UUID.randomUUID().toString());
                entityRef.put("type", "table");
                entityRef.put("fullyQualifiedName", "loader-test-service.db.public.table_" + index);
              } else {
                final EntityReference ref = tables.get(index % tables.size());
                entityRef.put("id", ref.getId().toString());
                entityRef.put("type", "table");
                entityRef.put("fullyQualifiedName", ref.getFullyQualifiedName());
              }
              final Map<String, Object> data = new HashMap<>();
              data.put("entity", entityRef);
              data.put("sizeInByte", ThreadLocalRandom.current().nextDouble(100.0, 100_000.0));
              httpPost(
                  DATA_INSIGHTS_PATH,
                  dataInsightBody(
                      baseTs - (index * 86_400_000L), 0, "rawCostAnalysisReportData", data));
            });
    summary.recordCreated(EntityKind.RAW_COST_ANALYSIS, createdCount);
  }

  private static void loadAggCostAnalysis(
      final EntityLoadSpec spec,
      final ExecutorService executor,
      final EntityLoadSummary.Builder summary) {
    final int count = spec.countOf(EntityKind.AGG_COST_ANALYSIS);
    final long baseTs = System.currentTimeMillis();

    final int createdCount =
        submitBatch(
            executor,
            count,
            EntityKind.AGG_COST_ANALYSIS,
            index -> {
              final Map<String, Object> data = new HashMap<>();
              data.put("entityType", "table");
              data.put("serviceName", "loader-test-service");
              data.put("serviceType", "BigQuery");
              data.put("totalSize", ThreadLocalRandom.current().nextDouble(1000.0, 1_000_000.0));
              data.put("totalCount", ThreadLocalRandom.current().nextInt(100, 100_001));
              data.put("unusedDataAssets", costAssetBuckets());
              data.put("frequentlyUsedDataAssets", costAssetBuckets());
              httpPost(
                  DATA_INSIGHTS_PATH,
                  dataInsightBody(
                      baseTs - (index * 86_400_000L), 0, "aggregatedCostAnalysisReportData", data));
            });
    summary.recordCreated(EntityKind.AGG_COST_ANALYSIS, createdCount);
  }

  private static Map<String, Object> dataInsightBody(
      final long timestamp,
      final int index,
      final String reportDataType,
      final Map<String, Object> data) {
    final Map<String, Object> body = new HashMap<>();
    body.put("timestamp", timestamp - (index * 86_400_000L));
    body.put("reportDataType", reportDataType);
    body.put("data", data);
    return body;
  }

  private static Map<String, Object> costAssetBuckets() {
    final Map<String, Object> count = new HashMap<>();
    final Map<String, Object> size = new HashMap<>();
    for (final String window :
        List.of("threeDays", "sevenDays", "fourteenDays", "thirtyDays", "sixtyDays")) {
      count.put(window, ThreadLocalRandom.current().nextInt(1, 51));
      size.put(window, ThreadLocalRandom.current().nextInt(100, 10_001));
    }
    return Map.of(
        "count",
        count,
        "size",
        size,
        "totalSize",
        ThreadLocalRandom.current().nextInt(1000, 100_001),
        "totalCount",
        ThreadLocalRandom.current().nextInt(1, 51));
  }

  private static String randomDoubleStr(final double min, final double max) {
    return String.format("%.2f", ThreadLocalRandom.current().nextDouble(min, max));
  }

  private static void httpPost(final String path, final Map<String, Object> body) {
    SdkClients.adminClient().getHttpClient().execute(HttpMethod.POST, path, body, Void.class);
  }

  // ---------------- Collected-entity context ----------------

  /**
   * Thread-safe accumulator of entities created during a load run, so downstream loaders
   * (lineage, time-series) can reference real IDs/FQNs instead of fabricating them. One
   * instance per {@link #load} invocation; no global state.
   */
  private static final class LoaderContext {
    private final List<EntityReference> tables = Collections.synchronizedList(new ArrayList<>());
    private final List<EntityReference> dashboards =
        Collections.synchronizedList(new ArrayList<>());
    private final List<EntityReference> pipelines = Collections.synchronizedList(new ArrayList<>());
    private final List<String> testCaseFqns = Collections.synchronizedList(new ArrayList<>());

    void recordTable(final Table table) {
      tables.add(makeRef(table.getId(), table.getName(), table.getFullyQualifiedName(), "table"));
    }

    void recordDashboard(final org.openmetadata.schema.entity.data.Dashboard dashboard) {
      dashboards.add(
          makeRef(
              dashboard.getId(),
              dashboard.getName(),
              dashboard.getFullyQualifiedName(),
              "dashboard"));
    }

    void recordPipeline(final org.openmetadata.schema.entity.data.Pipeline pipeline) {
      pipelines.add(
          makeRef(
              pipeline.getId(), pipeline.getName(), pipeline.getFullyQualifiedName(), "pipeline"));
    }

    private static EntityReference makeRef(
        final UUID id, final String name, final String fqn, final String type) {
      // EntityReference.type is @NotNull; the default getEntityReference() pulls it from
      // CANONICAL_ENTITY_NAME_MAP keyed on the runtime class name, which doesn't always
      // round-trip from SDK-returned entities. Set it explicitly so AddLineage and any
      // other downstream consumer doesn't 400 on a null type.
      return new EntityReference()
          .withId(id)
          .withName(name)
          .withFullyQualifiedName(fqn)
          .withType(type);
    }

    void recordTestCase(final org.openmetadata.schema.tests.TestCase testCase) {
      testCaseFqns.add(testCase.getFullyQualifiedName());
    }

    List<EntityReference> tables() {
      return List.copyOf(tables);
    }

    List<EntityReference> dashboards() {
      return List.copyOf(dashboards);
    }

    List<EntityReference> pipelines() {
      return List.copyOf(pipelines);
    }

    List<String> testCaseFqns() {
      return List.copyOf(testCaseFqns);
    }
  }
}
