package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.management.OperatingSystemMXBean;
import java.io.IOException;
import java.io.PrintWriter;
import java.lang.management.ManagementFactory;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicReference;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.platform.engine.discovery.DiscoverySelectors;
import org.junit.platform.launcher.core.LauncherDiscoveryRequestBuilder;
import org.junit.platform.launcher.core.LauncherFactory;
import org.junit.platform.launcher.listeners.SummaryGeneratingListener;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.apps.scheduler.AppScheduler;
import org.openmetadata.service.rdf.RdfRepository;
import org.quartz.JobKey;
import org.quartz.SchedulerException;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;

/** Full catalog rebuild, serving-query and interrupted-rebuild validation. Opt in explicitly. */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
@EnabledIfSystemProperty(named = "rdfCatalogScale", matches = "true")
public class RdfCatalogScaleIT {
  private static final String APP = "/v1/apps/name/RdfIndexApp/runs/latest";
  private static final String OWNS_TEST_SESSION = "rdfScaleOwnsTestSession";
  private static final List<AppRunRecord.Status> TERMINAL =
      List.of(
          AppRunRecord.Status.COMPLETED,
          AppRunRecord.Status.SUCCESS,
          AppRunRecord.Status.FAILED,
          AppRunRecord.Status.ACTIVE_ERROR,
          AppRunRecord.Status.STOPPED);
  private final HttpClient client = SdkClients.adminClient().getHttpClient();
  private final Path output =
      Path.of(System.getProperty("rdfScaleOutput", ".context/rdf-catalog-scale"));
  private final ObjectNode report = JsonUtils.getObjectMapper().createObjectNode();
  private final int samples = Integer.getInteger("rdfScaleQuerySamples", 100);
  private RdfScaleQueries queries;
  private RdfScaleResources resources;

  @Test
  void validateFullCatalogAndInterruptedRebuild(final TestNamespace namespace) throws Exception {
    requireIsolatedDiskStorage();
    pauseScheduledRdfJobs();
    validateCatalog(namespace);
  }

  private static void pauseScheduledRdfJobs() throws SchedulerException {
    final var scheduler = AppScheduler.getInstance().getScheduler();
    final var jobs =
        List.of(
            new JobKey("RdfIndexApp", AppScheduler.APPS_JOB_GROUP),
            new JobKey("RdfInferenceApp", AppScheduler.APPS_JOB_GROUP));
    // The dedicated launcher destroys this session. Resuming missed cron triggers at teardown
    // would start unmeasured inference over the full graph just before destroying its containers.
    for (var job : jobs) scheduler.pauseJob(job);
  }

  private static void requireIsolatedDiskStorage() {
    assertTrue(Boolean.getBoolean(OWNS_TEST_SESSION), "Use the standalone scale launcher");
    assumeTrue(TestSuiteBootstrap.isFusekiEnabled(), "Enable the RDF test infrastructure");
    assertEquals(
        "postgres",
        System.getProperty("databaseType", "postgres"),
        "Scale fixture uses PostgreSQL COPY");
    assertEquals(
        "false",
        System.getProperty("rdfContainerTmpfs", "true"),
        "Scale storage must be disk-backed");
    assertEquals(
        "false",
        System.getProperty("dbContainerTmpfs", "true"),
        "Scale database must be disk-backed");
    assertTrue(Boolean.getBoolean("rdfContainerStablePort"), "Restart requires a stable host port");
    assertNotNull(
        TestSuiteBootstrap.getFusekiContainer(), "Scale tests require isolated containers");
    assertNotNull(
        TestSuiteBootstrap.getDatabaseContainer(), "Scale tests require isolated containers");
  }

  private void validateCatalog(final TestNamespace namespace) throws Exception {
    Files.createDirectories(output);
    final RdfScaleCatalog catalog =
        new RdfScaleCatalog(
            TestSuiteBootstrap.getJdbi(), RdfScaleCatalog.Settings.configured(), namespace);
    final GenericContainer<?> fuseki = TestSuiteBootstrap.getFusekiContainer();
    environment(fuseki, catalog);
    seedCatalog(catalog);
    try (RdfScaleResources monitor =
        new RdfScaleResources(fuseki, TestSuiteBootstrap.getDatabaseContainer(), output)) {
      resources = monitor;
      validateRebuilds(catalog);
    } catch (RuntimeException | Error failure) {
      recordFailure(failure);
      throw failure;
    }
    resources = null;
    restartAndVerify(fuseki, catalog);
    report.put("completedAt", Instant.now().toString());
    checkpoint();
    System.out.println("RDF_SCALE report " + output.resolve("report.json").toAbsolutePath());
  }

