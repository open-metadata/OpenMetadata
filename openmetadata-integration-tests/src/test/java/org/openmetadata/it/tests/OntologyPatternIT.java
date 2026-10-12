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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.OntologyChangeSetTestSupport.applyOntologyChangeSet;

import java.net.URI;
import java.util.List;
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
import org.openmetadata.schema.api.data.InstantiateOntologyPattern;
import org.openmetadata.schema.api.data.OntologyPatternInstantiationResult;
import org.openmetadata.schema.api.data.OntologyPatternTermInput;
import org.openmetadata.schema.api.data.OntologyPatternType;
import org.openmetadata.schema.api.data.RegulatoryControlPatternInput;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyConfiguration;
import org.openmetadata.schema.type.OntologyLayer;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OntologyPatternIT {
  @AfterEach
  void cleanup(TestNamespace namespace) {
    NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
  }

  @Test
  void listsInstantiatesAndAtomicallyAppliesAGovernedPattern(TestNamespace namespace) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final Glossary glossary = createGlossary(client, namespace);
    final InstantiateOntologyPattern request = patternRequest(glossary, namespace);

    assertEquals(3, client.ontologyPatterns().list().getData().size());
    final OntologyPatternInstantiationResult result =
        client.ontologyPatterns().instantiate(request);
    namespace.trackRoot(Entity.ONTOLOGY_CHANGE_SET, result.getChangeSet().getId());
    final OntologyChangeSet draft =
        client
            .ontologyChangeSets()
            .get(result.getChangeSet().getId().toString(), "glossaries,operations");

    assertEquals(OntologyChangeSetState.DRAFT, draft.getState());
    assertEquals(5, draft.getOperations().size());
    assertEquals(3, result.getTerms().size());
    assertEquals(2, result.getRelationships().size());

    final OntologyChangeSet applied =
        applyOntologyChangeSet(client, draft, namespace, "patternEditor");
    final GlossaryTerm control =
        client.glossaryTerms().get(result.getTerms().getFirst().getId().toString(), "relatedTerms");
    final GlossaryTerm requirement =
        client.glossaryTerms().get(result.getTerms().get(1).getId().toString(), "");

    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertEquals(5, applied.getApplicationResult().getOperationsApplied());
    assertEquals(control.getId(), requirement.getParent().getId());
    assertTrue(control.getIri().toString().startsWith("https://example.org/patterns/concept/"));
    assertTrue(
        control.getRelatedTerms().stream()
            .anyMatch(relation -> relation.getRelationType().equals("hasPart")));
  }

  private static Glossary createGlossary(
      final OpenMetadataClient client, final TestNamespace namespace) {
    final OntologyConfiguration configuration =
        new OntologyConfiguration()
            .withBaseIri(URI.create("https://example.org/patterns/"))
            .withLayer(OntologyLayer.L_3)
            .withImports(List.of())
            .withPrefixes(List.of())
            .withIriMintingPattern("concept/{term}/{uuid}")
            .withReadOnly(false)
            .withInstalledPacks(List.of());
    final Glossary glossary =
        client
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(namespace.prefix("PatternGlossary"))
                    .withDescription("Ontology pattern integration model")
                    .withOntologyConfiguration(configuration));
    return namespace.trackRoot(Entity.GLOSSARY, glossary);
  }

  private static InstantiateOntologyPattern patternRequest(
      final Glossary glossary, final TestNamespace namespace) {
    return new InstantiateOntologyPattern()
        .withPatternType(OntologyPatternType.REGULATORY_CONTROL)
        .withGlossaryId(glossary.getId())
        .withChangeSetName(namespace.prefix("RegulatoryPatternDraft"))
        .withChangeSetDisplayName("Regulatory pattern draft")
        .withChangeSetDescription("Generated from a governed modeling pattern")
        .withRegulatoryControl(
            new RegulatoryControlPatternInput()
                .withControl(term(namespace.prefix("AccessControl")))
                .withRequirement(term(namespace.prefix("MfaRequirement")))
                .withEvidence(term(namespace.prefix("MfaEvidence"))));
  }

  private static OntologyPatternTermInput term(final String name) {
    return new OntologyPatternTermInput()
        .withName(name)
        .withDisplayName(name)
        .withDescription("Pattern-generated " + name);
  }
}
