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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.OntologyPackInstallPlan;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyPackInstallation;
import org.openmetadata.schema.type.OntologyPackModuleInstallation;
import org.openmetadata.schema.type.OntologyPackSlice;
import org.openmetadata.schema.type.OntologyPackSource;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.ontology.OntologyPackInstallations.PlanLedger;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot.Entry;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot.Snapshot;
import org.openmetadata.service.rdf.NativeOntologyRdfImporter;
import org.openmetadata.service.rdf.RdfSerializationFormat;

class OntologyPackInstallationsTest {
  private static final Set<String> PACKS_FOR_THE_INSTALL_JOB =
      Set.of("brick", "dpv", "fhir", "fibo", "gs1", "iof");

  @BeforeAll
  static void registerOntologyType() {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put(Entity.ONTOLOGY, Entity.ONTOLOGY);
  }

  private final OntologyPackCatalog catalog = OntologyPackCatalog.bundled();
  private final Ontology root =
      new Ontology()
          .withId(UUID.randomUUID())
          .withName("library")
          .withFullyQualifiedName("library");
  private final Snapshot emptySnapshot =
      new Snapshot(
          new OntologyState().withOntologyId(root.getId()).withWorkingRevision(0L),
          List.of(new Entry(MemberKind.ONTOLOGY, root)));

  @Test
  void rejectsAnEmptyStampedPlanBeforePreparingAnInstallation() {
    final OntologyChangeSet empty =
        changeSet("sosa-ssn", List.of("sosa")).withOperations(List.of()).withUndoCursor(0);

    assertThrows(
        PreconditionFailedException.class,
        () -> OntologyPackInstallations.prepare(catalog, emptySnapshot, empty, "steward", 123L));
  }

  @Test
  void validatesDependencyExpandedSourceAndStampsCatalogProvenance() {
    final OntologyChangeSet changeSet = plan("sosa-ssn", List.of("ssn"), emptySnapshot);

    OntologyPackInstallations.requireCurrent(catalog, changeSet);
    final var prepared =
        OntologyPackInstallations.prepare(catalog, emptySnapshot, changeSet, "steward", 123L);

    assertEquals(changeSet.getOntology().getId(), prepared.ontologyId());
    assertEquals(
        List.of("sosa", "ssn"),
        prepared.installation().getModules().stream()
            .map(OntologyPackModuleInstallation::getModuleId)
            .toList());
    assertEquals(
        catalog.require("sosa-ssn").getModules().getFirst().getSha256(),
        prepared.installation().getModules().getFirst().getSha256());
    assertEquals(123L, prepared.installation().getInstalledAt());
    assertEquals("steward", prepared.installation().getInstalledBy());
    assertEquals(catalog.require("sosa-ssn").getLicense(), prepared.installation().getLicense());
  }

  @Test
  void rejectsUnexpandedModulesAndGlossaryScope() {
    assertThrows(
        BadRequestException.class,
        () ->
            OntologyPackInstallations.requireCurrent(
                catalog, changeSet("sosa-ssn", List.of("ssn"))));
    final OntologyChangeSet glossary = changeSet("sosa-ssn", List.of("sosa"));
    glossary.setOntology(null);
    assertThrows(
        BadRequestException.class,
        () -> OntologyPackInstallations.requireCurrent(catalog, glossary));
  }

  @Test
  void mergesModulesOfTheSamePackWithoutMutatingPreviousRecord() {
    final OntologyPackInstallation first = installation("sosa-ssn", "sosa");
    final OntologyPackInstallation second = installation("sosa-ssn", "sosa", "ssn");

    final List<OntologyPackInstallation> merged =
        OntologyPackInstallations.record(List.of(first), second, List.of("sosa", "ssn"));

    assertEquals(1, merged.size());
    assertNotSame(first, merged.getFirst());
    assertEquals(
        List.of("sosa", "ssn"),
        merged.getFirst().getModules().stream()
            .map(OntologyPackModuleInstallation::getModuleId)
            .toList());
    assertEquals(
        List.of("sosa"),
        first.getModules().stream().map(OntologyPackModuleInstallation::getModuleId).toList());
  }

