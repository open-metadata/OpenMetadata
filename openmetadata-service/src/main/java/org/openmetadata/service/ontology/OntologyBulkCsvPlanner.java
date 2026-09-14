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
import static org.openmetadata.service.ontology.OntologyBulkCsvValueParser.iri;
import static org.openmetadata.service.ontology.OntologyBulkCsvValueParser.uuid;

import java.net.URI;
import java.time.Clock;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.api.data.OntologyBulkErrorCode;
import org.openmetadata.schema.api.data.OntologyBulkOperation;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.api.data.OntologyBulkRowError;
import org.openmetadata.schema.api.data.OntologyIriPreviewRequest;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.ontology.OntologyBulkCsvParser.CsvRow;
import org.openmetadata.service.ontology.OntologyBulkCsvParser.ParsedCsv;
import org.openmetadata.service.ontology.OntologyBulkCsvValueParser.URIValue;
import org.openmetadata.service.ontology.OntologyBulkCsvValueParser.UUIDValue;
import org.openmetadata.service.ontology.OntologyBulkPlan.Counts;
import org.openmetadata.service.util.FullyQualifiedName;

final class OntologyBulkCsvPlanner {
  private static final double INITIAL_VERSION = 0.1D;
  private final OntologyBulkCsvParser parser;
  private final OntologyIriMinter iriMinter;
  private final Clock clock;

  OntologyBulkCsvPlanner(
      final OntologyBulkCsvParser parser, final OntologyIriMinter iriMinter, final Clock clock) {
    this.parser = parser;
    this.iriMinter = iriMinter;
    this.clock = clock;
  }

  OntologyBulkPlan plan(
      final Glossary glossary,
      final OntologyBulkRequest request,
      final List<GlossaryTerm> existingTerms,
      final String user) {
    final ParsedCsv parsed = parser.parse(request.getCsv());
    final OntologyBulkCsvContext context =
        OntologyBulkCsvContext.create(glossary, existingTerms, user);
    final OntologyBulkCsvAccumulator accumulator = OntologyBulkCsvAccumulator.empty();
    addParserErrors(parsed, accumulator);
    for (final CsvRow row : parsed.rows()) {
      addRowPlan(planRow(row, context), accumulator, context);
    }
    return result(parsed, accumulator);
  }

  private RowPlan planRow(final CsvRow row, final OntologyBulkCsvContext context) {
    final OntologyBulkCsvAction action = action(row.action());
    final RowPlan plan =
        action == null
            ? RowPlan.error(
                error(
                    row,
                    OntologyBulkErrorCode.INVALID_ACTION,
                    "CSV action must be CREATE or UPDATE",
                    null))
            : switch (action) {
              case CREATE -> create(row, context);
              case UPDATE -> update(row, context);
            };
    return plan;
  }

  private RowPlan create(final CsvRow row, final OntologyBulkCsvContext context) {
    final UUIDValue termId = uuid(row.termId(), true, row, "termId");
    final ParentValue parent = parent(row.parentId(), row, context);
    final URIValue iri = iri(row.iri(), row);
    final OntologyBulkRowError required = requiredCreateValues(row);
    final OntologyBulkRowError error = first(required, termId.error(), parent.error(), iri.error());
    final RowPlan plan =
        error == null
            ? createValidated(row, termId.value(), parent.reference(), iri.value(), context)
            : RowPlan.error(error);
    return plan;
  }

  private RowPlan createValidated(
      final CsvRow row,
      final UUID termId,
      final EntityReference parent,
      final URI requestedIri,
      final OntologyBulkCsvContext context) {
    final String parentFqn =
        parent == null
            ? context.glossary().getFullyQualifiedName()
            : parent.getFullyQualifiedName();
    final String fullyQualifiedName = FullyQualifiedName.add(parentFqn, row.name());
    final OntologyBulkRowError duplicate = duplicate(row, termId, fullyQualifiedName, context);
    final RowPlan plan =
        duplicate == null
            ? createdPlan(row, termId, parent, fullyQualifiedName, requestedIri, context)
            : RowPlan.error(duplicate);
    return plan;
  }

