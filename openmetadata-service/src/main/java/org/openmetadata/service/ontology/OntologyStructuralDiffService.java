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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.api.data.OntologyStructuralDiff;
import org.openmetadata.schema.api.data.OntologyStructuralDiffState;
import org.openmetadata.schema.api.data.OntologyTermStructuralDiff;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.OntologySourceProvenance;
import org.openmetadata.schema.type.OntologyStructuralField;
import org.openmetadata.schema.type.OntologyTermStructure;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;

public final class OntologyStructuralDiffService {
  private static final int MAXIMUM_TERM_COUNT = 500;
  private final TermReader termReader;

  public OntologyStructuralDiffService(final TermReader termReader) {
    this.termReader = termReader;
  }

  public static OntologyStructuralDiffService createDefault(
      final GlossaryTermRepository termRepository) {
    return new OntologyStructuralDiffService(
        new RepositoryOntologyStructuralTermReader(termRepository));
  }

  public OntologyStructuralDiff diff(
      final Glossary source, final Glossary target, final Set<UUID> subsetTermIds) {
    requireRequest(source, target, subsetTermIds);
    final List<GlossaryTerm> subsetTerms = subsetTermIds.stream().map(termReader::read).toList();
    final List<OntologyTermStructuralDiff> data =
        subsetTerms.stream().map(term -> compare(source, target, term, subsetTerms)).toList();
    return new OntologyStructuralDiff()
        .withSourceGlossary(source.getEntityReference())
        .withTargetGlossary(target.getEntityReference())
        .withData(data);
  }

  private OntologyTermStructuralDiff compare(
      final Glossary source,
      final Glossary target,
      final GlossaryTerm subset,
      final List<GlossaryTerm> context) {
    final OntologySourceProvenance provenance = requireProvenance(source, target, subset);
    final GlossaryTerm currentSource = termReader.read(provenance.getSourceTerm().getId());
    requireCurrentSource(source, currentSource);
    final OntologyTermStructure base = provenance.getSourceSnapshot();
    final OntologyTermStructure sourceStructure =
        OntologyTermStructureMapper.sourceStructure(currentSource);
    final OntologyTermStructure subsetStructure =
        OntologyTermStructureMapper.subsetStructure(subset, context);
    final Structures structures = new Structures(base, sourceStructure, subsetStructure);
    return comparison(subset, currentSource, provenance, structures);
  }

  private static OntologyTermStructuralDiff comparison(
      final GlossaryTerm subset,
      final GlossaryTerm currentSource,
      final OntologySourceProvenance provenance,
      final Structures structures) {
    final Set<OntologyStructuralField> sourceChanges =
        changedFields(structures.base(), structures.currentSource());
    final Set<OntologyStructuralField> subsetChanges =
        changedFields(structures.base(), structures.currentSubset());
    final Set<OntologyStructuralField> conflicts =
        conflictingFields(
            structures.currentSource(), structures.currentSubset(), sourceChanges, subsetChanges);
    return new OntologyTermStructuralDiff()
        .withSubsetTerm(subset.getEntityReference())
        .withSourceTerm(currentSource.getEntityReference())
        .withBaseVersion(provenance.getSourceTermVersion())
        .withCurrentSourceVersion(currentSource.getVersion())
        .withSubsetVersion(subset.getVersion())
        .withState(state(sourceChanges, subsetChanges, conflicts))
        .withSourceChangedFields(sourceChanges)
        .withSubsetChangedFields(subsetChanges)
        .withConflictingFields(conflicts)
        .withBase(structures.base())
        .withCurrentSource(structures.currentSource())
        .withCurrentSubset(structures.currentSubset());
  }

  private static Set<OntologyStructuralField> changedFields(
      final OntologyTermStructure base, final OntologyTermStructure current) {
    final Set<OntologyStructuralField> changed = new LinkedHashSet<>();
    for (final OntologyStructuralField field : OntologyStructuralField.values()) {
      if (!fieldEquals(field, base, current)) {
        changed.add(field);
      }
    }
    return Set.copyOf(changed);
  }

