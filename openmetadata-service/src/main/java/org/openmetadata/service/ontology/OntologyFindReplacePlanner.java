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

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.api.data.OntologyBulkErrorCode;
import org.openmetadata.schema.api.data.OntologyBulkFindReplace;
import org.openmetadata.schema.api.data.OntologyBulkMatchField;
import org.openmetadata.schema.api.data.OntologyBulkMatchMode;
import org.openmetadata.schema.api.data.OntologyBulkOperation;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.api.data.OntologyBulkRowError;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.ontology.OntologyBulkPlan.Counts;
import org.openmetadata.service.util.FullyQualifiedName;

final class OntologyFindReplacePlanner {
  OntologyBulkPlan plan(
      final Glossary glossary, final OntologyBulkRequest request, final List<GlossaryTerm> terms) {
    final ReplacementContext context =
        ReplacementContext.create(glossary, request.getFindReplace(), terms);
    final Accumulator accumulator = Accumulator.empty();
    int rowNumber = 1;
    for (final GlossaryTerm term : terms) {
      add(planTerm(++rowNumber, term, context), accumulator, context);
    }
    return result(terms.size(), accumulator);
  }

  private static TermPlan planTerm(
      final int rowNumber, final GlossaryTerm term, final ReplacementContext context) {
    final String current = value(term, context.replacement().getField());
    final String replaced = replace(current, context.replacement());
    final TermPlan plan =
        Objects.equals(current, replaced)
            ? TermPlan.unchanged()
            : changed(rowNumber, term, replaced, context);
    return plan;
  }

  private static TermPlan changed(
      final int rowNumber,
      final GlossaryTerm term,
      final String replacement,
      final ReplacementContext context) {
    final GlossaryTerm updated = JsonUtils.deepCopy(term, GlossaryTerm.class);
    apply(updated, replacement, context.replacement().getField());
    final OntologyBulkRowError error = validateUpdated(rowNumber, term, updated, context);
    final TermPlan plan =
        error == null
            ? TermPlan.updated(updateOperation(updated, term.getVersion()))
            : TermPlan.error(error);
    return plan;
  }

  private static void apply(
      final GlossaryTerm term, final String replacement, final OntologyBulkMatchField field) {
    switch (field) {
      case NAME -> term.setName(replacement);
      case DISPLAY_NAME -> term.setDisplayName(replacement);
      case DESCRIPTION -> term.setDescription(replacement);
    }
  }

  private static OntologyBulkRowError validateUpdated(
      final int rowNumber,
      final GlossaryTerm original,
      final GlossaryTerm updated,
      final ReplacementContext context) {
    OntologyBulkRowError error = null;
    if (context.replacement().getField() == OntologyBulkMatchField.NAME) {
      final String updatedFqn = updatedFqn(updated, context.glossary());
      if (nullOrEmpty(updated.getName()) || updated.getName().isBlank()) {
        error =
            error(
                rowNumber,
                OntologyBulkErrorCode.MISSING_REQUIRED_VALUE,
                "Find/replace cannot make a term name empty",
                original.getId());
      } else if (isDuplicate(updatedFqn, original.getId(), context)) {
        error =
            error(
                rowNumber,
                OntologyBulkErrorCode.DUPLICATE_TERM,
                "Find/replace would create a duplicate term name",
                original.getId());
      } else {
        updated.setFullyQualifiedName(updatedFqn);
      }
    }
    return error;
  }

  private static String value(final GlossaryTerm term, final OntologyBulkMatchField field) {
    final String value =
        switch (field) {
          case NAME -> term.getName();
          case DISPLAY_NAME -> term.getDisplayName();
          case DESCRIPTION -> term.getDescription();
        };
    return value;
  }

  private static String replace(final String value, final OntologyBulkFindReplace replacement) {
    final String replaced;
    if (value == null) {
      replaced = null;
    } else if (replacement.getMatchMode() == OntologyBulkMatchMode.EXACT) {
      replaced = matchesExactly(value, replacement) ? replacement.getReplacement() : value;
    } else if (Boolean.TRUE.equals(replacement.getCaseSensitive())) {
      replaced = value.replace(replacement.getFind(), replacement.getReplacement());
    } else {
      replaced = replaceIgnoringCase(value, replacement.getFind(), replacement.getReplacement());
    }
    return replaced;
  }

  private static boolean matchesExactly(
      final String value, final OntologyBulkFindReplace replacement) {
    return Boolean.TRUE.equals(replacement.getCaseSensitive())
        ? value.equals(replacement.getFind())
        : value.equalsIgnoreCase(replacement.getFind());
  }

