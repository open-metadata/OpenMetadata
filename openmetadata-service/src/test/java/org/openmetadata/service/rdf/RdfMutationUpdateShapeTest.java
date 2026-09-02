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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.update.UpdateAction;
import org.junit.jupiter.api.Test;

class RdfMutationUpdateShapeTest {
  private static final String KNOWLEDGE_GRAPH = "https://open-metadata.org/graph/knowledge";

  @Test
  void entityDeleteCombinesIncomingAndOutgoingTriplesInOneWhereOperation() {
    String entityUri = "https://open-metadata.org/entity/table/123";
    String update = RdfRepository.buildEntityDeleteUpdate(entityUri);
    Dataset dataset = DatasetFactory.createTxnMem();
    Model graph = dataset.getNamedModel(KNOWLEDGE_GRAPH);
    Property predicate = graph.createProperty("urn:predicate");
    Resource entity = graph.createResource(entityUri);
    Resource outgoingObject = graph.createResource("urn:outgoing");
    Resource incomingSubject = graph.createResource("urn:incoming");
    Resource unrelatedSubject = graph.createResource("urn:unrelated");
    Resource unrelatedObject = graph.createResource("urn:unrelated-object");
    graph.add(entity, predicate, outgoingObject);
    graph.add(incomingSubject, predicate, entity);
    graph.add(unrelatedSubject, predicate, unrelatedObject);

    assertEquals(1, countOccurrences(update, "WHERE"), update);
    assertTrue(update.contains("UNION"), update);
    assertTrue(update.contains("VALUES ?s"), update);
    assertDoesNotThrow(() -> UpdateAction.parseExecute(update, dataset));
    assertFalse(graph.contains(entity, predicate, outgoingObject));
    assertFalse(graph.contains(incomingSubject, predicate, entity));
    assertTrue(graph.contains(unrelatedSubject, predicate, unrelatedObject));
    dataset.close();
  }

  @Test
  void relationshipReconcileCombinesSourcesWithValues() {
    String firstSourceUri = "https://open-metadata.org/entity/table/first";
    String secondSourceUri = "https://open-metadata.org/entity/table/second";
    Set<String> sourceUris = new LinkedHashSet<>(List.of(firstSourceUri, secondSourceUri));

    String update = RdfRepository.buildOutgoingRelationshipDelete(sourceUris);
    Dataset dataset = DatasetFactory.createTxnMem();
    Model graph = dataset.getNamedModel(KNOWLEDGE_GRAPH);
    Resource firstSource = graph.createResource(firstSourceUri);
    Resource secondSource = graph.createResource(secondSourceUri);
    Resource outsider = graph.createResource("urn:outsider");
    Resource target = graph.createResource("urn:target");
    Property contains = graph.createProperty("https://open-metadata.org/ontology/contains");
    Property owns = graph.createProperty("https://open-metadata.org/ontology/owns");
    Property name = graph.createProperty("https://open-metadata.org/ontology/name");
    graph.add(firstSource, contains, target);
    graph.add(secondSource, owns, target);
    graph.add(firstSource, name, "preserved name");
    graph.add(outsider, contains, target);

    assertEquals(1, countOccurrences(update, "WHERE"), update);
    assertTrue(update.contains("VALUES ?source"), update);
    sourceUris.forEach(source -> assertTrue(update.contains(source), update));
    assertDoesNotThrow(() -> UpdateAction.parseExecute(update, dataset));
    assertFalse(graph.contains(firstSource, contains, target));
    assertFalse(graph.contains(secondSource, owns, target));
    assertTrue(graph.contains(firstSource, name, "preserved name"));
    assertTrue(graph.contains(outsider, contains, target));
    dataset.close();
  }

  @Test
  void exactGlossaryRelationRemovalNeedsNoWhereOperation() {
    String firstUri = "https://open-metadata.org/entity/glossaryTerm/first";
    String secondUri = "https://open-metadata.org/entity/glossaryTerm/second";
    String predicateUri = "http://www.w3.org/2004/02/skos/core#related";
    String update =
        RdfRepository.buildGlossaryTermRelationDeleteUpdate(firstUri, secondUri, predicateUri);
    Dataset dataset = DatasetFactory.createTxnMem();
    Model graph = dataset.getNamedModel(KNOWLEDGE_GRAPH);
    Resource first = graph.createResource(firstUri);
    Resource second = graph.createResource(secondUri);
    Resource unrelated = graph.createResource("urn:unrelated");
    Property predicate = graph.createProperty(predicateUri);
    graph.add(first, predicate, second);
    graph.add(second, predicate, first);
    graph.add(first, predicate, unrelated);

    assertTrue(update.startsWith("DELETE DATA"), update);
    assertFalse(update.contains("WHERE"), update);
    assertEquals(2, countOccurrences(update, "skos/core#related"), update);
    assertDoesNotThrow(() -> UpdateAction.parseExecute(update, dataset));
    assertFalse(graph.contains(first, predicate, second));
    assertFalse(graph.contains(second, predicate, first));
    assertTrue(graph.contains(first, predicate, unrelated));
    dataset.close();
  }

  private static int countOccurrences(String haystack, String needle) {
    int count = 0;
    int from = 0;
    while ((from = haystack.indexOf(needle, from)) >= 0) {
      count++;
      from += needle.length();
    }
    return count;
  }
}
