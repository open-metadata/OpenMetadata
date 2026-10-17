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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.update.UpdateAction;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;

class OntologyGraphsTest {
  private static final String BASE = "https://open-metadata.org/";

  @Test
  void namesOneGraphPerOntologyEntityUnderTheBaseUri() {
    final UUID id = UUID.randomUUID();
    assertEquals(
        BASE + "graph/axiom/" + id,
        OntologyGraphs.graphIri(BASE, Entity.ONTOLOGY_AXIOM, id).orElseThrow());
    assertEquals(
        BASE + "graph/relationshipType/" + id,
        OntologyGraphs.graphIri(BASE, Entity.RELATIONSHIP_TYPE, id).orElseThrow());
    assertEquals(
        BASE + "graph/glossaryTerm/" + id,
        OntologyGraphs.graphIri(BASE, Entity.GLOSSARY_TERM, id).orElseThrow());
    assertTrue(OntologyGraphs.graphIri(BASE, Entity.TABLE, id).isEmpty());
  }

  @Test
  void packedGraphsKeepTheirOwnBlankNodes() {
    final Map<String, Model> graphs = new LinkedHashMap<>();
    graphs.put(BASE + "graph/axiom/a", restriction("hasA"));
    graphs.put(BASE + "graph/axiom/b", restriction("hasB"));
    final Dataset dataset = DatasetFactory.create();

    final List<String> updates = OntologyGraphs.replaceUpdates(graphs, Long.MAX_VALUE);
    updates.forEach(update -> UpdateAction.parseExecute(update, dataset));

    assertEquals(1, updates.size());
    graphs.forEach(
        (graph, model) -> assertTrue(dataset.getNamedModel(graph).isIsomorphicWith(model), graph));
    assertNotEquals(
        restrictionNode(dataset.getNamedModel(BASE + "graph/axiom/a")),
        restrictionNode(dataset.getNamedModel(BASE + "graph/axiom/b")),
        "two graphs never share a blank node");
  }

  private static Resource restrictionNode(final Model graph) {
    return graph.listSubjectsWithProperty(RDF.type, OWL2.Restriction).next();
  }

  @Test
  void splitsUpdatesAtThePayloadBudgetAndSendsAnOversizedGraphAlone() {
    final Map<String, Model> graphs = new LinkedHashMap<>();
    graphs.put(BASE + "graph/axiom/a", restriction("hasA"));
    graphs.put(BASE + "graph/axiom/b", restriction("hasB"));
    graphs.put(BASE + "graph/axiom/c", ModelFactory.createDefaultModel());

    final List<String> updates = OntologyGraphs.replaceUpdates(graphs, 1);

    assertEquals(3, updates.size());
    assertEquals("DROP SILENT GRAPH <" + BASE + "graph/axiom/c>", updates.get(2));
  }

  @Test
  void anEmptyModelDropsTheGraph() {
    final String graph = BASE + "graph/axiom/a";
    final Dataset dataset = DatasetFactory.create();
    OntologyGraphs.replaceUpdates(Map.of(graph, restriction("hasA")), Long.MAX_VALUE)
        .forEach(update -> UpdateAction.parseExecute(update, dataset));
    assertTrue(dataset.containsNamedModel(graph));

    OntologyGraphs.replaceUpdates(Map.of(graph, ModelFactory.createDefaultModel()), Long.MAX_VALUE)
        .forEach(update -> UpdateAction.parseExecute(update, dataset));

    assertFalse(dataset.containsNamedModel(graph));
  }

  private static Model restriction(final String property) {
    final Model model = ModelFactory.createDefaultModel();
    final Resource restriction =
        model
            .createResource()
            .addProperty(RDF.type, OWL2.Restriction)
            .addProperty(OWL2.onProperty, model.createResource("https://example.org/" + property))
            .addProperty(OWL2.someValuesFrom, OWL2.Thing);
    model.createResource("https://example.org/C").addProperty(OWL2.equivalentClass, restriction);
    return model;
  }
}
