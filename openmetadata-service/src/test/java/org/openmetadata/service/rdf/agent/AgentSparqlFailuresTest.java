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
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.NotAcceptableException;
import jakarta.ws.rs.NotAuthorizedException;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.rdf.SparqlQueryExecutionGuard.QueryCapacityException;
import org.openmetadata.service.rdf.SparqlQueryExecutionGuard.QueryTimeoutException;
import org.openmetadata.service.rdf.SparqlQueryLimits.OutputLimitExceededException;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.ImpersonationDeniedException;
import org.openmetadata.service.security.ImpersonationTargetNotFoundException;

class AgentSparqlFailuresTest {

  @Test
  void keepsAlreadyClassifiedFailures() {
    AgentSparqlException known =
        new AgentSparqlException(AgentSparqlErrorCode.QUERY_LIMIT_EXCEEDED, "too many");

    assertSame(known, AgentSparqlFailures.classify(known));
  }

  @Test
  void separatesImpersonationFromOtherAuthFailures() {
    assertCode(
        AgentSparqlErrorCode.IMPERSONATION_NOT_ALLOWED,
        new ImpersonationDeniedException("Only bot users can impersonate other users"));
    assertCode(
        AgentSparqlErrorCode.IMPERSONATION_NOT_ALLOWED,
        new ImpersonationTargetNotFoundException("Cannot impersonate non-existent user: ghost"));
    assertCode(
        AgentSparqlErrorCode.AUTHENTICATION_REQUIRED,
        AuthenticationException.getTokenNotPresentException());
    assertCode(
        AgentSparqlErrorCode.AUTHENTICATION_REQUIRED,
        new NotAuthorizedException("Authentication is required"));
    assertCode(
        AgentSparqlErrorCode.RDF_QUERY_FORBIDDEN,
        new AuthorizationException("Principal is not allowed ExecuteSparqlQuery"));
  }

  @Test
  void unknownCallerIsAuthenticationRequired() {
    // On this path the only entity resolution is the caller lookup, so a deleted token
    // subject surfaces here instead of as a backend failure.
    assertCode(
        AgentSparqlErrorCode.AUTHENTICATION_REQUIRED,
        new EntityNotFoundException("user ghost not found"));
  }

  @Test
  void mapsExecutionGuardAndOutputFailures() {
    assertCode(
        AgentSparqlErrorCode.EXECUTION_CAPACITY_EXHAUSTED,
        new QueryCapacityException("SPARQL principal concurrency limit reached"));
    assertCode(
        AgentSparqlErrorCode.EXECUTION_TIMEOUT,
        new QueryTimeoutException(30_000, new InterruptedException()));
    assertCode(
        AgentSparqlErrorCode.RESULT_OUTPUT_LIMIT_EXCEEDED, new OutputLimitExceededException());
  }

  @Test
  void clientRequestErrorsAreInvalidQueries() {
    assertCode(AgentSparqlErrorCode.QUERY_INVALID, new NotAcceptableException());
  }

  @Test
  void auditAttributesTheClassifiedFailureToTheRequest() {
    AgentSparqlCaller caller = new AgentSparqlCaller("request-1", "alice", "agent-bot");

    AgentSparqlException failure =
        assertThrows(
            AgentSparqlException.class,
            () ->
                AgentSparqlAudit.record(
                    caller,
                    () -> {
                      throw new QueryCapacityException("SPARQL server concurrency limit reached");
                    }));

    assertEquals(AgentSparqlErrorCode.EXECUTION_CAPACITY_EXHAUSTED, failure.getCode());
    assertEquals("request-1", failure.getRequestId());
  }

  private static void assertCode(AgentSparqlErrorCode expected, Throwable failure) {
    assertEquals(expected, AgentSparqlFailures.classify(failure).getCode());
  }
}
