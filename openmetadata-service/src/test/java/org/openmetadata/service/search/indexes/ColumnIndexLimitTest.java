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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.service.configuration.elasticsearch.SearchIndexingLimits;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchFieldLimits;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.models.FlattenColumn;

class ColumnIndexLimitTest {

  private static SearchRepository previousRepository;

  @BeforeAll
  static void initSearchRepository() {
    previousRepository = Entity.getSearchRepository();
    Entity.setSearchRepository(mock(SearchRepository.class));
  }

  @AfterAll
  static void restoreSearchRepository() {
    Entity.setSearchRepository(previousRepository);
  }

  private static final class TestColumnIndex implements ColumnIndex {
    @Override
    public Object getEntity() {
      return null;
    }

    @Override
    public String getEntityTypeName() {
      return "table";
    }

    @Override
    public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> esDoc) {
      return esDoc;
    }
  }

  @AfterEach
  void resetLimits() {
    SearchFieldLimits.setActive(null);
  }

  private void activateLimits(int depth, int maxColumns) {
    SearchIndexingLimits limits =
        new SearchIndexingLimits().withMappingDepthLimit(depth).withMaxColumns(maxColumns);
    SearchFieldLimits.setActive(
        SearchFieldLimits.from(new ElasticSearchConfiguration().withSearchIndexingLimits(limits)));
  }

  private Column nestedChain(int depth) {
    Column current = new Column().withName("c" + depth);
    Column root = current;
    for (int level = depth - 1; level >= 1; level--) {
      Column parent = new Column().withName("c" + level).withChildren(List.of(current));
      current = parent;
      root = parent;
    }
    return root;
  }

  @Test
  void parseColumns_stops_at_depth_limit() {
    activateLimits(3, 10000);
    List<FlattenColumn> flattened = new ArrayList<>();

    new TestColumnIndex().parseColumns(List.of(nestedChain(5)), flattened, null);

    assertEquals(3, flattened.size(), "recursion must stop at depth limit");
  }

  @Test
  void parseColumns_does_not_leak_tags_between_siblings() {
    activateLimits(20, 10000);
    Column tagged =
        new Column().withName("a").withTags(List.of(new TagLabel().withTagFQN("PII.Sensitive")));
    Column untagged = new Column().withName("b");
    List<FlattenColumn> flattened = new ArrayList<>();

    new TestColumnIndex().parseColumns(List.of(tagged, untagged), flattened, null);

    assertEquals("a", flattened.get(0).getName());
    assertEquals(1, flattened.get(0).getTags().size(), "tagged column keeps its tag");
    assertTrue(
        flattened.get(1).getTags() == null || flattened.get(1).getTags().isEmpty(),
        "untagged sibling must not inherit the previous column's tags");
  }

  @Test
  void parseColumns_builds_fully_qualified_names() {
    activateLimits(20, 10000);
    List<FlattenColumn> flattened = new ArrayList<>();

    new TestColumnIndex().parseColumns(List.of(nestedChain(3)), flattened, null);

    assertEquals("c1", flattened.get(0).getName());
    assertEquals("c1.c2", flattened.get(1).getName());
    assertEquals("c1.c2.c3", flattened.get(2).getName(), "deep path must keep full prefix");
  }

  @Test
  void parseColumns_stops_at_max_columns() {
    activateLimits(20, 4);
    List<Column> siblings = new ArrayList<>();
    for (int i = 0; i < 10; i++) {
      siblings.add(new Column().withName("col" + i));
    }
    List<FlattenColumn> flattened = new ArrayList<>();

    new TestColumnIndex().parseColumns(siblings, flattened, null);

    assertEquals(4, flattened.size(), "must stop once max columns reached");
  }

  @Test
  void flattenColumns_respects_depth_limit() {
    activateLimits(3, 10000);

    List<Column> result = ColumnSearchIndex.flattenColumns(List.of(nestedChain(5)));

    assertEquals(3, result.size(), "static flatten must stop at depth limit");
  }

  @Test
  void flattenColumns_respects_max_columns() {
    activateLimits(20, 4);
    List<Column> siblings = new ArrayList<>();
    for (int i = 0; i < 10; i++) {
      siblings.add(new Column().withName("col" + i));
    }

    List<Column> result = ColumnSearchIndex.flattenColumns(siblings);

    assertEquals(4, result.size(), "static flatten must stop at max columns");
  }
}