  @Test
  void stampsTheVerifiedDependencyExpandedSelection() {
    final var selected =
        new OntologyPackContentLoader(getClass().getClassLoader())
            .loadSelected(catalog, "sosa-ssn", List.of("ssn"));

    final OntologyPackSource source = OntologyPackInstallations.sourcePack(selected);

    assertEquals("sosa-ssn", source.getPackId());
    assertEquals(selected.manifest().getVersion(), source.getVersion());
    assertEquals(List.of("sosa", "ssn"), new ArrayList<>(source.getModuleIds()));
  }

  @Test
  void listsInstalledOntologiesInPackAndNameOrder() {
    final Ontology zed =
        new Ontology()
            .withId(UUID.randomUUID())
            .withName("Zed")
            .withFullyQualifiedName("Zed")
            .withInstalledPacks(List.of(installation("sosa-ssn", "sosa")));
    final Ontology alpha =
        new Ontology()
            .withId(UUID.randomUUID())
            .withName("Alpha")
            .withFullyQualifiedName("Alpha")
            .withInstalledPacks(
                List.of(installation("sosa-ssn", "sosa"), installation("dcat", "dcat")));
    final Ontology empty = new Ontology().withId(UUID.randomUUID()).withName("Empty");

    final var records = OntologyPackInstallations.records(List.of(zed, empty, alpha));

    assertEquals(
        List.of("dcat:Alpha", "sosa-ssn:Alpha", "sosa-ssn:Zed"),
        records.stream()
            .map(
                record ->
                    record.getInstallation().getPackId()
                        + ":"
                        + record.getOntology().getFullyQualifiedName())
            .toList());
  }

  @Test
  void replacesAnotherPackVersionAndRejectsStaleSourceAtApply() {
    final OntologyPackInstallation first = installation("sosa-ssn", "sosa");
    final OntologyPackInstallation newer = installation("sosa-ssn", "sosa").withVersion("2");
    final OntologyPackInstallation unrelated = installation("dcat", "dcat");

    assertEquals(
        List.of(newer, unrelated),
        OntologyPackInstallations.record(List.of(first, unrelated), newer, List.of("sosa", "ssn")));
    assertEquals(List.of(newer), OntologyPackInstallations.record(null, newer, List.of("sosa")));

    final OntologyChangeSet unstamped = new OntologyChangeSet();
    OntologyPackInstallations.requireCurrent(catalog, unstamped);
    assertNull(OntologyPackInstallations.prepare(catalog, null, unstamped, "steward", 123L));

    final OntologyChangeSet stale = changeSet("sosa-ssn", List.of("sosa"));
    stale.getSourcePack().setVersion("old-version");
    assertThrows(
        BadRequestException.class, () -> OntologyPackInstallations.requireCurrent(catalog, stale));
    assertThrows(
        PreconditionFailedException.class,
        () -> OntologyPackInstallations.prepare(catalog, emptySnapshot, stale, "steward", 123L));
  }

  @Test
  void acceptsIndependentReconciliationsAndRetriesWithoutChangingTheirIdsOrPayloads() {
    final var first = plan("sosa-ssn", List.of("ssn"), emptySnapshot);
    final var second = plan("sosa-ssn", List.of("ssn"), emptySnapshot);
    assertNotEquals(
        first.getOperations().getFirst().getId(), second.getOperations().getFirst().getId());
    assertNotEquals(
        first.getOperations().getFirst().getConcept().getId(),
        second.getOperations().getFirst().getConcept().getId());
    Collections.reverse(second.getOperations());
    final String before = JsonUtils.pojoToJson(second);

    final var prepared =
        OntologyPackInstallations.prepare(catalog, emptySnapshot, second, "steward", 123L);
    assertEquals(
        prepared,
        OntologyPackInstallations.prepare(catalog, emptySnapshot, second, "steward", 123L));
    assertEquals(JsonUtils.pojoToJson(second), before);
  }

