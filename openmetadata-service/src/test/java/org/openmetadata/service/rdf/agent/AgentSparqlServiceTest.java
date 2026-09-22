/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.rdf.agent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.ServiceUnavailableException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.apache.jena.query.QueryFactory;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.rdf.AgentSparqlBinding;
import org.openmetadata.schema.api.rdf.AgentSparqlCompletenessReason;
import org.openmetadata.schema.api.rdf.AgentSparqlCompletenessStatus;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;
import org.openmetadata.schema.api.rdf.AgentSparqlRdfTerm;
import org.openmetadata.schema.api.rdf.AgentSparqlRdfTermType;
import org.openmetadata.schema.api.rdf.AgentSparqlResponse;
import org.openmetadata.schema.api.rdf.RdfProjectionState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.RdfSparqlService;
import org.openmetadata.service.rdf.SparqlQueryExecutionGuard;
import org.openmetadata.service.rdf.SparqlQueryLimits;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;
import org.openmetadata.service.rdf.storage.RdfStorageCircuitOpenException;

class AgentSparqlServiceTest {
  private static final String SPARQL_JSON = "application/sparql-results+json";
  private static final String SELECT_ALL = "SELECT ?s WHERE { ?s ?p ?o }";

  private final RdfRepository repository = mock(RdfRepository.class);

  @Test
  void returnsTypedBindingsWithoutApplyingInference() {
    when(repository.executeSparqlQueryDirect(anyString(), eq(SPARQL_JSON)))
        .thenReturn(
            """
            {"head":{"vars":["s","label","count","blank","missing"]},
             "results":{"bindings":[{
               "s":{"type":"uri","value":"https://open-metadata.org/entity/table/1"},
               "label":{"type":"literal","value":"orders","xml:lang":"en"},
               "count":{"type":"literal","value":"3",
                        "datatype":"http://www.w3.org/2001/XMLSchema#integer"},
               "blank":{"type":"bnode","value":"b0"}}]}}
            """);

    AgentSparqlResponse response = execute(SELECT_ALL + " LIMIT 5");

    AgentSparqlBinding row = response.getResults().getBindings().getFirst();
    assertEquals(List.of("s", "label", "count", "blank", "missing"), response.getHead().getVars());
    assertTerm(row, "s", AgentSparqlRdfTermType.URI, null, null);
    assertTerm(row, "label", AgentSparqlRdfTermType.LITERAL, null, "en");
    assertTerm(
        row,
        "count",
        AgentSparqlRdfTermType.LITERAL,
        "http://www.w3.org/2001/XMLSchema#integer",
        null);
    assertTerm(row, "blank", AgentSparqlRdfTermType.BNODE, null, null);
    assertTrue(!row.getAdditionalProperties().containsKey("missing"), "Unbound stays absent");
    verify(repository, never()).executeSparqlQuery(anyString(), anyString());
  }

  @Test
  void emptyResultIsACompleteSuccess() {
    returnRows(0);

    AgentSparqlResponse response = execute(SELECT_ALL);

    assertTrue(response.getResults().getBindings().isEmpty());
    assertEquals(
        AgentSparqlCompletenessStatus.COMPLETE,
        response.getMetadata().getCompleteness().getStatus());
  }

  @Test
  void explicitLimitIsCompleteRelativeToTheSubmittedQuery() {
    returnRows(10);

    AgentSparqlResponse response = execute(SELECT_ALL + " LIMIT 10");

    assertEquals(10, response.getResults().getBindings().size());
    assertEquals(
        AgentSparqlCompletenessStatus.COMPLETE,
        response.getMetadata().getCompleteness().getStatus());
    assertEquals(10, response.getMetadata().getEffectiveLimits().getExplicitQueryLimit());
    assertEquals(10, QueryFactory.create(executedQuery()).getLimit());
  }

  @Test
  void exactlyTheServerLimitWithoutAnOverflowRowIsComplete() {
    returnRows(SparqlQueryLimits.DEFAULT_RESULT_LIMIT);

    AgentSparqlResponse response = execute(SELECT_ALL);

    assertEquals(
        SparqlQueryLimits.DEFAULT_RESULT_LIMIT, response.getResults().getBindings().size());
    assertEquals(
        AgentSparqlCompletenessStatus.COMPLETE,
        response.getMetadata().getCompleteness().getStatus());
    assertNull(response.getMetadata().getEffectiveLimits().getExplicitQueryLimit());
    assertEquals(
        SparqlQueryLimits.DEFAULT_RESULT_LIMIT + 1,
        QueryFactory.create(executedQuery()).getLimit());
  }

