package org.openmetadata.service.governance.workflows;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.ProcessEngineConfiguration;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.flowable.engine.impl.cfg.StandaloneProcessEngineConfiguration;
import org.flowable.job.service.impl.asyncexecutor.AsyncExecutor;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Saving workflow settings replaces the process engine on every server and closes the old one.
 * Closing an engine clears, by default, the lock on every job its executor owns, without waiting
 * for jobs still running, so such a job is acquired and run a second time. These tests run a real
 * engine with a job that is still running when the engine closes.
 */
@Testcontainers(disabledWithoutDocker = true)
class WorkflowEngineRetireTest {
  private static final String DATABASE_USER = "flowable";

  @Container
  static final GenericContainer<?> POSTGRES =
      new GenericContainer<>("postgres:15-alpine")
          .withEnv("POSTGRES_USER", DATABASE_USER)
          .withEnv("POSTGRES_PASSWORD", DATABASE_USER)
          .withExposedPorts(5432)
          .waitingFor(Wait.forLogMessage(".*ready to accept connections.*\\n", 2));

  private static final String PROCESS =
      """
      <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
          xmlns:flowable="http://flowable.org/bpmn" targetNamespace="retire">
        <process id="longJob" isExecutable="true">
          <startEvent id="start"/>
          <sequenceFlow id="toJob" sourceRef="start" targetRef="job"/>
          <serviceTask id="job" flowable:async="true" flowable:class="%s"/>
          <sequenceFlow id="toEnd" sourceRef="job" targetRef="end"/>
          <endEvent id="end"/>
        </process>
      </definitions>
      """
          .formatted(BlockingDelegate.class.getName());

  // Flowable instantiates the delegate by class name, so it reaches the test's latches statically.
  private static volatile CountDownLatch jobStarted;
  private static volatile CountDownLatch releaseJob;

  private String jdbcUrl;
  // A pool the engine does not own, as on a server: closing an engine force-closes only a pool it
  // created itself, which would cut off the job still running on it.
  private HikariDataSource dataSource;

  /** Stands in for a node that runs for minutes, such as a RunApp node waiting for its app. */
  public static class BlockingDelegate implements JavaDelegate {
    @Override
    public void execute(DelegateExecution execution) {
      jobStarted.countDown();
      try {
        releaseJob.await(5, TimeUnit.MINUTES);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    }
  }

  @BeforeEach
  void armJob() throws SQLException {
    String database = "retire_%s".formatted(UUID.randomUUID().toString().replace("-", ""));
    try (Connection connection = connect(serverUrl("postgres"));
        Statement statement = connection.createStatement()) {
      statement.execute("CREATE DATABASE %s".formatted(database));
    }
    jdbcUrl = serverUrl(database);
    jobStarted = new CountDownLatch(1);
    releaseJob = new CountDownLatch(1);
  }

  @AfterEach
  void finishJob() {
    releaseJob.countDown();
    if (dataSource != null) {
      dataSource.close();
    }
  }

  @Test
  void retiringEngineKeepsTheLockOfAJobStillRunningAndTheJobStillCompletes() throws Exception {
    ProcessEngine engine = startEngineRunningLongJob();
    AsyncExecutor asyncExecutor = engine.getProcessEngineConfiguration().getAsyncExecutor();
    String lockOwner = asyncExecutor.getLockOwner();

    WorkflowHandler.keepOwnedJobsLocked(asyncExecutor);
    CompletableFuture<Void> closing = closeWhileJobRuns(engine, asyncExecutor);

    assertEquals(lockOwner, jobLockOwner());
    releaseJob.countDown();
    closing.get(1, TimeUnit.MINUTES);
    assertEquals(0, countRows("ACT_RU_JOB"), "The job left locked completes");
    assertEquals(0, countRows("ACT_RU_EXECUTION"), "Its process runs to its end");
  }

  @Test
  void closingEngineByDefaultReleasesAJobStillRunning() throws Exception {
    ProcessEngine engine = startEngineRunningLongJob();
    AsyncExecutor asyncExecutor = engine.getProcessEngineConfiguration().getAsyncExecutor();

    CompletableFuture<Void> closing = closeWhileJobRuns(engine, asyncExecutor);

    assertNull(jobLockOwner(), "Server shutdown hands its jobs to the other servers");
    releaseJob.countDown();
    closing.get(1, TimeUnit.MINUTES);
  }

  /**
   * Closes the engine on another thread and returns once its job executor has shut down, which is
   * after it released or kept its job locks, while the job it acquired is still running.
   */
  private static CompletableFuture<Void> closeWhileJobRuns(
      ProcessEngine engine, AsyncExecutor asyncExecutor) {
    CompletableFuture<Void> closing = CompletableFuture.runAsync(engine::close);
    await().atMost(Duration.ofSeconds(30)).until(() -> !asyncExecutor.isActive());
    return closing;
  }

  private ProcessEngine startEngineRunningLongJob() {
    HikariConfig poolConfig = new HikariConfig();
    poolConfig.setJdbcUrl(jdbcUrl);
    poolConfig.setUsername(DATABASE_USER);
    poolConfig.setPassword(DATABASE_USER);
    dataSource = new HikariDataSource(poolConfig);
    StandaloneProcessEngineConfiguration configuration = new StandaloneProcessEngineConfiguration();
    configuration.setDataSource(dataSource);
    configuration.setDatabaseType(ProcessEngineConfiguration.DATABASE_TYPE_POSTGRES);
    configuration.setDatabaseSchemaUpdate(ProcessEngineConfiguration.DB_SCHEMA_UPDATE_TRUE);
    configuration.setAsyncExecutorActivate(true);
    configuration.setAsyncExecutorDefaultAsyncJobAcquireWaitTime(100);
    configuration.setEngineName("retire-" + UUID.randomUUID());
    ProcessEngine engine = configuration.buildProcessEngine();
    engine
        .getRepositoryService()
        .createDeployment()
        .addString("longJob.bpmn20.xml", PROCESS)
        .deploy();
    engine.getRuntimeService().startProcessInstanceByKey("longJob");
    await().atMost(Duration.ofSeconds(30)).until(() -> jobStarted.getCount() == 0);
    return engine;
  }

  private String jobLockOwner() throws SQLException {
    try (Connection connection = connect(jdbcUrl);
        Statement statement = connection.createStatement();
        ResultSet jobs = statement.executeQuery("SELECT LOCK_OWNER_ FROM ACT_RU_JOB")) {
      jobs.next();
      return jobs.getString(1);
    }
  }

  private long countRows(String table) throws SQLException {
    try (Connection connection = connect(jdbcUrl);
        Statement statement = connection.createStatement();
        ResultSet rows = statement.executeQuery("SELECT COUNT(*) FROM %s".formatted(table))) {
      rows.next();
      return rows.getLong(1);
    }
  }

  private static String serverUrl(String database) {
    return "jdbc:postgresql://%s:%d/%s"
        .formatted(POSTGRES.getHost(), POSTGRES.getMappedPort(5432), database);
  }

  private static Connection connect(String url) throws SQLException {
    return DriverManager.getConnection(url, DATABASE_USER, DATABASE_USER);
  }
}
