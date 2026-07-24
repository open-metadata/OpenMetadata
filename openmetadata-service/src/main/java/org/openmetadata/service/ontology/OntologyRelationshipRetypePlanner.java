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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.api.data.OntologyBulkErrorCode;
import org.openmetadata.schema.api.data.OntologyBulkOperation;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.api.data.OntologyBulkRetypeRelationships;
import org.openmetadata.schema.api.data.OntologyBulkRowError;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyRelationship;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.ontology.OntologyBulkPlan.Counts;

final class OntologyRelationshipRetypePlanner {
  private static final String ID_KEY_PREFIX = "id:";
  private static final String TERMS_KEY_SEPARATOR = ":";
  private final RelationshipTypeResolver relationshipTypes;

  OntologyRelationshipRetypePlanner(final RelationshipTypeResolver relationshipTypes) {
    this.relationshipTypes = relationshipTypes;
  }

  OntologyBulkPlan plan(final OntologyBulkRequest request, final List<GlossaryTerm> terms) {
    final OntologyBulkRetypeRelationships retype = request.getRetype();
    final RelationshipType sourceType =
        relationshipTypes.require(retype.getFromRelationshipTypeId());
    final RelationshipType targetType = relationshipTypes.require(retype.getToRelationshipTypeId());
    final RetypeContext context =
        new RetypeContext(scopedTerms(terms, retype), terms, sourceType, targetType);
    final Accumulator accumulator = Accumulator.empty();
    validateScope(retype, terms, accumulator);
    planRelationships(context, accumulator);
    return result(accumulator);
  }

  private static void planRelationships(
      final RetypeContext context, final Accumulator accumulator) {
    int rowNumber = 1;
    for (final GlossaryTerm term : context.scopedTerms()) {
      for (final TermRelation relation : listOrEmpty(term.getRelatedTerms())) {
        if (isSourceType(relation, context.sourceType())) {
          addRelationship(++rowNumber, term, relation, context, accumulator);
        }
      }
    }
  }

  private static void addRelationship(
      final int rowNumber,
      final GlossaryTerm term,
      final TermRelation relation,
      final RetypeContext context,
      final Accumulator accumulator) {
    final String key = mutationKey(term, relation);
    if (accumulator.seen().add(key)) {
      accumulator.totalRows(accumulator.totalRows() + 1);
      final RelationshipPlan plan = plan(rowNumber, term, relation, context);
      accumulator.add(plan);
    }
  }

  private static RelationshipPlan plan(
      final int rowNumber,
      final GlossaryTerm term,
      final TermRelation relation,
      final RetypeContext context) {
    final GlossaryTerm target = find(context.allTerms(), relation.getTerm().getId());
    final OntologyBulkRowError error = relationshipError(rowNumber, term, target, relation);
    final RelationshipPlan plan =
        error == null
            ? RelationshipPlan.updated(operation(term, relation, context.targetType()))
            : RelationshipPlan.error(error);
    return plan;
  }

  private static OntologyBulkRowError relationshipError(
      final int rowNumber,
      final GlossaryTerm term,
      final GlossaryTerm target,
      final TermRelation relation) {
    final OntologyBulkRowError error;
    if (relation.getId() == null) {
      error =
          error(
              rowNumber,
              OntologyBulkErrorCode.RELATIONSHIP_NOT_FOUND,
              "Relationship has no stable identity",
              term.getId(),
              null);
    } else if (relation.getProvenance() == RelationProvenance.INFERRED) {
      error =
          error(
              rowNumber,
              OntologyBulkErrorCode.INFERRED_RELATIONSHIP_READ_ONLY,
              "Inferred relationships cannot be retyped",
              term.getId(),
              relation.getId());
    } else if (target == null) {
      error =
          error(
              rowNumber,
              OntologyBulkErrorCode.TERM_OUTSIDE_GLOSSARY,
              "Cross-glossary relationships require an explicit multi-model change set",
              term.getId(),
              relation.getId());
    } else {
      error = null;
    }
    return error;
  }

