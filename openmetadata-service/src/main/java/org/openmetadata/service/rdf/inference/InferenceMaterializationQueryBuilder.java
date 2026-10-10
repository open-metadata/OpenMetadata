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

package org.openmetadata.service.rdf.inference;

import java.util.List;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryFactory;
import org.apache.jena.sparql.core.Quad;
import org.apache.jena.sparql.modify.request.UpdateClear;
import org.apache.jena.sparql.modify.request.UpdateModify;
import org.apache.jena.update.UpdateRequest;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.api.configuration.rdf.InferenceRuleStatus;

/** Rewrites validated CONSTRUCT rules into Fuseki-side named-graph updates. */
final class InferenceMaterializationQueryBuilder {
  private InferenceMaterializationQueryBuilder() {}

  /**
   * Adds the rule's conclusions to its graph without clearing it, so repeated passes accumulate
   * toward a fixed point. The WHERE clause reads Fuseki's union default graph, which holds the
   * asserted graphs and every rule graph; a {@code USING} list would make Jena build an in-memory
   * union of the graphs it names instead.
   */
  static String insert(final InferenceRuleStatus status) {
    final InferenceRule rule = status.getRule();
    InferenceRuleValidator.requireValid(rule, rule.getName());
    final Query query = QueryFactory.create(rule.getRuleBody());
    final UpdateRequest request = requestWithPrologue(query);
    request.add(buildInsert(query, NodeFactory.createURI(status.getGraphUri().toString())));
    return request.toString();
  }

  static String clear(final List<String> graphUris) {
    final UpdateRequest request = new UpdateRequest();
    graphUris.forEach(
        graphUri -> request.add(new UpdateClear(NodeFactory.createURI(graphUri), true)));
    return request.toString();
  }

  private static UpdateModify buildInsert(final Query query, final Node graph) {
    final UpdateModify update = new UpdateModify();
    update.setHasInsertClause(true);
    query.getConstructTemplate().getTriples().stream()
        .map(triple -> new Quad(graph, triple))
        .forEach(update.getInsertAcc()::addQuad);
    update.setElement(query.getQueryPattern());
    return update;
  }

  private static UpdateRequest requestWithPrologue(final Query query) {
    final UpdateRequest request = new UpdateRequest();
    request.setPrefixMapping(query.getPrefixMapping());
    if (query.explicitlySetBaseURI()) {
      request.setBaseURI(query.getBaseURI());
    }
    return request;
  }
}
