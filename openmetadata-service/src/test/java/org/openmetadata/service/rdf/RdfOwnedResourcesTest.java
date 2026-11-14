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

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QueryExecutionFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TableConstraint.ConstraintType;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.topic.CleanupPolicy;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;
import org.openmetadata.service.rdf.translator.ReferenceScope;

class RdfOwnedResourcesTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String GRAPH = BASE + "graph/knowledge";
  private static final String HAS_ITEM = BASE + "ontology/hasItem";

  private final JsonLdTranslator translator =
      new JsonLdTranslator(
          JsonUtils.getObjectMapper(), BASE, (type, fqns) -> Map.of(), ReferenceScope.ALL);

  @BeforeAll
  static void registerEntityTypes() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", "table");
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("topic", "topic");
  }

  @Test
  void walkingTheProjectionFindsWhatTheStoreScopeMatches() {
    final UUID tableId = UUID.randomUUID();
    final Column zip =
        column("svc.db.schema.orders.customer.address.zip")
            .withProfile(new ColumnProfile().withNullCount(2.0));
    final Table table =
        new Table()
            .withId(tableId)
            .withName("orders")
            .withFullyQualifiedName("svc.db.schema.orders")
            .withExtension(Map.of("costCenter", "finance", "tier", 2))
            .withProfile(new TableProfile().withRowCount(100.0))
            .withTableConstraints(
                List.of(
                    new TableConstraint()
                        .withConstraintType(ConstraintType.FOREIGN_KEY)
                        .withColumns(List.of("id"))
                        .withReferredColumns(List.of("svc.db.schema.customers.id"))))
            .withColumns(
                List.of(
                    column("svc.db.schema.orders.id"),
                    column("svc.db.schema.orders.customer")
                        .withDataType(ColumnDataType.STRUCT)
                        .withChildren(
                            List.of(
                                column("svc.db.schema.orders.customer.address")
                                    .withDataType(ColumnDataType.STRUCT)
                                    .withChildren(List.of(zip))))));
    final UUID topicId = UUID.randomUUID();
    final Topic topic =
        new Topic()
            .withId(topicId)
            .withName("events")
            .withFullyQualifiedName("kafka.events")
            .withCleanupPolicies(List.of(CleanupPolicy.DELETE, CleanupPolicy.COMPACT));

    // The extension, its two properties, four columns, one constraint and two measurements.
    final Model projection = translator.toRdf(table);
    final String tableUri = BASE + "entity/table/" + tableId;
    assertWalkMatchesStoreScope(tableUri, projection, 10);
    assertFalse(
        storeScopeSubjects(tableUri, projection)
            .contains(
                NodeFactory.createURI(RdfUtils.columnUri(BASE, "svc.db.schema.customers.id"))));
    assertWalkMatchesStoreScope(BASE + "entity/topic/" + topicId, translator.toRdf(topic), 2);
  }

  @Test
  void listCellsNeverLeadIntoTheEntitiesTheyReferTo() {
    final String entityUri = BASE + "entity/topic/" + UUID.randomUUID();
    final String otherUri = BASE + "entity/table/" + UUID.randomUUID();
    final Model model = ModelFactory.createDefaultModel();
    final Resource cell =
        model.createResource(RdfOwnedResources.listCellIri(entityUri, HAS_ITEM, 0));
    model.createResource(entityUri).addProperty(model.createProperty(HAS_ITEM), cell);
    cell.addProperty(RDF.first, model.createResource(otherUri)).addProperty(RDF.rest, RDF.nil);
    model.createResource(otherUri).addProperty(RDFS.label, "referenced table");

    final Set<Node> matched = storeScopeSubjects(entityUri, model);

    assertTrue(matched.contains(cell.asNode()));
    assertFalse(matched.contains(NodeFactory.createURI(otherUri)));
    assertFalse(
        RdfOwnedResources.ownedSubjects(model.getGraph(), NodeFactory.createURI(entityUri))
            .contains(NodeFactory.createURI(otherUri)));
  }

  @Test
  void eachCellOfEachListHasItsOwnStableName() {
    final String entityUri = BASE + "entity/topic/" + UUID.randomUUID();
    assertEquals(
        RdfOwnedResources.listCellIri(entityUri, HAS_ITEM, 0),
        RdfOwnedResources.listCellIri(entityUri, HAS_ITEM, 0));
    assertNotEquals(
        RdfOwnedResources.listCellIri(entityUri, HAS_ITEM, 0),
        RdfOwnedResources.listCellIri(entityUri, HAS_ITEM, 1));
    assertNotEquals(
        RdfOwnedResources.listCellIri(entityUri, HAS_ITEM, 0),
        RdfOwnedResources.listCellIri(entityUri, "http://purl.org/dc/terms/hasItem", 0));
    assertTrue(
        RdfOwnedResources.isOwnedList(
            entityUri,
            NodeFactory.createURI(RdfOwnedResources.listCellIri(entityUri, HAS_ITEM, 3))));
    assertTrue(RdfOwnedResources.isOwnedList(entityUri, RDF.nil.asNode()));
    assertFalse(
        RdfOwnedResources.isOwnedList(
            entityUri,
            NodeFactory.createURI(
                RdfOwnedResources.listCellIri(
                    BASE + "entity/topic/" + UUID.randomUUID(), HAS_ITEM, 0))));
  }

  private static void assertWalkMatchesStoreScope(
      final String entityUri, final Model projection, final int expectedOwned) {
    final Set<Node> fromStore = storeScopeSubjects(entityUri, projection);
    // The arm that matches the entity's links to its lists binds the entity itself as subject.
    fromStore.remove(NodeFactory.createURI(entityUri));
    final Set<Node> walked =
        RdfOwnedResources.ownedSubjects(projection.getGraph(), NodeFactory.createURI(entityUri));
    assertEquals(fromStore, walked);
    assertEquals(expectedOwned, walked.size(), () -> "owned resources: " + walked);
  }

  private static Set<Node> storeScopeSubjects(final String entityUri, final Model projection) {
    final Dataset dataset = DatasetFactory.create();
    try {
      dataset.getNamedModel(GRAPH).add(projection);
      final String query =
          "SELECT DISTINCT ?subject WHERE { GRAPH <"
              + GRAPH
              + "> { VALUES ?entity { <"
              + entityUri
              + "> } "
              + RdfOwnedResources.ownedTriplesPattern()
              + " } }";
      final Set<Node> subjects = new HashSet<>();
      try (QueryExecution execution = QueryExecutionFactory.create(query, dataset)) {
        execution.execSelect().forEachRemaining(row -> subjects.add(row.get("subject").asNode()));
      }
      return subjects;
    } finally {
      dataset.close();
    }
  }

  private static Column column(final String fqn) {
    return new Column()
        .withName(fqn.substring(fqn.lastIndexOf('.') + 1))
        .withDataType(ColumnDataType.INT)
        .withFullyQualifiedName(fqn);
  }
}