  @Test
  void anOverflowRowTruncatesToTheServerLimit() {
    returnRows(SparqlQueryLimits.DEFAULT_RESULT_LIMIT + 1);

    AgentSparqlResponse response = execute(SELECT_ALL + " OFFSET 5");

    assertEquals(
        SparqlQueryLimits.DEFAULT_RESULT_LIMIT, response.getResults().getBindings().size());
    assertEquals(
        AgentSparqlCompletenessStatus.TRUNCATED,
        response.getMetadata().getCompleteness().getStatus());
    assertEquals(
        AgentSparqlCompletenessReason.SERVER_ROW_LIMIT,
        response.getMetadata().getCompleteness().getReason());
    assertEquals(5, QueryFactory.create(executedQuery()).getOffset());
  }

  @Test
  void notReadyBeforeExecutionNeverTouchesTheRepository() {
    for (RdfProjectionState state :
        List.of(RdfProjectionState.REBUILDING, RdfProjectionState.DEGRADED)) {
      AgentSparqlService service = service(() -> state);

      assertCode(
          AgentSparqlErrorCode.PROJECTION_NOT_READY, () -> service.execute("user", SELECT_ALL));
    }
    verifyNoInteractions(repository);
  }

  @Test
  void unreadableProjectionStateIsNotReady() {
    AgentSparqlService service =
        service(
            () -> {
              throw new IllegalStateException("app run store unavailable");
            });

    assertCode(
        AgentSparqlErrorCode.PROJECTION_NOT_READY, () -> service.execute("user", SELECT_ALL));
    verifyNoInteractions(repository);
  }

  @Test
  void projectionThatDegradesDuringExecutionDiscardsTheResult() {
    returnRows(1);
    Deque<RdfProjectionState> states =
        new ArrayDeque<>(List.of(RdfProjectionState.READY, RdfProjectionState.DEGRADED));
    AgentSparqlService service = service(states::removeFirst);

    assertCode(
        AgentSparqlErrorCode.PROJECTION_NOT_READY, () -> service.execute("user", SELECT_ALL));
    verify(repository).executeSparqlQueryDirect(anyString(), eq(SPARQL_JSON));
  }

  @Test
  void disabledRepositoryIsUnavailableRatherThanNotReady() {
    AgentSparqlService service =
        new AgentSparqlService(
            () -> {
              throw new ServiceUnavailableException("RDF repository is not enabled");
            },
            () -> RdfProjectionState.READY,
            SparqlQueryExecutionGuard.shared());

    assertCode(
        AgentSparqlErrorCode.RDF_REPOSITORY_UNAVAILABLE, () -> service.execute("user", SELECT_ALL));
  }

  @Test
  void storageFailuresMapToDistinctCodes() {
    assertStorageFailure(
        new RuntimeException("Failed", new ConnectException("refused")),
        AgentSparqlErrorCode.RDF_REPOSITORY_UNAVAILABLE);
    assertStorageFailure(
        new RdfStorageCircuitOpenException("executeSparqlQuery"),
        AgentSparqlErrorCode.RDF_REPOSITORY_UNAVAILABLE);
    assertStorageFailure(
        new RuntimeException("Failed", new SocketTimeoutException("read timed out")),
        AgentSparqlErrorCode.EXECUTION_TIMEOUT);
    assertStorageFailure(
        new RuntimeException("Failed", new IllegalStateException("Query too complex")),
        AgentSparqlErrorCode.RDF_BACKEND_FAILURE);
  }

  @Test
  void backendFailureMessagesDoNotLeakStorageDetails() {
    when(repository.executeSparqlQueryDirect(anyString(), eq(SPARQL_JSON)))
        .thenThrow(new RuntimeException("http://admin:secret@fuseki:3030 exploded"));

    AgentSparqlException failure =
        assertThrows(AgentSparqlException.class, () -> readyService().execute("user", SELECT_ALL));

    assertTrue(!failure.getMessage().contains("secret"), failure.getMessage());
  }

  @Test
  void oversizedBackendResultIsAStructuredError() {
    when(repository.executeSparqlQueryDirect(anyString(), eq(SPARQL_JSON)))
        .thenReturn("x".repeat(SparqlQueryLimits.MAX_OUTPUT_BYTES + 1));

    assertCode(
        AgentSparqlErrorCode.RESULT_OUTPUT_LIMIT_EXCEEDED,
        () -> readyService().execute("user", SELECT_ALL));
  }

  @Test
  void unreadableBackendResultIsABackendFailure() {
    when(repository.executeSparqlQueryDirect(anyString(), eq(SPARQL_JSON))).thenReturn("<html/>");

    assertCode(
        AgentSparqlErrorCode.RDF_BACKEND_FAILURE, () -> readyService().execute("user", SELECT_ALL));
  }

