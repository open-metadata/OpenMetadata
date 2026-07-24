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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.api.data.OntologyProfileReport;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;

/** Live OWL 2 profile and persistence coverage for typed ontology axioms. */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OntologyAxiomResourceIT {
  private static final String ONTOLOGY_AXIOM = "ontologyAxiom";
  private static final URI SUBJECT_IRI = URI.create("https://example.org/model/RegulatedProduct");
  private static final URI PROPERTY_IRI = URI.create("https://example.org/model/hasJurisdiction");
  private static final URI FILLER_IRI = URI.create("https://example.org/model/Jurisdiction");

  @AfterEach
  void cleanup(TestNamespace ns) {
    NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
  }

  @Test
  void validatesAndPersistsAQualifiedCardinalityRestriction(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    CreateOntologyAxiom request = restrictionRequest(glossary, ns.prefix("jurisdictionRule"));

    OntologyProfileReport report = client.ontologyAxioms().validate(request);
    OntologyAxiom created = client.ontologyAxioms().create(request);
    ns.trackRoot(ONTOLOGY_AXIOM, created);
    OntologyAxiom stored = client.ontologyAxioms().get(created.getId().toString());

    assertTrue(report.getValid());
    assertTrue(report.getViolations().isEmpty());
    assertEquals(OntologyAxiomType.SUBCLASS_OF, stored.getAxiomType());
    assertEquals(1, stored.getExpressions().size());
    assertEquals(Integer.valueOf(1), stored.getExpressions().getFirst().getCardinality());
    assertEquals(FILLER_IRI, stored.getExpressions().getFirst().getFiller().getClassIri());
  }

  @Test
  void rejectsReservedVocabularyBeforePersistence(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    CreateOntologyAxiom request =
        restrictionRequest(glossary, ns.prefix("reservedRule"))
            .withSubjectIri(URI.create("http://www.w3.org/2002/07/owl#Thing"));

    OpenMetadataException exception =
        assertThrows(OpenMetadataException.class, () -> client.ontologyAxioms().create(request));

    assertFalse(exception.getMessage().isBlank());
  }

  private static CreateOntologyAxiom restrictionRequest(Glossary glossary, String name) {
    OntologyExpression filler =
        new OntologyExpression()
            .withKind(OntologyExpressionKind.NAMED_CLASS)
            .withClassIri(FILLER_IRI);
    OntologyExpression restriction =
        new OntologyExpression()
            .withKind(OntologyExpressionKind.RESTRICTION)
            .withPropertyIri(PROPERTY_IRI)
            .withRestrictionKind(OntologyRestrictionKind.EXACT)
            .withCardinality(1)
            .withFiller(filler);
    return new CreateOntologyAxiom()
        .withName(name)
        .withDisplayName("Jurisdiction requirement")
        .withDescription("Every regulated product has exactly one governing jurisdiction")
        .withGlossary(glossary.getFullyQualifiedName())
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withSubjectIri(SUBJECT_IRI)
        .withExpressions(List.of(restriction))
        .withProvenance(RelationProvenance.MANUAL)
        .withEntityStatus(EntityStatus.DRAFT);
  }
}
