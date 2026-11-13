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

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.apache.jena.graph.Graph;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.graph.Triple;
import org.apache.jena.riot.out.NodeFmtLib;
import org.openmetadata.service.rdf.RdfOwnedResources;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.translator.RdfPropertyMapper;

/**
 * The triples one entity write replaces: the entity's literals, its values under the predicates
 * the translator owns, and the subresources it owns. Writes outside this scope, such as
 * relationship and lineage edges, are never deleted by an entity write.
 */
final class RdfEntityScope {
  private RdfEntityScope() {}

  /**
   * The translator's static "always managed" predicates, which cover a field that shrank to empty
   * and is no longer emitted, plus whatever predicates the new model emits for the entity, which
   * cover predicates introduced through the JSON-LD context. Relationship-hook predicates such as
   * {@code om:owns} and {@code om:upstream} are excluded even when a model carries them: their
   * edges are maintained by their own writes, and replacing them from an entity snapshot would race
   * those writes.
   */
  static Set<String> translatorPredicates(final String entityUri, final Graph model) {
    final Set<String> predicates =
        new LinkedHashSet<>(RdfPropertyMapper.TRANSLATOR_MANAGED_DIRECT_PREDICATES);
    model
        .find(NodeFactory.createURI(entityUri), Node.ANY, Node.ANY)
        .forEachRemaining(triple -> predicates.add(triple.getPredicate().getURI()));
    predicates.removeAll(RdfRepository.RELATIONSHIP_HOOK_PREDICATES);
    return predicates;
  }

  /**
   * One WHERE-bearing operation, not two: Fuseki rejects an update request carrying more than one
   * whenever {@code arq:updateTimeout} is configured. {@code !isIRI(?o) || ?p IN (...)} removes the
   * literal values whatever the predicate, so a literal that shrank to empty does not persist, and
   * the IRI values of translator-owned predicates; hook-managed IRI values survive.
   */
  static String deleteUpdate(final Set<String> entityUris, final Set<String> predicates) {
    return entityUris.isEmpty()
        ? ""
        : "DELETE { GRAPH <"
            + JenaFusekiStorage.KNOWLEDGE_GRAPH
            + "> { ?subject ?p ?o } } WHERE { "
            + scope(entityUris, predicates)
            + " }";
  }

  /** The triples {@link #deleteUpdate} would remove for {@code entityUri}, read instead. */
  static String storedTriplesQuery(final String entityUri, final Set<String> predicates) {
    return "CONSTRUCT { ?subject ?p ?o } WHERE { " + scope(Set.of(entityUri), predicates) + " }";
  }

  /**
   * The triples of {@code model} this scope does not cover, such as the labels of the tags an
   * entity carries, the types of the entities it references and its lineage edges. A write only
   * adds them when missing, as other writes own them too.
   */
  static List<Triple> outsideScope(
      final Graph model, final String entityUri, final Set<String> predicates) {
    final Node entity = NodeFactory.createURI(entityUri);
    final Set<Node> owned = RdfOwnedResources.ownedSubjects(model, entity);
    final List<Triple> outside = new ArrayList<>();
    model
        .find()
        .forEachRemaining(
            triple -> {
              if (!owned.contains(triple.getSubject())
                  && !isEntityTripleInScope(triple, entity, predicates)) {
                outside.add(triple);
              }
            });
    return outside;
  }

  /** Which of {@code triples} the store holds, matched by value as the store does. */
  static String existingTriplesQuery(final List<Triple> triples) {
    final StringBuilder values = new StringBuilder();
    for (Triple triple : triples) {
      values
          .append("(")
          .append(NodeFmtLib.strNT(triple.getSubject()))
          .append(' ')
          .append(NodeFmtLib.strNT(triple.getPredicate()))
          .append(' ')
          .append(NodeFmtLib.strNT(triple.getObject()))
          .append(")\n");
    }
    return "CONSTRUCT { ?subject ?p ?o } WHERE { GRAPH <"
        + JenaFusekiStorage.KNOWLEDGE_GRAPH
        + "> { VALUES (?subject ?p ?o) { "
        + values
        + "} ?subject ?p ?o } }";
  }

  private static boolean isEntityTripleInScope(
      final Triple triple, final Node entity, final Set<String> predicates) {
    final Node object = triple.getObject();
    return triple.getSubject().equals(entity)
        && (!object.isURI()
            || predicates.contains(triple.getPredicate().getURI())
            || RdfOwnedResources.isOwnedList(entity.getURI(), object));
  }

  private static String scope(final Set<String> entityUris, final Set<String> predicates) {
    final String filter =
        predicates.isEmpty()
            ? "!isIRI(?o)"
            : "!isIRI(?o) || ?p IN (" + iris(predicates, ", ") + ")";
    return String.format(
        "GRAPH <%1$s> { VALUES ?entity { %2$s } "
            + "{ ?entity ?p ?o . BIND(?entity AS ?subject) FILTER(%3$s) } UNION { %4$s } }",
        JenaFusekiStorage.KNOWLEDGE_GRAPH,
        iris(entityUris, " "),
        filter,
        RdfOwnedResources.ownedTriplesPattern());
  }

  private static String iris(final Iterable<String> iris, final String separator) {
    final StringBuilder list = new StringBuilder();
    for (String iri : iris) {
      if (!list.isEmpty()) {
        list.append(separator);
      }
      list.append('<').append(iri).append('>');
    }
    return list.toString();
  }
}
