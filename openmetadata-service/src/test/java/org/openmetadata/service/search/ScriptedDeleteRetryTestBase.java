package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.indexes.SearchIndex;
import org.slf4j.LoggerFactory;

public abstract class ScriptedDeleteRetryTestBase {
  protected static final String SCRIPT =
      "!doc['testCaseFQN.keyword'].empty && params.fqns.contains(doc['testCaseFQN.keyword'].value)";
  protected static final Map<String, Object> PARAMS = Map.of("fqns", List.of("my_test"));
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private final HttpClient http =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
  protected final List<Long> conflicts = new ArrayList<>();
  protected boolean keepConflicting;
  protected boolean reportTimeout;
  protected boolean reportShardFailure;
  protected String index;

  protected abstract String engineUrl();

  protected abstract void connect(ElasticSearchConfiguration config) throws Exception;

  protected abstract void closeClient() throws Exception;

  protected abstract void deleteByScript() throws Exception;

  protected abstract void deleteOnce() throws Exception;

  protected abstract EntityManagementClient manager();

  protected enum DeletePath {
    FIELDS,
    FQN_PREFIX,
    RANGE,
    RANGE_AND_TERM
  }

  /** How the engine answers single-document writes: as sent, or with a real 409 or 400. */
  protected enum WriteFailure {
    NONE,
    CONFLICT,
    REJECTED
  }

  protected enum SingleDocumentWrite {
    CREATE,
    CREATE_TIME_SERIES,
    SOFT_DELETE
  }

  protected WriteFailure writeFailure = WriteFailure.NONE;
  protected int failingWrites = Integer.MAX_VALUE;
  protected int writeAttempts;

  protected boolean failThisWrite() {
    writeAttempts++;
    return writeFailure != WriteFailure.NONE && failingWrites-- > 0;
  }

  @BeforeEach
  void setUp() throws Exception {
    index = "script-delete-" + UUID.randomUUID();
    URI uri = URI.create(engineUrl());
    connect(
        new ElasticSearchConfiguration()
            .withHost(uri.getHost())
            .withPort(uri.getPort())
            .withScheme("http")
            .withConnectionTimeoutSecs(10)
            .withSocketTimeoutSecs(30)
            .withBatchSize(10)
            .withClusterAlias(""));
    request(
        "PUT",
        index,
        "{\"settings\":{\"number_of_shards\":1,\"number_of_replicas\":0,\"refresh_interval\":\"-1\"}}");
    seed();
  }

  @AfterEach
  void tearDown() throws Exception {
    try {
      if (index != null) request("DELETE", index, "");
    } finally {
      closeClient();
      http.close();
    }
  }

  @Test
  void noConflictsNeedsOnlyOneAttemptAndKeepsOtherTestCases() throws Exception {
    deleteByScript();
    assertEquals(List.of(0L), conflicts);
    assertOnlyOtherTestCaseRemains();
  }

  @Test
  void retriesAnUpdatedDocumentAgainstItsRefreshedVersion() throws Exception {
    rewriteWithoutRefresh();
    deleteByScript();
    assertOnlyOtherTestCaseRemains();
    assertEquals(List.of(1L, 0L), conflicts);
  }

  @ParameterizedTest
  @EnumSource(DeletePath.class)
  void everyDeleteByQueryRetriesAnUpdatedDocument(DeletePath path) throws Exception {
    rewriteWithoutRefresh();
    delete(path);
    assertOnlyOtherTestCaseRemains();
    assertEquals(List.of(1L, 0L), conflicts);
  }

  @ParameterizedTest
  @EnumSource(DeletePath.class)
  void persistentConflictsAreNotLoggedAsErrors(DeletePath path) throws Exception {
    Logger managerLog = (Logger) LoggerFactory.getLogger(manager().getClass());
    ListAppender<ILoggingEvent> logged = new ListAppender<>();
    logged.start();
    managerLog.addAppender(logged);
    try {
      keepConflicting = true;
      delete(path);
    } finally {
      managerLog.detachAppender(logged);
    }
    assertEquals(List.of(1L, 1L, 1L), conflicts);
    assertTrue(logged.list.stream().noneMatch(e -> e.getLevel().isGreaterOrEqual(Level.ERROR)));
  }

