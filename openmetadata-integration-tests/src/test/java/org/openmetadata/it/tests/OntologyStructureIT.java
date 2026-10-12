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
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.MergeOntologyStructure;
import org.openmetadata.schema.api.data.OntologyStructuralDiff;
import org.openmetadata.schema.api.data.OntologyStructuralDiffRequest;
import org.openmetadata.schema.api.data.OntologyStructuralDiffState;
import org.openmetadata.schema.api.data.OntologyStructuralMergeResult;
import org.openmetadata.schema.api.data.OntologyStructuralMergeSelection;
import org.openmetadata.schema.api.data.OntologySubsetResult;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyConfiguration;
import org.openmetadata.schema.type.OntologyLayer;
import org.openmetadata.schema.type.OntologyStructuralField;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OntologyStructureIT {
  private static final String SOURCE_DESCRIPTION = "Upstream description after review";
  private static final String LOCAL_DISPLAY_NAME = "Application customer";

  @AfterEach
  void cleanup(TestNamespace namespace) {
    NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
  }

  @Test
  void diffsSelectivelyMergesAndAppliesVersionedStructure(TestNamespace namespace) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final Models models = createModels(client, namespace);
    final GlossaryTerm copied = materializeSubset(client, models, namespace);
    final UpdatedTerms updated = divergeSourceAndSubset(client, models.sourceTerm(), copied);
    final OntologyStructuralDiff diff = diff(client, models, updated.subset());

    assertThreeWayDiff(diff);
    final OntologyStructuralMergeResult merge = merge(client, models, updated.subset(), namespace);
    namespace.trackRoot(Entity.ONTOLOGY_CHANGE_SET, merge.getChangeSet().getId());
    final OntologyChangeSet draft =
        client
            .ontologyChangeSets()
            .get(merge.getChangeSet().getId().toString(), "glossaries,operations");
    final OntologyChangeSet applied =
        applyOntologyChangeSet(client, draft, namespace, "structureEditor");
    assertMerged(client, updated, draft, merge, applied);
  }

  private static Models createModels(
      final OpenMetadataClient client, final TestNamespace namespace) {
    final Glossary source =
        createGlossary(client, namespace, "StructureReference", OntologyLayer.L_1);
    final Glossary target =
        createGlossary(client, namespace, "StructureApplication", OntologyLayer.L_3);
    final GlossaryTerm term =
        client
            .glossaryTerms()
            .create(
                new CreateGlossaryTerm()
                    .withName(namespace.prefix("Customer"))
                    .withDescription("Original source description")
                    .withGlossary(source.getFullyQualifiedName())
                    .withIri(URI.create("https://example.org/structure/customer")));
    return new Models(source, target, term);
  }

  private static Glossary createGlossary(
      final OpenMetadataClient client,
      final TestNamespace namespace,
      final String suffix,
      final OntologyLayer layer) {
    final String name = namespace.prefix(suffix);
    final OntologyConfiguration configuration = configuration(name, layer);
    final Glossary glossary =
        client
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(name)
                    .withDescription("Structural merge integration model")
                    .withOntologyConfiguration(configuration));
    return namespace.trackRoot(Entity.GLOSSARY, glossary);
  }

  private static OntologyConfiguration configuration(final String name, final OntologyLayer layer) {
    return new OntologyConfiguration()
        .withBaseIri(URI.create("https://example.org/structure/" + name + '/'))
        .withLayer(layer)
        .withImports(List.of())
        .withPrefixes(List.of())
        .withIriMintingPattern("concept/{term}/{uuid}")
        .withReadOnly(false)
        .withInstalledPacks(List.of());
  }

  private static GlossaryTerm materializeSubset(
      final OpenMetadataClient client, final Models models, final TestNamespace namespace) {
    final BuildOntologySubset request =
        new BuildOntologySubset()
            .withSourceGlossaryId(models.source().getId())
            .withTargetGlossaryId(models.target().getId())
            .withSourceTermIds(Set.of(models.sourceTerm().getId()))
            .withIncludeDescendants(false)
            .withIncludeRelationships(false)
            .withChangeSetName(namespace.prefix("StructureSubset"))
            .withChangeSetDescription("Materialize the application concept");
    final OntologySubsetResult result = client.ontologySubsets().build(request);
    namespace.trackRoot(Entity.ONTOLOGY_CHANGE_SET, result.getChangeSet().getId());
    applyOntologyChangeSet(client, result.getChangeSet(), namespace, "subsetEditor");
    return client
        .glossaryTerms()
        .get(result.getTerms().getFirst().getId().toString(), termFields());
  }

  private static UpdatedTerms divergeSourceAndSubset(
      final OpenMetadataClient client,
      final GlossaryTerm initialSource,
      final GlossaryTerm initialSubset) {
    final GlossaryTerm source =
        client.glossaryTerms().get(initialSource.getId().toString(), termFields());
    source.setDescription(SOURCE_DESCRIPTION);
    final GlossaryTerm updatedSource = client.glossaryTerms().update(source.getId(), source);
    initialSubset.setDisplayName(LOCAL_DISPLAY_NAME);
    final GlossaryTerm updatedSubset =
        client.glossaryTerms().update(initialSubset.getId(), initialSubset);
    return new UpdatedTerms(updatedSource, updatedSubset);
  }

  private static OntologyStructuralDiff diff(
      final OpenMetadataClient client, final Models models, final GlossaryTerm subset) {
    final OntologyStructuralDiffRequest request =
        new OntologyStructuralDiffRequest()
            .withSourceGlossaryId(models.source().getId())
            .withTargetGlossaryId(models.target().getId())
            .withSubsetTermIds(Set.of(subset.getId()));
    return client.ontologyStructure().diff(request);
  }

  private static void assertThreeWayDiff(final OntologyStructuralDiff diff) {
    assertEquals(1, diff.getData().size());
    assertEquals(OntologyStructuralDiffState.MERGEABLE, diff.getData().getFirst().getState());
    assertEquals(
        Set.of(OntologyStructuralField.DESCRIPTION),
        diff.getData().getFirst().getSourceChangedFields());
    assertEquals(
        Set.of(OntologyStructuralField.DISPLAY_NAME),
        diff.getData().getFirst().getSubsetChangedFields());
    assertTrue(diff.getData().getFirst().getConflictingFields().isEmpty());
  }

  private static OntologyStructuralMergeResult merge(
      final OpenMetadataClient client,
      final Models models,
      final GlossaryTerm subset,
      final TestNamespace namespace) {
    final OntologyStructuralMergeSelection selection =
        new OntologyStructuralMergeSelection()
            .withSubsetTermId(subset.getId())
            .withFields(Set.of(OntologyStructuralField.DESCRIPTION));
    final MergeOntologyStructure request =
        new MergeOntologyStructure()
            .withSourceGlossaryId(models.source().getId())
            .withTargetGlossaryId(models.target().getId())
            .withContextTermIds(Set.of(subset.getId()))
            .withSelections(List.of(selection))
            .withChangeSetName(namespace.prefix("StructureMerge"))
            .withChangeSetDescription("Selectively merge the source description");
    return client.ontologyStructure().merge(request);
  }

  private static void assertMerged(
      final OpenMetadataClient client,
      final UpdatedTerms updated,
      final OntologyChangeSet draft,
      final OntologyStructuralMergeResult merge,
      final OntologyChangeSet applied) {
    final GlossaryTerm persisted =
        client.glossaryTerms().get(updated.subset().getId().toString(), termFields());
    assertEquals(OntologyChangeSetState.DRAFT, draft.getState());
    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertEquals(1, draft.getOperations().size());
    assertTrue(merge.getRelationshipOperations().isEmpty());
    assertEquals(SOURCE_DESCRIPTION, persisted.getDescription());
    assertEquals(LOCAL_DISPLAY_NAME, persisted.getDisplayName());
    assertEquals(
        updated.source().getVersion(), persisted.getOntologySource().getSourceTermVersion());
    assertEquals(
        SOURCE_DESCRIPTION, persisted.getOntologySource().getSourceSnapshot().getDescription());
  }

  private static String termFields() {
    return "attributes,conceptMappings,ontologySource,relatedTerms";
  }

  private record Models(Glossary source, Glossary target, GlossaryTerm sourceTerm) {}

  private record UpdatedTerms(GlossaryTerm source, GlossaryTerm subset) {}
}
