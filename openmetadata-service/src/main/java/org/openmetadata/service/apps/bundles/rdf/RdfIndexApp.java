package org.openmetadata.service.apps.bundles.rdf;

import static org.openmetadata.service.apps.scheduler.AppScheduler.ON_DEMAND_JOB;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_CONFIG;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_RUN_STATS;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.TRIGGER_TYPE_KEY;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.WEBSOCKET_STATUS_CHANNEL;
import static org.openmetadata.service.socket.WebSocketManager.RDF_INDEX_JOB_BROADCAST_CHANNEL;

import io.micrometer.core.instrument.Metrics;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.bundles.rdf.sink.RdfBulkSink;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.ServerIdentityResolver;
import org.openmetadata.service.exception.AppException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.monitoring.OntologyMetrics;
import org.openmetadata.service.rdf.RdfBackgroundScheduler;
import org.openmetadata.service.rdf.RdfExcludedEntities;
import org.openmetadata.service.rdf.RdfProjectionHealth;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.rebuild.RdfDatasetManager.BuildTarget;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.quartz.JobExecutionContext;

@Slf4j
public class RdfIndexApp extends AbstractNativeApplication {
  private static final String ALL = "all";
  private static final int DEFAULT_BATCH_SIZE = 100;
  private static final int DEFAULT_READER_THREADS = 4;
  private static final int MAX_READER_THREADS = 10;
  private static final long WEBSOCKET_UPDATE_INTERVAL_MS = 2000;
  private static final long HEARTBEAT_INTERVAL_SECONDS = 30;

  private static final Set<String> EXCLUDED_ENTITY_TYPES =
      RdfExcludedEntities.EXCLUDED_ENTITY_TYPES;

  private static final String METRIC_RDF_INDEX_JOB = "rdf.index.job";
  private static final String TAG_OUTCOME = "outcome";
  private static final double DEFAULT_MIN_SUCCESS_RATIO = 0.95d;

  // Not final: resolved lazily via rdf() so the app can still be constructed when RDF
  // is disabled at startup and enabled later.
  private RdfRepository rdfRepository;
  private RdfBatchProcessor batchProcessor;

  // Package-private so tests can replace the guard with a fake; production wiring
  // happens in the constructor.
  RdfReindexAdmissionGuard admissionGuard;

  // The repository used by the current run, retained so run teardown can clear the
  // auto-tune payload-budget override on exactly the instance that received it.
  private volatile RdfRepository runRepository;
  // Non-null only while a blue/green rebuild is populating an idle dataset; cleared once the
  // rebuild is promoted or abandoned.
  private volatile String buildDataset;
  // Identifies this run in the reindex lock and in its failure records.
  private volatile UUID runId;
  private volatile RdfReindexRunLock runLock;
  private volatile ScheduledFuture<?> heartbeat;
  private volatile RuntimeException rebuildLeaseFailure;
  private long initialProjectionFailureVersion;
  private boolean rebuildsEntireProjection;
  private volatile boolean stopped = false;
  private volatile long lastWebSocketUpdate = 0;

  @Getter private EventPublisherJob jobData;
  private JobExecutionContext jobExecutionContext;
  private final AtomicReference<Stats> rdfIndexStats = new AtomicReference<>();