  @Test
  void acceptsEveryBundledPackSelectionThatFitsOneInteractiveImport() {
    for (final var manifest : catalog.list()) {
      if (!PACKS_FOR_THE_INSTALL_JOB.contains(manifest.getId())) {
        for (final var module : manifest.getModules()) {
          final var draft = plan(manifest.getId(), List.of(module.getId()), emptySnapshot);
          final var prepared =
              OntologyPackInstallations.prepare(catalog, emptySnapshot, draft, "steward", 123L);
          assertEquals(manifest.getId(), prepared.installation().getPackId());
        }
      }
    }
  }

  @Test
  void rejectsMissingExtraUnrelatedAndDuplicateOperations() {
    final var missing = plan("sosa-ssn", List.of("sosa"), emptySnapshot);
    missing.getOperations().removeLast();
    missing.setUndoCursor(missing.getOperations().size());
    assertRejected(missing, emptySnapshot);

    final var extra = plan("sosa-ssn", List.of("sosa"), emptySnapshot);
    extra
        .getOperations()
        .add(plan("dcat", List.of("dcat"), emptySnapshot).getOperations().getFirst());
    extra.setUndoCursor(extra.getOperations().size());
    assertRejected(extra, emptySnapshot);

    final var unrelated = plan("dcat", List.of("dcat"), emptySnapshot);
    unrelated.setSourcePack(changeSet("sosa-ssn", List.of("sosa")).getSourcePack());
    assertRejected(unrelated, emptySnapshot);

    final var duplicate = plan("sosa-ssn", List.of("sosa"), emptySnapshot);
    final var repeated =
        JsonUtils.deepCopy(duplicate.getOperations().getFirst(), OntologyChangeOperation.class);
    repeated.setId(UUID.randomUUID());
    NativeOntologyChanges.definition(repeated).setId(UUID.randomUUID());
    duplicate.getOperations().add(repeated);
    duplicate.setUndoCursor(duplicate.getOperations().size());
    assertRejected(duplicate, emptySnapshot);
  }

  @ParameterizedTest
  @MethodSource("conceptAlterations")
  void rejectsAlteredConceptPayloadOrAttribution(
      final Consumer<OntologyChangeOperation> alteration) {
    final var draft = plan("sosa-ssn", List.of("sosa"), emptySnapshot);
    alteration.accept(draft.getOperations().getFirst());
    assertRejected(draft, emptySnapshot);
  }

  private static Stream<Consumer<OntologyChangeOperation>> conceptAlterations() {
    return Stream.of(
        operation -> operation.getConcept().setDisplayName("Changed label"),
        operation -> operation.getConcept().setIri(URI.create("https://example.org/changed")),
        operation ->
            operation
                .getConcept()
                .setOntology(new EntityReference().withId(UUID.randomUUID()).withType("ontology")),
        operation ->
            operation
                .getConcept()
                .setOwners(
                    List.of(new EntityReference().withId(UUID.randomUUID()).withType("user"))),
        operation -> operation.setSourceMemoryIds(Set.of(UUID.randomUUID())),
        operation -> operation.withTargetId(operation.getConcept().getId()).withBaseVersion(0.1));
  }

  @Test
  void rejectsChangedRelationEndpointsAndWorkingRevision() {
    final var draft = plan("sosa-ssn", List.of("ssn"), emptySnapshot);
    draft.getOperations().stream()
        .filter(operation -> operation.getAxiom() != null)
        .findFirst()
        .orElseThrow()
        .getAxiom()
        .setSubjectIri(URI.create("https://example.org/changed"));
    assertRejected(draft, emptySnapshot);
    final var stale = plan("sosa-ssn", List.of("sosa"), emptySnapshot).withBaseWorkingRevision(1L);
    assertRejected(stale, emptySnapshot);
  }

