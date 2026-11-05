/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.schema.type.TagLabel.TagSource;

/** A column document carries the glossary terms the column inherits from its table. */
class ColumnSearchIndexTest {

  private static final String TABLE_FQN = "svc.db.schema.orders";
  private static final String REVENUE = "Finance.Revenue";

  /**
   * A reindex builds column docs from a bulk-loaded table, and a column change rebuilds them from
   * the updated table; in neither case does the column itself carry the inherited term. The doc takes
   * it from the table, so a rebuild cannot erase it.
   */
  @Test
  void columnDocCarriesTheTablesGlossaryTermEvenWhenTheColumnDoesNot() {
    Table table =
        table(
            tag(REVENUE, TagSource.GLOSSARY, LabelType.MANUAL),
            tag("PII.Sensitive", TagSource.CLASSIFICATION, LabelType.MANUAL));

    Map<String, Object> doc = buildDoc(column(), table);

    assertEquals(Map.of(REVENUE, LabelType.DERIVED), labels(doc));
    assertEquals(List.of(REVENUE), doc.get("glossaryTags"));
  }

  @Test
  void aColumnsOwnLabelOfTheTermWinsInItsDoc() {
    Column column = column();
    column.setTags(new ArrayList<>(List.of(tag(REVENUE, TagSource.GLOSSARY, LabelType.MANUAL))));

    Map<String, Object> doc =
        buildDoc(column, table(tag(REVENUE, TagSource.GLOSSARY, LabelType.MANUAL)));

    assertEquals(Map.of(REVENUE, LabelType.MANUAL), labels(doc));
  }

  private static Map<String, Object> buildDoc(Column column, Table table) {
    return new ColumnSearchIndex(column, table).buildSearchIndexDocInternal(new HashMap<>());
  }

  @SuppressWarnings("unchecked")
  private static Map<String, LabelType> labels(Map<String, Object> doc) {
    Map<String, LabelType> labels = new HashMap<>();
    ((List<TagLabel>) doc.getOrDefault("tags", List.of()))
        .forEach(label -> labels.put(label.getTagFQN(), label.getLabelType()));
    return labels;
  }

  private static Column column() {
    return new Column().withName("amount").withFullyQualifiedName(TABLE_FQN + ".amount");
  }

  private static Table table(TagLabel... tags) {
    return new Table()
        .withId(UUID.randomUUID())
        .withName("orders")
        .withFullyQualifiedName(TABLE_FQN)
        .withTags(new ArrayList<>(List.of(tags)));
  }

  private static TagLabel tag(String fqn, TagSource source, LabelType labelType) {
    return new TagLabel().withTagFQN(fqn).withSource(source).withLabelType(labelType);
  }
}
