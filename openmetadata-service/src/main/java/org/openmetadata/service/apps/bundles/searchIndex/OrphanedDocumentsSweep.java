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
package org.openmetadata.service.apps.bundles.searchIndex;

import java.io.IOException;
import org.openmetadata.service.search.SearchRepository;

/**
 * Removes from a serving index the documents whose rows are gone, as an in-place reindex does
 * after rewriting it. The scheduled search repair runs it for every type once a day: a delete
 * whose search write was lost leaves such a document, and nothing else would remove it.
 */
public final class OrphanedDocumentsSweep {
  private OrphanedDocumentsSweep() {}

  /**
   * Deletes {@code entityType}'s documents that were read before {@code untouchedSince}, or never
   * stamped, and whose rows are gone.
   *
   * @return how many documents were deleted
   */
  public static long removeOrphans(
      final SearchRepository searchRepository, final String entityType, final long untouchedSince)
      throws IOException {
    final String servingIndex =
        searchRepository
            .getIndexMapping(entityType)
            .getIndexName(searchRepository.getClusterAlias());
    return new InPlaceIndexSweep(
            new RawIndexOperations(searchRepository.getSearchClient()),
            InPlaceIndexSweep::databaseRows,
            searchRepository.getVectorIndexService())
        .removeOrphans(entityType, servingIndex, untouchedSince);
  }
}
