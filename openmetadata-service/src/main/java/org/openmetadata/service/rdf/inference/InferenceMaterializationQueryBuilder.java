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

/** Rewrites a validated CONSTRUCT rule into a Fuseki-side named-graph materialization update. */
final class InferenceMaterializationQueryBuilder {
  private InferenceMaterializationQueryBuilder() {}

  static String build(final InferenceRuleStatus status) {
    final InferenceRule rule = status.getRule();
    InferenceRuleValidator.requireValid(rule, rule.getName());
    final Query query = QueryFactory.create(rule.getRuleBody());
    final Node graph = NodeFactory.createURI(status.getGraphUri().toString());
    final UpdateRequest request = requestWithPrologue(query);
    request.add(new UpdateClear(graph, true));
    request.add(buildInsert(query, graph));
    return request.toString();
  }

  static String clear(final List<InferenceRuleStatus> statuses) {
    final UpdateRequest request = new UpdateRequest();
    statuses.stream()
        .map(InferenceRuleStatus::getGraphUri)
        .map(Object::toString)
        .map(NodeFactory::createURI)
        .map(graph -> new UpdateClear(graph, true))
        .forEach(request::add);
    return request.toString();
  }

  static String clear(final String graphUri) {
    return new UpdateRequest(new UpdateClear(NodeFactory.createURI(graphUri), true)).toString();
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
