/*
 *  Copyright 2024 Collate.
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
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.SearchIndexingLimits;
import org.openmetadata.schema.type.Field;
import org.openmetadata.service.search.SearchFieldLimits;
import org.openmetadata.service.search.models.FlattenSchemaField;

class SchemaFieldFlattenerTest {

  @AfterEach
  void resetLimits() {
    SearchFieldLimits.setActive(null);
  }

  private void activateLimits(int depth, int maxFields) {
    SearchIndexingLimits limits =
        new SearchIndexingLimits().withMappingDepthLimit(depth).withMaxColumns(maxFields);
    SearchFieldLimits.setActive(
        SearchFieldLimits.from(new ElasticSearchConfiguration().withSearchIndexingLimits(limits)));
  }

  private Field nestedChain(int depth) {
    Field current = new Field().withName("f" + depth);
    Field root = current;
    for (int level = depth - 1; level >= 1; level--) {
      Field parent = new Field().withName("f" + level).withChildren(List.of(current));
      current = parent;
      root = parent;
    }
    return root;
  }

  @Test
  void parseSchemaFields_stops_at_depth_limit() {
    activateLimits(3, 10000);
    List<FlattenSchemaField> flattened = new ArrayList<>();

    SchemaFieldFlattener.parseSchemaFields(List.of(nestedChain(5)), flattened, null);

    assertEquals(3, flattened.size(), "recursion must stop at depth limit");
  }

  @Test
  void parseSchemaFields_builds_fully_qualified_names() {
    activateLimits(20, 10000);
    List<FlattenSchemaField> flattened = new ArrayList<>();

    SchemaFieldFlattener.parseSchemaFields(List.of(nestedChain(3)), flattened, null);

    assertEquals("f1", flattened.get(0).getName());
    assertEquals("f1.f2", flattened.get(1).getName());
    assertEquals("f1.f2.f3", flattened.get(2).getName(), "deep path must keep full prefix");
  }

  @Test
  void parseSchemaFields_stops_at_max_fields() {
    activateLimits(20, 4);
    List<Field> siblings = new ArrayList<>();
    for (int i = 0; i < 10; i++) {
      siblings.add(new Field().withName("field" + i));
    }
    List<FlattenSchemaField> flattened = new ArrayList<>();

    SchemaFieldFlattener.parseSchemaFields(siblings, flattened, null);

    assertEquals(4, flattened.size(), "must stop once max fields reached");
  }
}
