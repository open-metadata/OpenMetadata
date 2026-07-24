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

package org.openmetadata.service.rdf;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import org.apache.jena.query.Query;
import org.apache.jena.query.QueryException;
import org.apache.jena.query.QueryFactory;
import org.apache.jena.query.QueryType;
import org.openmetadata.service.monitoring.OntologyMetrics;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard.FederationDisallowedException;

/** Validates the shared read-only SPARQL boundary used by manual and AI-generated queries. */
public final class OntologySparqlQueryValidator {
  private final SparqlFederationGuard federationGuard;

  public OntologySparqlQueryValidator(final SparqlFederationGuard federationGuard) {
    this.federationGuard = federationGuard;
  }

  public Query validate(final String sparql) {
    final Query query;
    try {
      query = validateQuery(sparql);
    } catch (IllegalArgumentException | FederationDisallowedException exception) {
      OntologyMetrics.recordQueryRejection();
      throw exception;
    }
    return query;
  }

  private Query validateQuery(final String sparql) {
    requireQuery(sparql);
    SparqlQueryLimits.requireBoundedText(sparql);
    federationGuard.enforce(sparql);
    final Query query = parse(sparql);
    requireReadQuery(query);
    rejectExternalDataset(query);
    return SparqlQueryLimits.applyResultLimit(query);
  }

  private static Query parse(final String sparql) {
    final Query query;
    try {
      query = QueryFactory.create(sparql);
    } catch (QueryException exception) {
      throw new IllegalArgumentException(
          "Invalid SPARQL query: " + exception.getMessage(), exception);
    }
    return query;
  }

  private static void requireQuery(final String sparql) {
    if (nullOrEmpty(sparql) || sparql.isBlank()) {
      throw new IllegalArgumentException("SPARQL query is required");
    }
  }

  private static void requireReadQuery(final Query query) {
    if (!isSupported(query.queryType())) {
      throw new IllegalArgumentException("Only read-only SPARQL queries are accepted");
    }
  }

  private static boolean isSupported(final QueryType queryType) {
    return switch (queryType) {
      case SELECT, ASK, CONSTRUCT, DESCRIBE -> true;
      default -> false;
    };
  }

  private static void rejectExternalDataset(final Query query) {
    if (!query.getGraphURIs().isEmpty() || !query.getNamedGraphURIs().isEmpty()) {
      throw new IllegalArgumentException(
          "Ontology-scoped SPARQL does not accept FROM or external graph URIs");
    }
  }
}
