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

import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;

/**
 * Emits one structured log event per agent SPARQL request with both the service actor and the
 * effective user. Query text is deliberately not logged.
 */
@Slf4j
public final class AgentSparqlAudit {
  private static final String SUCCESS = "SUCCESS";

  private AgentSparqlAudit() {}

  public static AgentSparqlResult record(
      final AgentSparqlCaller caller, final Supplier<AgentSparqlResult> execution) {
    final long startNanos = System.nanoTime();
    try {
      final AgentSparqlResult result = execution.get();
      log(caller, SUCCESS, result.rowCount(), startNanos);
      return result;
    } catch (RuntimeException exception) {
      final AgentSparqlException failure =
          AgentSparqlFailures.classify(exception).forRequest(caller.requestId());
      log(caller, failure.getCode().value(), 0, startNanos);
      logBackendCause(caller, failure);
      throw failure;
    }
  }

  private static void log(
      final AgentSparqlCaller caller, final String outcome, final int rows, final long startNanos) {
    LOG.info(
        "agent_sparql_query requestId={} serviceActor={} effectiveUser={} outcome={} rows={}"
            + " durationMs={}",
        caller.requestId(),
        caller.serviceActor(),
        caller.effectiveUser(),
        outcome,
        rows,
        (System.nanoTime() - startNanos) / 1_000_000);
  }

  private static void logBackendCause(
      final AgentSparqlCaller caller, final AgentSparqlException failure) {
    if (failure.getCode() == AgentSparqlErrorCode.RDF_BACKEND_FAILURE) {
      LOG.warn("agent_sparql_query requestId={} backend failure", caller.requestId(), failure);
    }
  }
}
