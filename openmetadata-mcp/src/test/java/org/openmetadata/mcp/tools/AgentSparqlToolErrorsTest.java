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

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;
import org.openmetadata.service.rdf.agent.AgentSparqlException;
import org.openmetadata.service.security.AuthorizationException;

class AgentSparqlToolErrorsTest {

  private static final Set<AgentSparqlErrorCode> CLIENT_ERRORS =
      Set.of(
          AgentSparqlErrorCode.QUERY_INVALID,
          AgentSparqlErrorCode.QUERY_FORM_NOT_ALLOWED,
          AgentSparqlErrorCode.GRAPH_SELECTION_NOT_ALLOWED,
          AgentSparqlErrorCode.QUERY_LIMIT_EXCEEDED,
          AgentSparqlErrorCode.RESULT_OUTPUT_LIMIT_EXCEEDED);
  private static final Set<AgentSparqlErrorCode> RETRYABLE =
      Set.of(
          AgentSparqlErrorCode.EXECUTION_CAPACITY_EXHAUSTED,
          AgentSparqlErrorCode.PROJECTION_NOT_READY,
          AgentSparqlErrorCode.RDF_REPOSITORY_UNAVAILABLE);

  @Test
  void queryShapeRejectionsAreClientErrorsThatKeepTheirCode() {
    for (AgentSparqlErrorCode code : CLIENT_ERRORS) {
      final RuntimeException mapped = map(code);

      assertThat(mapped).as(code.value()).isInstanceOf(IllegalArgumentException.class);
      assertThat(mapped.getMessage()).startsWith(code.value() + ": ");
    }
  }

  @Test
  void aBlockedServiceClauseIsForbiddenLikeOnTheRestEndpoints() {
    assertThat(map(AgentSparqlErrorCode.FEDERATION_NOT_ALLOWED))
        .isInstanceOf(AuthorizationException.class)
        .hasMessageStartingWith("FEDERATION_NOT_ALLOWED: ");
  }

  @Test
  void transientStatesTellTheClientToRetry() {
    for (AgentSparqlErrorCode code : RETRYABLE) {
      assertThat(map(code))
          .as(code.value())
          .isInstanceOf(RdfRetryLaterException.class)
          .hasMessageStartingWith(code.value() + ": ")
          .hasMessageEndingWith("Retry shortly.");
    }
  }

  @Test
  void aTimeoutIsClassifiedAsATimeout() {
    assertThat(map(AgentSparqlErrorCode.EXECUTION_TIMEOUT))
        .isInstanceOf(RdfQueryTimeoutException.class);
  }

  @Test
  void everyOtherCodeIsAServerFaultWithTheOriginalAsCause() {
    for (AgentSparqlErrorCode code : AgentSparqlErrorCode.values()) {
      if (!CLIENT_ERRORS.contains(code)
          && !RETRYABLE.contains(code)
          && code != AgentSparqlErrorCode.FEDERATION_NOT_ALLOWED
          && code != AgentSparqlErrorCode.EXECUTION_TIMEOUT) {
        final RuntimeException mapped = map(code);

        assertThat(mapped).as(code.value()).isInstanceOf(IllegalStateException.class);
        assertThat(mapped.getCause()).isInstanceOf(AgentSparqlException.class);
      }
    }
  }

  private static RuntimeException map(final AgentSparqlErrorCode code) {
    return AgentSparqlToolErrors.toToolException(new AgentSparqlException(code, "detail"));
  }
}