  private RowPlan createdPlan(
      final CsvRow row,
      final UUID termId,
      final EntityReference parent,
      final String fullyQualifiedName,
      final URI requestedIri,
      final OntologyBulkCsvContext context) {
    final URI iri =
        requestedIri == null ? mintIri(context.glossary(), row.name(), termId) : requestedIri;
    final GlossaryTerm term =
        new GlossaryTerm()
            .withId(termId)
            .withName(row.name())
            .withDisplayName(nullOrEmpty(row.displayName()) ? row.name() : row.displayName())
            .withDescription(row.description())
            .withFullyQualifiedName(fullyQualifiedName)
            .withGlossary(context.glossary().getEntityReference())
            .withParent(parent)
            .withIri(iri)
            .withAttributes(List.of())
            .withConceptMappings(List.of())
            .withEntityStatus(EntityStatus.DRAFT)
            .withVersion(INITIAL_VERSION)
            .withProvider(ProviderType.USER)
            .withUpdatedBy(context.user())
            .withUpdatedAt(clock.millis());
    return RowPlan.create(operation(OntologyChangeOperationType.CREATE_TERM, term, null));
  }

  private RowPlan update(final CsvRow row, final OntologyBulkCsvContext context) {
    final UUIDValue termId = uuid(row.termId(), true, row, "termId");
    final GlossaryTerm existing =
        termId.error() == null ? find(context.existingTerms(), termId.value()) : null;
    final OntologyBulkRowError missing = missingUpdateTerm(row, termId, existing, context);
    final ParentValue parent = updateParent(row.parentId(), row, context);
    final URIValue iri = iri(row.iri(), row);
    final OntologyBulkRowError error = first(missing, parent.error(), iri.error());
    final RowPlan plan =
        error == null ? updateValidated(row, existing, parent, iri, context) : RowPlan.error(error);
    return plan;
  }

  private RowPlan updateValidated(
      final CsvRow row,
      final GlossaryTerm existing,
      final ParentValue parent,
      final URIValue iri,
      final OntologyBulkCsvContext context) {
    final GlossaryTerm updated = JsonUtils.deepCopy(existing, GlossaryTerm.class);
    applyValues(row, updated, parent, iri);
    final String fqn = updatedFqn(updated, context.glossary());
    final boolean hasChanges = !updated.equals(existing);
    final OntologyBulkRowError error =
        hasChanges ? duplicateUpdate(row, existing, fqn, context) : null;
    final RowPlan plan =
        !hasChanges
            ? RowPlan.noChange()
            : error == null
                ? updatedPlan(updated.withFullyQualifiedName(fqn), existing.getVersion())
                : RowPlan.error(error);
    return plan;
  }

  private static void applyValues(
      final CsvRow row, final GlossaryTerm updated, final ParentValue parent, final URIValue iri) {
    if (!nullOrEmpty(row.name())) {
      updated.setName(row.name());
    }
    if (!nullOrEmpty(row.displayName())) {
      updated.setDisplayName(row.displayName());
    }
    if (!nullOrEmpty(row.description())) {
      updated.setDescription(row.description());
    }
    if (!nullOrEmpty(row.parentId())) {
      updated.setParent(parent.reference());
    }
    if (!nullOrEmpty(row.iri())) {
      updated.setIri(iri.value());
    }
  }

  private static RowPlan updatedPlan(final GlossaryTerm term, final Double baseVersion) {
    return RowPlan.update(operation(OntologyChangeOperationType.UPDATE_TERM, term, baseVersion));
  }

