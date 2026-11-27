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

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.validation.ConstraintViolationException;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.utils.JsonUtils;

class OntologyDefinitionTest {
  private static final URI NAMESPACE = URI.create("https://example.org/sales/");

  @Test
  void definitionsRoundTripWithoutGlossaryFields() {
    Ontology ontology = ontology();
    OntologyConcept concept = concept(ontology);
    OntologyProperty property =
        new OntologyProperty()
            .withId(UUID.randomUUID())
            .withName("customerId")
            .withFullyQualifiedName("Sales.customerId")
            .withOntology(reference(ontology))
            .withIri(NAMESPACE.resolve("customerId"))
            .withKind(OntologyPropertyKind.DATA);

    assertDoesNotThrow(() -> JsonUtils.validateJsonSchema(ontology, Ontology.class));
    assertDoesNotThrow(() -> JsonUtils.validateJsonSchema(concept, OntologyConcept.class));
    assertDoesNotThrow(() -> JsonUtils.validateJsonSchema(property, OntologyProperty.class));
    assertEquals(
        concept, JsonUtils.readValue(JsonUtils.pojoToJson(concept), OntologyConcept.class));
    assertEquals(
        property, JsonUtils.readValue(JsonUtils.pojoToJson(property), OntologyProperty.class));
    assertNull(ontology.getEntityStatus());
    assertNull(concept.getEntityStatus());
    assertNull(property.getEntityStatus());
  }

  @Test
  void nativeCreationRequestsCanOmitTheSemanticIri() {
    CreateOntologyConcept concept =
        new CreateOntologyConcept()
            .withName("Customer")
            .withOntology("Sales")
            .withConceptType(OntologyConceptType.OWL_CLASS);
    CreateOntologyProperty property =
        new CreateOntologyProperty()
            .withName("customerId")
            .withOntology("Sales")
            .withKind(OntologyPropertyKind.DATA);

    assertDoesNotThrow(() -> JsonUtils.validateJsonSchema(concept, CreateOntologyConcept.class));
    assertDoesNotThrow(() -> JsonUtils.validateJsonSchema(property, CreateOntologyProperty.class));
  }

  @Test
  void propertyReferencesPreserveExactIriIdentity() {
    String references =
        "[\"HTTPS://EXAMPLE.org/Customer\",\"https://example.org/Customer\",\"urn:example:客户\"]";
    OntologyProperty property =
        JsonUtils.readValue(
            "{\"domain\":"
                + references
                + ",\"range\":"
                + references
                + ",\"disjointWith\":"
                + references
                + "}",
            OntologyProperty.class);
    List<String> expected =
        List.of("HTTPS://EXAMPLE.org/Customer", "https://example.org/Customer", "urn:example:客户");

    assertEquals(expected, property.getDomain().stream().map(URI::toString).toList());
    assertEquals(expected, property.getRange().stream().map(URI::toString).toList());
    assertEquals(expected, property.getDisjointWith().stream().map(URI::toString).toList());
  }

  @Test
  void conceptRequiresItsOwnOntologyAndSemanticIdentity() {
    OntologyConcept concept = concept(ontology()).withOntology(null);
    assertThrows(
        ConstraintViolationException.class,
        () -> JsonUtils.validateJsonSchema(concept, OntologyConcept.class));
    concept.setOntology(new EntityReference().withId(UUID.randomUUID()).withType("ontology"));
    concept.setIri(null);
    assertThrows(
        ConstraintViolationException.class,
        () -> JsonUtils.validateJsonSchema(concept, OntologyConcept.class));
  }

  @Test
  void propertyRequiresAnExplicitKind() {
    OntologyProperty property =
        new OntologyProperty()
            .withId(UUID.randomUUID())
            .withName("value")
            .withFullyQualifiedName("Sales.value")
            .withOntology(reference(ontology()))
            .withIri(NAMESPACE.resolve("value"));
    assertThrows(
        ConstraintViolationException.class,
        () -> JsonUtils.validateJsonSchema(property, OntologyProperty.class));
    property.setKind(OntologyPropertyKind.ANNOTATION);
    assertDoesNotThrow(() -> JsonUtils.validateJsonSchema(property, OntologyProperty.class));
  }

  @Test
  void ontologyRequiresANamespaceForNativeDefinitions() {
    Ontology ontology = ontology().withNamespace(null);
    assertThrows(
        ConstraintViolationException.class,
        () -> JsonUtils.validateJsonSchema(ontology, Ontology.class));
  }

  private static EntityReference reference(Ontology ontology) {
    return new EntityReference().withId(ontology.getId()).withType("ontology");
  }

  private static Ontology ontology() {
    return new Ontology()
        .withId(UUID.randomUUID())
        .withName("Sales")
        .withFullyQualifiedName("Sales")
        .withIri(URI.create("https://example.org/sales"))
        .withNamespace(NAMESPACE);
  }

  private static OntologyConcept concept(Ontology ontology) {
    return new OntologyConcept()
        .withId(UUID.randomUUID())
        .withName("Customer")
        .withFullyQualifiedName("Sales.Customer")
        .withOntology(reference(ontology))
        .withIri(NAMESPACE.resolve("Customer"))
        .withConceptType(OntologyConceptType.OWL_CLASS);
  }
}