  @Test
  void retriesWhenEveryMatchingDocumentConflicted() throws Exception {
    deleteOnce();
    seed(1);
    rewriteWithoutRefresh();
    deleteByScript();
    assertOnlyOtherTestCaseRemains();
    assertEquals(List.of(1L, 0L), conflicts);
  }

  @Test
  void aConcurrentlyDeletedDocumentDoesNotPreventCleanup() throws Exception {
    request("DELETE", index + "/_doc/held", "");
    deleteByScript();
    assertTrue(conflicts.size() <= 2);
    assertEquals(0L, conflicts.getLast());
    assertOnlyOtherTestCaseRemains();
  }

  @Test
  void persistentWritersStopAfterThreeAttempts() throws Exception {
    keepConflicting = true;
    deleteByScript();
    assertEquals(List.of(1L, 1L, 1L), conflicts);
    request("POST", index + "/_refresh", "");
    assertEquals(2L, request("GET", index + "/_count", "").path("count").asLong());
    assertEquals(
        "my_test",
        request("GET", index + "/_doc/held", "").path("_source").path("testCaseFQN").asText());
  }

  @Test
  void aTimedOutDeleteIsNotRetried() throws Exception {
    keepConflicting = true;
    reportTimeout = true;
    deleteByScript();
    assertEquals(List.of(1L), conflicts);
    assertEquals(
        "my_test",
        request("GET", index + "/_doc/held", "").path("_source").path("testCaseFQN").asText());
  }

  @Test
  void aShardFailureIsNotRetried() throws Exception {
    keepConflicting = true;
    reportShardFailure = true;
    deleteByScript();
    assertEquals(List.of(1L), conflicts);
    assertEquals(
        "my_test",
        request("GET", index + "/_doc/held", "").path("_source").path("testCaseFQN").asText());
  }

  @Test
  void oneAttemptLeavesTheUnrefreshedUpdateBehind() throws Exception {
    rewriteWithoutRefresh();
    deleteOnce();
    assertEquals(List.of(1L), conflicts);
    assertEquals(2L, request("GET", index + "/_count", "").path("count").asLong());
  }

  @Test
  @EnabledIfSystemProperty(named = "scriptDelete.benchmark", matches = "true")
  void measuresCleanAndConflictedCleanup() throws Exception {
    List<Double> baseline = new ArrayList<>();
    List<Double> clean = new ArrayList<>();
    List<Double> retried = new ArrayList<>();
    for (int sample = 0; sample < 15; sample++) {
      seed(1000);
      long started = System.nanoTime();
      deleteOnce();
      double originalMillis = (System.nanoTime() - started) / 1_000_000.0;
      seed(1000);
      started = System.nanoTime();
      deleteByScript();
      double cleanMillis = (System.nanoTime() - started) / 1_000_000.0;
      seed(1000);
      rewriteWithoutRefresh();
      started = System.nanoTime();
      deleteByScript();
      double conflictMillis = (System.nanoTime() - started) / 1_000_000.0;
      assertOnlyOtherTestCaseRemains();
      if (sample >= 3) {
        baseline.add(originalMillis);
        clean.add(cleanMillis);
        retried.add(conflictMillis);
      }
    }
    System.out.printf(
        "SCRIPT_DELETE_TIMING %s baseline_ms=%s clean_ms=%s conflict_ms=%s%n",
        getClass().getSimpleName(), baseline, clean, retried);
  }

  @ParameterizedTest
  @EnumSource(SingleDocumentWrite.class)
  void aSingleDocumentWriteThatKeepsLosingIsRetriedThenSurfacesAsAConflict(
      SingleDocumentWrite write) {
    writeFailure = WriteFailure.CONFLICT;
    assertTrue(SearchUtils.isVersionConflict(assertThrows(Exception.class, () -> write(write))));
    assertEquals(4, writeAttempts);
  }

  @ParameterizedTest
  @EnumSource(SingleDocumentWrite.class)
  void aRejectedSingleDocumentWriteIsNeitherRetriedNorAConflict(SingleDocumentWrite write) {
    writeFailure = WriteFailure.REJECTED;
    assertFalse(SearchUtils.isVersionConflict(assertThrows(Exception.class, () -> write(write))));
    assertEquals(1, writeAttempts);
  }

