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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.UriInfo;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.api.data.MergeOntologyStructure;
import org.openmetadata.schema.api.data.OntologyStructuralDiff;
import org.openmetadata.schema.api.data.OntologyStructuralMergeResult;
import org.openmetadata.schema.api.data.OntologyStructuralMergeSelection;
import org.openmetadata.schema.api.data.OntologyStructuralRelationshipOperation;
import org.openmetadata.schema.api.data.OntologyTermStructuralDiff;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologySourceProvenance;
import org.openmetadata.schema.type.OntologyStructuralField;
import org.openmetadata.schema.type.OntologyTermStructure;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.OntologyChangeSetRepository;
import org.openmetadata.service.ontology.OntologyStructuralDiffService.TermReader;

public final class OntologyStructuralMergeService {
  private final OntologyStructuralDiffService diffService;
  private final TermReader termReader;
  private final OntologyStructuralRelationshipMerger relationshipMerger;
  private final Clock clock;
  private final ChangeSetStore changeSetStore;

  public static OntologyStructuralMergeService createDefault(
      final GlossaryTermRepository termRepository,
      final OntologyChangeSetRepository changeSetRepository,
      final RelationshipTypeResolver relationshipTypes,
      final Clock clock) {
    final TermReader termReader = new RepositoryOntologyStructuralTermReader(termRepository);
    return new OntologyStructuralMergeService(
        new OntologyStructuralDiffService(termReader),
        termReader,
        new OntologyStructuralRelationshipMerger(relationshipTypes, clock),
        clock,
        changeSetRepository::create);
  }

  OntologyStructuralMergeService(
      final OntologyStructuralDiffService diffService,
      final TermReader termReader,
      final OntologyStructuralRelationshipMerger relationshipMerger,
      final Clock clock,
      final ChangeSetStore changeSetStore) {
    this.diffService = diffService;
    this.termReader = termReader;
    this.relationshipMerger = relationshipMerger;
    this.clock = clock;
    this.changeSetStore = changeSetStore;
  }

  public OntologyStructuralMergeResult merge(
      final Glossary source,
      final Glossary target,
      final MergeOntologyStructure request,
      final MergeExecution execution) {
    validateRequest(request);
    final List<GlossaryTerm> context = readContext(request.getContextTermIds());
    final OntologyStructuralDiff diff =
        diffService.diff(source, target, request.getContextTermIds());
    final MergePlan plan = new MergePlan(source, target, context, execution);
    final MergeAccumulator accumulator = MergeAccumulator.empty();
    mergeSelections(request.getSelections(), diff, plan, accumulator);
    final OntologyChangeSet changeSet = persistChangeSet(request, plan, accumulator);
    return result(source, target, changeSet, accumulator);
  }

  private void mergeSelections(
      final List<OntologyStructuralMergeSelection> selections,
      final OntologyStructuralDiff diff,
      final MergePlan plan,
      final MergeAccumulator accumulator) {
    final Set<UUID> selectedIds = new HashSet<>();
    for (final OntologyStructuralMergeSelection selection : selections) {
      requireSelection(selection, plan.context(), selectedIds);
      mergeSelection(selection, requireDiff(diff, selection), plan, accumulator);
    }
  }

  private void mergeSelection(
      final OntologyStructuralMergeSelection selection,
      final OntologyTermStructuralDiff diff,
      final MergePlan plan,
      final MergeAccumulator accumulator) {
    requireSourceChanges(selection, diff);
    final GlossaryTerm targetTerm =
        OntologyStructuralTermContext.requireTerm(plan.context(), selection.getSubsetTermId());
    final GlossaryTerm sourceTerm = termReader.read(diff.getSourceTerm().getId());
    final GlossaryTerm updated = JsonUtils.deepCopy(targetTerm, GlossaryTerm.class);
    applySelectedFields(updated, diff.getCurrentSource(), selection.getFields(), plan);
    updateProvenance(updated, sourceTerm, diff.getCurrentSource(), plan);
    accumulator.termOperations().add(updateOperation(updated, targetTerm.getVersion()));
    accumulator.terms().add(updated.getEntityReference());
    if (selection.getFields().contains(OntologyStructuralField.RELATIONSHIPS)) {
      relationshipMerger.merge(
          targetTerm,
          diff.getCurrentSource().getRelationships(),
          plan.context(),
          plan.execution().user(),
          accumulator.relationships());
    }
  }

