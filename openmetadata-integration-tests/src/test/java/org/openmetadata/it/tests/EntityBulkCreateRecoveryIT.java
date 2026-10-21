package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.SQLException;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.IntStream;
import org.awaitility.Awaitility;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlFailureProbe;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.monitoring.RequestLatencyContext;

@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.SAME_THREAD)
@Isolated("Temporarily decorates the application's SQL logger")
class EntityBulkCreateRecoveryIT {
  private static final String INSERT_TEST_CASE = "insert into test_case (";
  private static final String INSERT_GLOSSARY_TERM = "insert into glossary_term_entity (";
  private static final String CREATE_MANY_TERMS = "/v1/glossaryTerms/createMany";

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void concurrentDuplicateSkipsWinnerAndCreatesRemainingTests(
      boolean includeFresh, TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Table table = createTable(ns);
    final TestCase seed = client.testCases().create(request(table, ns.shortPrefix("seed")));
    final CreateTestCase duplicate = request(table, ns.shortPrefix("duplicate"));
    final CreateTestCase fresh = request(table, ns.shortPrefix("fresh"));
    final AtomicReference<TestCase> winner = new AtomicReference<>();
    final AtomicInteger conflicts = new AtomicInteger();
    final var jdbi = Entity.getJdbi();
    final SqlLogger previous = jdbi.getConfig(SqlStatements.class).getSqlLogger();

    List<TestCase> created;
    jdbi.setSqlLogger(
        concurrentInsertLogger(
            previous,
            INSERT_TEST_CASE,
            1,
            () -> winner.set(client.testCases().create(duplicate)),
            conflicts));
    try {
      created =
          client
              .testCases()
              .createMany(includeFresh ? List.of(fresh, duplicate) : List.of(duplicate));
    } finally {
      jdbi.setSqlLogger(previous);
    }

    assertNotNull(winner.get());
    assertTrue(conflicts.get() > 0, "The batch must encounter a real duplicate-key error");
    assertEquals(
        includeFresh ? List.of(fresh.getName()) : List.of(),
        created.stream().map(TestCase::getName).toList());
    if (includeFresh) {
      final TestCase stored =
          client.testCases().get(created.getFirst().getId().toString(), "testSuite,testDefinition");
      assertNotNull(stored.getTestSuite());
      assertNotNull(stored.getTestDefinition());
    }
    assertEquals(
        winner.get().getId(),
        client.testCases().getByName(winner.get().getFullyQualifiedName()).getId());
    final String suiteId =
        client
            .testCases()
            .get(seed.getId().toString(), "testSuite")
            .getTestSuite()
            .getId()
            .toString();
    final int relationships =
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT count(*) FROM entity_relationship WHERE fromId = :suite AND toEntity = 'testCase'")
                    .bind("suite", suiteId)
                    .mapTo(Integer.class)
                    .one());
    assertEquals(
        includeFresh ? 3 : 2,
        relationships,
        "Only the seed, concurrent winner and any new test have relationships");
  }

  private SqlLogger concurrentInsertLogger(
      SqlLogger delegate,
      String insertSql,
      int insertNumber,
      Runnable concurrentCreate,
      AtomicInteger conflicts) {
    final AtomicInteger inserts = new AtomicInteger();
    return new SqlLogger() {
      @Override
      public void logBeforeExecution(StatementContext context) {
        delegate.logBeforeExecution(context);
        if (RequestLatencyContext.getContext() != null
            && context.getRenderedSql().toLowerCase(Locale.ROOT).contains(insertSql)
            && inserts.incrementAndGet() == insertNumber) {
          // Commit on another request after the preflight lookup but before the batch INSERT.
          concurrentCreate.run();
        }
      }

      @Override
      public void logAfterExecution(StatementContext context) {
        delegate.logAfterExecution(context);
      }

      @Override
      public void logException(StatementContext context, SQLException exception) {
        delegate.logException(context, exception);
        if (exception.getErrorCode() == 1062 || "23505".equals(exception.getSQLState())) {
          conflicts.incrementAndGet();
        }
      }
    };
  }

  @Test
  void duplicateInLaterChunkPreservesEarlierGlossaryTerms(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Glossary glossary = GlossaryTestFactory.createSimple(ns);
    final List<CreateGlossaryTerm> requests = termRequests(glossary, 102);
    final AtomicReference<GlossaryTerm> firstCommitted = new AtomicReference<>();
    final AtomicReference<GlossaryTerm> winner = new AtomicReference<>();
    final AtomicInteger conflicts = new AtomicInteger();
    final var jdbi = Entity.getJdbi();
    final SqlLogger previous = jdbi.getConfig(SqlStatements.class).getSqlLogger();
    jdbi.setSqlLogger(
        concurrentInsertLogger(
            previous,
            INSERT_GLOSSARY_TERM,
            2,
            () -> {
              firstCommitted.set(
                  client.glossaryTerms().getByName(glossary.getFullyQualifiedName() + ".term_0"));
              winner.set(client.glossaryTerms().create(requests.get(100)));
            },
            conflicts));
    List<GlossaryTerm> created;
    try {
      created =
          List.of(
              client
                  .getHttpClient()
                  .execute(HttpMethod.POST, CREATE_MANY_TERMS, requests, GlossaryTerm[].class));
    } finally {
      jdbi.setSqlLogger(previous);
    }

    assertTrue(conflicts.get() > 0, "The second transaction must hit a real duplicate");
    assertEquals(
        IntStream.range(0, 102).filter(i -> i != 100).mapToObj(i -> "term_" + i).toList(),
        created.stream().map(GlossaryTerm::getName).toList());
    assertEquals(firstCommitted.get().getId(), created.getFirst().getId());
    assertEquals(
        winner.get().getId(),
        client.glossaryTerms().getByName(winner.get().getFullyQualifiedName()).getId());
    assertEquals(
        created.getLast().getId(),
        client.glossaryTerms().getByName(created.getLast().getFullyQualifiedName()).getId());
    final int relationships =
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT count(*) FROM entity_relationship WHERE fromId = :glossary AND toEntity = 'glossaryTerm'")
                    .bind("glossary", glossary.getId().toString())
                    .mapTo(Integer.class)
                    .one());
    assertEquals(102, relationships);
    assertSearchable(created.getFirst());
    assertSearchable(created.getLast());
  }

  @Test
  void unrelatedFailureInLaterChunkKeepsEarlierTermsPublished(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Glossary glossary = GlossaryTestFactory.createSimple(ns);
    final List<CreateGlossaryTerm> requests = termRequests(glossary, 101);
    final AtomicInteger inserts = new AtomicInteger();
    try (var failure =
        SqlFailureProbe.forRequests(
            Entity.getJdbi(),
            INSERT_GLOSSARY_TERM,
            () ->
                new UnableToExecuteStatementException(
                    "Injected constraint failure",
                    new SQLException("Injected constraint failure", "23503"),
                    null),
            context ->
                context.getRenderedSql().toLowerCase(Locale.ROOT).contains(INSERT_GLOSSARY_TERM)
                    && inserts.incrementAndGet() == 2)) {
      final OpenMetadataException error =
          assertThrows(
              OpenMetadataException.class,
              () ->
                  client
                      .getHttpClient()
                      .execute(HttpMethod.POST, CREATE_MANY_TERMS, requests, GlossaryTerm[].class));
      assertTrue(failure.injected());
      assertEquals(400, error.getStatusCode());
    }

    final GlossaryTerm first =
        client.glossaryTerms().getByName(glossary.getFullyQualifiedName() + ".term_0");
    assertSearchable(first);
    assertEquals(
        404,
        assertThrows(
                OpenMetadataException.class,
                () ->
                    client
                        .glossaryTerms()
                        .getByName(glossary.getFullyQualifiedName() + ".term_100"))
            .getStatusCode());
    assertEquals("term_100", client.glossaryTerms().create(requests.get(100)).getName());
  }

  private List<CreateGlossaryTerm> termRequests(Glossary glossary, int count) {
    return IntStream.range(0, count)
        .mapToObj(
            i ->
                new CreateGlossaryTerm()
                    .withName("term_" + i)
                    .withGlossary(glossary.getFullyQualifiedName())
                    .withDescription("Bulk term " + i))
        .toList();
  }

  private void assertSearchable(GlossaryTerm term) {
    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () ->
                assertEquals(
                    1,
                    JsonUtils.readTree(
                            SdkClients.adminClient()
                                .search()
                                .query("id:" + term.getId())
                                .index("glossary_term_search_index")
                                .size(1)
                                .execute())
                        .path("hits")
                        .path("hits")
                        .size()));
  }

  @ParameterizedTest
  @CsvSource({"23503,400", "23505,409", "08001,500"})
  void unrelatedDatabaseErrorsRollBackAndPropagate(
      String sqlState, int expectedStatus, TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Table table = createTable(ns);
    client.testCases().create(request(table, ns.shortPrefix("seed")));
    final CreateTestCase fresh = request(table, ns.shortPrefix("fresh"));
    try (var failure =
        SqlFailureProbe.forRequests(
            Entity.getJdbi(),
            INSERT_TEST_CASE,
            () ->
                new UnableToExecuteStatementException(
                    "Injected SQL failure",
                    new SQLException("Injected SQL failure", sqlState),
                    null),
            ignored -> true)) {
      final OpenMetadataException error =
          assertThrows(
              OpenMetadataException.class,
              () ->
                  client
                      .getHttpClient()
                      .executeForString(
                          HttpMethod.POST, "/v1/dataQuality/testCases/createMany", List.of(fresh)));
      assertTrue(failure.injected());
      assertEquals(expectedStatus, error.getStatusCode());
    }
    assertEquals(fresh.getName(), client.testCases().create(fresh).getName());
  }

  private Table createTable(TestNamespace ns) {
    final DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName(ns.shortPrefix("service"), ns);
    final Database database =
        DatabaseTestFactory.createWithName(service.getFullyQualifiedName(), "db");
    final DatabaseSchema schema =
        DatabaseSchemaTestFactory.create(database.getFullyQualifiedName(), "schema");
    return TableTestFactory.createSimpleWithName("table", ns, schema.getFullyQualifiedName());
  }

  private CreateTestCase request(Table table, String name) {
    return TestCaseBuilder.create(SdkClients.adminClient())
        .name(name)
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "100")
        .build();
  }
}