  @Test
  void emptyJsonObjectIsAnUnreadableBackendResult() {
    when(repository.executeSparqlQueryDirect(anyString(), eq(SPARQL_JSON))).thenReturn("{}");

    assertCode(
        AgentSparqlErrorCode.RDF_BACKEND_FAILURE, () -> readyService().execute("user", SELECT_ALL));
  }

  @Test
  void envelopeGrowthPastTheByteCeilingIsAStructuredError() {
    // The backend payload stays under the ceiling; the mapped envelope adds the fixed metadata
    // block, which pushes the serialized response over it.
    String template =
        "{\"head\":{\"vars\":[\"s\"]},\"results\":{\"bindings\":"
            + "[{\"s\":{\"type\":\"literal\",\"value\":\"%s\"}}]}}";
    int padding = SparqlQueryLimits.MAX_OUTPUT_BYTES - 100 - template.length() + 2;
    String backend = template.formatted("v".repeat(padding));
    when(repository.executeSparqlQueryDirect(anyString(), eq(SPARQL_JSON))).thenReturn(backend);

    assertCode(
        AgentSparqlErrorCode.RESULT_OUTPUT_LIMIT_EXCEEDED,
        () -> readyService().execute("user", SELECT_ALL));
  }

  @Test
  void guardKeysOnTheEffectiveUserRatherThanAnyServiceActor() {
    SparqlQueryExecutionGuard guard = mock(SparqlQueryExecutionGuard.class);
    when(guard.execute(eq("alice"), any()))
        .thenAnswer(invocation -> invocation.getArgument(1, Supplier.class).get());
    returnRows(1);
    AgentSparqlService service =
        new AgentSparqlService(
            () -> new RdfSparqlService(repository, new SparqlFederationGuard(null)),
            () -> RdfProjectionState.READY,
            guard);

    service.execute("alice", SELECT_ALL);

    ArgumentCaptor<String> principal = ArgumentCaptor.forClass(String.class);
    verify(guard).execute(principal.capture(), any());
    assertEquals("alice", principal.getValue());
  }

  @Test
  void invalidQueriesAreRejectedBeforeExecution() {
    assertCode(
        AgentSparqlErrorCode.GRAPH_SELECTION_NOT_ALLOWED,
        () -> readyService().execute("user", "SELECT ?s WHERE { GRAPH ?g { ?s ?p ?o } }"));
    verifyNoInteractions(repository);
  }

  private void assertStorageFailure(RuntimeException failure, AgentSparqlErrorCode expected) {
    when(repository.executeSparqlQueryDirect(anyString(), eq(SPARQL_JSON))).thenThrow(failure);

    assertCode(expected, () -> readyService().execute("user", SELECT_ALL));
  }

  private AgentSparqlResponse execute(String sparql) {
    AgentSparqlResult result = readyService().execute("user", sparql);
    AgentSparqlResponse response =
        JsonUtils.readValue(new String(result.body()), AgentSparqlResponse.class);
    assertEquals(response.getResults().getBindings().size(), result.rowCount());
    return response;
  }

  private String executedQuery() {
    ArgumentCaptor<String> query = ArgumentCaptor.forClass(String.class);
    verify(repository).executeSparqlQueryDirect(query.capture(), eq(SPARQL_JSON));
    return query.getValue();
  }

  private void returnRows(int rows) {
    String bindings =
        IntStream.range(0, rows)
            .mapToObj(index -> "{\"s\":{\"type\":\"uri\",\"value\":\"urn:row:" + index + "\"}}")
            .collect(Collectors.joining(","));
    when(repository.executeSparqlQueryDirect(anyString(), eq(SPARQL_JSON)))
        .thenReturn("{\"head\":{\"vars\":[\"s\"]},\"results\":{\"bindings\":[" + bindings + "]}}");
  }

  private AgentSparqlService readyService() {
    return service(() -> RdfProjectionState.READY);
  }

  private AgentSparqlService service(Supplier<RdfProjectionState> projectionState) {
    return new AgentSparqlService(
        () -> new RdfSparqlService(repository, new SparqlFederationGuard(null)),
        projectionState,
        SparqlQueryExecutionGuard.shared());
  }

  private static void assertTerm(
      AgentSparqlBinding row,
      String variable,
      AgentSparqlRdfTermType type,
      String datatype,
      String language) {
    AgentSparqlRdfTerm term = row.getAdditionalProperties().get(variable);
    assertEquals(type, term.getType());
    assertEquals(datatype, term.getDatatype());
    assertEquals(language, term.getXmlLang());
  }

  private static void assertCode(AgentSparqlErrorCode expected, Runnable execution) {
    AgentSparqlException failure = assertThrows(AgentSparqlException.class, execution::run);
    assertEquals(expected, failure.getCode());
  }
}