  private static String replaceIgnoringCase(
      final String value, final String find, final String replacement) {
    final String lowerValue = value.toLowerCase(Locale.ROOT);
    final String lowerFind = find.toLowerCase(Locale.ROOT);
    final StringBuilder result = new StringBuilder(value.length());
    int cursor = 0;
    int match = lowerValue.indexOf(lowerFind, cursor);
    while (match >= 0) {
      result.append(value, cursor, match).append(replacement);
      cursor = match + find.length();
      match = lowerValue.indexOf(lowerFind, cursor);
    }
    result.append(value, cursor, value.length());
    return result.toString();
  }

  private static boolean isDuplicate(
      final String fqn, final UUID originalId, final ReplacementContext context) {
    return context.terms().stream()
        .filter(term -> !term.getId().equals(originalId))
        .anyMatch(term -> fqn.equals(term.getFullyQualifiedName()));
  }

  private static String updatedFqn(final GlossaryTerm term, final Glossary glossary) {
    final String parentFqn =
        term.getParent() == null
            ? glossary.getFullyQualifiedName()
            : term.getParent().getFullyQualifiedName();
    return FullyQualifiedName.add(parentFqn, term.getName());
  }

  private static OntologyChangeOperation updateOperation(
      final GlossaryTerm term, final Double baseVersion) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.UPDATE_TERM)
        .withTargetId(term.getId())
        .withBaseVersion(baseVersion)
        .withTerm(term)
        .withState(OntologyChangeOperationState.ACTIVE);
  }

  private static void add(
      final TermPlan plan, final Accumulator accumulator, final ReplacementContext context) {
    switch (plan.state()) {
      case UPDATED -> {
        accumulator.operations().add(plan.operation());
        context.replace(plan.operation().getTerm());
      }
      case INVALID -> accumulator.addError(plan.error());
      case UNCHANGED -> accumulator.unchangedRows(accumulator.unchangedRows() + 1);
    }
  }

  private static OntologyBulkPlan result(final int totalRows, final Accumulator accumulator) {
    return new OntologyBulkPlan(
        OntologyBulkOperation.FIND_REPLACE,
        totalRows,
        accumulator.operations().size(),
        accumulator.invalidRows(),
        accumulator.unchangedRows(),
        new Counts(0, 0, accumulator.operations().size(), 0),
        accumulator.operations(),
        accumulator.errors(),
        accumulator.errorsTruncated());
  }

  private static OntologyBulkRowError error(
      final int rowNumber,
      final OntologyBulkErrorCode code,
      final String message,
      final UUID termId) {
    return OntologyBulkPlanningErrors.error(rowNumber, code, message, termId, null);
  }

  private enum PlanState {
    UPDATED,
    INVALID,
    UNCHANGED
  }

  private record TermPlan(
      PlanState state, OntologyChangeOperation operation, OntologyBulkRowError error) {
    private static TermPlan updated(final OntologyChangeOperation operation) {
      return new TermPlan(PlanState.UPDATED, operation, null);
    }

    private static TermPlan error(final OntologyBulkRowError error) {
      return new TermPlan(PlanState.INVALID, null, error);
    }

    private static TermPlan unchanged() {
      return new TermPlan(PlanState.UNCHANGED, null, null);
    }
  }

  private record ReplacementContext(
      Glossary glossary, OntologyBulkFindReplace replacement, List<GlossaryTerm> terms) {
    private static ReplacementContext create(
        final Glossary glossary,
        final OntologyBulkFindReplace replacement,
        final List<GlossaryTerm> terms) {
      return new ReplacementContext(glossary, replacement, new ArrayList<>(terms));
    }

    private void replace(final GlossaryTerm updated) {
      final GlossaryTerm original =
          terms.stream()
              .filter(term -> term.getId().equals(updated.getId()))
              .findFirst()
              .orElse(null);
      if (original != null) {
        terms.remove(original);
      }
      terms.add(updated);
    }
  }

  private static final class Accumulator {
    private final List<OntologyChangeOperation> operations = new ArrayList<>();
    private final List<OntologyBulkRowError> errors = new ArrayList<>();
    private int invalidRows;
    private int unchangedRows;
    private boolean errorsTruncated;

    private static Accumulator empty() {
      return new Accumulator();
    }

    private void addError(final OntologyBulkRowError error) {
      invalidRows++;
      final boolean wasAdded = OntologyBulkPlanningErrors.add(errors, error);
      errorsTruncated = !wasAdded || errorsTruncated;
    }

    private List<OntologyChangeOperation> operations() {
      return operations;
    }

    private List<OntologyBulkRowError> errors() {
      return errors;
    }

    private int invalidRows() {
      return invalidRows;
    }

    private int unchangedRows() {
      return unchangedRows;
    }

    private void unchangedRows(final int value) {
      unchangedRows = value;
    }

    private boolean errorsTruncated() {
      return errorsTruncated;
    }
  }
}