  @Test
  void aConflictThatClearsIsRetriedAndWritten() throws Exception {
    writeFailure = WriteFailure.CONFLICT;
    failingWrites = 1;
    try (MockedStatic<SearchIndexRetryQueue> queue = mockStatic(SearchIndexRetryQueue.class)) {
      List<ILoggingEvent> logged =
          logsOf(() -> manager().updateEntity(index, "held", Map.of(), "ctx._source.value = 3"));

      assertEquals(2, writeAttempts);
      assertEquals(
          3, request("GET", index + "/_doc/held", "").path("_source").path("value").asInt());
      queue.verifyNoInteractions();
      assertTrue(logged.stream().noneMatch(e -> e.getLevel().isGreaterOrEqual(Level.WARN)));
    }
  }

  @Test
  void aConflictedEntityUpdateIsQueuedAndLoggedAsAWarning() throws Exception {
    writeFailure = WriteFailure.CONFLICT;
    try (MockedStatic<SearchIndexRetryQueue> queue = mockStatic(SearchIndexRetryQueue.class)) {
      List<ILoggingEvent> logged =
          logsOf(() -> manager().updateEntity(index, "held", Map.of(), "ctx._source.value = 3"));

      assertEquals(4, writeAttempts);
      queue.verify(() -> SearchIndexRetryQueue.enqueue(eq("held"), isNull(), any()));
      assertNoErrors(logged);
    }
  }

  @Test
  void aRejectedEntityUpdateIsStillLoggedAsAnError() throws Exception {
    writeFailure = WriteFailure.REJECTED;
    try (MockedStatic<SearchIndexRetryQueue> ignored = mockStatic(SearchIndexRetryQueue.class)) {
      List<ILoggingEvent> logged =
          logsOf(() -> manager().updateEntity(index, "held", Map.of(), "ctx._source.value = 3"));

      assertEquals(1, writeAttempts);
      assertTrue(logged.stream().anyMatch(e -> e.getLevel() == Level.ERROR));
    }
  }

  @Test
  void aConflictedReindexIsQueuedAndLoggedAsAWarning() throws Exception {
    writeFailure = WriteFailure.CONFLICT;
    EntityReference table = reindexableTable();
    try (MockedStatic<Entity> entities = mockStatic(Entity.class);
        MockedStatic<SearchIndexRetryQueue> queue = mockStatic(SearchIndexRetryQueue.class)) {
      resolveForReindex(entities, table);

      List<ILoggingEvent> logged = logsOf(() -> manager().reindexEntities(List.of(table)));

      queue.verify(
          () ->
              SearchIndexRetryQueue.enqueue(
                  eq(table.getId().toString()),
                  eq(table.getFullyQualifiedName()),
                  eq(Entity.TABLE),
                  any()));
      assertNoErrors(logged);
    }
  }

  @Test
  void aRejectedReindexIsStillLoggedAsAnError() throws Exception {
    writeFailure = WriteFailure.REJECTED;
    EntityReference table = reindexableTable();
    try (MockedStatic<Entity> entities = mockStatic(Entity.class);
        MockedStatic<SearchIndexRetryQueue> ignored = mockStatic(SearchIndexRetryQueue.class)) {
      resolveForReindex(entities, table);

      List<ILoggingEvent> logged = logsOf(() -> manager().reindexEntities(List.of(table)));

      assertTrue(logged.stream().anyMatch(e -> e.getLevel() == Level.ERROR));
    }
  }

  private void write(SingleDocumentWrite write) throws Exception {
    EntityManagementClient manager = manager();
    switch (write) {
      case CREATE -> manager.createEntity(index, "held", matchingDocument(4));
      case CREATE_TIME_SERIES -> manager.createTimeSeriesEntity(index, "held", matchingDocument(4));
      case SOFT_DELETE -> manager.softDeleteOrRestoreEntity(
          index, "held", "ctx._source.deleted = true");
    }
  }

  private EntityReference reindexableTable() throws Exception {
    UUID id = UUID.randomUUID();
    request("PUT", index + "/_doc/" + id + "?refresh=true", matchingDocument(1));
    return new EntityReference()
        .withId(id)
        .withType(Entity.TABLE)
        .withFullyQualifiedName("svc.db.schema.orders");
  }