  private static void applySelectedFields(
      final GlossaryTerm updated,
      final OntologyTermStructure source,
      final Set<OntologyStructuralField> fields,
      final MergePlan plan) {
    for (final OntologyStructuralField field : fields) {
      switch (field) {
        case NAME -> updated.setName(source.getName());
        case DISPLAY_NAME -> updated.setDisplayName(source.getDisplayName());
        case DESCRIPTION -> updated.setDescription(source.getDescription());
        case ENTITY_STATUS -> updated.setEntityStatus(source.getEntityStatus());
        case PARENT -> updated.setParent(
            OntologyStructuralTermContext.targetParent(
                source.getParentSourceTermId(), plan.context()));
        case ATTRIBUTES -> updated.setAttributes(List.copyOf(source.getAttributes()));
        case CONCEPT_MAPPINGS -> updated.setConceptMappings(mergedMappings(updated, source));
        case RELATIONSHIPS -> {}
      }
    }
  }

  private void updateProvenance(
      final GlossaryTerm updated,
      final GlossaryTerm sourceTerm,
      final OntologyTermStructure sourceStructure,
      final MergePlan plan) {
    final OntologySourceProvenance provenance =
        JsonUtils.deepCopy(updated.getOntologySource(), OntologySourceProvenance.class);
    provenance
        .withSourceGlossary(plan.source().getEntityReference())
        .withSourceGlossaryVersion(plan.source().getVersion())
        .withSourceTerm(sourceTerm.getEntityReference())
        .withSourceTermVersion(sourceTerm.getVersion())
        .withSourceIri(sourceTerm.getIri())
        .withSourceSnapshot(sourceStructure)
        .withCapturedAt(clock.millis())
        .withCapturedBy(plan.execution().user());
    updated.setOntologySource(provenance);
  }

