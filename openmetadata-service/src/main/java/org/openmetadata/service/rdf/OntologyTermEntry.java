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

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFList;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.ResourceFactory;
import org.apache.jena.rdf.model.Statement;
import org.apache.jena.vocabulary.OWL;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;

/**
 * Cuts one term out of the canonical ontology: a class with every property whose declared domain
 * covers the class or one of its superclasses, plus by label and comment every shared property whose
 * schema:domainIncludes names one of them; or a property on its own.
 */
final class OntologyTermEntry {
  private static final String HTTP = "http://";
  private static final String HTTPS = "https://";
  private static final Property DOMAIN_INCLUDES =
      ResourceFactory.createProperty("https://schema.org/domainIncludes");
  private static final List<Property> SUMMARY = List.of(RDFS.label, RDFS.comment);

  private OntologyTermEntry() {}

  static Optional<Resource> resolve(Model ontology, String term) {
    final String iri = ontology.expandPrefix(Objects.requireNonNullElse(term, "").strip());
    final Resource resource = ontology.createResource(iri);
    final boolean declared =
        (iri.startsWith(HTTP) || iri.startsWith(HTTPS))
            && ontology.contains(resource, null, (RDFNode) null);
    return declared ? Optional.of(resource) : Optional.empty();
  }

  static Model extract(Model ontology, Resource term) {
    final Model entry = ModelFactory.createDefaultModel();
    entry.setNsPrefixes(ontology.getNsPrefixMap());
    addDescription(ontology, term, entry);
    final Set<Resource> classes = classesCovering(ontology, term);
    final Set<Resource> declared = propertiesWith(ontology, RDFS.domain, classes);
    declared.forEach(property -> addDescription(ontology, property, entry));
    propertiesWith(ontology, DOMAIN_INCLUDES, classes).stream()
        .filter(property -> !declared.contains(property))
        .forEach(property -> addSummary(ontology, property, entry));
    return entry;
  }

  private static Set<Resource> classesCovering(Model ontology, Resource term) {
    final boolean isClass =
        ontology.contains(term, RDF.type, OWL.Class)
            || ontology.contains(term, RDF.type, RDFS.Class);
    return isClass ? superClasses(ontology, term) : Set.of();
  }

  private static Set<Resource> propertiesWith(
      Model ontology, Property axis, Set<Resource> classes) {
    return ontology
        .listStatements(null, axis, (RDFNode) null)
        .filterKeep(
            statement ->
                classes.contains(statement.getObject())
                    || (RDFS.domain.equals(axis) && unionCovers(statement.getObject(), classes)))
        .mapWith(Statement::getSubject)
        .toSet();
  }

  private static boolean unionCovers(final RDFNode domain, final Set<Resource> classes) {
    if (!domain.isAnon() || classes.isEmpty()) {
      return false;
    }
    final Resource members = domain.asResource().getPropertyResourceValue(OWL.unionOf);
    return members != null
        && members.as(RDFList.class).iterator().filterKeep(classes::contains).hasNext();
  }

  /** A shared predicate is listed by label and comment; its own entry has the rest. */
  private static void addSummary(Model ontology, Resource property, Model entry) {
    SUMMARY.forEach(
        axis -> entry.add(ontology.listStatements(property, axis, (RDFNode) null).toList()));
  }

  private static Set<Resource> superClasses(Model ontology, Resource start) {
    final Set<Resource> seen = new HashSet<>();
    final Deque<Resource> pending = new ArrayDeque<>(Set.of(start));
    while (!pending.isEmpty()) {
      final Resource next = pending.pop();
      if (seen.add(next)) {
        ontology
            .listObjectsOfProperty(next, RDFS.subClassOf)
            .filterKeep(RDFNode::isURIResource)
            .forEachRemaining(parent -> pending.push(parent.asResource()));
      }
    }
    return seen;
  }

  /** The subject's statements, following blank-node objects so lists and restrictions stay whole. */
  private static void addDescription(Model ontology, Resource subject, Model entry) {
    final Deque<Resource> pending = new ArrayDeque<>(Set.of(subject));
    final Set<Resource> seen = new HashSet<>();
    while (!pending.isEmpty()) {
      final Resource next = pending.pop();
      if (seen.add(next)) {
        ontology
            .listStatements(next, null, (RDFNode) null)
            .forEachRemaining(
                statement -> {
                  entry.add(statement);
                  if (statement.getObject().isAnon()) {
                    pending.push(statement.getObject().asResource());
                  }
                });
      }
    }
  }
}
