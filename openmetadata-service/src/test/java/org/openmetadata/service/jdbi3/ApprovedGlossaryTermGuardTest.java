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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.ApprovedGlossaryTermGuard.TaggedEntity;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * The guard judges each target on its own: the term lookup and {@code tag_usage} are the
 * boundaries, so they are the only things stubbed.
 */
class ApprovedGlossaryTermGuardTest {

  private static final String TABLE_FQN = "svc.db.schema.orders";
  private static final String COLUMN_A = TABLE_FQN + ".id";
  private static final String COLUMN_B = TABLE_FQN + ".total";
  private static final GlossaryTerm DEPRECATED =
      new GlossaryTerm()
          .withFullyQualifiedName("Glossary.Revenue")
          .withEntityStatus(EntityStatus.DEPRECATED);
  private static final GlossaryTerm APPROVED =
      new GlossaryTerm()
          .withFullyQualifiedName("Glossary.Customer")
          .withEntityStatus(EntityStatus.APPROVED);

  private MockedStatic<Entity> entity;
  private CollectionDAO.TagUsageDAO tagUsageDAO;

  @BeforeEach
  void stubBoundaries() {
    tagUsageDAO = mock(CollectionDAO.TagUsageDAO.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.tagUsageDAO()).thenReturn(tagUsageDAO);
    entity = mockStatic(Entity.class, CALLS_REAL_METHODS);
    entity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    entity
        .when(
            () ->
                Entity.getEntityByNames(
                    eq(Entity.GLOSSARY_TERM), anyList(), eq(""), eq(Include.NON_DELETED)))
        .thenReturn(List.of(DEPRECATED, APPROVED));
  }

  @AfterEach
  void closeStubs() {
    entity.close();
  }

  @Test
  void aTermHeldOnOneColumnIsNewOnAnother() {
    Map<String, String> rejections =
        ApprovedGlossaryTermGuard.rejectionsByTarget(
            Map.of(COLUMN_A, List.of(label(DEPRECATED)), COLUMN_B, List.of(label(DEPRECATED))),
            Map.of(COLUMN_A, List.of(label(DEPRECATED))));

    assertEquals(
        Map.of(
            COLUMN_B,
            CatalogExceptionMessage.glossaryTermNotApproved(
                DEPRECATED.getFullyQualifiedName(), EntityStatus.DEPRECATED)),
        rejections);
  }

  @Test
  void aTermTheTargetOnlyInheritsIsNewOnIt() {
    TagLabel inherited = label(DEPRECATED).withLabelType(LabelType.DERIVED);

    assertThrows(
        IllegalArgumentException.class,
        () ->
            ApprovedGlossaryTermGuard.checkNewlyApplied(
                Map.of(COLUMN_A, List.of(label(DEPRECATED))),
                Map.of(COLUMN_A, List.of(inherited))));
  }

  @Test
  void aTermHeldInTheLoadedStateNeedsNoStoredRead() {
    ApprovedGlossaryTermGuard.checkNewlyApplied(
        Map.of(COLUMN_A, List.of(label(DEPRECATED))), Map.of(COLUMN_A, List.of(label(DEPRECATED))));

    verify(tagUsageDAO, never()).getTagsByTargetFQNHashes(anyList());
  }

  @Test
  void aTermTheLoadedStateMissesIsReadFromStoredTags() {
    when(tagUsageDAO.getTagsByTargetFQNHashes(List.of(FullyQualifiedName.buildHash(COLUMN_A))))
        .thenReturn(Map.of(FullyQualifiedName.buildHash(COLUMN_A), List.of(label(DEPRECATED))));

    ApprovedGlossaryTermGuard.checkNewlyApplied(
        Map.of(COLUMN_A, List.of(label(DEPRECATED))), Map.of());
  }

  @Test
  void approvedTermsNeverReadStoredTags() {
    ApprovedGlossaryTermGuard.checkNewlyApplied(
        Map.of(COLUMN_A, List.of(label(APPROVED))), Map.of());

    verify(tagUsageDAO, never()).getTagsByTargetFQNHashes(anyList());
  }

  @Test
  void tagsByTargetKeysEveryNestedColumn() {
    Column nested =
        new Column()
            .withName("cents")
            .withDataType(ColumnDataType.INT)
            .withFullyQualifiedName(COLUMN_B + ".cents")
            .withTags(List.of(label(DEPRECATED)));
    Column parent =
        new Column()
            .withName("total")
            .withDataType(ColumnDataType.STRUCT)
            .withFullyQualifiedName(COLUMN_B)
            .withChildren(List.of(nested));
    Table table =
        new Table()
            .withFullyQualifiedName(TABLE_FQN)
            .withTags(List.of(label(APPROVED)))
            .withColumns(List.of(parent));

    Map<String, List<TagLabel>> tagsByTarget =
        ApprovedGlossaryTermGuard.tagsByTarget(table, columnsOf(table));

    assertEquals(
        Map.of(
            TABLE_FQN,
            List.of(label(APPROVED)),
            COLUMN_B,
            List.of(),
            COLUMN_B + ".cents",
            List.of(label(DEPRECATED))),
        tagsByTarget);
  }

