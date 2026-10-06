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

package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.io.IOException;
import java.util.Map;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.api.rdf.RdfProjectionState;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.SparqlQueryExecutionGuard;
import org.openmetadata.service.rdf.agent.AgentSparqlAudit;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.slf4j.LoggerFactory;

/** What a caller who holds only {@code ExecuteSparqlQuery} gets from {@code sparql_query}. */
class SparqlQueryToolAgentProfileTest {

  private static final String JSON = "application/sparql-results+json";
  private static final String EMPTY_SELECT_RESULT =
      "{\"head\":{\"vars\":[\"s\"]},\"results\":{\"bindings\":[]}}";
  private static final String SELECT_ALL = "SELECT ?s WHERE { ?s ?p ?o } LIMIT 10";
  private static final CatalogSecurityContext CALLER =
      RdfToolAuthorization.caller("agent-profile-user");

  private MockedStatic<DefaultAuthorizer> subjects;

  @BeforeEach
  void callersAreNotAdministrators() {
    subjects = RdfToolAuthorization.resolvingCallersAs(false);
  }

  @AfterEach
  void releaseTheCallerResolution() {
    subjects.close();
  }

  @Test
  void selectReturnsTheAgentJsonWithCompletenessOutsideTheBoundedBody() throws IOException {
    final RdfRepository repository = repositoryReturning(EMPTY_SELECT_RESULT);

    final SparqlQueryTool.Result result = run(repository, Map.of("query", SELECT_ALL));

    assertEquals("json", result.format());
    assertEquals("SELECT", result.queryType());
    assertEquals("COMPLETE", result.completeness().status());
    assertNull(result.completeness().reason());
    assertTrue(result.body().contains("\"completeness\""));
    verify(repository, never()).executeSparqlQuery(anyString(), anyString());
  }

  @Test
  void aSelectWithoutALimitIsMarkedTruncatedWhenTheServerCapCutsIt() throws IOException {
    final RdfRepository repository = repositoryReturning(rows(1_001));

    final SparqlQueryTool.Result result =
        run(repository, Map.of("query", "SELECT ?s WHERE { ?s ?p ?o }"));

    assertEquals("TRUNCATED", result.completeness().status());
    assertEquals("SERVER_ROW_LIMIT", result.completeness().reason());
  }

  @Test
  void completenessSurvivesWhenTheMcpBodyBudgetCutsTheJson() throws IOException {
    final RdfRepository repository = repositoryReturning(rows(900));

    final SparqlQueryTool.Result result =
        run(
            repository,
            Map.of("query", "SELECT ?s WHERE { ?s ?p ?o } LIMIT 900", "maxBytes", 1024));

    assertTrue(result.truncated());
    assertFalse(result.body().contains("\"completeness\""));
    assertEquals("COMPLETE", result.completeness().status());
  }

  @Test
  void queryFormsOutsideTheProfileAreRejectedWithTheirCodeAndNeverReachTheGraph() {
    final Map<String, String> expectedCodeByQuery =
        Map.of(
            "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }", "QUERY_FORM_NOT_ALLOWED",
            "ASK { ?s ?p ?o }", "QUERY_FORM_NOT_ALLOWED",
            "DESCRIBE <https://open-metadata.org/entity/table/abc>", "QUERY_FORM_NOT_ALLOWED",
            "SELECT * WHERE { GRAPH ?g { ?s ?p ?o } }", "GRAPH_SELECTION_NOT_ALLOWED",
            "SELECT * FROM <urn:g> WHERE { ?s ?p ?o }", "GRAPH_SELECTION_NOT_ALLOWED",
            "SELECT * WHERE { ?s ?p ?o FILTER(<java:java.lang.Math.abs>(1)) }",
                "QUERY_FORM_NOT_ALLOWED");
    final RdfRepository repository = repositoryReturning(EMPTY_SELECT_RESULT);

    expectedCodeByQuery.forEach(
        (query, code) -> {
          final IllegalArgumentException rejected =
              assertThrows(
                  IllegalArgumentException.class, () -> run(repository, Map.of("query", query)));
          assertTrue(rejected.getMessage().startsWith(code + ":"), query + " -> " + rejected);
        });

    verify(repository, never()).executeSparqlQueryDirect(anyString(), anyString());
    verify(repository, never()).executeSparqlQuery(anyString(), anyString());
  }

  @Test
  void aBlockedServiceClauseIsForbiddenLikeOnTheRestEndpointsAndTheAdminPath() {
    final RdfRepository repository = repositoryReturning(EMPTY_SELECT_RESULT);

    final AuthorizationException blocked =
        assertThrows(
            AuthorizationException.class,
            () ->
                run(
                    repository,
                    Map.of(
                        "query",
                        "SELECT * WHERE { SERVICE <https://x.example/sparql> { ?s ?p ?o } }")));

    assertTrue(blocked.getMessage().startsWith("FEDERATION_NOT_ALLOWED:"));
    verify(repository, never()).executeSparqlQueryDirect(anyString(), anyString());
  }

  @Test
  void inferenceAndNonJsonFormatsAreRejectedUpFrontNamingTheRule() {
    final RdfRepository repository = repositoryReturning(EMPTY_SELECT_RESULT);

    final IllegalArgumentException inference =
        assertThrows(
            IllegalArgumentException.class,
            () -> run(repository, Map.of("query", SELECT_ALL, "inferenceLevel", "rdfs")));
    final IllegalArgumentException format =
        assertThrows(
            IllegalArgumentException.class,
            () -> run(repository, Map.of("query", SELECT_ALL, "format", "csv")));

    assertTrue(inference.getMessage().contains("'inferenceLevel' must be 'none'"));
    assertTrue(format.getMessage().contains("'format' must be 'json'"));
    verify(repository, never()).executeSparqlQueryDirect(anyString(), anyString());
  }