  private void resolveForReindex(MockedStatic<Entity> entities, EntityReference table) {
    EntityInterface<?> entity = mock(EntityInterface.class);
    when(entity.getId()).thenReturn(table.getId());
    entities
        .when(() -> Entity.getEntity(any(EntityReference.class), eq("*"), eq(Include.ALL)))
        .thenReturn(entity);
    SearchRepository repository = mock(SearchRepository.class);
    IndexMapping mapping = mock(IndexMapping.class);
    when(repository.getIndexMapping(Entity.TABLE)).thenReturn(mapping);
    when(repository.getClusterAlias()).thenReturn("");
    when(mapping.getIndexName("")).thenReturn(index);
    entities.when(Entity::getSearchRepository).thenReturn(repository);
    SearchIndex searchIndex = mock(SearchIndex.class);
    when(searchIndex.buildSearchIndexDoc()).thenReturn(Map.of("value", 4));
    entities.when(() -> Entity.buildSearchIndex(Entity.TABLE, entity)).thenReturn(searchIndex);
  }

  private List<ILoggingEvent> logsOf(ThrowingRunnable action) throws Exception {
    Logger managerLog = (Logger) LoggerFactory.getLogger(manager().getClass());
    ListAppender<ILoggingEvent> logged = new ListAppender<>();
    logged.start();
    managerLog.addAppender(logged);
    try {
      action.run();
    } finally {
      managerLog.detachAppender(logged);
    }
    return logged.list;
  }

  private static void assertNoErrors(List<ILoggingEvent> logged) {
    assertTrue(
        logged.stream().noneMatch(e -> e.getLevel().isGreaterOrEqual(Level.ERROR)),
        () -> logged.stream().map(ILoggingEvent::getFormattedMessage).toList().toString());
    assertTrue(logged.stream().anyMatch(e -> e.getLevel() == Level.WARN));
  }

  @FunctionalInterface
  private interface ThrowingRunnable {
    void run() throws Exception;
  }

  protected void rewriteWithoutRefresh() throws Exception {
    request("PUT", index + "/_doc/held?refresh=false", matchingDocument(2));
  }

  private void delete(DeletePath path) throws Exception {
    EntityManagementClient manager = manager();
    switch (path) {
      case FIELDS -> manager.deleteEntityByFields(
          List.of(index), List.of(Pair.of("testCaseFQN.keyword", "my_test")));
      case FQN_PREFIX -> manager.deleteEntityByFQNPrefix(index, "svc.");
      case RANGE -> manager.deleteByRangeQuery(index, "value", null, null, 50, null);
      case RANGE_AND_TERM -> manager.deleteByRangeAndTerm(
          index, "value", null, null, 50, null, "testCaseFQN.keyword", "my_test");
    }
  }

  private static String matchingDocument(int value) {
    return "{\"testCaseFQN\":\"my_test\",\"fullyQualifiedName\":\"svc.my_test\",\"value\":"
        + value
        + "}";
  }

  private void seed() throws Exception {
    seed(2);
  }

  private void seed(int matchingDocuments) throws Exception {
    StringBuilder body = new StringBuilder();
    for (int doc = 0; doc < matchingDocuments; doc++) {
      String id = doc == 0 ? "held" : "match-" + doc;
      body.append("{\"index\":{\"_id\":\"")
          .append(id)
          .append("\"}}\n")
          .append(matchingDocument(1))
          .append("\n");
    }
    body.append(
        "{\"index\":{\"_id\":\"keep\"}}\n"
            + "{\"testCaseFQN\":\"another_test\",\"fullyQualifiedName\":\"other.another_test\","
            + "\"value\":100}\n");
    assertEquals(
        false,
        request("POST", index + "/_bulk?refresh=true", body.toString()).path("errors").asBoolean());
    conflicts.clear();
  }

  private void assertOnlyOtherTestCaseRemains() throws Exception {
    assertEquals(1L, request("GET", index + "/_count", "").path("count").asLong());
    assertEquals(
        "another_test",
        request("GET", index + "/_doc/keep", "").path("_source").path("testCaseFQN").asText());
  }

  private JsonNode request(String method, String path, String body) throws Exception {
    HttpRequest req =
        HttpRequest.newBuilder(URI.create(engineUrl() + "/" + path))
            .timeout(Duration.ofSeconds(30))
            .header("Content-Type", "application/json")
            .method(
                method,
                body.isEmpty()
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(body))
            .build();
    HttpResponse<String> response = http.send(req, HttpResponse.BodyHandlers.ofString());
    assertTrue(response.statusCode() >= 200 && response.statusCode() < 300, response.body());
    return MAPPER.readTree(response.body());
  }
}
