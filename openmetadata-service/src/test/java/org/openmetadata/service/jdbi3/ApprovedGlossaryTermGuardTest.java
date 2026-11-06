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
        ApprovedGlossaryTermGuard.tagsByTarget(table, Entity.TABLE);

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

  private static TagLabel label(GlossaryTerm term) {
    return new TagLabel()
        .withTagFQN(term.getFullyQualifiedName())
        .withSource(TagSource.GLOSSARY)
        .withLabelType(LabelType.MANUAL);
  }
}