  private static OntologyChangeOperation operation(
      final GlossaryTerm source, final TermRelation relation, final RelationshipType targetType) {
    final OntologyRelationship relationship =
        new OntologyRelationship()
            .withId(relation.getId())
            .withFromTerm(source.getEntityReference())
            .withToTerm(relation.getTerm())
            .withRelationshipType(targetType.getEntityReference())
            .withProvenance(relation.getProvenance())
            .withStatus(relation.getStatus())
            .withCreatedBy(relation.getCreatedBy())
            .withCreatedAt(relation.getCreatedAt());
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.UPDATE_RELATIONSHIP)
        .withTargetId(source.getId())
        .withBaseVersion(source.getVersion())
        .withRelationship(relationship)
        .withState(OntologyChangeOperationState.ACTIVE);
  }

  private static List<GlossaryTerm> scopedTerms(
      final List<GlossaryTerm> terms, final OntologyBulkRetypeRelationships retype) {
    final List<GlossaryTerm> scoped =
        nullOrEmpty(retype.getTermIds())
            ? terms
            : terms.stream().filter(term -> retype.getTermIds().contains(term.getId())).toList();
    return scoped;
  }

  private static void validateScope(
      final OntologyBulkRetypeRelationships retype,
      final List<GlossaryTerm> terms,
      final Accumulator accumulator) {
    if (!nullOrEmpty(retype.getTermIds())) {
      int rowNumber = 1;
      for (final UUID termId : retype.getTermIds()) {
        if (find(terms, termId) == null) {
          accumulator.totalRows(accumulator.totalRows() + 1);
          accumulator.add(
              RelationshipPlan.error(
                  error(
                      ++rowNumber,
                      OntologyBulkErrorCode.TERM_OUTSIDE_GLOSSARY,
                      "Retype scope contains a term outside the target glossary",
                      termId,
                      null)));
        }
      }
    }
  }

  private static boolean isSourceType(
      final TermRelation relation, final RelationshipType sourceType) {
    return relation.getRelationshipType() != null
        && sourceType.getId().equals(relation.getRelationshipType().getId());
  }

  private static GlossaryTerm find(final List<GlossaryTerm> terms, final UUID id) {
    return terms.stream().filter(term -> term.getId().equals(id)).findFirst().orElse(null);
  }

  private static String mutationKey(final GlossaryTerm source, final TermRelation relation) {
    final String key;
    if (relation.getId() != null) {
      key = ID_KEY_PREFIX + relation.getId();
    } else {
      final UUID first = minimum(source.getId(), relation.getTerm().getId());
      final UUID second = maximum(source.getId(), relation.getTerm().getId());
      key = first + TERMS_KEY_SEPARATOR + second;
    }
    return key;
  }

  private static UUID minimum(final UUID first, final UUID second) {
    return first.compareTo(second) <= 0 ? first : second;
  }

  private static UUID maximum(final UUID first, final UUID second) {
    return first.compareTo(second) >= 0 ? first : second;
  }

  private static OntologyBulkRowError error(
      final int rowNumber,
      final OntologyBulkErrorCode code,
      final String message,
      final UUID termId,
      final UUID relationshipId) {
    return OntologyBulkPlanningErrors.error(rowNumber, code, message, termId, relationshipId);
  }

  private static OntologyBulkPlan result(final Accumulator accumulator) {
    final int unchanged =
        accumulator.totalRows() - accumulator.operations().size() - accumulator.invalidRows();
    return new OntologyBulkPlan(
        OntologyBulkOperation.RETYPE_RELATIONSHIPS,
        accumulator.totalRows(),
        accumulator.operations().size(),
        accumulator.invalidRows(),
        Math.max(unchanged, 0),
        new Counts(0, 0, 0, accumulator.operations().size()),
        accumulator.operations(),
        accumulator.errors(),
        accumulator.errorsTruncated());
  }

  private record RetypeContext(
      List<GlossaryTerm> scopedTerms,
      List<GlossaryTerm> allTerms,
      RelationshipType sourceType,
      RelationshipType targetType) {}

  private record RelationshipPlan(OntologyChangeOperation operation, OntologyBulkRowError error) {
    private static RelationshipPlan updated(final OntologyChangeOperation operation) {
      return new RelationshipPlan(operation, null);
    }

    private static RelationshipPlan error(final OntologyBulkRowError error) {
      return new RelationshipPlan(null, error);
    }
  }

  private static final class Accumulator {
    private final List<OntologyChangeOperation> operations = new ArrayList<>();
    private final List<OntologyBulkRowError> errors = new ArrayList<>();
    private final Set<String> seen = new HashSet<>();
    private int totalRows;
    private int invalidRows;
    private boolean errorsTruncated;

    private static Accumulator empty() {
      return new Accumulator();
    }

    private void add(final RelationshipPlan plan) {
      if (plan.error() == null) {
        operations.add(plan.operation());
      } else {
        invalidRows++;
        final boolean wasAdded = OntologyBulkPlanningErrors.add(errors, plan.error());
        errorsTruncated = !wasAdded || errorsTruncated;
      }
    }

    private List<OntologyChangeOperation> operations() {
      return operations;
    }

    private List<OntologyBulkRowError> errors() {
      return errors;
    }

    private Set<String> seen() {
      return seen;
    }

    private int totalRows() {
      return totalRows;
    }

    private void totalRows(final int value) {
      totalRows = value;
    }

    private int invalidRows() {
      return invalidRows;
    }

    private boolean errorsTruncated() {
      return errorsTruncated;
    }
  }
}