  private static Set<OntologyStructuralField> conflictingFields(
      final OntologyTermStructure source,
      final OntologyTermStructure subset,
      final Set<OntologyStructuralField> sourceChanges,
      final Set<OntologyStructuralField> subsetChanges) {
    final Set<OntologyStructuralField> conflicts = new LinkedHashSet<>();
    for (final OntologyStructuralField field : sourceChanges) {
      if (subsetChanges.contains(field) && !fieldEquals(field, source, subset)) {
        conflicts.add(field);
      }
    }
    return Set.copyOf(conflicts);
  }

  private static boolean fieldEquals(
      final OntologyStructuralField field,
      final OntologyTermStructure first,
      final OntologyTermStructure second) {
    final boolean isEqual =
        switch (field) {
          case NAME -> Objects.equals(first.getName(), second.getName());
          case DISPLAY_NAME -> Objects.equals(first.getDisplayName(), second.getDisplayName());
          case DESCRIPTION -> Objects.equals(first.getDescription(), second.getDescription());
          case ENTITY_STATUS -> Objects.equals(first.getEntityStatus(), second.getEntityStatus());
          case PARENT -> Objects.equals(
              first.getParentSourceTermId(), second.getParentSourceTermId());
          case ATTRIBUTES -> Objects.equals(first.getAttributes(), second.getAttributes());
          case CONCEPT_MAPPINGS -> Objects.equals(
              first.getConceptMappings(), second.getConceptMappings());
          case RELATIONSHIPS -> Objects.equals(first.getRelationships(), second.getRelationships());
        };
    return isEqual;
  }

  private static OntologyStructuralDiffState state(
      final Set<OntologyStructuralField> sourceChanges,
      final Set<OntologyStructuralField> subsetChanges,
      final Set<OntologyStructuralField> conflicts) {
    final OntologyStructuralDiffState state;
    if (!conflicts.isEmpty()) {
      state = OntologyStructuralDiffState.CONFLICT;
    } else if (sourceChanges.isEmpty() && subsetChanges.isEmpty()) {
      state = OntologyStructuralDiffState.UNCHANGED;
    } else if (subsetChanges.isEmpty()) {
      state = OntologyStructuralDiffState.SOURCE_CHANGED;
    } else if (sourceChanges.isEmpty()) {
      state = OntologyStructuralDiffState.SUBSET_CHANGED;
    } else {
      state = OntologyStructuralDiffState.MERGEABLE;
    }
    return state;
  }

  private static OntologySourceProvenance requireProvenance(
      final Glossary source, final Glossary target, final GlossaryTerm subset) {
    final OntologySourceProvenance provenance = subset.getOntologySource();
    final boolean isInvalid =
        subset.getGlossary() == null
            || !target.getId().equals(subset.getGlossary().getId())
            || provenance == null
            || provenance.getSourceGlossary() == null
            || !source.getId().equals(provenance.getSourceGlossary().getId())
            || provenance.getSourceTerm() == null
            || provenance.getSourceSnapshot() == null;
    if (isInvalid) {
      throw new BadRequestException(
          "Term '" + subset.getId() + "' is not a mergeable member of the requested subset");
    }
    return provenance;
  }

  private static void requireCurrentSource(
      final Glossary source, final GlossaryTerm currentSource) {
    final boolean isInvalid =
        currentSource.getGlossary() == null
            || !source.getId().equals(currentSource.getGlossary().getId())
            || currentSource.getVersion() == null;
    if (isInvalid) {
      throw new BadRequestException(
          "Current source term '" + currentSource.getId() + "' is outside the source model");
    }
  }

  private static void requireRequest(
      final Glossary source, final Glossary target, final Set<UUID> subsetTermIds) {
    final boolean isInvalid =
        source.getId().equals(target.getId())
            || nullOrEmpty(subsetTermIds)
            || subsetTermIds.size() > MAXIMUM_TERM_COUNT
            || subsetTermIds.stream().anyMatch(Objects::isNull);
    if (isInvalid) {
      throw new BadRequestException(
          "Structural diff requires different models and 1 to 500 unique subset terms");
    }
  }

  @FunctionalInterface
  public interface TermReader {
    GlossaryTerm read(UUID termId);
  }

  private record Structures(
      OntologyTermStructure base,
      OntologyTermStructure currentSource,
      OntologyTermStructure currentSubset) {}
}