  private static OntologyChangeOperation operation(
      final OntologyChangeOperationType type, final GlossaryTerm term, final Double baseVersion) {
    final boolean isCreate = type == OntologyChangeOperationType.CREATE_TERM;
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(type)
        .withTargetId(isCreate ? null : term.getId())
        .withBaseVersion(isCreate ? null : baseVersion)
        .withTerm(term)
        .withState(OntologyChangeOperationState.ACTIVE);
  }

  private URI mintIri(final Glossary glossary, final String name, final UUID id) {
    final OntologyIriPreviewRequest request =
        new OntologyIriPreviewRequest()
            .withGlossaryId(glossary.getId())
            .withTermName(name)
            .withCandidateId(id);
    return iriMinter.preview(glossary, request).getIri();
  }

  private static OntologyBulkRowError requiredCreateValues(final CsvRow row) {
    final boolean isMissing =
        nullOrEmpty(row.termId()) || nullOrEmpty(row.name()) || nullOrEmpty(row.description());
    final OntologyBulkRowError error =
        isMissing
            ? error(
                row,
                OntologyBulkErrorCode.MISSING_REQUIRED_VALUE,
                "CREATE requires termId, name, and description",
                null)
            : null;
    return error;
  }

  private static OntologyBulkRowError missingUpdateTerm(
      final CsvRow row,
      final UUIDValue termId,
      final GlossaryTerm existing,
      final OntologyBulkCsvContext context) {
    final OntologyBulkRowError error;
    if (termId.error() != null) {
      error = termId.error();
    } else if (existing == null) {
      error =
          error(row, OntologyBulkErrorCode.TERM_NOT_FOUND, "Term does not exist", termId.value());
    } else if (!context.glossary().getId().equals(existing.getGlossary().getId())) {
      error =
          error(
              row,
              OntologyBulkErrorCode.TERM_OUTSIDE_GLOSSARY,
              "Term is outside the target glossary",
              termId.value());
    } else {
      error = null;
    }
    return error;
  }

  private static ParentValue parent(
      final String value, final CsvRow row, final OntologyBulkCsvContext context) {
    final ParentValue parent =
        nullOrEmpty(value) || OntologyBulkCsvParser.ROOT_PARENT.equals(value)
            ? new ParentValue(null, null)
            : resolvedParent(value, row, context);
    return parent;
  }

  private static ParentValue updateParent(
      final String value, final CsvRow row, final OntologyBulkCsvContext context) {
    final ParentValue parent =
        nullOrEmpty(value) ? new ParentValue(null, null) : parent(value, row, context);
    return parent;
  }

  private static ParentValue resolvedParent(
      final String value, final CsvRow row, final OntologyBulkCsvContext context) {
    final UUIDValue parentId = uuid(value, true, row, "parentId");
    final GlossaryTerm parent =
        parentId.error() == null ? find(context.allTerms(), parentId.value()) : null;
    final OntologyBulkRowError error =
        parentId.error() != null
            ? parentId.error()
            : parent == null
                ? error(
                    row,
                    OntologyBulkErrorCode.TERM_NOT_FOUND,
                    "Parent term does not exist or must appear earlier in the CSV",
                    parentId.value())
                : null;
    final EntityReference reference = error == null ? parent.getEntityReference() : null;
    return new ParentValue(reference, error);
  }

  private static OntologyBulkRowError duplicate(
      final CsvRow row,
      final UUID termId,
      final String fullyQualifiedName,
      final OntologyBulkCsvContext context) {
    final boolean isDuplicate =
        find(context.allTerms(), termId) != null
            || context.fullyQualifiedNames().contains(fullyQualifiedName);
    final OntologyBulkRowError error =
        isDuplicate
            ? error(
                row,
                OntologyBulkErrorCode.DUPLICATE_TERM,
                "Term ID or fully qualified name already exists",
                termId)
            : null;
    return error;
  }

