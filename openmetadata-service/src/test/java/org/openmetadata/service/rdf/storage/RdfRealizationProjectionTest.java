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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.update.UpdateAction;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.AssetRealization;
import org.openmetadata.schema.type.AssetRealizationRole;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;

/** Concept realizations keep their role in the graph, through every kind of entity write. */
class RdfRealizationProjectionTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String OM = BASE + "ontology/";
  private static final UUID TERM = UUID.fromString("00000000-0000-0000-0000-00000000000a");
  private static final UUID ORDERS = UUID.fromString("00000000-0000-0000-0000-00000000000b");
  private static final UUID ORDERS_COPY = UUID.fromString("00000000-0000-0000-0000-00000000000c");

  private final Dataset dataset = DatasetFactory.create();
  private final Model graph = dataset.getNamedModel(BASE + "graph/knowledge");
  private final JsonLdTranslator translator =
      new JsonLdTranslator(JsonUtils.getObjectMapper(), BASE);

  @AfterEach
  void close() {
    dataset.close();
  }

  @Test
  void eachRealizationIsProjectedWithThePredicateForItsRole() {
    store(
        term(
            realization(ORDERS, AssetRealizationRole.PRIMARY_STORE),
            realization(ORDERS_COPY, AssetRealizationRole.REPLICA)),
        false);

    assertTrue(hasRole("hasPrimaryStore", ORDERS));
    assertTrue(hasRole("hasReplica", ORDERS_COPY));
    assertFalse(
        graph.contains(graph.createResource(termIri()), property("realizedIn"), (RDFNode) null));
  }

  @Test
  void aRealizationWithoutARoleIsThePrimaryStore() {
    store(term(realization(ORDERS, null)), false);

    assertTrue(hasRole("hasPrimaryStore", ORDERS));
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void changingOrRemovingRealizationsLeavesNoStaleRole(final boolean bulk) {
    store(
        term(
            realization(ORDERS, AssetRealizationRole.PRIMARY_STORE),
            realization(ORDERS_COPY, AssetRealizationRole.DERIVED)),
        bulk);

    store(term(realization(ORDERS, AssetRealizationRole.DERIVED)), bulk);

    assertFalse(hasRole("hasPrimaryStore", ORDERS));
    assertTrue(hasRole("hasDerivedAsset", ORDERS));
    assertFalse(hasRole("hasDerivedAsset", ORDERS_COPY));
  }

  private boolean hasRole(final String rolePredicate, final UUID table) {
    return graph.contains(
        graph.createResource(termIri()),
        property(rolePredicate),
        graph.createResource(BASE + "entity/table/" + table));
  }

  private void store(final GlossaryTerm term, final boolean bulk) {
    final Model model = translator.toRdf(term);
    try {
      final String update =
          bulk
              ? JenaFusekiStorage.buildBulkReconcileUpdate(
                  BASE,
                  List.of(
                      new RdfStorageInterface.EntityWriteRequest(
                          Entity.GLOSSARY_TERM, term.getId(), model)))
              : JenaFusekiStorage.buildEntityUpsertUpdate(termIri(), model);
      UpdateAction.parseExecute(update, dataset);
    } finally {
      model.close();
    }
  }

  private static GlossaryTerm term(final AssetRealization... realizations) {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("glossaryterm", Entity.GLOSSARY_TERM);
    return new GlossaryTerm()
        .withId(TERM)
        .withName("Order")
        .withFullyQualifiedName("Sales.Order")
        .withRealizedIn(List.of(realizations));
  }

  private static AssetRealization realization(final UUID table, final AssetRealizationRole role) {
    return new AssetRealization()
        .withAsset(new EntityReference().withId(table).withType(Entity.TABLE))
        .withRole(role);
  }

  private static String termIri() {
    return BASE + "entity/" + Entity.GLOSSARY_TERM + "/" + TERM;
  }

  private Property property(final String localName) {
    return graph.createProperty(OM + localName);
  }
}
