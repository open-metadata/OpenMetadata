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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologyAttributeDataType;
import org.openmetadata.service.Entity;

/**
 * Verifies that a concept reports the attributes it inherits through subsumption alongside the ones
 * it declares, without those inherited declarations being persisted onto the concept.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OntologyEffectiveAttributesIT {
  private static final String EFFECTIVE_ATTRIBUTES = "effectiveAttributes";

  @AfterEach
  void cleanup(TestNamespace namespace) {
    NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
  }

  @Test
  void inheritsAttributesFromEveryAncestor(TestNamespace namespace) throws Exception {
    Glossary glossary = createGlossary(namespace);
    GlossaryTerm party = createTerm(glossary, "Party", null, attribute("partyId"));
    GlossaryTerm person = createTerm(glossary, "Person", party, attribute("email"));
    GlossaryTerm customer = createTerm(glossary, "Customer", person, attribute("loyaltyTier"));

    Map<String, OntologyAttribute> effective = effectiveAttributesOf(customer);

    assertEquals(
        List.of("loyaltyTier", "email", "partyId"),
        effectiveAttributeNames(customer),
        "own attributes come first, then each ancestor in turn");
    assertFalse(effective.get("loyaltyTier").getInherited());
    assertNull(effective.get("loyaltyTier").getDeclaringTerm());
    assertTrue(effective.get("email").getInherited());
    assertEquals(person.getId(), effective.get("email").getDeclaringTerm().getId());
    assertTrue(effective.get("partyId").getInherited());
    assertEquals(
        party.getId(),
        effective.get("partyId").getDeclaringTerm().getId(),
        "the grandparent stays the declarer of its own attribute");
  }

  @Test
  void keepsInheritedAttributesOutOfTheStoredDeclaration(TestNamespace namespace) throws Exception {
    Glossary glossary = createGlossary(namespace);
    GlossaryTerm person = createTerm(glossary, "Person", null, attribute("email"));
    GlossaryTerm customer = createTerm(glossary, "Customer", person, attribute("loyaltyTier"));

    GlossaryTerm fetched =
        SdkClients.adminClient()
            .glossaryTerms()
            .get(customer.getId().toString(), EFFECTIVE_ATTRIBUTES);

    assertEquals(
        List.of("loyaltyTier"),
        fetched.getAttributes().stream().map(a -> a.getName().toString()).toList(),
        "attributes stays what the concept declares, so a read-modify-write cannot persist email");
    assertEquals(2, fetched.getEffectiveAttributes().size());
  }

  @Test
  void aConceptOverridesAnInheritedAttribute(TestNamespace namespace) throws Exception {
    Glossary glossary = createGlossary(namespace);
    GlossaryTerm person =
        createTerm(
            glossary,
            "Person",
            null,
            attribute("email").withDataType(OntologyAttributeDataType.STRING));
    GlossaryTerm customer =
        createTerm(
            glossary,
            "Customer",
            person,
            attribute("email").withDescription("Verified billing address"));

    Map<String, OntologyAttribute> effective = effectiveAttributesOf(customer);

    assertEquals(1, effective.size(), "the ancestor declaration is shadowed, not duplicated");
    assertFalse(effective.get("email").getInherited());
    assertEquals("Verified billing address", effective.get("email").getDescription());
  }

  @Test
  void rootConceptsReportOnlyWhatTheyDeclare(TestNamespace namespace) throws Exception {
    Glossary glossary = createGlossary(namespace);
    GlossaryTerm party = createTerm(glossary, "Party", null, attribute("partyId"));

    assertEquals(List.of("partyId"), effectiveAttributeNames(party));
    assertFalse(effectiveAttributesOf(party).get("partyId").getInherited());
  }

  private List<String> effectiveAttributeNames(GlossaryTerm term) throws Exception {
    return fetch(term).getEffectiveAttributes().stream()
        .map(attribute -> attribute.getName().toString())
        .toList();
  }

  private Map<String, OntologyAttribute> effectiveAttributesOf(GlossaryTerm term) throws Exception {
    return fetch(term).getEffectiveAttributes().stream()
        .collect(
            Collectors.toMap(
                attribute -> attribute.getName().toString(), Function.identity(), (a, b) -> a));
  }

  private GlossaryTerm fetch(GlossaryTerm term) throws Exception {
    return SdkClients.adminClient()
        .glossaryTerms()
        .get(term.getId().toString(), EFFECTIVE_ATTRIBUTES);
  }

  private OntologyAttribute attribute(String name) {
    return new OntologyAttribute()
        .withId(UUID.randomUUID())
        .withName(name)
        .withDataType(OntologyAttributeDataType.STRING)
        .withIsIdentifier(false);
  }

  private GlossaryTerm createTerm(
      Glossary glossary, String name, GlossaryTerm parent, OntologyAttribute attribute)
      throws Exception {
    CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(name)
            .withDescription("Ontology concept " + name)
            .withGlossary(glossary.getFullyQualifiedName())
            .withAttributes(List.of(attribute));
    if (parent != null) {
      request.withParent(parent.getFullyQualifiedName());
    }

    return SdkClients.adminClient().glossaryTerms().create(request);
  }

  private Glossary createGlossary(TestNamespace namespace) throws Exception {
    return namespace.trackRoot(
        Entity.GLOSSARY,
        SdkClients.adminClient()
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(namespace.prefix("attributeGlossary"))
                    .withDescription("Concepts with inherited attributes")));
  }
}