  private void recordFailure(final Throwable failure) throws IOException {
    final ObjectNode result = report.putObject("failure");
    result.put("observedAt", Instant.now().toString());
    result.put("type", failure.getClass().getName());
    result.put("message", failure.getMessage());
    if (failure.getCause() != null) {
      result.put("cause", failure.getCause().toString());
    }
    checkpoint();
  }

  private void seedCatalog(final RdfScaleCatalog catalog) throws IOException, SQLException {
    final long seedStart = System.nanoTime();
    catalog.seed();
    report.put("seedSeconds", secondsSince(seedStart));
    queries = new RdfScaleQueries(catalog);
    checkpoint();
  }

  private void validateRebuilds(final RdfScaleCatalog catalog) throws Exception {
    rebuild("local", false);
    final RdfScaleQueries.Snapshot snapshot = verifySnapshot(catalog);
    record("snapshot", snapshot);
    queries.saveSubjectCounts(output.resolve("subjects-local.json"));
    queryBenchmark("after-local");
    interruptRebuild(snapshot);
    rebuildWithServingQueries();
    final var recovered = verifySnapshot(catalog);
    record("snapshotAfterRecovery", recovered);
    queries.saveSubjectCounts(output.resolve("subjects-recovered.json"));
    assertEquals(snapshot, recovered);
    queryBenchmark("after-distributed");
  }

  private void environment(final GenericContainer<?> fuseki, final RdfScaleCatalog catalog)
      throws IOException {
    report.put("startedAt", Instant.now().toString());
    report.put("productionCommit", System.getProperty("rdfScaleCommit", "unspecified"));
    report.put("javaVersion", System.getProperty("java.version"));
    report.put("javaVendor", System.getProperty("java.vendor"));
    report.put("os", System.getProperty("os.name") + " " + System.getProperty("os.arch"));
    report.put("appHeapLimitBytes", Runtime.getRuntime().maxMemory());
    report.put("appProcessors", Runtime.getRuntime().availableProcessors());
    report.put(
        "hostMemoryBytes",
        ManagementFactory.getPlatformMXBean(OperatingSystemMXBean.class).getTotalMemorySize());
    recordContainerEnvironment(fuseki);
    report.put("resourceSampleSeconds", 2);
    report.put("querySamplesPerType", samples);
    report.put("concurrentQueryIntervalSeconds", 5);
    report.put("indexingBatchSize", Integer.getInteger("rdfScaleBatchSize", 1000));
    report.put(
        "bulkLineageEdgeBatchSize",
        TestSuiteBootstrap.getRdfConfiguration().getBulkLineageEdgeBatchSize());
    report.put(
        "maxAppendPayloadBytes",
        TestSuiteBootstrap.getRdfConfiguration().getMaxAppendPayloadBytes());
    report.put(
        "bulkAppendEntityBatchSize",
        TestSuiteBootstrap.getRdfConfiguration().getBulkAppendEntityBatchSize());
    report.put("scheduledRdfJobsPaused", true);
    report.put("schema", catalog.schemaFqn());
    record("workload", catalog.settings());
  }

  private void recordContainerEnvironment(final GenericContainer<?> fuseki) {
    report.put("fusekiImage", fuseki.getDockerImageName());
    report.put("fusekiImageId", fuseki.getContainerInfo().getImageId());
    report.put("fusekiHeapOptions", System.getProperty("rdfContainerJvmArgs", ""));
    report.put("fusekiMemoryLimitBytes", fuseki.getContainerInfo().getHostConfig().getMemory());
    report.put("fusekiNanoCpus", fuseki.getContainerInfo().getHostConfig().getNanoCPUs());
    report.put("databaseDurable", Boolean.getBoolean("dbDurable"));
    report.put("databaseImage", TestSuiteBootstrap.getDatabaseContainer().getDockerImageName());
    report.put(
        "databaseMemoryLimitBytes",
        TestSuiteBootstrap.getDatabaseContainer().getContainerInfo().getHostConfig().getMemory());
    report.put(
        "databaseNanoCpus",
        TestSuiteBootstrap.getDatabaseContainer().getContainerInfo().getHostConfig().getNanoCPUs());
  }

  private AppRunRecord rebuild(final String label, final boolean distributed) throws IOException {
    resources.phase(label);
    final String serving = activeDataset();
    report.putObject(label).put("servingBefore", serving);
    final Long previous = latestStart();
    final long start = System.nanoTime();
    trigger(distributed);
    final AppRunRecord run = awaitRun(previous);
    report.withObject("/" + label).put("terminalObservedSeconds", secondsSince(start));
    awaitIndexingWorkerShutdown(Duration.ofMinutes(12));
    recordRun(label, start, run);
    if (run.getStatus() == AppRunRecord.Status.FAILED) {
      assertEquals(serving, activeDataset(), "A failed rebuild must not promote its partial graph");
    }
    assertTrue(
        run.getStatus() == AppRunRecord.Status.COMPLETED
            || run.getStatus() == AppRunRecord.Status.SUCCESS,
        "RDF scale rebuild failed: " + JsonUtils.pojoToJson(run));
    assertEquals(0, stats(run).path("failedRecords").asLong());
    assertNotEquals(serving, activeDataset(), "A successful blue/green rebuild must promote");
    System.out.printf("RDF_SCALE %s complete %.1fs %s%n", label, secondsSince(start), stats(run));
    return run;
  }