  @Test
  void requiresFullRedoAndLeavesUnmarkedDraftHandlingUnchanged() {
    final var draft = plan("sosa-ssn", List.of("sosa"), emptySnapshot);
    draft.setUndoCursor(draft.getOperations().size() - 1);
    OntologyChangeSetValidator.normalizeAndValidate(draft);
    assertRejected(draft, emptySnapshot);
    draft.setUndoCursor(draft.getOperations().size());
    OntologyChangeSetValidator.normalizeAndValidate(draft);
    assertEquals(
        "sosa-ssn",
        OntologyPackInstallations.prepare(catalog, emptySnapshot, draft, "steward", 123L)
            .installation()
            .getPackId());
    draft.setSourcePack(null);
    draft.setUndoCursor(0);
    assertNull(OntologyPackInstallations.prepare(catalog, null, draft, "steward", 123L));
  }

  @Test
  void validatesPartialReinstallAndRetainsModuleUnionButRejectsNoOpStamp() {
    final var first = plan("sosa-ssn", List.of("sosa"), emptySnapshot);
    final var installed =
        OntologyPackInstallations.prepare(catalog, emptySnapshot, first, "steward", 123L);
    final Snapshot populated = populated(first);
    final var second = plan("sosa-ssn", List.of("ssn"), populated);
    assertTrue(
        second.getOperations().size()
            < plan("sosa-ssn", List.of("ssn"), emptySnapshot).getOperations().size());
    final var next = OntologyPackInstallations.prepare(catalog, populated, second, "steward", 124L);
    final var union =
        OntologyPackInstallations.record(
            List.of(installed.installation()), next.installation(), next.moduleOrder());
    assertEquals(
        List.of("sosa", "ssn"),
        union.getFirst().getModules().stream()
            .map(OntologyPackModuleInstallation::getModuleId)
            .toList());
    final var noOp = plan("sosa-ssn", List.of("sosa"), populated);
    assertTrue(noOp.getOperations().isEmpty());
    assertRejected(noOp, populated);
  }

  @Test
  void preservesUpdateTargetAndBaseVersionIdentity() {
    final Snapshot existing = populated(plan("sosa-ssn", List.of("sosa"), emptySnapshot));
    existing.entries().get(1).definition().setDisplayName("Old label");
    final var update = plan("sosa-ssn", List.of("sosa"), existing);
    assertEquals(1, update.getOperations().size());
    final var operation = update.getOperations().getFirst();
    assertEquals(existing.entries().get(1).definition().getId(), operation.getTargetId());
    OntologyPackInstallations.prepare(catalog, existing, update, "steward", 123L);
    operation.setBaseVersion(0.2);
    assertRejected(update, existing);
    operation.setBaseVersion(0.1);
    operation.setTargetId(UUID.randomUUID());
    operation.getConcept().setId(operation.getTargetId());
    assertRejected(update, existing);
  }

  @Test
  void comparesOrderedPropertyChainsWithoutErasingSemanticFields() {
    final String rdf =
        """
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix ex: <https://example.org/> .
        ex:parent a owl:ObjectProperty .
        ex:brother a owl:ObjectProperty .
        ex:uncle a owl:ObjectProperty ; owl:propertyChainAxiom (ex:parent ex:brother) .
        """;
    final var expected = reconcile(rdf, RdfSerializationFormat.TURTLE, emptySnapshot);
    final var actual = reconcile(rdf, RdfSerializationFormat.TURTLE, emptySnapshot);
    OntologyPackInstallations.requireMatchingOperations(expected, actual);
    final var chain =
        actual.stream()
            .map(OntologyChangeOperation::getProperty)
            .filter(property -> property.getPropertyChain().size() == 2)
            .findFirst()
            .orElseThrow();
    chain.setPropertyChain(chain.getPropertyChain().reversed());
    assertThrows(
        PreconditionFailedException.class,
        () -> OntologyPackInstallations.requireMatchingOperations(expected, actual));
  }

