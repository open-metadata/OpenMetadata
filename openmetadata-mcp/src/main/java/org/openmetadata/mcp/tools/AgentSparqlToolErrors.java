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

import org.openmetadata.schema.api.rdf.RdfProjectionState;
import org.openmetadata.service.rdf.agent.AgentSparqlException;
import org.openmetadata.service.security.AuthorizationException;

/**
 * Maps the stable agent-profile error codes onto the exception kinds {@code DefaultToolContext}
 * already classifies by name, keeping the code in the message so a client can act on it.
 */
final class AgentSparqlToolErrors {

  private AgentSparqlToolErrors() {}

  private static final String ADMIN_RUNS_REBUILD = "an administrator needs to run RdfIndexApp";

  static RuntimeException toToolException(final AgentSparqlException failure) {
    final String message = "%s: %s".formatted(failure.getCode().value(), failure.getMessage());
    return switch (failure.getCode()) {
      case QUERY_INVALID,
          QUERY_FORM_NOT_ALLOWED,
          GRAPH_SELECTION_NOT_ALLOWED,
          QUERY_LIMIT_EXCEEDED,
          RESULT_OUTPUT_LIMIT_EXCEEDED -> new IllegalArgumentException(message, failure);
        // A blocked SERVICE is a 403 on the REST endpoints and, for administrators, on this tool.
      case FEDERATION_NOT_ALLOWED -> new AuthorizationException(message);
      case EXECUTION_CAPACITY_EXHAUSTED, RDF_REPOSITORY_UNAVAILABLE -> new RdfRetryLaterException(
          message + ". Retry shortly.", failure);
      case PROJECTION_NOT_READY -> projectionNotReady(failure);
      case EXECUTION_TIMEOUT -> new RdfQueryTimeoutException(message, failure);
      default -> new IllegalStateException(message, failure);
    };
  }

  /**
   * A rebuild in progress, or no run recorded yet, finishes on its own and is worth retrying. A
   * degraded projection does not: it stays that way until an administrator runs a full rebuild,
   * so telling the client to retry would only make it loop.
   */
  private static RuntimeException projectionNotReady(final AgentSparqlException failure) {
    final RdfProjectionState state = failure.getProjectionState();
    if (state == RdfProjectionState.DEGRADED) {
      return new RdfProjectionDegradedException(
          "PROJECTION_NOT_READY: RDF projection is degraded; an administrator must run a full"
              + " RdfIndexApp rebuild before graph queries can be answered.",
          failure);
    }
    final String situation =
        state == null
            ? "RDF projection state could not be determined"
            : "RDF projection is rebuilding";
    return new RdfRetryLaterException(
        "PROJECTION_NOT_READY: %s; retry later. If it persists, %s."
            .formatted(situation, ADMIN_RUNS_REBUILD),
        failure);
  }
}