  private void recordRun(final String label, final long start, final AppRunRecord run)
      throws IOException {
    final ObjectNode measurement = report.withObject("/" + label);
    measurement.put("observedSeconds", secondsSince(start));
    measurement.put("appSeconds", (run.getEndTime() - run.getStartTime()) / 1000.0);
    measurement.put("servingDataset", activeDataset());
    measurement.set("run", JsonUtils.valueToTree(run));
    measurement.set("resources", JsonUtils.valueToTree(resources.peaks()));
    checkpoint();
  }

  private void rebuildWithServingQueries() throws Exception {
    final CountDownLatch stop = new CountDownLatch(1);
    try (var executor = Executors.newSingleThreadExecutor()) {
      final Future<Map<String, RdfScaleQueries.Latency>> concurrent =
          executor.submit(
              () ->
                  queries.measureDuringRebuild(
                      output.resolve("queries-during-recovery.jsonl"), stop));
      try {
        rebuild("distributed-recovery", true);
      } finally {
        stop.countDown();
      }
      final var measurements = concurrent.get();
      RdfScaleQueries.assertSuccessful(measurements);
      record("queriesDuringRecovery", measurements);
    }
  }

  private void interruptRebuild(final RdfScaleQueries.Snapshot snapshot) throws IOException {
    resources.phase("interrupted");
    final String serving = activeDataset();
    final Long previous = latestStart();
    final long start = System.nanoTime();
    trigger(true);
    awaitPartialRebuild(previous);
    client.execute(HttpMethod.POST, "/v1/apps/stop/RdfIndexApp", null, Void.class);
    final AppRunRecord stopped = awaitRun(previous);
    assertEquals(AppRunRecord.Status.STOPPED, stopped.getStatus());
    awaitIndexingWorkerShutdown(Duration.ofMinutes(2));
    assertEquals(
        serving, activeDataset(), "Interrupted builds must retain the complete serving dataset");
    assertEquals(snapshot, queries.snapshot(), "Interruption changed the served graph");
    recordInterruption(serving, start, stopped);
  }

