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

package org.openmetadata.service.resources.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.rdf.AgentSparqlError;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;
import org.openmetadata.service.rdf.agent.AgentSparqlException;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.ImpersonationDeniedException;

class AgentSparqlTransportTest {

  @Test
  void everyErrorCodeHasTheContractStatus() {
    Map<AgentSparqlErrorCode, Integer> expected =
        Map.ofEntries(
            Map.entry(AgentSparqlErrorCode.QUERY_INVALID, 400),
            Map.entry(AgentSparqlErrorCode.QUERY_FORM_NOT_ALLOWED, 400),
            Map.entry(AgentSparqlErrorCode.GRAPH_SELECTION_NOT_ALLOWED, 400),
            Map.entry(AgentSparqlErrorCode.QUERY_LIMIT_EXCEEDED, 400),
            Map.entry(AgentSparqlErrorCode.AUTHENTICATION_REQUIRED, 401),
            Map.entry(AgentSparqlErrorCode.RDF_QUERY_FORBIDDEN, 403),
            Map.entry(AgentSparqlErrorCode.IMPERSONATION_NOT_ALLOWED, 403),
            Map.entry(AgentSparqlErrorCode.FEDERATION_NOT_ALLOWED, 403),
            Map.entry(AgentSparqlErrorCode.EXECUTION_CAPACITY_EXHAUSTED, 429),
            Map.entry(AgentSparqlErrorCode.RESULT_OUTPUT_LIMIT_EXCEEDED, 413),
            Map.entry(AgentSparqlErrorCode.EXECUTION_TIMEOUT, 503),
            Map.entry(AgentSparqlErrorCode.RDF_REPOSITORY_UNAVAILABLE, 503),
            Map.entry(AgentSparqlErrorCode.PROJECTION_NOT_READY, 503),
            Map.entry(AgentSparqlErrorCode.RDF_BACKEND_FAILURE, 500));

    assertEquals(AgentSparqlErrorCode.values().length, expected.size());
    expected.forEach((code, status) -> assertEquals(status, AgentSparqlTransport.status(code)));
  }

  @Test
  void errorEnvelopeKeepsTheAuditedRequestId() {
    AgentSparqlException failure =
        new AgentSparqlException(AgentSparqlErrorCode.PROJECTION_NOT_READY, "rebuilding")
            .forRequest("request-7");

    Response response = AgentSparqlTransport.errorResponse(failure);

    AgentSparqlError error = (AgentSparqlError) response.getEntity();
    assertEquals(503, response.getStatus());
    assertEquals(AgentSparqlErrorCode.PROJECTION_NOT_READY, error.getCode());
    assertEquals("request-7", error.getRequestId());
  }

  @Test
  void preResourceFailuresGetAGeneratedRequestId() {
    Response unauthenticated =
        AgentSparqlTransport.errorResponse(AuthenticationException.getTokenNotPresentException());
    Response impersonation =
        AgentSparqlTransport.errorResponse(
            new ImpersonationDeniedException("Only bot users can impersonate other users"));

    assertEquals(401, unauthenticated.getStatus());
    assertEquals("om-auth", unauthenticated.getHeaderString(HttpHeaders.WWW_AUTHENTICATE));
    assertNotNull(((AgentSparqlError) unauthenticated.getEntity()).getRequestId());
    assertEquals(403, impersonation.getStatus());
    assertEquals(
        AgentSparqlErrorCode.IMPERSONATION_NOT_ALLOWED,
        ((AgentSparqlError) impersonation.getEntity()).getCode());
  }

  @Test
  void readsOnlyTheQueryField() {
    assertEquals(
        "SELECT ?s WHERE { ?s ?p ?o }",
        AgentSparqlTransport.readQuery("{\"query\":\"SELECT ?s WHERE { ?s ?p ?o }\"}"));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "",
        "not json",
        "{\"query\":\"SELECT * {}\",\"defaultGraphUri\":\"urn:g\"}",
        "{\"query\":\"SELECT * {}\",\"limit\":50000}",
        "null"
      })
  void rejectsMalformedOrExtendedBodies(String body) {
    AgentSparqlException rejected =
        assertThrows(AgentSparqlException.class, () -> AgentSparqlTransport.readQuery(body));
    assertEquals(AgentSparqlErrorCode.QUERY_INVALID, rejected.getCode());
  }

  @Test
  void matchesOnlyTheAgentPath() {
    assertTrue(AgentSparqlTransport.isAgentSparqlRequest(uriInfo("v1/rdf/sparql/agent")));
    assertTrue(AgentSparqlTransport.isAgentSparqlRequest(uriInfo("/v1/rdf/sparql/agent/")));
    assertFalse(AgentSparqlTransport.isAgentSparqlRequest(uriInfo("v1/rdf/sparql")));
    assertFalse(AgentSparqlTransport.isAgentSparqlRequest(uriInfo("v1/rdf/sparql/update")));
    assertFalse(AgentSparqlTransport.isAgentSparqlRequest(null));
  }

  @Test
  void documentedStatusesMatchTheContractMapping() throws Exception {
    Operation operation =
        RdfResource.class
            .getMethod("queryAgentSparql", SecurityContext.class, String.class)
            .getAnnotation(Operation.class);
    Set<String> documented =
        Arrays.stream(operation.responses())
            .map(ApiResponse::responseCode)
            .collect(Collectors.toSet());
    Set<String> mapped =
        Arrays.stream(AgentSparqlErrorCode.values())
            .map(code -> String.valueOf(AgentSparqlTransport.status(code)))
            .collect(Collectors.toSet());

    assertTrue(documented.containsAll(mapped), "Every mapped status is documented: " + mapped);
    documented.remove("200");
    assertEquals(mapped, documented);
  }

  private static UriInfo uriInfo(String path) {
    UriInfo uriInfo = mock(UriInfo.class);
    when(uriInfo.getPath()).thenReturn(path);
    return uriInfo;
  }
}