  @Test
  void anEmptyOwnerListAddedByStorageIsNotADifferenceInThePlan() {
    final String rdf =
        """
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix ex: <https://example.org/> .
        ex:knows a owl:ObjectProperty .
        """;
    final var expected = reconcile(rdf, RdfSerializationFormat.TURTLE, emptySnapshot);
    final var stored = reconcile(rdf, RdfSerializationFormat.TURTLE, emptySnapshot);
    stored.stream()
        .map(OntologyChangeOperation::getProperty)
        .filter(Objects::nonNull)
        .forEach(property -> property.setOwners(new ArrayList<>()));

    OntologyPackInstallations.requireMatchingOperations(expected, stored);
  }

  @Test
  void aSliceIsVerifiedAgainstTheJobsRecordedPlanAndOnlyTheLastRecordsTheInstallation() {
    final var draft = plan("sosa-ssn", List.of("ssn", "sosa"), emptySnapshot);
    final var slicePlan = OntologyPackSlicePlan.of(draft.getOperations(), 40, "ab".repeat(32));
    assertEquals(4, slicePlan.slices().size());
    final PlanLedger ledger = ledgerOf(slicePlan);

    final List<Boolean> recordsInstallation =
        slicePlan.slices().stream()
            .map(
                slice ->
                    OntologyPackInstallations.prepareSlice(
                            catalog, ledger, sliceChangeSet(draft, slicePlan, slice), "steward", 5L)
                        != null)
            .toList();

    assertEquals(List.of(false, false, false, true), recordsInstallation);
  }

  @Test
  void rejectsASliceWhoseOperationsDifferFromThePlanOrWhoseStampIsForeign() {
    final var draft = plan("sosa-ssn", List.of("ssn", "sosa"), emptySnapshot);
    final var slicePlan = OntologyPackSlicePlan.of(draft.getOperations(), 40, "ab".repeat(32));
    final PlanLedger ledger = ledgerOf(slicePlan);
    final var first = slicePlan.slices().getFirst();

    final var altered = sliceChangeSet(draft, slicePlan, first);
    altered.getOperations().getFirst().getConcept().setDisplayName("Changed label");
    assertSliceRejected(ledger, altered);

    final var swapped = sliceChangeSet(draft, slicePlan, first);
    swapped.getSourcePack().getSlice().setIndex(1);
    assertSliceRejected(ledger, swapped);

    final var otherJob = sliceChangeSet(draft, slicePlan, first);
    otherJob.getSourcePack().getSlice().setJobId(8L);
    assertSliceRejected(ledger, otherJob);

    final var otherPlan = sliceChangeSet(draft, slicePlan, first);
    otherPlan.getSourcePack().getSlice().setPlanDigest("cd".repeat(32));
    assertSliceRejected(ledger, otherPlan);

    final var otherOntology = sliceChangeSet(draft, slicePlan, first);
    otherOntology.setOntology(new EntityReference().withId(UUID.randomUUID()).withType("ontology"));
    assertSliceRejected(ledger, otherOntology);

    final var partial = sliceChangeSet(draft, slicePlan, first);
    partial.setUndoCursor(partial.getOperations().size() - 1);
    assertSliceRejected(ledger, partial);
  }

  private void assertSliceRejected(final PlanLedger ledger, final OntologyChangeSet changeSet) {
    assertThrows(
        PreconditionFailedException.class,
        () -> OntologyPackInstallations.prepareSlice(catalog, ledger, changeSet, "steward", 5L));
  }

  private PlanLedger ledgerOf(final OntologyPackSlicePlan slicePlan) {
    final OntologyPackInstallPlan recorded =
        new OntologyPackInstallPlan()
            .withPlanDigest(slicePlan.planDigest())
            .withSliceDigests(slicePlan.sliceDigests())
            .withMemberCount(slicePlan.memberCount())
            .withMembersApplied(0);
    return (jobId, ontologyId) -> jobId == 7L && ontologyId.equals(root.getId()) ? recorded : null;
  }

