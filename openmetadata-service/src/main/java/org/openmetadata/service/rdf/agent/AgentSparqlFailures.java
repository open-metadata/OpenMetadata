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

import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.ServiceUnavailableException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.rdf.SparqlQueryExecutionGuard.QueryCapacityException;
import org.openmetadata.service.rdf.SparqlQueryExecutionGuard.QueryTimeoutException;
import org.openmetadata.service.rdf.SparqlQueryLimits.OutputLimitExceededException;
import org.openmetadata.service.rdf.storage.JenaFusekiStorage;
import org.openmetadata.service.rdf.storage.RdfStorageCircuitOpenException;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.ImpersonationDeniedException;
import org.openmetadata.service.security.ImpersonationTargetNotFoundException;

/**
 * Maps any failure on the agent SPARQL path to its stable code. Backend-derived failures get fixed
 * messages so storage URLs, credentials, and stack details never reach the caller.
 */
public final class AgentSparqlFailures {

  private AgentSparqlFailures() {}

  public static AgentSparqlException classify(final Throwable failure) {
    return switch (failure) {
      case AgentSparqlException known -> known;
      case ImpersonationDeniedException denied -> impersonationNotAllowed(denied);
      case ImpersonationTargetNotFoundException missing -> impersonationNotAllowed(missing);
      case AuthenticationException unauthenticated -> authenticationRequired(unauthenticated);
      case NotAuthorizedException unauthenticated -> authenticationRequired(unauthenticated);
        // Entity resolution on this path is the caller and policy lookup during authorization,
        // so a failure here means the caller cannot be established; report it as unknown caller
        // rather than a backend failure.
      case EntityNotFoundException unknownCaller -> authenticationRequired(unknownCaller);
      case AuthorizationException forbidden -> new AgentSparqlException(
          AgentSparqlErrorCode.RDF_QUERY_FORBIDDEN,
          "The caller is not permitted to execute agent SPARQL queries",
          forbidden);
      default -> classifyExecutionFailure(failure);
    };
  }

  private static AgentSparqlException classifyExecutionFailure(final Throwable failure) {
    return switch (failure) {
      case QueryCapacityException capacity -> new AgentSparqlException(
          AgentSparqlErrorCode.EXECUTION_CAPACITY_EXHAUSTED, capacity.getMessage(), capacity);
      case QueryTimeoutException timeout -> executionTimeout(timeout);
      case OutputLimitExceededException tooLarge -> new AgentSparqlException(
          AgentSparqlErrorCode.RESULT_OUTPUT_LIMIT_EXCEEDED, tooLarge.getMessage(), tooLarge);
      case RdfStorageCircuitOpenException circuitOpen -> repositoryUnavailable(circuitOpen);
      case ServiceUnavailableException disabled -> repositoryUnavailable(disabled);
      case WebApplicationException request -> classifyRequestFailure(request);
      default -> classifyStorageFailure(failure);
    };
  }

  private static AgentSparqlException classifyStorageFailure(final Throwable failure) {
    if (JenaFusekiStorage.isTimeoutFailure(failure)) {
      return executionTimeout(failure);
    }
    if (JenaFusekiStorage.isUnavailableFailure(failure)) {
      return repositoryUnavailable(failure);
    }
    return new AgentSparqlException(
        AgentSparqlErrorCode.RDF_BACKEND_FAILURE,
        "The RDF backend failed to execute the query",
        failure);
  }

  private static AgentSparqlException classifyRequestFailure(
      final WebApplicationException exception) {
    final boolean isClientError =
        exception.getResponse().getStatusInfo().getFamily() == Response.Status.Family.CLIENT_ERROR;
    return isClientError
        ? new AgentSparqlException(
            AgentSparqlErrorCode.QUERY_INVALID, "The request could not be processed", exception)
        : classifyStorageFailure(exception);
  }

  private static AgentSparqlException impersonationNotAllowed(final Throwable cause) {
    return new AgentSparqlException(
        AgentSparqlErrorCode.IMPERSONATION_NOT_ALLOWED,
        "The requested impersonation is not allowed",
        cause);
  }

  private static AgentSparqlException authenticationRequired(final Throwable cause) {
    return new AgentSparqlException(
        AgentSparqlErrorCode.AUTHENTICATION_REQUIRED, "Valid authentication is required", cause);
  }

  private static AgentSparqlException executionTimeout(final Throwable cause) {
    return new AgentSparqlException(
        AgentSparqlErrorCode.EXECUTION_TIMEOUT, "The SPARQL query exceeded its time limit", cause);
  }

  private static AgentSparqlException repositoryUnavailable(final Throwable cause) {
    return new AgentSparqlException(
        AgentSparqlErrorCode.RDF_REPOSITORY_UNAVAILABLE,
        "The RDF repository is unavailable",
        cause);
  }
}
