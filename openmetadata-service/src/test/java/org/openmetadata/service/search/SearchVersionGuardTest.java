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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.search.scripts.SoftDeleteScript;

class SearchVersionGuardTest {
  private static final Table ENTITY = new Table().withVersion(0.3).withUpdatedAt(30L);

  @Test
  void aPartialUpdateIsStampedWithTheEntityState() {
    final SearchDocumentUpdate partial =
        new SearchDocumentUpdate(
            "ctx._source.description = params.description", Map.of("description", "d"));

    final SearchDocumentUpdate guarded = SearchVersionGuard.apply(partial, ENTITY, 40L);

    assertEquals(
        Map.of("description", "d", "version", 0.3, "updatedAt", 30L, "sourceReadAt", 40L),
        guarded.parameters());
    assertTrue(guarded.script().contains(partial.script()));
  }

  @Test
  void aFullDocumentKeepsItsOwnStateAndUpsertMode() {
    final Map<String, Object> document = Map.of("name", "t", "version", 0.2, "updatedAt", 20L);
    final SearchDocumentUpdate full =
        new SearchDocumentUpdate(SearchClient.DEFAULT_UPDATE_SCRIPT, document, true);

    final SearchDocumentUpdate guarded = SearchVersionGuard.apply(full, ENTITY, 40L);

    assertEquals(
        Map.of("name", "t", "version", 0.2, "updatedAt", 20L, "sourceReadAt", 40L),
        guarded.parameters());
    assertTrue(guarded.scriptedUpsert());
  }

  @Test
  void onlyTheEntityOwnSoftDeleteIsOrdered() {
    final SoftDeleteScript own = SoftDeleteScript.forEntity(true, ENTITY, 40L);
    final SoftDeleteScript descendants = new SoftDeleteScript(true);

    assertEquals(Map.of("version", 0.3, "updatedAt", 30L, "sourceReadAt", 40L), own.params());
    assertTrue(own.painless().contains(descendants.painless()));
    assertEquals(Map.of(), descendants.params());
  }
}