  public RdfIndexApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
    this.rdfRepository = RdfRepository.getInstanceOrNull();
    this.batchProcessor =
        this.rdfRepository == null
            ? null
            : new RdfBatchProcessor(collectionDAO, this.rdfRepository);
    this.admissionGuard = RdfReindexAdmissionGuard.forProduction(collectionDAO);
  }

  private RdfRepository rdf() {
    if (rdfRepository == null) {
      rdfRepository = RdfRepository.getInstance();
      batchProcessor = new RdfBatchProcessor(collectionDAO, rdfRepository);
    }
    return rdfRepository;
  }

  @Override
  public void init(App app) {
    super.init(app);
    jobData = JsonUtils.convertValue(app.getAppConfiguration(), EventPublisherJob.class);
  }

  @Override
  public void execute(JobExecutionContext jobExecutionContext) {
    long jobStartNanos = System.nanoTime();
    try {
      executeInternal(jobExecutionContext);
    } finally {
      String outcome =
          jobData != null && jobData.getStatus() != null ? jobData.getStatus().value() : "unknown";
      Metrics.timer(METRIC_RDF_INDEX_JOB, TAG_OUTCOME, outcome)
          .record(System.nanoTime() - jobStartNanos, TimeUnit.NANOSECONDS);
    }
  }

  private void executeInternal(JobExecutionContext jobExecutionContext) {
    this.jobExecutionContext = jobExecutionContext;
    stopped = false;

    if (jobData == null) {
      String appConfigJson =
          (String) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_CONFIG);
      if (appConfigJson != null) {
        jobData = JsonUtils.readValue(appConfigJson, EventPublisherJob.class);
      } else if (getApp() != null && getApp().getAppConfiguration() != null) {
        jobData = JsonUtils.convertValue(getApp().getAppConfiguration(), EventPublisherJob.class);
      } else {
        LOG.error("Unable to initialize jobData from JobDataMap or App configuration");
        throw new IllegalStateException("JobData is not initialized");
      }
    }

    if (!rdf().isEnabled()) {
      LOG.error("RDF Repository is not enabled. Please enable RDF in configuration.");
      updateJobStatus(EventPublisherJob.Status.FAILED);
      jobData.setFailure(
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.JOB)
              .withMessage("RDF Repository is not enabled"));
      sendUpdates(jobExecutionContext, true);
      return;
    }

    if (!admitAgainstSearchReindex(jobExecutionContext)) {
      return;
    }

    try {
      rdf().ensureStorageReady();
    } catch (Exception e) {
      LOG.error("RDF storage is not ready; aborting indexing job", e);
      updateJobStatus(EventPublisherJob.Status.FAILED);
      jobData.setFailure(
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.JOB)
              .withMessage("RDF storage is not ready: " + e.getMessage()));
      sendUpdates(jobExecutionContext, true);
      return;
    }

    String jobName = jobExecutionContext.getJobDetail().getKey().getName();
    if (jobName.equals(ON_DEMAND_JOB)) {
      Map<String, Object> jsonAppConfig = JsonUtils.convertValue(jobData, Map.class);
      getApp().setAppConfiguration(jsonAppConfig);
    }

    try {
      acquireRunLock();
      initialProjectionFailureVersion = RdfProjectionHealth.failureVersion();
      jobData.setRdfBuildDataset(null);
      jobData.setRdfRebuildId(null);
      rebuildLeaseFailure = null;
      jobData.setEntities(resolveEntityTypes(jobData.getEntities()));
      rebuildsEntireProjection =
          Boolean.TRUE.equals(jobData.getRecreateIndex())
              && jobData.getEntities().containsAll(getAll());
      if (jobData.getEntities().isEmpty()) {
        throw new IllegalStateException(
            "No repository-backed entity types configured for RDF indexing");
      }
      buildDataset = resolveBlueGreenBuildDataset();
      RdfRepository indexingRepository = rdf().forRun(buildDataset, jobData.getRdfRebuildId(), 0);
      runRepository = indexingRepository;
      RdfAutoTune.applyTo(jobData, indexingRepository);
      startHeartbeat();
      batchProcessor =
          new RdfBatchProcessor(
              collectionDAO,
              indexingRepository,
              RdfIndexingRunContext.forJob(jobData).withJobIdentity(runId, serverId()));

      LOG.info(
          "RDF Index Job Started for Entities: {}, RecreateIndex: {}, BuildDataset: {}",
          jobData.getEntities(),
          jobData.getRecreateIndex(),
          buildDataset != null ? buildDataset : "<serving>");

      initializeJob(jobExecutionContext);

      if (buildDataset != null) {
        prepareBuildDataset(indexingRepository, buildDataset);
      } else if (Boolean.TRUE.equals(jobData.getRecreateIndex())) {
        LOG.info("Clearing existing RDF data");
        clearRdfData();
      }

      updateJobStatus(EventPublisherJob.Status.RUNNING);
      reindex(indexingRepository);

      if (stopped) {
        updateJobStatus(EventPublisherJob.Status.STOPPED);
        abandonBuildDataset();
      } else {
        final boolean promoted = promoteBuildDataset(indexingRepository);
        updateJobStatus(EventPublisherJob.Status.COMPLETED);
        if (!promoted) {
          // In-place indexing reports completion before potentially lengthy disk maintenance.
          compactStorageBestEffort(indexingRepository);
        }
      }

      LOG.info("RDF Index Job Completed for Entities: {}", jobData.getEntities());
    } catch (Exception ex) {
      abandonBuildDataset();
      if (stopped) {
        LOG.info("RDF Index Job Stopped for Entities: {}", jobData.getEntities());
        jobData.setStatus(EventPublisherJob.Status.STOPPED);
      } else {
        handleJobFailure(ex);
      }
    } finally {
      stopHeartbeat();
      releaseRunLock();
      clearAutoTuneOverride();
      sendUpdates(jobExecutionContext, true);
    }
  }

  private void clearAutoTuneOverride() {
    RdfRepository repository = runRepository;
    runRepository = null;
    if (repository != null) {
      repository.clearAppendPayloadBudgetOverride();
    }
  }

  private void acquireRunLock() {
    runId = UUID.randomUUID();
    runLock =
        RdfReindexRunLock.forRun(collectionDAO.rdfReindexLockDAO(), runId.toString(), serverId());
    runLock.acquire();
  }

  private void releaseRunLock() {
    final RdfReindexRunLock lock = runLock;
    runLock = null;
    if (lock != null) {
      lock.release();
    }
  }

  private static String serverId() {
    return ServerIdentityResolver.getInstance().getServerId();
  }

  /**
   * Cron-triggered runs defer while a Search reindex is active — two concurrent full entity-table
   * scans thrash the database. On-demand runs bypass the guard (operator intent wins) but log the
   * contention. Returns false when the run was deferred past the guard's window and ended STOPPED.
   */
  private boolean admitAgainstSearchReindex(JobExecutionContext jobExecutionContext) {
    boolean admitted = true;
    String triggerType =
        (String) jobExecutionContext.getJobDetail().getJobDataMap().get(TRIGGER_TYPE_KEY);
    if (ON_DEMAND_JOB.equals(triggerType)) {
      admissionGuard
          .currentContention()
          .ifPresent(
              contention ->
                  LOG.warn(
                      "Starting on-demand RDF reindex despite active search reindex ({}); "
                          + "concurrent full entity scans will degrade both jobs",
                      contention));
    } else if (admissionGuard.currentContention().isPresent()) {
      RdfReindexAdmissionGuard.AdmissionResult result = admissionGuard.awaitAdmission();
      if (!result.admitted()) {
        markRunDeferred(jobExecutionContext, result);
        admitted = false;
      }
    }
    return admitted;
  }

  private void markRunDeferred(
      JobExecutionContext jobExecutionContext, RdfReindexAdmissionGuard.AdmissionResult result) {
    String message =
        String.format(
            "RDF reindex deferred to avoid concurrent full entity-table scans and aborted after "
                + "%d minutes: %s. It will run at the next scheduled time, or trigger it manually "
                + "to override the guard.",
            TimeUnit.MILLISECONDS.toMinutes(result.waitedMs()), result.contention());
    LOG.warn(message);
    updateJobStatus(EventPublisherJob.Status.STOPPED);
    jobData.setFailure(
        new IndexingError().withErrorSource(IndexingError.ErrorSource.JOB).withMessage(message));
    sendUpdates(jobExecutionContext, true);
  }

  private void compactStorageBestEffort(final RdfRepository repository) {
    // TDB2 copies index pages on every write transaction, including append-only rebuilds.
    // Failure to reclaim obsolete pages does not invalidate the indexed graph.
    try {
      repository.compactStorage();
    } catch (RuntimeException compactFailure) {
      LOG.warn(
          "RDF index compaction failed; disk reclamation skipped. Reason: {}",
          compactFailure.getMessage(),
          compactFailure);
    }
  }

  private void initializeJob(JobExecutionContext jobExecutionContext) {
    LOG.debug("Executing RDF Indexing Job with JobData: {}", jobData);
    updateJobStatus(EventPublisherJob.Status.RUNNING);

    LOG.debug("Initializing job statistics.");
    rdfIndexStats.set(initializeTotalRecords(jobData.getEntities()));
    jobData.setStats(rdfIndexStats.get());

    cleanupPreviousRunFailures();

    // bulkAddGlossaryTermRelations has no per-batch DELETE side, so stale
    // glossary-term relations would accumulate forever across reindex runs.
    // When recreateIndex=true clearAll() already wipes everything, so we
    // only need this targeted cleanup on incremental runs.
    //
    // Let the failure propagate: clearAllGlossaryTermRelations rethrows on
    // failure precisely so the indexer can fail loudly instead of silently
    // marking a job successful while the graph still has stale predicates.
    // The outer try/catch in execute() will set the run status to FAILED.
    if (!Boolean.TRUE.equals(jobData.getRecreateIndex())
        && jobData.getEntities() != null
        && jobData.getEntities().contains(Entity.GLOSSARY_TERM)) {
      LOG.info("Clearing existing glossary term relations before re-indexing");
      rdf().clearAllGlossaryTermRelations();
    }

    sendUpdates(jobExecutionContext, true);
  }

  /**
   * Drop failure records from earlier runs so the table stays bounded by a single run's failures
   * rather than growing forever, and so an operator inspecting failures after a run sees only that
   * run's. Safe to wipe wholesale: the reindex lock prevents two RDF index jobs from overlapping.
   * Best-effort — a cleanup problem must not stop an indexing run from starting.
   */
  private void cleanupPreviousRunFailures() {
    try {
      int deleted = collectionDAO.rdfIndexFailureDAO().deleteAll();
      if (deleted > 0) {
        LOG.info("Cleaned up {} RDF index failure record(s) from previous runs", deleted);
      }
    } catch (Exception e) {
      LOG.warn("Could not clean up RDF index failure records from previous runs", e);
    }
  }

  /** Picks the idle dataset and generation every write of this run targets. */
  private String resolveBlueGreenBuildDataset() {
    if (!Boolean.TRUE.equals(jobData.getRecreateIndex())
        || !Boolean.TRUE.equals(jobData.getBlueGreenRebuild())) {
      return null;
    }
    if (!rdf().supportsBlueGreenRebuild()) {
      throw new IllegalStateException(
          "Blue/green RDF rebuilds are unsupported by this storage backend");
    }
    final BuildTarget target = rdf().beginBlueGreenRebuild();
    jobData.setRdfBuildDataset(target.dataset());
    jobData.setRdfRebuildId(target.id());
    return target.dataset();
  }

  /** Renews the run lock, and a blue/green run's dataset lease, until the run ends. */
  private void startHeartbeat() {
    final RdfReindexRunLock lock = runLock;
    final BuildTarget target =
        buildDataset == null ? null : new BuildTarget(jobData.getRdfRebuildId(), buildDataset);
    heartbeat =
        RdfBackgroundScheduler.getInstance()
            .scheduleWithFixedDelay(
                () -> renewLeases(lock, target),
                HEARTBEAT_INTERVAL_SECONDS,
                HEARTBEAT_INTERVAL_SECONDS,
                TimeUnit.SECONDS);
  }

  private void renewLeases(final RdfReindexRunLock lock, final BuildTarget target) {
    try {
      lock.renew();
    } catch (RuntimeException exception) {
      LOG.warn(
          "Could not renew the RDF reindex lock; it expires unless a later renewal succeeds",
          exception);
    }
    if (target != null) {
      try {
        rdf().renewBuild(target);
      } catch (RuntimeException exception) {
        rebuildLeaseFailure = exception;
        LOG.error("RDF rebuild lost its dataset lease", exception);
      }
    }
  }

  private void stopHeartbeat() {
    if (heartbeat != null) {
      heartbeat.cancel(false);
      heartbeat = null;
    }
  }

  /** Reuse the idle alternate only after the shared generation fence has been acquired. */
  private void prepareBuildDataset(RdfRepository indexingRepository, String targetDataset) {
    LOG.info("Preparing blue/green build dataset '{}'", targetDataset);
    indexingRepository.clearAll();
    indexingRepository.compactStorage();
    indexingRepository.reloadOntologies();
    LOG.info("Build dataset '{}' is empty and ontology-seeded", targetDataset);
  }

  /** Validate the rebuild before replaying live changes and atomically switching serving. */
  private boolean promoteBuildDataset(RdfRepository indexingRepository) {
    if (buildDataset == null) {
      return false;
    }
    checkBuildCanPromote();
    long triples = indexingRepository.getTripleCount();
    long successRecords = successRecordsSoFar();
    if (successRecords > 0 && triples <= 0) {
      throw new IllegalStateException(
          String.format(
              "Refusing to activate RDF dataset '%s': indexed %d records but the dataset reports "
                  + "%d triples",
              buildDataset, successRecords, triples));
    }
    requirePromotionSuccessRatio(successRecords);
    // Compact the target while live writers still use the serving dataset.
    compactStorageBestEffort(indexingRepository);
    checkBuildCanPromote();
    rdf()
        .activateDataset(
            buildDataset,
            jobData.getRdfRebuildId(),
            getApp() != null ? getApp().getName() : "system");
    LOG.info(
        "Activated RDF dataset '{}' ({} triples before live mutation replay).",
        buildDataset,
        triples);
    buildDataset = null;
    return true;
  }

  private void checkBuildCanPromote() {
    if (stopped) {
      throw new CancellationException("RDF rebuild was stopped before promotion");
    }
    if (rebuildLeaseFailure != null) {
      throw new IllegalStateException("RDF rebuild lost its dataset lease", rebuildLeaseFailure);
    }
  }

  /**
   * Blue/green promotion gate: refuse to flip the serving pointer when the rebuild lost more than
   * the configured fraction of records — the old dataset keeps serving and the run fails visibly
   * instead of silently promoting a hollow graph. Skipped when totals are unavailable (an
   * accounting gap must not veto an otherwise successful rebuild).
   */
  private void requirePromotionSuccessRatio(long successRecords) {
    long totalRecords = totalRecordsSoFar();
    double minSuccessRatio =
        jobData.getMinSuccessRatio() != null
            ? jobData.getMinSuccessRatio()
            : DEFAULT_MIN_SUCCESS_RATIO;
    if (totalRecords > 0 && (double) successRecords / totalRecords < minSuccessRatio) {
      throw new IllegalStateException(
          String.format(
              "Refusing to activate RDF dataset '%s': success ratio %.4f (%d/%d) is below "
                  + "minSuccessRatio %.2f. The previous dataset keeps serving.",
              buildDataset,
              (double) successRecords / totalRecords,
              successRecords,
              totalRecords,
              minSuccessRatio));
    }
  }

  private long totalRecordsSoFar() {
    Stats stats = rdfIndexStats.get();
    StepStats jobStats = stats != null ? stats.getJobStats() : null;
    Integer totalRecords = jobStats != null ? jobStats.getTotalRecords() : null;
    return totalRecords != null ? totalRecords : 0L;
  }

  /**
   * Success count so far, or 0 when stats are unavailable. Never throws: an accounting gap must not
   * turn a successful rebuild into a failed job.
   */
  private long successRecordsSoFar() {
    Stats stats = rdfIndexStats.get();
    StepStats jobStats = stats != null ? stats.getJobStats() : null;
    Integer successRecords = jobStats != null ? jobStats.getSuccessRecords() : null;
    return successRecords != null ? successRecords : 0L;
  }

  /**
   * Leave the serving pointer untouched after a failed or stopped rebuild. The half-built dataset
   * is retained rather than deleted so it can be inspected; the next rebuild clears it before
   * reuse.
   */
  private void abandonBuildDataset() {
    if (buildDataset != null) {
      try {
        rdf().abandonBuild(new BuildTarget(jobData.getRdfRebuildId(), buildDataset));
      } catch (RuntimeException exception) {
        LOG.error("Could not release the failed RDF rebuild; its lease will expire", exception);
      }
      LOG.warn(
          "RDF rebuild did not complete; serving dataset unchanged and build dataset '{}' left "
              + "in place for inspection",
          buildDataset);
      buildDataset = null;
    }
  }

  private void clearRdfData() {
    try {
      rdf().clearAll();
      LOG.info("Cleared all RDF data");
      // CLEAR ALL is a logical delete on TDB2: triples are marked free but the
      // on-disk dataset and journal keep growing across runs. Compact NOW while
      // the dataset is essentially empty so the next re-ingest writes into a
      // fresh, small dataset directory. Without this, every recreateIndex run
      // accumulates ~1x the dataset size on disk and the PVC eventually fills.
      // Must run BEFORE reloadOntologies(), otherwise the ontology graph gets
      // copied through compaction unnecessarily.
      rdf().compactStorage();
      // CLEAR ALL wipes the ontology and shapes graphs as well; reload them
      // before indexing starts so SPARQL queries that depend on the ontology
      // (inference, federated, etc.) work after the wipe.
      rdf().reloadOntologies();
    } catch (Exception e) {
      LOG.error("Failed to clear RDF data", e);
      throw new RuntimeException("Failed to clear RDF data", e);
    }
  }

  private void reindex(final RdfRepository indexingRepository) throws InterruptedException {
    try (RdfBulkSink sink = new RdfBulkSink(indexingRepository, batchProcessor, () -> stopped)) {
      new RdfReindexer(
              sink::submit,
              RdfReindexer::repositoryPages,
              new RunListener(),
              batchSize(),
              readerThreads())
          .index(jobData.getEntities());
    }
  }

  private int batchSize() {
    return jobData.getBatchSize() != null ? jobData.getBatchSize() : DEFAULT_BATCH_SIZE;
  }

  /** {@code producerThreads} is the configured number of threads loading entities to index. */
  private int readerThreads() {
    return jobData.getProducerThreads() != null
        ? Math.clamp(jobData.getProducerThreads(), 1, MAX_READER_THREADS)
        : DEFAULT_READER_THREADS;
  }

  private final class RunListener implements RdfReindexer.Listener {
    @Override
    public boolean isStopRequested() {
      return stopped;
    }

    @Override
    public void onPageRead() {
      sendUpdates(jobExecutionContext, false);
    }

    @Override
    public void onBatchWritten(final String entityType, final StepStats batch) {
      updateEntityStats(entityType, batch);
    }

    @Override
    public void onBatchFailed(
        final String entityType, final int failedRecords, final String reason) {
      recordIndexingFailure(entityType, failedRecords, reason);
    }

    @Override
    public void onRowDropped(final String entityType, final String reason) {
      batchProcessor.recordReaderFailure(entityType, reason);
    }

    @Override
    public void onEntityTypeUnreadable(
        final String entityType, final long rowsRead, final String reason) {
      final StepStats entityStats =
          rdfIndexStats.get().getEntityStats().getAdditionalProperties().get(entityType);
      final int unread =
          entityStats == null ? 0 : (int) Math.max(0, entityStats.getTotalRecords() - rowsRead);
      updateEntityStats(
          entityType, new StepStats().withSuccessRecords(0).withFailedRecords(unread));
      recordIndexingFailure(entityType, unread, "could not read them: " + reason);
    }
  }

  private void recordIndexingFailure(String entityType, int failedCount, String errorMessage) {
    String message =
        String.format(
            "%d record(s) failed for entity type %s: %s",
            failedCount, entityType, errorMessage != null ? errorMessage : "");
    if (jobData.getFailure() == null) {
      jobData.setFailure(
          new IndexingError().withErrorSource(IndexingError.ErrorSource.JOB).withMessage(message));
    }
  }

  private Stats initializeTotalRecords(Set<String> entities) {
    Stats stats = new Stats();
    stats.setEntityStats(new EntityStats());

    int total = 0;
    for (String entityType : entities) {
      int entityTotal = getTotalEntityRecords(entityType);
      total += entityTotal;

      StepStats entityStats = new StepStats();
      entityStats.setTotalRecords(entityTotal);
      entityStats.setSuccessRecords(0);
      entityStats.setFailedRecords(0);

      stats.getEntityStats().getAdditionalProperties().put(entityType, entityStats);
      LOG.debug("Set Total Records for entityType '{}': {}", entityType, entityTotal);
    }

    StepStats jobStats = new StepStats();
    jobStats.setTotalRecords(total);
    jobStats.setSuccessRecords(0);
    jobStats.setFailedRecords(0);
    stats.setJobStats(jobStats);

    return stats;
  }

  private int getTotalEntityRecords(String entityType) {
    try {
      EntityRepository<?> repository = Entity.getEntityRepository(entityType);
      return repository.getDao().listTotalCount();
    } catch (Exception e) {
      LOG.error("Error getting total count for entity type {}", entityType, e);
      return 0;
    }
  }

  private static long nullSafe(Long value) {
    return value == null ? 0L : value;
  }

  private synchronized void updateEntityStats(String entityType, StepStats currentEntityStats) {
    Stats stats = rdfIndexStats.get();
    if (stats == null) {
      return;
    }

    StepStats entityStats = stats.getEntityStats().getAdditionalProperties().get(entityType);
    if (entityStats != null) {
      entityStats.withSuccessRecords(
          entityStats.getSuccessRecords() + currentEntityStats.getSuccessRecords());
      entityStats.withFailedRecords(
          entityStats.getFailedRecords() + currentEntityStats.getFailedRecords());
      entityStats.withReaderTimeMs(
          nullSafe(entityStats.getReaderTimeMs()) + nullSafe(currentEntityStats.getReaderTimeMs()));
      entityStats.withSinkTimeMs(
          nullSafe(entityStats.getSinkTimeMs()) + nullSafe(currentEntityStats.getSinkTimeMs()));
      entityStats.withProcessTimeMs(
          nullSafe(entityStats.getProcessTimeMs())
              + nullSafe(currentEntityStats.getProcessTimeMs()));
      entityStats.withTotalTimeMs(
          nullSafe(entityStats.getReaderTimeMs())
              + nullSafe(entityStats.getProcessTimeMs())
              + nullSafe(entityStats.getSinkTimeMs()));
    }

    StepStats jobStats = stats.getJobStats();
    int totalSuccess =
        stats.getEntityStats().getAdditionalProperties().values().stream()
            .mapToInt(StepStats::getSuccessRecords)
            .sum();
    int totalFailed =
        stats.getEntityStats().getAdditionalProperties().values().stream()
            .mapToInt(StepStats::getFailedRecords)
            .sum();

    long totalReaderTimeMs =
        stats.getEntityStats().getAdditionalProperties().values().stream()
            .mapToLong(stat -> nullSafe(stat.getReaderTimeMs()))
            .sum();

    long totalSinkTimeMs =
        stats.getEntityStats().getAdditionalProperties().values().stream()
            .mapToLong(stat -> nullSafe(stat.getSinkTimeMs()))
            .sum();

    long totalProcessTimeMs =
        stats.getEntityStats().getAdditionalProperties().values().stream()
            .mapToLong(stat -> nullSafe(stat.getProcessTimeMs()))
            .sum();

    jobStats
        .withSuccessRecords(totalSuccess)
        .withFailedRecords(totalFailed)
        .withReaderTimeMs(totalReaderTimeMs)
        .withProcessTimeMs(totalProcessTimeMs)
        .withSinkTimeMs(totalSinkTimeMs)
        .withTotalTimeMs(totalReaderTimeMs + totalProcessTimeMs + totalSinkTimeMs);

    rdfIndexStats.set(stats);
    jobData.setStats(stats);
  }

  private void updateJobStatus(EventPublisherJob.Status newStatus) {
    final EventPublisherJob.Status currentStatus = jobData.getStatus();
    final boolean canUpdate =
        !stopped
            || newStatus == EventPublisherJob.Status.STOP_IN_PROGRESS
            || newStatus == EventPublisherJob.Status.STOPPED;
    if (canUpdate) {
      LOG.info("Updating job status from {} to {}", currentStatus, newStatus);
      recordRebuildTransition(currentStatus, newStatus);
      jobData.setStatus(newStatus);
    } else {
      LOG.info("Skipping status update to {} because stop has been initiated", newStatus);
    }
  }

  private void recordRebuildTransition(
      final EventPublisherJob.Status currentStatus, final EventPublisherJob.Status newStatus) {
    if (currentStatus != newStatus) {
      switch (newStatus) {
        case RUNNING -> OntologyMetrics.recordGraphRebuildStarted();
        case COMPLETED, SUCCESS -> {
          OntologyMetrics.recordGraphRebuildCompleted();
          if (rebuildsEntireProjection) {
            RdfProjectionHealth.markReady(initialProjectionFailureVersion);
          }
        }
        case FAILED, ACTIVE_ERROR, STOPPED -> OntologyMetrics.recordGraphRebuildFailed();
        case STARTED, ACTIVE, STOP_IN_PROGRESS -> {}
      }
    }
  }

  private void sendUpdates(JobExecutionContext jobExecutionContext, boolean forceUpdate) {
    try {
      long currentTime = System.currentTimeMillis();
      if (!forceUpdate && (currentTime - lastWebSocketUpdate < WEBSOCKET_UPDATE_INTERVAL_MS)) {
        return;
      }
      lastWebSocketUpdate = currentTime;

      jobExecutionContext.getJobDetail().getJobDataMap().put(APP_RUN_STATS, jobData.getStats());
      jobExecutionContext
          .getJobDetail()
          .getJobDataMap()
          .put(WEBSOCKET_STATUS_CHANNEL, RDF_INDEX_JOB_BROADCAST_CHANNEL);
      updateRecordToDbAndNotify(jobExecutionContext);
    } catch (Exception ex) {
      LOG.error("Failed to send updated stats with WebSocket", ex);
    }
  }

  public void updateRecordToDbAndNotify(JobExecutionContext jobExecutionContext) {
    AppRunRecord appRecord = getJobRecord(jobExecutionContext);

    appRecord.setStatus(AppRunRecord.Status.fromValue(jobData.getStatus().value()));
    if (jobData.getFailure() != null) {
      appRecord.setFailureContext(
          new FailureContext().withAdditionalProperty("failure", jobData.getFailure()));
    }
    if (jobData.getStats() != null) {
      appRecord.setSuccessContext(
          new SuccessContext().withAdditionalProperty("stats", jobData.getStats()));
    }
    pushAppStatusUpdates(jobExecutionContext, appRecord, true);

    if (WebSocketManager.getInstance() != null) {
      String messageJson = JsonUtils.pojoToJson(appRecord);
      WebSocketManager.getInstance()
          .broadCastMessageToAll(RDF_INDEX_JOB_BROADCAST_CHANNEL, messageJson);
    }
  }

  private void handleJobFailure(Exception ex) {
    IndexingError indexingError =
        new IndexingError()
            .withErrorSource(IndexingError.ErrorSource.JOB)
            .withMessage(String.format("RDF Indexing Job Failed: %s", ex.getMessage()));
    LOG.error("RDF Indexing Job Failed", ex);

    jobData.setStatus(EventPublisherJob.Status.FAILED);
    jobData.setFailure(indexingError);
  }

  @Override
  public void stop() {
    LOG.info("RDF indexing job is being stopped.");
    stopped = true;
    if (jobData != null) {
      jobData.setStatus(EventPublisherJob.Status.STOP_IN_PROGRESS);
    }
  }

  @Override
  protected void validateConfig(Map<String, Object> appConfig) {
    try {
      JsonUtils.convertValue(appConfig, EventPublisherJob.class);
    } catch (IllegalArgumentException e) {
      throw AppException.byMessage(Response.Status.BAD_REQUEST, "Invalid App Configuration");
    }
  }

  private Set<String> getAll() {
    return resolveEntityTypes(new HashSet<>(Entity.getEntityList()));
  }

  private Set<String> resolveEntityTypes(Set<String> requestedEntities) {
    Set<String> entitiesToResolve = requestedEntities;
    if (entitiesToResolve == null
        || entitiesToResolve.isEmpty()
        || entitiesToResolve.contains(ALL)) {
      entitiesToResolve = new HashSet<>(Entity.getEntityList());
    }

    Set<String> resolvedEntities = new LinkedHashSet<>();
    List<String> skippedEntities = new ArrayList<>();
    List<String> excludedEntities = new ArrayList<>();
    for (String entityType : entitiesToResolve) {
      if (entityType == null || entityType.isBlank() || ALL.equals(entityType)) {
        continue;
      }
      if (EXCLUDED_ENTITY_TYPES.contains(entityType)) {
        excludedEntities.add(entityType);
      } else if (isIndexableEntityType(entityType)) {
        resolvedEntities.add(entityType);
      } else {
        skippedEntities.add(entityType);
      }
    }

    if (!excludedEntities.isEmpty()) {
      LOG.info("Skipping RDF indexing for entity types excluded from RDF: {}", excludedEntities);
    }
    if (!skippedEntities.isEmpty()) {
      LOG.info("Skipping RDF indexing for non repository-backed entity types: {}", skippedEntities);
    }

    return resolvedEntities;
  }

  private boolean isIndexableEntityType(String entityType) {
    try {
      Entity.getEntityRepository(entityType);
      return true;
    } catch (Exception e) {
      return false;
    }
  }
}
