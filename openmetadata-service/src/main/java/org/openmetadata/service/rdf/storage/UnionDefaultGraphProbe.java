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
package org.openmetadata.service.rdf.storage;

import com.google.common.base.Throwables;
import java.util.UUID;
import org.apache.jena.atlas.web.HttpException;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryFactory;
import org.apache.jena.update.UpdateFactory;
import org.apache.jena.update.UpdateRequest;

/**
 * One triple written into a named graph, the way indexing stores entities, then asked for without
 * a GRAPH clause, the way SHACL validation, inference, the SPARQL playground and the MCP tools
 * read. The read only sees named graphs when the dataset enables {@code tdb2:unionDefaultGraph},
 * which no response header proves on every Fuseki, so readiness observes it instead; the write
 * also proves the dataset accepts SPARQL updates. Each probe has its own subject, so probes run by
 * other servers at the same time never see or remove each other's triple.
 */
record UnionDefaultGraphProbe(String subject) {
  static final String GRAPH = "https://open-metadata.org/graph/readiness-probe";
  private static final String PREDICATE = GRAPH + "#written";

  private static final String UNION_DISABLED =
      "Fuseki dataset '%s' at %s does not enable tdb2:unionDefaultGraph, so SPARQL without a GRAPH"
          + " clause cannot see indexed entities: set tdb2:unionDefaultGraph true in its TDB2"
          + " assembler";
  private static final String UPDATE_NOT_ACCEPTED =
      "Fuseki dataset '%s' at %s did not accept a SPARQL update (%s): serve it with"
          + " fuseki:serviceUpdate, or start Fuseki with --update, and grant the RDF user write"
          + " access to it";

  static UnionDefaultGraphProbe unique() {
    return new UnionDefaultGraphProbe("urn:uuid:" + UUID.randomUUID());
  }

  UpdateRequest write() {
    return UpdateFactory.create("INSERT DATA { GRAPH <" + GRAPH + "> { " + triple() + " } }");
  }

  Query askWithoutGraphClause() {
    return QueryFactory.create("ASK { " + triple() + " }");
  }

  UpdateRequest remove() {
    return UpdateFactory.create("DELETE DATA { GRAPH <" + GRAPH + "> { " + triple() + " } }");
  }

  static String unionDisabledMessage(final String server, final String dataset) {
    return UNION_DISABLED.formatted(dataset, server);
  }

  static String updateNotAcceptedMessage(
      final String server, final String dataset, final RuntimeException failure) {
    return UPDATE_NOT_ACCEPTED.formatted(dataset, server, evidence(failure));
  }

  private static String evidence(final RuntimeException failure) {
    return Throwables.getCausalChain(failure).stream()
        .filter(HttpException.class::isInstance)
        .map(cause -> ((HttpException) cause).getStatusCode())
        .filter(status -> status > 0)
        .findFirst()
        .map(status -> "HTTP " + status)
        .orElseGet(failure::getMessage);
  }

  private String triple() {
    return "<" + subject + "> <" + PREDICATE + "> true";
  }
}