  @Test
  void aRefusedOptionIsAuditedLikeAnyOtherOutcomeOfAPermittedCall() {
    final RdfRepository repository = repositoryReturning(EMPTY_SELECT_RESULT);
    final Logger auditLogger = (Logger) LoggerFactory.getLogger(AgentSparqlAudit.class);
    final ListAppender<ILoggingEvent> events = new ListAppender<>();
    events.start();
    auditLogger.addAppender(events);
    try {
      assertThrows(
          IllegalArgumentException.class,
          () -> run(repository, Map.of("query", SELECT_ALL, "inferenceLevel", "rdfs")));

      final String event = events.list.get(0).getFormattedMessage();
      assertTrue(event.contains("effectiveUser=agent-profile-user"), event);
      assertTrue(event.contains("outcome=QUERY_INVALID"), event);
    } finally {
      auditLogger.detachAppender(events);
    }
  }

  @Test
  void explicitlyAskingForTheDefaultsIsAccepted() throws IOException {
    final RdfRepository repository = repositoryReturning(EMPTY_SELECT_RESULT);

    final SparqlQueryTool.Result result =
        run(repository, Map.of("query", SELECT_ALL, "inferenceLevel", "none", "format", "JSON"));

    assertNotNull(result.completeness());
  }

  @Test
  void anUnreadyProjectionIsARetryableErrorAndTheGraphIsNotQueried() {
    final RdfRepository repository = repositoryReturning(EMPTY_SELECT_RESULT);

    final RdfRetryLaterException notReady =
        assertThrows(
            RdfRetryLaterException.class,
            () ->
                tool(repository, () -> RdfProjectionState.REBUILDING)
                    .execute(grantedAuthorizer(), CALLER, Map.of("query", SELECT_ALL)));

    assertTrue(notReady.getMessage().startsWith("PROJECTION_NOT_READY:"));
    verify(repository, never()).executeSparqlQueryDirect(anyString(), anyString());
  }

  @Test
  void aGrantedCallerOnADeploymentWithoutRdfGetsTheNotEnabledMessage() {
    assertThrows(
        RdfNotEnabledException.class,
        () ->
            new SparqlQueryTool(() -> null, SparqlQueryExecutionGuard.shared()::execute)
                .execute(grantedAuthorizer(), CALLER, Map.of("query", SELECT_ALL)));
  }

  @Test
  void aCallerWithoutAPrincipalIsRefusedInsteadOfFailingWithANullPointer() {
    final RdfRepository repository = repositoryReturning(EMPTY_SELECT_RESULT);
    final CatalogSecurityContext anonymous = mock(CatalogSecurityContext.class);

    assertThrows(
        AuthorizationException.class,
        () ->
            tool(repository, () -> RdfProjectionState.READY)
                .execute(grantedAuthorizer(), anonymous, Map.of("query", SELECT_ALL)));
  }

  @Test
  void administratorsKeepConstructGraphAndInferenceOnTheExistingPath() throws IOException {
    final RdfRepository repository = enabledRepository();
    when(repository.executeSparqlQuery(anyString(), anyString())).thenReturn("{}");
    final Authorizer administrator = grantedAuthorizer();
    RdfToolAuthorization.resolveCallersAs(subjects, true);

    final SparqlQueryTool.Result construct =
        tool(repository, () -> RdfProjectionState.READY)
            .execute(
                administrator,
                CALLER,
                Map.of("query", "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 1"));
    final SparqlQueryTool.Result graph =
        tool(repository, () -> RdfProjectionState.READY)
            .execute(
                administrator,
                CALLER,
                Map.of("query", "SELECT * WHERE { GRAPH ?g { ?s ?p ?o } } LIMIT 1"));

    assertEquals("CONSTRUCT", construct.queryType());
    assertEquals("SELECT", graph.queryType());
    assertNull(construct.completeness());
    assertNull(graph.completeness());
    verify(repository, never()).executeSparqlQueryDirect(anyString(), anyString());
  }

  private static SparqlQueryTool.Result run(
      final RdfRepository repository, final Map<String, Object> params) throws IOException {
    return tool(repository, () -> RdfProjectionState.READY)
        .execute(grantedAuthorizer(), CALLER, params);
  }

  private static SparqlQueryTool tool(
      final RdfRepository repository, final Supplier<RdfProjectionState> projectionState) {
    return new SparqlQueryTool(
        () -> repository, SparqlQueryExecutionGuard.shared()::execute, projectionState);
  }

  private static Authorizer grantedAuthorizer() {
    return mock(Authorizer.class);
  }

  private static RdfRepository repositoryReturning(final String selectJson) {
    final RdfRepository repository = enabledRepository();
    when(repository.executeSparqlQueryDirect(anyString(), eq(JSON))).thenReturn(selectJson);
    return repository;
  }

  private static RdfRepository enabledRepository() {
    final RdfRepository repository = mock(RdfRepository.class);
    when(repository.isEnabled()).thenReturn(true);
    when(repository.getConfig()).thenReturn(new RdfConfiguration());
    return repository;
  }

  private static String rows(final int count) {
    final StringBuilder bindings = new StringBuilder();
    for (int row = 0; row < count; row++) {
      bindings.append(row == 0 ? "" : ",");
      bindings.append(
          "{\"s\":{\"type\":\"uri\",\"value\":\"https://open-metadata.org/e/%d\"}}".formatted(row));
    }
    return "{\"head\":{\"vars\":[\"s\"]},\"results\":{\"bindings\":[%s]}}".formatted(bindings);
  }
}
