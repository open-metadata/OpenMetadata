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
package org.openmetadata.service.search;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.apps.bundles.searchIndex.SearchIndexEntityTypes;

/**
 * Pins the premise behind {@code SearchRepository.INDICES_WITHOUT_REINDEX_SOURCE}.
 *
 * <p>That list drives a warning, and a warning keyed on a string is exactly the kind of thing that
 * rots silently: rename the mapping key and it stops matching, make the type reindexable and it
 * starts lying. Neither shows up as a failure anywhere, so the operator simply stops being told that
 * a CLI reindex is about to empty an index nothing will refill. These assertions fail instead.
 */
class IndicesWithoutReindexSourceTest {

  private static final String PIPELINE_STATUS_INDEX_KEY = "pipelineStatus";

  @BeforeAll
  static void loadRealMapping() throws java.io.IOException {
    IndexMappingLoader.init();
  }

  @Test
  @DisplayName("pipelineStatus is still a real index key, so the warning still matches something")
  void pipelineStatusIsStillAMappedIndex() {
    assertThat(IndexMappingLoader.getInstance().getIndexMapping())
        .as(
            "INDICES_WITHOUT_REINDEX_SOURCE names '%s'; if the mapping key was renamed the warning "
                + "silently stops firing and a CLI reindex empties the index unannounced",
            PIPELINE_STATUS_INDEX_KEY)
        .containsKey(PIPELINE_STATUS_INDEX_KEY);
  }

  @Test
  @DisplayName("nothing reindexes pipelineStatus, which is what makes the warning true")
  void pipelineStatusHasNoReindexSource() {
    // pipelineStatus documents, and the pipelineExecution documents PipelineRepository writes into
    // the same index under a composite doc id, are both absent from the reindex time-series set.
    // Adding either one here is the fix that should delete the warning — and this assertion.
    assertThat(SearchIndexEntityTypes.isTimeSeriesEntity(PIPELINE_STATUS_INDEX_KEY))
        .as(
            "if '%s' became reindexable, INDICES_WITHOUT_REINDEX_SOURCE is now claiming a data loss "
                + "that no longer happens",
            PIPELINE_STATUS_INDEX_KEY)
        .isFalse();
    assertThat(SearchIndexEntityTypes.isTimeSeriesEntity("pipelineExecution")).isFalse();
  }
}
