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
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.BuildOntologySubset;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.OntologySubsetResult;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyConfiguration;
import org.openmetadata.schema.type.OntologyLayer;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OntologySubsetIT {
  private static final String HAS_PART = "hasPart";

  @AfterEach
  void cleanup(TestNamespace namespace) {
    NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
  }

  @Test
  void buildsAndAppliesAVersionPinnedApplicationSubset(TestNamespace namespace) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final Glossary source =
        createGlossary(client, namespace, "ReferenceOntology", OntologyLayer.L_1);
    final Glossary target =
        createGlossary(client, namespace, "ApplicationOntology", OntologyLayer.L_3);
    final GlossaryTerm sourceRoot = createSourceHierarchy(client, source, namespace);
    final BuildOntologySubset request = subsetRequest(source, target, sourceRoot, namespace);

    final OntologySubsetResult result = client.ontologySubsets().build(request);
    namespace.trackRoot(Entity.ONTOLOGY_CHANGE_SET, result.getChangeSet().getId());
    final OntologyChangeSet draft =
        client
            .ontologyChangeSets()
            .get(result.getChangeSet().getId().toString(), "glossaries,operations");

    assertEquals(OntologyChangeSetState.DRAFT, draft.getState());
    assertEquals(3, result.getTerms().size());
    assertEquals(1, result.getRelationships().size());
    assertEquals(source.getVersion(), result.getSourceGlossaryVersion());

    final OntologyChangeSet applied =
        applyOntologyChangeSet(client, draft, namespace, "subsetEditor");
    final GlossaryTerm copiedRoot =
        client
            .glossaryTerms()
            .get(
                result.getTerms().getFirst().getId().toString(),
                "conceptMappings,ontologySource,relatedTerms");
    final GlossaryTerm copiedChild =
        client.glossaryTerms().get(result.getTerms().get(1).getId().toString(), "parent");

    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertEquals(4, applied.getApplicationResult().getOperationsApplied());
    assertEquals(sourceRoot.getId(), copiedRoot.getOntologySource().getSourceTerm().getId());
    assertEquals(sourceRoot.getVersion(), copiedRoot.getOntologySource().getSourceTermVersion());
    assertEquals(copiedRoot.getId(), copiedChild.getParent().getId());
    assertTrue(
        copiedRoot.getConceptMappings().stream()
            .anyMatch(
                mapping ->
                    mapping.getMappingType() == ConceptMapping.ConceptMappingType.EXACT_MATCH
                        && sourceRoot.getIri().equals(mapping.getConceptIri())));
    assertTrue(
        copiedRoot.getRelatedTerms().stream()
            .anyMatch(
                relation ->
                    relation.getProvenance() == RelationProvenance.IMPORTED
                        && relation.getRelationType().equals(HAS_PART)));
  }

  private static Glossary createGlossary(
      final OpenMetadataClient client,
      final TestNamespace namespace,
      final String suffix,
      final OntologyLayer layer) {
    final String name = namespace.prefix(suffix);
    final OntologyConfiguration configuration =
        new OntologyConfiguration()
            .withBaseIri(URI.create("https://example.org/subsets/" + name + '/'))
            .withLayer(layer)
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
                    .withName(name)
                    .withDescription("Ontology subset integration model")
                    .withOntologyConfiguration(configuration));
    return namespace.trackRoot(Entity.GLOSSARY, glossary);
  }

  private static GlossaryTerm createSourceHierarchy(
      final OpenMetadataClient client, final Glossary glossary, final TestNamespace namespace) {
    final GlossaryTerm root = createTerm(client, glossary, null, namespace.prefix("Customer"));
    final GlossaryTerm child = createTerm(client, glossary, root, namespace.prefix("Account"));
    final GlossaryTerm grandchild =
        createTerm(client, glossary, child, namespace.prefix("Balance"));
    final GlossaryTerm updatedRoot =
        client.glossaryTerms().addRelation(root.getId(), child.getId(), HAS_PART);
    assertEquals(child.getId(), grandchild.getParent().getId());
    return updatedRoot;
  }

  private static GlossaryTerm createTerm(
      final OpenMetadataClient client,
      final Glossary glossary,
      final GlossaryTerm parent,
      final String name) {
    final CreateGlossaryTerm request =
        new CreateGlossaryTerm()
            .withName(name)
            .withDescription("Reference concept " + name)
            .withGlossary(glossary.getFullyQualifiedName())
            .withIri(URI.create("https://example.org/reference/" + name));
    if (parent != null) {
      request.setParent(parent.getFullyQualifiedName());
    }
    return client.glossaryTerms().create(request);
  }

  private static BuildOntologySubset subsetRequest(
      final Glossary source,
      final Glossary target,
      final GlossaryTerm root,
      final TestNamespace namespace) {
    return new BuildOntologySubset()
        .withSourceGlossaryId(source.getId())
        .withTargetGlossaryId(target.getId())
        .withSourceTermIds(Set.of(root.getId()))
        .withIncludeDescendants(true)
        .withIncludeRelationships(true)
        .withChangeSetName(namespace.prefix("ApplicationSubsetDraft"))
        .withChangeSetDisplayName("Application subset draft")
        .withChangeSetDescription("Version-pinned subset integration draft");
  }
}
