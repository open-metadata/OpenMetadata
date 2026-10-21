/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Covers how a field inherits its entity's glossary terms on read (table columns, schema fields,
 * data model columns, ...) and which labels the write paths keep out of {@code tag_usage}.
 */
class EntityInheritedTermsTest {

  private static final String TABLE_FQN = "svc.db.schema.orders";
  private static final String PAYLOAD_FQN = TABLE_FQN + ".payload";
  private static final String INNER_FQN = PAYLOAD_FQN + ".inner";
  private static final String AMOUNT_FQN = TABLE_FQN + ".amount";
  private static final String REVENUE = "Finance.Revenue";

  @Test
  void inheritedTermIsADerivedCopyOfTheParentsGlossaryTerm() {
    TagLabel parentLabel = tag(REVENUE, TagSource.GLOSSARY, LabelType.MANUAL);

    List<TagLabel> inherited = Entity.inheritedParentTerms(List.of(parentLabel));

    assertEquals(1, inherited.size());
    assertEquals(REVENUE, inherited.getFirst().getTagFQN());
    assertEquals(LabelType.DERIVED, inherited.getFirst().getLabelType());
    // The parent's own label must not flip along with the copy.
    assertEquals(LabelType.MANUAL, parentLabel.getLabelType());
  }

  @Test
  void classificationAndDerivedParentLabelsAreNotInherited() {
    List<TagLabel> inherited =
        Entity.inheritedParentTerms(
            List.of(
                tag("PII.Sensitive", TagSource.CLASSIFICATION, LabelType.MANUAL),
                tag("Finance.Implied", TagSource.GLOSSARY, LabelType.DERIVED)));

    assertTrue(inherited.isEmpty());
    assertTrue(Entity.inheritedParentTerms(null).isEmpty());
  }

  /**
   * DERIVED labels never reach {@code tag_usage}: a client that reads a table and writes it back
   * would otherwise pin the inherited term on every column, outliving its removal from the table.
   * PROPAGATED labels are stored: they come from lineage propagation and belong to the asset.
   */
  @Test
  void derivedLabelsAreNotPersistedButLineagePropagatedOnesAre() {
    assertTrue(TagLabelUtil.isSystemGenerated(tag(REVENUE, TagSource.GLOSSARY, LabelType.DERIVED)));
    assertFalse(
        TagLabelUtil.isSystemGenerated(tag(REVENUE, TagSource.GLOSSARY, LabelType.PROPAGATED)));
    assertFalse(TagLabelUtil.isSystemGenerated(tag(REVENUE, TagSource.GLOSSARY, LabelType.MANUAL)));
    assertFalse(
        TagLabelUtil.isSystemGenerated(
            tag("PII.Sensitive", TagSource.CLASSIFICATION, LabelType.AUTOMATED)));
    assertFalse(TagLabelUtil.isSystemGenerated(null));
  }

  @Test
  void everyFieldInheritsTheTermAndAFieldsOwnLabelWins() {
    List<Column> columns = columns();
    Map<String, List<TagLabel>> tags =
        Map.of(
            TABLE_FQN, List.of(tag(REVENUE, TagSource.GLOSSARY, LabelType.MANUAL)),
            AMOUNT_FQN, List.of(tag(REVENUE, TagSource.GLOSSARY, LabelType.MANUAL)));

    try (MockedStatic<Entity> entity = tableWithTags(tags, Map.of());
        MockedStatic<SettingsCache> settings = glossaryPropagationEnabled()) {
      Entity.populateEntityFieldTags(Entity.TABLE, columns, TABLE_FQN, true);
    }

    assertLabels(columns.getFirst(), Map.of(REVENUE, LabelType.DERIVED));
    assertLabels(columns.getFirst().getChildren().getFirst(), Map.of(REVENUE, LabelType.DERIVED));
    assertLabels(columns.get(1), Map.of(REVENUE, LabelType.MANUAL));
  }

  /**
   * Inheritance follows the entity rules in {@code EntityRepository#inheritTags}: a field that holds
   * its own term under a mutually exclusive glossary does not also report the parent's sibling term,
   * a combination the write path would have rejected.
   */
  @Test
  void anInheritedTermConflictingWithTheFieldsOwnTermIsSkipped() {
    List<Column> columns = columns();
    Map<String, List<TagLabel>> tags =
        Map.of(
            TABLE_FQN, List.of(tag(REVENUE, TagSource.GLOSSARY, LabelType.MANUAL)),
            AMOUNT_FQN, List.of(tag("Finance.Cost", TagSource.GLOSSARY, LabelType.MANUAL)));

    try (MockedStatic<Entity> entity = tableWithTags(tags, Map.of());
        MockedStatic<SettingsCache> settings = glossaryPropagationEnabled();
        MockedStatic<TagLabelUtil> util = mockStatic(TagLabelUtil.class, CALLS_REAL_METHODS)) {
      util.when(() -> TagLabelUtil.mutuallyExclusive(any(TagLabel.class))).thenReturn(true);
      Entity.populateEntityFieldTags(Entity.TABLE, columns, TABLE_FQN, true);
    }

    assertLabels(columns.getFirst(), Map.of(REVENUE, LabelType.DERIVED));
    assertLabels(columns.get(1), Map.of("Finance.Cost", LabelType.MANUAL));
  }