  private static OntologyBulkRowError duplicateUpdate(
      final CsvRow row,
      final GlossaryTerm existing,
      final String updatedFqn,
      final OntologyBulkCsvContext context) {
    final GlossaryTerm duplicate =
        context.allTerms().stream()
            .filter(term -> updatedFqn.equals(term.getFullyQualifiedName()))
            .filter(term -> !existing.getId().equals(term.getId()))
            .findFirst()
            .orElse(null);
    final OntologyBulkRowError error =
        duplicate == null
            ? null
            : error(
                row,
                OntologyBulkErrorCode.DUPLICATE_TERM,
                "Updated fully qualified name already exists",
                existing.getId());
    return error;
  }

  private static String updatedFqn(final GlossaryTerm term, final Glossary glossary) {
    final String parentFqn =
        term.getParent() == null
            ? glossary.getFullyQualifiedName()
            : term.getParent().getFullyQualifiedName();
    return FullyQualifiedName.add(parentFqn, term.getName());
  }

  private static OntologyBulkCsvAction action(final String value) {
    return Arrays.stream(OntologyBulkCsvAction.values())
        .filter(action -> action.name().equalsIgnoreCase(value))
        .findFirst()
        .orElse(null);
  }

  private static GlossaryTerm find(final List<GlossaryTerm> terms, final UUID id) {
    return id == null
        ? null
        : terms.stream().filter(term -> term.getId().equals(id)).findFirst().orElse(null);
  }

  private static OntologyBulkRowError first(final OntologyBulkRowError... errors) {
    return Arrays.stream(errors).filter(Objects::nonNull).findFirst().orElse(null);
  }

  private static OntologyBulkRowError error(
      final CsvRow row, final OntologyBulkErrorCode code, final String message, final UUID termId) {
    return OntologyBulkPlanningErrors.error(row.rowNumber(), code, message, termId, null);
  }

  private static void addParserErrors(
      final ParsedCsv parsed, final OntologyBulkCsvAccumulator accumulator) {
    accumulator.errors().addAll(parsed.errors());
    accumulator.invalidRows(parsed.errors().isEmpty() ? 0 : Math.max(1, parsed.totalRows()));
  }

  private static void addRowPlan(
      final RowPlan plan,
      final OntologyBulkCsvAccumulator accumulator,
      final OntologyBulkCsvContext context) {
    if (plan.unchanged()) {
      accumulator.addUnchanged();
    } else if (plan.error() != null) {
      accumulator.addError(plan.error());
    } else {
      accumulator.add(plan.action(), plan.operation());
      if (plan.action() == OntologyBulkCsvAction.CREATE) {
        context.add(plan.operation().getTerm());
      } else {
        context.update(plan.operation().getTerm());
      }
    }
  }

  private static OntologyBulkPlan result(
      final ParsedCsv parsed, final OntologyBulkCsvAccumulator accumulator) {
    final int totalRows = Math.max(parsed.totalRows(), accumulator.invalidRows());
    return new OntologyBulkPlan(
        OntologyBulkOperation.CSV_UPSERT,
        totalRows,
        accumulator.operations().size(),
        accumulator.invalidRows(),
        accumulator.unchangedRows(),
        new Counts(accumulator.creates(), accumulator.updates(), 0, 0),
        accumulator.operations(),
        accumulator.errors(),
        accumulator.errorsTruncated());
  }

  private record RowPlan(
      OntologyBulkCsvAction action,
      OntologyChangeOperation operation,
      OntologyBulkRowError error,
      boolean unchanged) {
    private static RowPlan create(final OntologyChangeOperation operation) {
      return new RowPlan(OntologyBulkCsvAction.CREATE, operation, null, false);
    }

    private static RowPlan update(final OntologyChangeOperation operation) {
      return new RowPlan(OntologyBulkCsvAction.UPDATE, operation, null, false);
    }

    private static RowPlan error(final OntologyBulkRowError error) {
      return new RowPlan(null, null, error, false);
    }

    private static RowPlan noChange() {
      return new RowPlan(null, null, null, true);
    }
  }

  private record ParentValue(EntityReference reference, OntologyBulkRowError error) {}
}