  private static OntologyChangeOperation updateOperation(
      final GlossaryTerm updated, final Double baseVersion) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.UPDATE_TERM)
        .withTargetId(updated.getId())
        .withBaseVersion(baseVersion)
        .withTerm(updated)
        .withState(OntologyChangeOperationState.ACTIVE);
  }

  private OntologyChangeSet persistChangeSet(
      final MergeOntologyStructure request,
      final MergePlan plan,
      final MergeAccumulator accumulator) {
    final List<OntologyChangeOperation> operations = new ArrayList<>(accumulator.termOperations());
    operations.addAll(accumulator.relationships().operations());
    final OntologyChangeSet draft = changeSet(request, plan.target(), operations);
    return changeSetStore.create(plan.execution().uriInfo(), draft, plan.execution().user(), null);
  }

  private static OntologyChangeSet changeSet(
      final MergeOntologyStructure request,
      final Glossary target,
      final List<OntologyChangeOperation> operations) {
    return new OntologyChangeSet()
        .withId(UUID.randomUUID())
        .withName(request.getChangeSetName())
        .withDisplayName(changeSetDisplayName(request))
        .withDescription(request.getChangeSetDescription())
        .withGlossaries(List.of(target.getEntityReference()))
        .withState(OntologyChangeSetState.DRAFT)
        .withOperations(List.copyOf(operations))
        .withUndoCursor(operations.size())
        .withProvider(ProviderType.USER);
  }

  private static String changeSetDisplayName(final MergeOntologyStructure request) {
    final String displayName =
        nullOrEmpty(request.getChangeSetDisplayName())
                || request.getChangeSetDisplayName().isBlank()
            ? request.getChangeSetName()
            : request.getChangeSetDisplayName();
    return displayName;
  }

  private static OntologyStructuralMergeResult result(
      final Glossary source,
      final Glossary target,
      final OntologyChangeSet changeSet,
      final MergeAccumulator accumulator) {
    return new OntologyStructuralMergeResult()
        .withSourceGlossary(source.getEntityReference())
        .withTargetGlossary(target.getEntityReference())
        .withChangeSet(changeSet.getEntityReference())
        .withTerms(List.copyOf(accumulator.terms()))
        .withRelationshipOperations(
            accumulator.relationships().operations().stream()
                .map(OntologyStructuralMergeService::relationshipOperation)
                .toList());
  }

  private static OntologyStructuralRelationshipOperation relationshipOperation(
      final OntologyChangeOperation operation) {
    return new OntologyStructuralRelationshipOperation()
        .withOperationType(operation.getOperationType())
        .withRelationship(operation.getRelationship());
  }

  private List<GlossaryTerm> readContext(final Set<UUID> contextTermIds) {
    return contextTermIds.stream().map(termReader::read).toList();
  }

  private static void validateRequest(final MergeOntologyStructure request) {
    final boolean isInvalid =
        nullOrEmpty(request.getContextTermIds())
            || request.getContextTermIds().size() > 500
            || nullOrEmpty(request.getSelections())
            || request.getSelections().size() > 500;
    if (isInvalid) {
      throw new BadRequestException(
          "Structural merge requires 1 to 500 context terms and selections");
    }
  }

  private static void requireSelection(
      final OntologyStructuralMergeSelection selection,
      final List<GlossaryTerm> context,
      final Set<UUID> selectedIds) {
    final boolean isInvalid =
        selection == null
            || selection.getSubsetTermId() == null
            || nullOrEmpty(selection.getFields())
            || !selectedIds.add(selection.getSubsetTermId())
            || context.stream().noneMatch(term -> term.getId().equals(selection.getSubsetTermId()));
    if (isInvalid) {
      throw new BadRequestException(
          "Every structural merge selection must identify one unique context term and field set");
    }
  }

  private static void requireSourceChanges(
      final OntologyStructuralMergeSelection selection, final OntologyTermStructuralDiff diff) {
    if (!diff.getSourceChangedFields().containsAll(selection.getFields())) {
      throw new BadRequestException(
          "Structural merge selections must reference fields changed in the source model");
    }
  }

  private static OntologyTermStructuralDiff requireDiff(
      final OntologyStructuralDiff diff, final OntologyStructuralMergeSelection selection) {
    return diff.getData().stream()
        .filter(item -> item.getSubsetTerm().getId().equals(selection.getSubsetTermId()))
        .findFirst()
        .orElseThrow(
            () ->
                new BadRequestException("Structural merge selection is outside the diff context"));
  }

  private static List<ConceptMapping> mergedMappings(
      final GlossaryTerm updated, final OntologyTermStructure source) {
    final List<ConceptMapping> mappings = new ArrayList<>(source.getConceptMappings());
    final OntologySourceProvenance provenance = updated.getOntologySource();
    if (provenance.getSourceIri() != null
        && mappings.stream()
            .noneMatch(mapping -> provenance.getSourceIri().equals(mapping.getConceptIri()))) {
      mappings.add(
          new ConceptMapping()
              .withConceptIri(provenance.getSourceIri())
              .withMappingType(ConceptMapping.ConceptMappingType.EXACT_MATCH)
              .withSource(provenance.getSourceGlossary().getName()));
    }
    return List.copyOf(mappings);
  }

  public record MergeExecution(UriInfo uriInfo, String user) {}

  private record MergePlan(
      Glossary source, Glossary target, List<GlossaryTerm> context, MergeExecution execution) {}

  private record MergeAccumulator(
      List<OntologyChangeOperation> termOperations,
      List<EntityReference> terms,
      OntologyStructuralRelationshipMerger.Accumulator relationships) {
    private static MergeAccumulator empty() {
      return new MergeAccumulator(
          new ArrayList<>(),
          new ArrayList<>(),
          OntologyStructuralRelationshipMerger.Accumulator.empty());
    }
  }

  @FunctionalInterface
  interface ChangeSetStore {
    OntologyChangeSet create(
        UriInfo uriInfo, OntologyChangeSet changeSet, String user, String impersonatedBy);
  }
}
