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
package org.openmetadata.service.search;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.Test;

class RebuildAwareEntityManagementTest {
  private static final String TABLES = "om_table_search_index";
  private static final String STAGED_TABLES = "om_table_search_index_rebuild_1";
  private static final String STAGED_DASHBOARDS = "om_dashboard_search_index_rebuild_1";

  private final EntityManagementClient engine = mock(EntityManagementClient.class);
  private final EntityManagementClient writes =
      new RebuildAwareEntityManagement(
          engine,
          index -> TABLES.equals(index) ? List.of(TABLES, STAGED_TABLES) : List.of(index),
          indexes ->
              Stream.concat(indexes.stream(), Stream.of(STAGED_TABLES, STAGED_DASHBOARDS))
                  .toList());

  @Test
  void aDocumentWriteReachesTheServingIndexAndItsRebuild() throws Exception {
    final Map<String, Object> doc = Map.of("name", "orders");

    writes.updateEntity(TABLES, "t1", doc, "script", "table");
    writes.deleteEntity(TABLES, "t2");

    verify(engine).updateEntity(TABLES, "t1", doc, "script", "table");
    verify(engine).updateEntity(STAGED_TABLES, "t1", doc, "script", "table");
    verify(engine).deleteEntity(TABLES, "t2");
    verify(engine).deleteEntity(STAGED_TABLES, "t2");
    verify(engine, never()).deleteEntity(STAGED_DASHBOARDS, "t2");
  }

  @Test
  void aDocumentWriteToAnIndexNotBeingRebuiltIsSentOnce() throws Exception {
    writes.createEntity("om_topic_search_index", "t1", "{}");

    verify(engine).createEntity("om_topic_search_index", "t1", "{}");
    verifyNoMoreInteractions(engine);
  }

  @Test
  void aWriteByQueryReachesEveryRebuildItsQueryCouldMatch() throws Exception {
    final List<Pair<String, String>> match = List.of(Pair.of("service.id", "s1"));

    writes.deleteEntityByFields(List.of("all"), match);
    writes.updateByFqnPrefix("all", "old", "new", "fullyQualifiedName");

    verify(engine).deleteEntityByFields(List.of("all", STAGED_TABLES, STAGED_DASHBOARDS), match);
    for (final String target : List.of("all", STAGED_TABLES, STAGED_DASHBOARDS)) {
      verify(engine).updateByFqnPrefix(target, "old", "new", "fullyQualifiedName");
    }
  }

  @Test
  void readsAreNotRouted() throws Exception {
    writes.getDocByID(TABLES, "t1");

    verify(engine).getDocByID(TABLES, "t1");
    verifyNoMoreInteractions(engine);
  }
}
