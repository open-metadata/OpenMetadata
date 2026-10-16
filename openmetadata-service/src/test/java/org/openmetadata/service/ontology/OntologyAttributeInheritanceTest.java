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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologyAttributeDataType;

class OntologyAttributeInheritanceTest {
  private static final EntityReference PERSON = termRef("Person");
  private static final EntityReference PARTY = termRef("Party");

  @Test
  void declaredAttributesAreNotMarkedInherited() {
    List<OntologyAttribute> effective =
        OntologyAttributeInheritance.merge(List.of(attribute("email", null)), List.of(), PERSON);

    assertEquals(1, effective.size());
    assertFalse(effective.getFirst().getInherited());
    assertNull(effective.getFirst().getDeclaringTerm(), "a declared attribute has no declarer");
  }

  @Test
  void parentAttributesAreInheritedAndAttributedToTheParent() {
    List<OntologyAttribute> effective =
        OntologyAttributeInheritance.merge(
            List.of(attribute("loyaltyTier", null)), List.of(attribute("email", null)), PERSON);

    assertEquals(List.of("loyaltyTier", "email"), namesOf(effective), "own attributes come first");
    assertFalse(effective.getFirst().getInherited());
    assertTrue(effective.get(1).getInherited());
    assertEquals(PERSON, effective.get(1).getDeclaringTerm());
  }

  @Test
  void grandparentAttributesKeepTheirOriginalDeclaringConcept() {
    OntologyAttribute fromGrandparent =
        attribute("partyId", null).withInherited(true).withDeclaringTerm(PARTY);

    List<OntologyAttribute> effective =
        OntologyAttributeInheritance.merge(
            List.of(), List.of(attribute("email", null), fromGrandparent), PERSON);

    assertEquals(PERSON, effective.getFirst().getDeclaringTerm(), "parent declares email");
    assertEquals(
        PARTY,
        effective.get(1).getDeclaringTerm(),
        "the grandparent stays the declarer of partyId");
  }

  @Test
  void aConceptShadowsAnAncestorAttributeOfTheSameName() {
    OntologyAttribute own = attribute("email", null).withDataType(OntologyAttributeDataType.STRING);
    OntologyAttribute ancestor =
        attribute("EMAIL", null).withDataType(OntologyAttributeDataType.INTEGER);

    List<OntologyAttribute> effective =
        OntologyAttributeInheritance.merge(List.of(own), List.of(ancestor), PERSON);

    assertEquals(1, effective.size(), "the ancestor declaration is shadowed");
    assertEquals(OntologyAttributeDataType.STRING, effective.getFirst().getDataType());
    assertFalse(effective.getFirst().getInherited());
  }

  @Test
  void aConceptShadowsAnAncestorAttributeSharingItsIri() {
    URI sharedIri = URI.create("http://example.com/ontology#email");
    List<OntologyAttribute> effective =
        OntologyAttributeInheritance.merge(
            List.of(attribute("workEmail", sharedIri)),
            List.of(attribute("email", sharedIri)),
            PERSON);

    assertEquals(List.of("workEmail"), namesOf(effective), "same IRI means the same property");
  }

  @Test
  void unrelatedAncestorAttributesAreAllRetained() {
    List<OntologyAttribute> effective =
        OntologyAttributeInheritance.merge(
            List.of(attribute("loyaltyTier", null)),
            List.of(attribute("email", null), attribute("birthDate", null)),
            PERSON);

    assertEquals(List.of("loyaltyTier", "email", "birthDate"), namesOf(effective));
  }

  @Test
  void mergingDoesNotMutateTheAncestorAttribute() {
    OntologyAttribute ancestor = attribute("email", null);

    OntologyAttributeInheritance.merge(List.of(), List.of(ancestor), PERSON);

    assertFalse(ancestor.getInherited(), "the cached parent attribute stays untouched");
    assertNull(ancestor.getDeclaringTerm());
  }

  private static List<String> namesOf(List<OntologyAttribute> attributes) {
    return attributes.stream().map(attribute -> attribute.getName().toString()).toList();
  }

  private static OntologyAttribute attribute(String name, URI iri) {
    return new OntologyAttribute()
        .withId(UUID.randomUUID())
        .withName(name)
        .withIri(iri)
        .withDataType(OntologyAttributeDataType.STRING)
        .withIsIdentifier(false);
  }

  private static EntityReference termRef(String name) {
    return new EntityReference()
        .withId(UUID.nameUUIDFromBytes(name.getBytes()))
        .withType("glossaryTerm")
        .withName(name);
  }
}
