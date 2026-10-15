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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

import java.net.URI;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.update.UpdateAction;
import org.apache.jena.vocabulary.RDF;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;

/** Live writes and their replays project an axiom into its own graph through the repository. */
class RdfRepositoryOntologyGraphTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String EX = "https://example.org/retail/";
  private static final String KNOWLEDGE = "https://open-metadata.org/graph/knowledge";
  private final Dataset dataset = DatasetFactory.create();
  private OntologyAxiom current;
  private final RdfRepository repository = repository();

  @BeforeAll
  static void registerEntityType() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("ontologyaxiom", Entity.ONTOLOGY_AXIOM);
  }

  @AfterEach
  void close() {
    dataset.close();
    RdfProjectionHealth.markReady();
  }

  @Test
  void axiomWritesReplaceItsGraphAndLeaveNoJsonOnTheRecord() {
    current = axiom(some(EX + "hasContact", union(EX + "Email", EX + "Phone")));
    final RdfLiveWrite update = RdfLiveWrite.EntityUpdate.capture(current);
    final String graph = BASE + "graph/axiom/" + current.getId();

    replay(update);
    assertTrue(dataset.getNamedModel(graph).contains(null, RDF.first));
    final Model record = dataset.getNamedModel(KNOWLEDGE);
    assertTrue(record.contains(record.createResource(entityIri()), null));
    assertFalse(record.contains(null, record.createProperty(BASE + "ontology/expressions")));

    current.setExpressions(List.of(named(EX + "Customer")));
    replay(update);
    final Model replaced = dataset.getNamedModel(graph);
    assertFalse(replaced.contains(null, RDF.first), "the old union's list is gone");
    assertFalse(
        replaced.listStatements().toList().stream()
            .anyMatch(statement -> statement.getSubject().isAnon()),
        "the old restriction is gone");

    current = null;
    replay(update);
    assertFalse(dataset.containsNamedModel(graph), "a replay after a hard delete drops it");
  }

  @Test
  void deleteDropsTheAxiomGraph() {
    current = axiom(named(EX + "Customer"));
    replay(RdfLiveWrite.EntityUpdate.capture(current));
    final String graph = BASE + "graph/axiom/" + current.getId();
    assertTrue(dataset.containsNamedModel(graph));
    assertTrue(hasMemberRecord(graph), "the graph is written with its member record");

    replay(new RdfLiveWrite.EntityDelete(Entity.ONTOLOGY_AXIOM, current.getId()));

    assertFalse(dataset.containsNamedModel(graph));
    assertFalse(hasMemberRecord(graph), "a hard delete removes the member record too");
    final Model knowledge = dataset.getNamedModel(KNOWLEDGE);
    assertFalse(knowledge.contains(knowledge.createResource(entityIri()), null));
  }

  private boolean hasMemberRecord(final String graph) {
    final Model members = dataset.getNamedModel(OntologyGraphs.membersGraph(BASE));
    return members.contains(members.createResource(graph), null);
  }

  private String entityIri() {
    return BASE + "entity/ontologyAxiom/" + current.getId();
  }

  private void replay(final RdfLiveWrite command) {
    JsonUtils.readValue(JsonUtils.pojoToJson(command), RdfLiveWrite.class).apply(repository);
  }

  private RdfRepository repository() {
    final RdfStorageInterface storage = mock(RdfStorageInterface.class);
    doAnswer(
            call -> {
              UpdateAction.parseExecute(call.<String>getArgument(0), dataset);
              return null;
            })
        .when(storage)
        .executeSparqlUpdate(anyString());
    doAnswer(
            call -> {
              final Model knowledge = dataset.getNamedModel(KNOWLEDGE);
              knowledge.removeAll(
                  knowledge.createResource(
                      BASE + "entity/" + call.getArgument(0) + "/" + call.getArgument(1)),
                  null,
                  null);
              knowledge.add(call.<Model>getArgument(2));
              return null;
            })
        .when(storage)
        .storeEntity(anyString(), any(UUID.class), any(Model.class));
    return new RdfRepository(
        new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE)),
        storage,
        new JsonLdTranslator(JsonUtils.getObjectMapper(), BASE),
        () -> null,
        new RdfProjectionLoaders(
            (type, id) -> {
              if (current == null) {
                throw new EntityNotFoundException("Entity was hard deleted");
              }
              return current;
            },
            (fromId, toId) -> Optional.empty(),
            new NoSources()));
  }

  private static OntologyAxiom axiom(final OntologyExpression expression) {
    return new OntologyAxiom()
        .withId(UUID.randomUUID())
        .withName("contactable")
        .withFullyQualifiedName("Retail.contactable")
        .withGlossary(
            new EntityReference()
                .withId(UUID.randomUUID())
                .withType(Entity.GLOSSARY)
                .withFullyQualifiedName("Retail"))
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withSubjectIri(URI.create(EX + "ContactableCustomer"))
        .withExpressions(List.of(expression));
  }

  private static OntologyExpression named(final String iri) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.NAMED_CLASS)
        .withClassIri(URI.create(iri));
  }

  private static OntologyExpression union(final String first, final String second) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.UNION)
        .withOperands(List.of(named(first), named(second)));
  }

  private static OntologyExpression some(final String property, final OntologyExpression filler) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.RESTRICTION)
        .withPropertyIri(URI.create(property))
        .withRestrictionKind(OntologyRestrictionKind.SOME)
        .withFiller(filler);
  }

  private static final class NoSources implements OntologyGraphProjection.Sources {
    @Override
    public List<RelationshipType> relationshipTypes() {
      return List.of();
    }

    @Override
    public Optional<GlossaryTerm> glossaryTerm(final UUID termId) {
      return Optional.empty();
    }

    @Override
    public List<GlossaryTerm> glossaryTerms(final EntityReference glossary) {
      return List.of();
    }
  }
}
