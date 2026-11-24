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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import org.apache.jena.query.Query;
import org.apache.jena.query.QueryException;
import org.apache.jena.query.QueryFactory;
import org.apache.jena.update.UpdateFactory;
import org.openmetadata.schema.api.rdf.AgentSparqlErrorCode;
import org.openmetadata.service.rdf.SparqlQueryLimits;

/**
 * Accepts only SELECT queries that read the server-selected default graph: no dataset clauses, no
 * GRAPH, and no SERVICE at any nesting level. Inspection runs on the parsed query tree so keywords
 * inside literals or comments are never mistaken for query structure.
 */
public final class AgentSparqlQueryValidator {
  private static final int SERVER_ROW_LIMIT = SparqlQueryLimits.DEFAULT_RESULT_LIMIT;

  public AgentSparqlQueryPlan validate(final String sparql) {
    final Query query = parse(requireBoundedText(sparql));
    requireSelect(query);
    AgentSparqlQueryInspector.inspect(query);
    return plan(query);
  }

  private static String requireBoundedText(final String sparql) {
    if (nullOrEmpty(sparql) || sparql.isBlank()) {
      throw invalid("SPARQL query is required");
    }
    if (sparql.length() > SparqlQueryLimits.MAX_QUERY_CHARACTERS) {
      throw invalid(
          "SPARQL query exceeds the maximum length of %,d characters"
              .formatted(SparqlQueryLimits.MAX_QUERY_CHARACTERS));
    }
    return sparql;
  }

  private static Query parse(final String sparql) {
    try {
      return QueryFactory.create(sparql);
    } catch (QueryException exception) {
      throw isUpdate(sparql)
          ? formNotAllowed("SPARQL UPDATE is not allowed")
          : invalid("Invalid SPARQL query: " + exception.getMessage());
    }
  }

  private static boolean isUpdate(final String sparql) {
    try {
      UpdateFactory.create(sparql);
      return true;
    } catch (QueryException exception) {
      return false;
    }
  }

  private static void requireSelect(final Query query) {
    if (!query.isSelectType()) {
      throw formNotAllowed("Only SELECT queries are allowed, not " + query.queryType());
    }
  }

  private static AgentSparqlQueryPlan plan(final Query query) {
    final Integer explicitLimit = explicitLimit(query);
    if (explicitLimit == null) {
      query.setLimit(SERVER_ROW_LIMIT + 1L);
    }
    return new AgentSparqlQueryPlan(query.toString(), explicitLimit);
  }

  private static Integer explicitLimit(final Query query) {
    if (!query.hasLimit()) {
      return null;
    }
    if (query.getLimit() > SparqlQueryLimits.MAX_RESULT_LIMIT) {
      throw new AgentSparqlException(
          AgentSparqlErrorCode.QUERY_LIMIT_EXCEEDED,
          "SPARQL LIMIT must be at most %,d".formatted(SparqlQueryLimits.MAX_RESULT_LIMIT));
    }
    return Math.toIntExact(query.getLimit());
  }

  private static AgentSparqlException invalid(final String message) {
    return new AgentSparqlException(AgentSparqlErrorCode.QUERY_INVALID, message);
  }

  private static AgentSparqlException formNotAllowed(final String message) {
    return new AgentSparqlException(AgentSparqlErrorCode.QUERY_FORM_NOT_ALLOWED, message);
  }
}