  private OntologyChangeSet sliceChangeSet(
      final OntologyChangeSet draft,
      final OntologyPackSlicePlan slicePlan,
      final OntologyPackSlicePlan.Slice slice) {
    final List<OntologyChangeOperation> operations =
        JsonUtils.readObjects(
            JsonUtils.pojoToJson(slice.operations()), OntologyChangeOperation.class);
    return new OntologyChangeSet()
        .withOntology(root.getEntityReference())
        .withBaseWorkingRevision(0L)
        .withOperations(new ArrayList<>(operations))
        .withUndoCursor(operations.size())
        .withSourcePack(
            JsonUtils.deepCopy(draft.getSourcePack(), OntologyPackSource.class)
                .withSlice(
                    new OntologyPackSlice()
                        .withJobId(7L)
                        .withIndex(slice.index())
                        .withCount(slicePlan.slices().size())
                        .withPlanDigest(slicePlan.planDigest())));
  }

  private void assertRejected(final OntologyChangeSet draft, final Snapshot snapshot) {
    assertThrows(
        PreconditionFailedException.class,
        () -> OntologyPackInstallations.prepare(catalog, snapshot, draft, "steward", 123L));
  }

  private OntologyChangeSet plan(
      final String packId, final List<String> modules, final Snapshot snapshot) {
    final var selected = catalog.loadSelected(packId, modules);
    final var operations =
        reconcile(selected.body(), RdfSerializationFormat.parse(selected.format()), snapshot);
    final var draft =
        new OntologyChangeSet()
            .withOntology(root.getEntityReference())
            .withBaseWorkingRevision(snapshot.state().getWorkingRevision())
            .withOperations(operations)
            .withUndoCursor(operations.size())
            .withSourcePack(OntologyPackInstallations.sourcePack(selected));
    OntologyChangeSetValidator.normalizeAndValidate(draft);
    draft.setOperations(new ArrayList<>(draft.getOperations()));
    return draft;
  }

  private List<OntologyChangeOperation> reconcile(
      final String rdf, final RdfSerializationFormat format, final Snapshot snapshot) {
    final var importer = new NativeOntologyRdfImporter();
    final var model = importer.parse(rdf, format);
    try {
      return new ArrayList<>(importer.reconcile(model, snapshot).getOperations());
    } finally {
      model.close();
    }
  }

  private Snapshot populated(final OntologyChangeSet draft) {
    final List<Entry> entries = new ArrayList<>(emptySnapshot.entries());
    for (final var operation : draft.getOperations()) {
      final MemberKind kind =
          switch (operation.getOperationType()) {
            case UPSERT_CONCEPT -> MemberKind.CONCEPT;
            case UPSERT_PROPERTY -> MemberKind.PROPERTY;
            case UPSERT_AXIOM -> MemberKind.AXIOM;
            default -> throw new AssertionError(operation.getOperationType());
          };
      entries.add(new Entry(kind, NativeOntologyChanges.definition(operation)));
    }
    return new Snapshot(emptySnapshot.state(), List.copyOf(entries));
  }

  private OntologyChangeSet changeSet(final String packId, final List<String> moduleIds) {
    return new OntologyChangeSet()
        .withOntology(new EntityReference().withId(UUID.randomUUID()))
        .withSourcePack(
            new OntologyPackSource()
                .withPackId(packId)
                .withVersion(catalog.require(packId).getVersion())
                .withModuleIds(new LinkedHashSet<>(moduleIds)));
  }

  private static OntologyPackInstallation installation(
      final String packId, final String... moduleIds) {
    return new OntologyPackInstallation()
        .withPackId(packId)
        .withVersion("1")
        .withModules(
            java.util.Arrays.stream(moduleIds)
                .map(
                    id ->
                        new OntologyPackModuleInstallation()
                            .withModuleId(id)
                            .withSha256("a".repeat(64)))
                .toList())
        .withInstalledAt(1L)
        .withInstalledBy("steward");
  }
}