  /**
   * An inherited term does not imply its classification tags on the field: the field is not, say,
   * PII.Sensitive because its table's term is. Only the field's own terms imply tags, as before.
   */
  @Test
  void onlyAFieldsOwnTermsImplyClassificationTags() {
    List<Column> columns = columns();
    Map<String, List<TagLabel>> tags =
        Map.of(
            TABLE_FQN, List.of(tag(REVENUE, TagSource.GLOSSARY, LabelType.MANUAL)),
            AMOUNT_FQN, List.of(tag("Marketing.Spend", TagSource.GLOSSARY, LabelType.MANUAL)));
    Map<String, List<TagLabel>> implied =
        Map.of(
            REVENUE,
            List.of(tag("PII.Sensitive", TagSource.CLASSIFICATION, LabelType.DERIVED)),
            "Marketing.Spend",
            List.of(tag("Cost.Tracked", TagSource.CLASSIFICATION, LabelType.DERIVED)));

    try (MockedStatic<Entity> entity = tableWithTags(tags, implied);
        MockedStatic<SettingsCache> settings = glossaryPropagationEnabled()) {
      Entity.populateEntityFieldTags(Entity.TABLE, columns, TABLE_FQN, true);
    }

    assertLabels(columns.getFirst(), Map.of(REVENUE, LabelType.DERIVED));
    assertLabels(
        columns.get(1),
        Map.of(
            "Marketing.Spend",
            LabelType.MANUAL,
            "Cost.Tracked",
            LabelType.DERIVED,
            REVENUE,
            LabelType.DERIVED));
  }

  /** A top-level column with a nested one, and a sibling column. */
  private static List<Column> columns() {
    Column inner = new Column().withName("inner").withFullyQualifiedName(INNER_FQN);
    Column payload =
        new Column()
            .withName("payload")
            .withFullyQualifiedName(PAYLOAD_FQN)
            .withChildren(List.of(inner));
    Column amount = new Column().withName("amount").withFullyQualifiedName(AMOUNT_FQN);
    return List.of(payload, amount);
  }

  /** Stands in for tag_usage: the labels stored per FQN, and the tags each term implies. */
  @SuppressWarnings("unchecked")
  private static MockedStatic<Entity> tableWithTags(
      Map<String, List<TagLabel>> tagsByFqn, Map<String, List<TagLabel>> impliedByTermFqn) {
    EntityRepository<?> repository = mock(EntityRepository.class);
    when(repository.getTagsByPrefix(TABLE_FQN, "%")).thenReturn(keyedByHash(tagsByFqn));
    CollectionDAO.TagUsageDAO tagUsageDAO = mock(CollectionDAO.TagUsageDAO.class);
    when(tagUsageDAO.getDerivedTagsBatch(anyList())).thenReturn(keyedByHash(impliedByTermFqn));
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.tagUsageDAO()).thenReturn(tagUsageDAO);
    MockedStatic<Entity> entity = mockStatic(Entity.class, CALLS_REAL_METHODS);
    entity.when(() -> Entity.getEntityRepository(Entity.TABLE)).thenReturn(repository);
    entity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    return entity;
  }

  private static MockedStatic<SettingsCache> glossaryPropagationEnabled() {
    MockedStatic<SettingsCache> settings = mockStatic(SettingsCache.class);
    settings.when(SettingsCache::isGlossaryTagPropagationEnabled).thenReturn(true);
    return settings;
  }

  private static Map<String, List<TagLabel>> keyedByHash(Map<String, List<TagLabel>> byFqn) {
    Map<String, List<TagLabel>> byHash = new HashMap<>();
    byFqn.forEach((fqn, labels) -> byHash.put(FullyQualifiedName.buildHash(fqn), labels));
    return byHash;
  }

  private static void assertLabels(Column column, Map<String, LabelType> expected) {
    Map<String, LabelType> actual = new HashMap<>();
    column.getTags().forEach(label -> actual.put(label.getTagFQN(), label.getLabelType()));
    assertEquals(expected, actual, () -> column.getName() + " labels: " + column.getTags());
  }

  private static TagLabel tag(String fqn, TagSource source, LabelType labelType) {
    return new TagLabel().withTagFQN(fqn).withSource(source).withLabelType(labelType);
  }
}
