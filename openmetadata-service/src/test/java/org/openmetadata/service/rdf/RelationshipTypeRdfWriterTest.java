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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

class RelationshipTypeRdfWriterTest {
  @Test
  void anInverseNamedBeforeItExistsIsOmittedNotFatal() {
    final RelationshipType owner = type("hasPart").withInverse(byFqn("partOf"));
    final Model model = ModelFactory.createDefaultModel();

    new RelationshipTypeRdfWriter(List.of(owner)).write(model, owner);

    final Resource property = model.createResource(owner.getRdfPredicate().toString());
    assertTrue(model.contains(property, RDF.type, OWL2.ObjectProperty));
    assertFalse(model.contains(property, OWL2.inverseOf));
  }

  @Test
  void aReferenceWithTheIdOfAMissingTypeStillFailsTheExport() {
    final RelationshipType owner =
        type("hasPart").withDisjointWith(Set.of(byId(type("deletedPartOf"))));
    final RelationshipTypeRdfWriter writer = new RelationshipTypeRdfWriter(List.of(owner));
    final Model model = ModelFactory.createDefaultModel();

    assertThrows(IllegalArgumentException.class, () -> writer.write(model, owner));
  }

  @Test
  void aResolvedInverseIsProjected() {
    final RelationshipType partOf = type("partOf");
    final RelationshipType owner = type("hasPart").withInverse(byFqn("partOf"));
    final Model model = ModelFactory.createDefaultModel();

    new RelationshipTypeRdfWriter(List.of(owner, partOf)).write(model, owner);

    assertTrue(
        model.contains(
            model.createResource(owner.getRdfPredicate().toString()),
            OWL2.inverseOf,
            model.createResource(partOf.getRdfPredicate().toString())));
  }

  private static RelationshipType type(final String name) {
    final URI predicate = URI.create("https://example.org/writer-test/" + name);
    return new RelationshipType()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withDisplayName(name)
        .withRdfPredicate(predicate)
        .withIri(predicate)
        .withDomain(Set.of())
        .withRange(Set.of())
        .withCharacteristics(Set.of());
  }

  private static EntityReference byFqn(final String fqn) {
    return new EntityReference().withType(Entity.RELATIONSHIP_TYPE).withFullyQualifiedName(fqn);
  }

  private static EntityReference byId(final RelationshipType type) {
    return new EntityReference()
        .withId(type.getId())
        .withType(Entity.RELATIONSHIP_TYPE)
        .withFullyQualifiedName(type.getFullyQualifiedName());
  }
}
