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
package org.openmetadata.service.rdf;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatus;
import org.openmetadata.schema.tests.type.TestCaseResolutionStatusTypes;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ColumnUtil;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.security.mask.PIIMasker;
import org.openmetadata.service.util.EntityUtil;

/**
 * Loads the latest profiles, test results and open incidents onto entities before they are
 * projected, on the live write and on the reindex alike. They live in time-series tables, not in
 * the entity, so a plain entity read carries none of them. What reaches the graph follows the
 * masking a caller without PII access gets, judged on tags this class reads itself, so a loader
 * that did not ask for tags cannot unmask anything
 * (ADR:2026-11-18-the-rdf-graph-carries-the-latest-quality-evidence).
 */
public final class RdfQualityEvidence {
  private final RdfQualityEvidenceSource source;

  public RdfQualityEvidence(final RdfQualityEvidenceSource source) {
    this.source = source;
  }

  public static RdfQualityEvidence database() {
    return new RdfQualityEvidence(new DatabaseRdfQualityEvidenceSource());
  }

  /**
   * Attaches evidence to one page of {@code entityType} entities. Time-series reads are batched by
   * kind. Masking loads column tags per table and loads each distinct tested table once per page.
   */
  public void attach(final String entityType, final List<? extends EntityInterface<?>> entities) {
    switch (entityType) {
      case Entity.TABLE -> attachProfiles(entities.stream().map(Table.class::cast).toList());
      case Entity.TEST_CASE -> attachTestEvidence(
          entities.stream().map(TestCase.class::cast).toList());
      default -> {
        // Only tables, their columns and test cases carry quality evidence.
      }
    }
  }

  private void attachProfiles(final List<Table> tables) {
    final Map<String, TableProfile> tableProfiles =
        source.latestTableProfiles(tables.stream().map(Table::getFullyQualifiedName).toList());
    for (final Table table : tables) {
      table.setProfile(tableProfiles.get(table.getFullyQualifiedName()));
      EntityUtil.getFlattenedEntityField(table.getColumns())
          .forEach(column -> column.setProfile(null));
    }
    final List<Column> unmasked = tables.stream().flatMap(this::unmaskedColumns).toList();
    final Map<String, ColumnProfile> columnProfiles =
        source.latestColumnProfiles(unmasked.stream().map(Column::getFullyQualifiedName).toList());
    unmasked.forEach(
        column -> column.setProfile(columnProfiles.get(column.getFullyQualifiedName())));
  }

  private Stream<Column> unmaskedColumns(final Table table) {
    final List<Column> columns = EntityUtil.getFlattenedEntityField(table.getColumns());
    final Set<String> unmaskedFqns = unmaskedFqns(table, source.columnTags(table));
    return columns.stream().filter(column -> unmaskedFqns.contains(column.getFullyQualifiedName()));
  }

  /** Judges a copy of the column tree that carries the tags stored for each column. */
  private static Set<String> unmaskedFqns(
      final Table table, final Map<String, List<TagLabel>> storedTags) {
    final List<Column> judged = JsonUtils.deepCopyList(table.getColumns(), Column.class);
    EntityUtil.getFlattenedEntityField(judged)
        .forEach(
            column ->
                column.setTags(storedTags.getOrDefault(column.getFullyQualifiedName(), List.of())));
    return PIIMasker.columnsWithUnmaskedProfiles(judged).stream()
        .map(Column::getFullyQualifiedName)
        .collect(Collectors.toSet());
  }

  private void attachTestEvidence(final List<TestCase> testCases) {
    final List<String> fqns = testCases.stream().map(TestCase::getFullyQualifiedName).toList();
    final Map<String, TestCaseResult> results = source.latestTestCaseResults(fqns);
    final Map<String, TestCaseResolutionStatus> incidents = source.latestIncidentStatuses(fqns);
    final Map<String, Optional<Table>> tables = new HashMap<>();
    for (final TestCase testCase : testCases) {
      final Optional<EntityLink> link = parseEntityLink(testCase.getEntityLink());
      final Optional<Table> table =
          link.flatMap(parsed -> tables.computeIfAbsent(parsed.getEntityFQN(), source::liveTable));
      final boolean unmasked =
          link.filter(parsed -> !PIIMasker.hidesTestCaseResults(table.orElse(null), parsed))
              .isPresent();
      if (unmasked) {
        final String fqn = testCase.getFullyQualifiedName();
        testCase.setTestCaseResult(results.get(fqn));
        testCase.setIncidentStatus(open(incidents.get(fqn)));
      } else {
        PIIMasker.maskTestCaseFields(testCase);
      }
      link.ifPresentOrElse(
          parsed -> keepOnlyResolvedColumnLink(testCase, table, parsed),
          () -> testCase.setEntityLink(null));
    }
  }

  private static TestCaseResolutionStatus open(final TestCaseResolutionStatus latest) {
    final boolean isOpen =
        latest != null
            && latest.getTestCaseResolutionStatusType() != TestCaseResolutionStatusTypes.Resolved;
    return isOpen ? latest : null;
  }

  /**
   * A column test whose column no longer resolves keeps pointing at its table only: the copy read
   * for the projection gets the table's entity link, so the graph names no column that is gone.
   */
  private static void keepOnlyResolvedColumnLink(
      final TestCase testCase, final Optional<Table> table, final EntityLink link) {
    if (link.getFieldName() != null && !resolvesColumn(table, link)) {
      testCase.setEntityLink(new EntityLink(Entity.TABLE, link.getEntityFQN()).getLinkString());
    }
  }

  private static boolean resolvesColumn(final Optional<Table> table, final EntityLink link) {
    return table
        .map(
            found ->
                ColumnUtil.resolveColumnChainByPath(found.getColumns(), link.getArrayFieldName()))
        .filter(path -> !path.isEmpty())
        .isPresent();
  }

  /** A missing or malformed stored link cannot establish a target or authorize its evidence. */
  public static Optional<EntityLink> parseEntityLink(final String link) {
    if (link == null) {
      return Optional.empty();
    }
    try {
      return Optional.of(EntityLink.parse(link));
    } catch (IllegalArgumentException | IllegalStateException malformed) {
      return Optional.empty();
    }
  }
}