  /** A move rewrites field FQNs before their stored labels are re-keyed. */
  @Test
  void aMovedFieldIsKeyedByItsStoredFqn() {
    String movedTable = "svc.db.other.orders";
    Table stored =
        new Table()
            .withFullyQualifiedName(TABLE_FQN)
            .withColumns(List.of(column("id", COLUMN_A, List.of(label(DEPRECATED)))));
    Table moved =
        new Table()
            .withFullyQualifiedName(movedTable)
            .withColumns(
                List.of(
                    column("id", movedTable + ".id", List.of(label(DEPRECATED))),
                    column("total", movedTable + ".total", List.of())));

    Map<String, List<TagLabel>> requested =
        ApprovedGlossaryTermGuard.tagsByStoredTarget(
            new TaggedEntity(moved, columnsOf(moved)), new TaggedEntity(stored, columnsOf(stored)));

    assertEquals(
        Map.of(
            TABLE_FQN,
            List.of(),
            COLUMN_A,
            List.of(label(DEPRECATED)),
            movedTable + ".total",
            List.of()),
        requested);
    ApprovedGlossaryTermGuard.checkNewlyApplied(
        requested, ApprovedGlossaryTermGuard.tagsByTarget(stored, columnsOf(stored)));
  }

  /** A request and a response field can share a name; each keeps its own target. */
  @Test
  void sameNamedFieldsInDifferentContainersStayApart() {
    String endpoint = "svc.collection.orders";
    Column request = column("id", endpoint + ".requestSchema.id", List.of(label(DEPRECATED)));
    Column response = column("id", endpoint + ".responseSchema.id", List.of());
    TaggedEntity stored =
        new TaggedEntity(
            new Table().withFullyQualifiedName(endpoint),
            Map.of(
                "requestSchema.schemaFields",
                    List.of(column("id", request.getFullyQualifiedName(), List.of())),
                "responseSchema.schemaFields", List.of(response)));
    TaggedEntity updated =
        new TaggedEntity(
            new Table().withFullyQualifiedName(endpoint),
            Map.of(
                "requestSchema.schemaFields", List.of(request),
                "responseSchema.schemaFields", List.of(response)));

    assertThrows(
        IllegalArgumentException.class,
        () ->
            ApprovedGlossaryTermGuard.checkNewlyApplied(
                ApprovedGlossaryTermGuard.tagsByStoredTarget(updated, stored),
                ApprovedGlossaryTermGuard.tagsByTarget(
                    stored.entity(), stored.fieldsByContainer())));
  }

  /** A term is judged by its hash, so quoting a segment that needs none changes nothing. */
  @Test
  void aQuotedTermFqnIsTheSameTerm() {
    TagLabel quoted = label(DEPRECATED).withTagFQN("Glossary.\"Revenue\"");

    assertThrows(
        IllegalArgumentException.class,
        () ->
            ApprovedGlossaryTermGuard.checkNewlyApplied(
                Map.of(COLUMN_B, List.of(quoted)), Map.of()));
    ApprovedGlossaryTermGuard.checkNewlyApplied(
        Map.of(COLUMN_A, List.of(quoted)), Map.of(COLUMN_A, List.of(label(DEPRECATED))));
  }

  /** Columns match ignoring case, so a re-ingest that changes a name's case keeps its terms. */
  @Test
  void aFieldRenamedOnlyInCaseKeepsItsStoredTarget() {
    Table stored =
        new Table()
            .withFullyQualifiedName(TABLE_FQN)
            .withColumns(List.of(column("ID", TABLE_FQN + ".ID", List.of(label(DEPRECATED)))));
    Table renamed =
        new Table()
            .withFullyQualifiedName(TABLE_FQN)
            .withColumns(List.of(column("id", COLUMN_A, List.of(label(DEPRECATED)))));

    ApprovedGlossaryTermGuard.checkNewlyApplied(
        ApprovedGlossaryTermGuard.tagsByStoredTarget(
            new TaggedEntity(renamed, columnsOf(renamed)),
            new TaggedEntity(stored, columnsOf(stored))),
        ApprovedGlossaryTermGuard.tagsByTarget(stored, columnsOf(stored)));
  }

  private static Map<String, List<? extends FieldInterface>> columnsOf(Table table) {
    return Map.of("columns", table.getColumns() == null ? List.of() : table.getColumns());
  }

  private static Column column(String name, String fqn, List<TagLabel> tags) {
    return new Column()
        .withName(name)
        .withDataType(ColumnDataType.INT)
        .withFullyQualifiedName(fqn)
        .withTags(tags);
  }

  private static TagLabel label(GlossaryTerm term) {
    return new TagLabel()
        .withTagFQN(term.getFullyQualifiedName())
        .withSource(TagSource.GLOSSARY)
        .withLabelType(LabelType.MANUAL);
  }
}
