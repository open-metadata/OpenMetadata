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

import com.fasterxml.jackson.core.JsonProcessingException;
import java.util.Objects;
import java.util.function.Supplier;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;
import org.openmetadata.schema.api.rdf.AgentSparqlResponse;
import org.openmetadata.schema.api.rdf.RdfProjectionState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.RdfSparqlService;
import org.openmetadata.service.rdf.SparqlQueryExecutionGuard;
import org.openmetadata.service.rdf.SparqlQueryLimits;

/**
 * Executes agent-authored SELECT queries against the server-configured RDF dataset.
 *
 * <p>Readiness is checked before execution and again before returning, discarding the result if
 * the projection stopped being ready. This is a conservative readiness policy, not a snapshot
 * guarantee: a transition that starts and ends between the two checks is not detected.
 */
public final class AgentSparqlService {
  private final Supplier<RdfSparqlService> sparqlServiceSupplier;
  private final Supplier<RdfProjectionState> projectionStateSupplier;
  private final SparqlQueryExecutionGuard executionGuard;
  private final AgentSparqlQueryValidator validator = new AgentSparqlQueryValidator();
  private final AgentSparqlResultMapper resultMapper = new AgentSparqlResultMapper();

  public AgentSparqlService(
      final Supplier<RdfSparqlService> sparqlServiceSupplier,
      final Supplier<RdfProjectionState> projectionStateSupplier,
      final SparqlQueryExecutionGuard executionGuard) {
    this.sparqlServiceSupplier = Objects.requireNonNull(sparqlServiceSupplier);
    this.projectionStateSupplier = Objects.requireNonNull(projectionStateSupplier);
    this.executionGuard = Objects.requireNonNull(executionGuard);
  }

  /**
   * @param effectiveUser the validated effective caller, resolved before the guard's thread handoff
   *     so per-user concurrency never keys on the impersonating bot
   */
  public AgentSparqlResult execute(final String effectiveUser, final String sparql) {
    try {
      return executeValidated(effectiveUser, validator.validate(sparql));
    } catch (RuntimeException exception) {
      throw AgentSparqlFailures.classify(exception);
    }
  }

  private AgentSparqlResult executeValidated(
      final String effectiveUser, final AgentSparqlQueryPlan plan) {
    final RdfSparqlService sparqlService = sparqlServiceSupplier.get();
    requireReadyProjection();
    final String sparqlJson =
        executionGuard.execute(
            effectiveUser, () -> sparqlService.selectJsonWithoutInference(plan.executableSparql()));
    final AgentSparqlResponse response = resultMapper.toResponse(sparqlJson, plan);
    requireReadyProjection();
    return new AgentSparqlResult(
        serializeBounded(response), response.getResults().getBindings().size());
  }

  private void requireReadyProjection() {
    final RdfProjectionState state = currentProjectionState();
    if (state != RdfProjectionState.READY) {
      throw projectionNotReady("RDF projection is not ready (" + state + ")", null);
    }
  }

  private RdfProjectionState currentProjectionState() {
    try {
      return projectionStateSupplier.get();
    } catch (RuntimeException exception) {
      throw projectionNotReady("RDF projection state could not be determined", exception);
    }
  }

  private static byte[] serializeBounded(final AgentSparqlResponse response) {
    final byte[] body;
    try {
      body = JsonUtils.getObjectMapper().writeValueAsBytes(response);
    } catch (JsonProcessingException exception) {
      throw new AgentSparqlException(
          AgentSparqlErrorCode.RDF_BACKEND_FAILURE, "Could not serialize SELECT result", exception);
    }
    if (body.length > SparqlQueryLimits.MAX_OUTPUT_BYTES) {
      throw new SparqlQueryLimits.OutputLimitExceededException();
    }
    return body;
  }

  private static AgentSparqlException projectionNotReady(
      final String message, final Throwable cause) {
    return new AgentSparqlException(AgentSparqlErrorCode.PROJECTION_NOT_READY, message, cause);
  }
}
