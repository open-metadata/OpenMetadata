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

import org.openmetadata.service.rdf.agent.AgentSparqlException;
import org.openmetadata.service.security.AuthorizationException;

/**
 * Maps the stable agent-profile error codes onto the exception kinds {@code DefaultToolContext}
 * already classifies by name, keeping the code in the message so a client can act on it.
 */
final class AgentSparqlToolErrors {

  private AgentSparqlToolErrors() {}

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
      case EXECUTION_CAPACITY_EXHAUSTED,
          PROJECTION_NOT_READY,
          RDF_REPOSITORY_UNAVAILABLE -> new RdfRetryLaterException(
          message + ". Retry shortly.", failure);
      case EXECUTION_TIMEOUT -> new RdfQueryTimeoutException(message, failure);
      default -> new IllegalStateException(message, failure);
    };
  }
}
