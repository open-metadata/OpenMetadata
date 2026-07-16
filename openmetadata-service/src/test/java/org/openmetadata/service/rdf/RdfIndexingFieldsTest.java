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

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.service.Entity;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;

class RdfIndexingFieldsTest {

  @Test
  void removesVotesFromSelectiveSearchFields() {
    try (MockedStatic<ReindexingUtil> reindexingUtil = Mockito.mockStatic(ReindexingUtil.class)) {
      reindexingUtil
          .when(() -> ReindexingUtil.getSearchIndexFields("table"))
          .thenReturn(List.of("owners", Entity.FIELD_VOTES, "tags"));

      assertEquals(List.of("owners", "tags"), RdfIndexingFields.forEntityType("table"));
    }
  }

  @Test
  void preservesWildcardFallback() {
    try (MockedStatic<ReindexingUtil> reindexingUtil = Mockito.mockStatic(ReindexingUtil.class)) {
      reindexingUtil
          .when(() -> ReindexingUtil.getSearchIndexFields("table"))
          .thenReturn(List.of("*"));

      assertEquals(List.of("*"), RdfIndexingFields.forEntityType("table"));
    }
  }
}
