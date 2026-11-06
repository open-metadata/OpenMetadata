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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;

import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * An ontology owner edits what the ontology holds (ADR:2026-11-02-ontology-roles-are-seeded), so a
 * concept, property or axiom with no owner of its own reports the ontology's owners.
 */
class OntologyOwnerInheritanceTest {
  private static final EntityReference OWNER =
      new EntityReference().withId(UUID.randomUUID()).withType("user").withName("curator");

  private CollectionDAO previous;

  @BeforeEach
  void useMockedStorage() {
    previous = Entity.getCollectionDAO();
    Entity.setCollectionDAO(mock(CollectionDAO.class, RETURNS_DEEP_STUBS));
  }

  @AfterEach
  void restoreStorage() {
    Entity.setCollectionDAO(previous);
  }

  @Test
  void conceptWithoutOwnersReportsTheOntologyOwnersAsInherited() {
    final OntologyConceptRepository repository = new OntologyConceptRepository();
    final OntologyConcept concept = new OntologyConcept().withOntology(ontologyReference());

    assertInheritsFromOntology(repository, concept, concept::getOwners);
  }

  @Test
  void propertyWithoutOwnersReportsTheOntologyOwnersAsInherited() {
    final OntologyPropertyRepository repository = new OntologyPropertyRepository();
    final OntologyProperty property = new OntologyProperty().withOntology(ontologyReference());

    assertInheritsFromOntology(repository, property, property::getOwners);
  }

  @Test
  void axiomWithoutOwnersReportsTheOntologyOwnersAsInherited() {
    final OntologyAxiomRepository repository = new OntologyAxiomRepository();
    final OntologyAxiom axiom = new OntologyAxiom().withOntology(ontologyReference());

    assertInheritsFromOntology(repository, axiom, axiom::getOwners);
  }

  @Test
  void conceptWithItsOwnOwnerKeepsIt() {
    final OntologyConceptRepository repository = new OntologyConceptRepository();
    final EntityReference own =
        new EntityReference().withId(UUID.randomUUID()).withType("user").withName("own");
    final OntologyConcept concept =
        new OntologyConcept().withOntology(ontologyReference()).withOwners(List.of(own));

    repository.applyInheritance(concept, repository.getFields("owners"), ontologyOwnedBy(OWNER));

    assertEquals(List.of(own), concept.getOwners());
  }

  private static <T extends OntologyDefinition> void assertInheritsFromOntology(
      final OntologyEntityRepository<T> repository,
      final T definition,
      final Supplier<List<EntityReference>> owners) {
    final Fields fields = repository.getFields("owners");

    assertTrue(repository.requiresParentForInheritance(definition, fields));
    repository.applyInheritance(definition, fields, ontologyOwnedBy(OWNER));

    assertEquals(1, owners.get().size());
    assertEquals(OWNER.getId(), owners.get().get(0).getId());
    assertEquals(Boolean.TRUE, owners.get().get(0).getInherited());
  }

  private static EntityReference ontologyReference() {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.ONTOLOGY)
        .withName("owned");
  }

  private static EntityInterface<?> ontologyOwnedBy(final EntityReference owner) {
    return new Ontology().withOwners(List.of(owner));
  }
}