  private void awaitIndexingWorkerShutdown(final Duration timeout) {
    // Terminal status can precede compaction and release of the build lease.
    Awaitility.await("RDF workers finish and release their rebuild lease")
        .atMost(timeout)
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              resources.check();
              return AppScheduler.getInstance().getScheduler().getCurrentlyExecutingJobs().stream()
                  .noneMatch(
                      context ->
                          context
                                  .getJobDetail()
                                  .getKey()
                                  .getGroup()
                                  .equals(AppScheduler.APPS_JOB_GROUP)
                              && context
                                  .getJobDetail()
                                  .getKey()
                                  .getName()
                                  .startsWith("RdfIndexApp"));
            });
  }

  private void awaitPartialRebuild(final Long previous) {
    Awaitility.await("Rebuild has written a partial target")
        .atMost(Duration.ofMinutes(10))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              resources.check();
              final AppRunRecord run = latest();
              if (!isNew(run, previous)) return false;
              assertFalseTerminal(run);
              return stats(run).path("successRecords").asLong() >= 100;
            });
  }

  private void recordInterruption(
      final String serving, final long start, final AppRunRecord stopped) throws IOException {
    final ObjectNode interruption = report.putObject("interruption");
    interruption.put("seconds", secondsSince(start));
    interruption.put("servingDatasetBefore", serving);
    interruption.put("servingDatasetAfter", activeDataset());
    interruption.set("run", JsonUtils.valueToTree(stopped));
    interruption.set("resources", JsonUtils.valueToTree(resources.peaks()));
    checkpoint();
  }

  private static void assertFalseTerminal(final AppRunRecord run) {
    assertTrue(
        !TERMINAL.contains(run.getStatus()),
        "Rebuild completed before cancellation could be exercised");
  }

  private void restartAndVerify(final GenericContainer<?> fuseki, final RdfScaleCatalog catalog)
      throws IOException, InterruptedException {
    final String serving = activeDataset();
    final var before = queries.snapshot();
    final long start = System.nanoTime();
    fuseki.getDockerClient().restartContainerCmd(fuseki.getContainerId()).withTimeout(30).exec();
    Wait.forHttp("/$/ping")
        .forPort(3030)
        .forStatusCode(200)
        .withStartupTimeout(Duration.ofMinutes(2))
        .waitUntilReady(fuseki);
    assertEquals(serving, activeDataset());
    final var after = verifySnapshot(catalog);
    record("snapshotAfterRestart", after);
    assertEquals(before, after, "Fuseki restart changed the persisted graph");
    report.put("fusekiRestartAndVerificationSeconds", secondsSince(start));
    queryBenchmark("after-restart");
  }

  private RdfScaleQueries.Snapshot verifySnapshot(final RdfScaleCatalog catalog) {
    final var snapshot = queries.snapshot();
    final long expectedTables =
        TestSuiteBootstrap.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT COUNT(*) FROM table_entity WHERE deleted = false")
                        .mapTo(Long.class)
                        .one());
    assertEquals(expectedTables, snapshot.tables());
    assertEquals(catalog.settings().edges(), snapshot.upstream());
    assertEquals(catalog.settings().edges(), snapshot.downstream());
    assertEquals(catalog.settings().edges(), snapshot.provenance());
    assertEquals(
        Math.ceilDiv(catalog.settings().tables(), 1000) * 2L, snapshot.extensionProperties());
    assertEquals(
        Math.ceilDiv(catalog.settings().edges(), catalog.settings().detailedEvery()),
        snapshot.details());
    return snapshot;
  }

  private void queryBenchmark(final String label) throws IOException, InterruptedException {
    if (resources != null) resources.phase("queries-" + label);
    final var results = queries.measure(output.resolve("queries-" + label + ".jsonl"), samples);
    RdfScaleQueries.assertSuccessful(results);
    record("queries-" + label, results);
  }

  private void trigger(final boolean distributed) {
    client.execute(
        HttpMethod.POST,
        "/v1/apps/trigger/RdfIndexApp",
        Map.of(
            "entities",
            List.of("all"),
            "recreateIndex",
            true,
            "blueGreenRebuild",
            true,
            "batchSize",
            Integer.getInteger("rdfScaleBatchSize", 1000),
            "producerThreads",
            Integer.getInteger("rdfScaleProducerThreads", 2),
            "consumerThreads",
            3,
            "queueSize",
            5000,
            "useDistributedIndexing",
            distributed,
            "partitionSize",
            Integer.getInteger("rdfScalePartitionSize", 10_000)),
        Void.class);
  }

  private AppRunRecord awaitRun(final Long previous) {
    final AtomicReference<AppRunRecord> result = new AtomicReference<>();
    Awaitility.await("RDF scale run terminal state")
        .atMost(Duration.ofMinutes(120))
        .pollInterval(Duration.ofSeconds(2))
        .until(
            () -> {
              resources.check();
              final AppRunRecord run = latest();
              if (isNew(run, previous) && TERMINAL.contains(run.getStatus())) {
                result.set(run);
                return true;
              }
              return false;
            });
    return result.get();
  }

  private Long latestStart() {
    final AppRunRecord run = latest();
    return run == null ? null : run.getStartTime();
  }

  private AppRunRecord latest() {
    return client.execute(HttpMethod.GET, APP, null, AppRunRecord.class);
  }

  private static boolean isNew(final AppRunRecord run, final Long previous) {
    return run != null
        && run.getStartTime() != null
        && (previous == null || run.getStartTime() > previous);
  }

  private static String activeDataset() {
    return RdfRepository.getInstance().activeDatasetName();
  }

  private static JsonNode stats(final AppRunRecord run) {
    final JsonNode json = JsonUtils.valueToTree(run);
    final JsonNode success = json.path("successContext").path("stats").path("jobStats");
    return success.isMissingNode()
        ? json.path("failureContext").path("stats").path("jobStats")
        : success;
  }

  private void record(final String key, final Object value) throws IOException {
    report.set(key, JsonUtils.valueToTree(value));
    checkpoint();
  }

  private void checkpoint() throws IOException {
    Files.writeString(
        output.resolve("report.json"),
        JsonUtils.getObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(report));
  }

  private static double secondsSince(final long start) {
    return (System.nanoTime() - start) / 1e9;
  }

  public static void main(final String[] args) {
    System.setProperty(OWNS_TEST_SESSION, Boolean.TRUE.toString());
    final var listener = new SummaryGeneratingListener();
    try (var session = LauncherFactory.openSession()) {
      session
          .getLauncher()
          .execute(
              LauncherDiscoveryRequestBuilder.request()
                  .selectors(DiscoverySelectors.selectClass(RdfCatalogScaleIT.class))
                  .build(),
              listener);
    }
    listener.getSummary().printTo(new PrintWriter(System.out));
    listener.getSummary().printFailuresTo(new PrintWriter(System.out));
    System.exit(
        listener.getSummary().getTestsSucceededCount() == 1
                && listener.getSummary().getTotalFailureCount() == 0
            ? 0
            : 1);
  }
}
