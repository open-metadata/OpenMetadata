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

import java.util.List;
import org.openmetadata.schema.api.rdf.AgentSparqlBinding;
import org.openmetadata.schema.api.rdf.AgentSparqlCompleteness;
import org.openmetadata.schema.api.rdf.AgentSparqlCompletenessBasis;
import org.openmetadata.schema.api.rdf.AgentSparqlCompletenessReason;
import org.openmetadata.schema.api.rdf.AgentSparqlCompletenessStatus;
import org.openmetadata.schema.api.rdf.AgentSparqlEffectiveLimits;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;
import org.openmetadata.schema.api.rdf.AgentSparqlMetadata;
import org.openmetadata.schema.api.rdf.AgentSparqlResponse;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.SparqlQueryLimits;

/**
 * Turns a backend SPARQL JSON result into the typed agent response. Completeness is judged against
 * the submitted query: an explicit LIMIT is honored as-is, while a server-limited query executed
 * one row past the limit so an extra row proves truncation.
 */
final class AgentSparqlResultMapper {
  private static final int SERVER_ROW_LIMIT = SparqlQueryLimits.DEFAULT_RESULT_LIMIT;

  AgentSparqlResponse toResponse(final String sparqlJson, final AgentSparqlQueryPlan plan) {
    final AgentSparqlResponse response = parse(sparqlJson);
    final List<AgentSparqlBinding> bindings = response.getResults().getBindings();
    final boolean truncated = plan.isServerLimited() && bindings.size() > SERVER_ROW_LIMIT;
    if (truncated) {
      response.getResults().setBindings(List.copyOf(bindings.subList(0, SERVER_ROW_LIMIT)));
    }
    return response.withMetadata(metadata(plan, truncated));
  }

  private static AgentSparqlResponse parse(final String sparqlJson) {
    final AgentSparqlResponse response;
    try {
      response = JsonUtils.readValue(sparqlJson, AgentSparqlResponse.class);
    } catch (JsonParsingException exception) {
      throw unreadableResult(exception);
    }
    if (response == null || response.getHead() == null || response.getResults() == null) {
      throw unreadableResult(null);
    }
    return response;
  }

  private static AgentSparqlMetadata metadata(
      final AgentSparqlQueryPlan plan, final boolean truncated) {
    return new AgentSparqlMetadata()
        .withCompleteness(completeness(truncated))
        .withEffectiveLimits(
            new AgentSparqlEffectiveLimits()
                .withServerRowLimit(SERVER_ROW_LIMIT)
                .withExplicitQueryLimit(plan.explicitLimit())
                .withOutputBytesLimit(SparqlQueryLimits.MAX_OUTPUT_BYTES));
  }

  private static AgentSparqlCompleteness completeness(final boolean truncated) {
    return new AgentSparqlCompleteness()
        .withStatus(
            truncated
                ? AgentSparqlCompletenessStatus.TRUNCATED
                : AgentSparqlCompletenessStatus.COMPLETE)
        .withRelativeTo(AgentSparqlCompletenessBasis.SUBMITTED_QUERY)
        .withReason(truncated ? AgentSparqlCompletenessReason.SERVER_ROW_LIMIT : null);
  }

  private static AgentSparqlException unreadableResult(final Throwable cause) {
    return new AgentSparqlException(
        AgentSparqlErrorCode.RDF_BACKEND_FAILURE,
        "The RDF backend returned an unreadable SELECT result",
        cause);
  }
}
