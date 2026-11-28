/*
 *  Copyright 2024 Collate
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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.HashSet;
import org.openmetadata.service.search.EntityReindexContext;
import org.openmetadata.service.search.ReindexContext;

public final class EntityReindexContextMapper {
  private EntityReindexContextMapper() {}

  /**
   * {@code stagedChunkDeleteUnrecorded} is whether a node failed a partition of the run because it
   * missed a delete from the run's chunk generation and could not record it. Every caller that
   * finalizes a type must say, or the generation could go live with a deleted entity's chunks.
   */
  public static EntityReindexContext fromStagedContext(
      ReindexContext stagedIndexContext, String entityType, boolean stagedChunkDeleteUnrecorded) {
    String originalIndex = stagedIndexContext.getOriginalIndex(entityType).orElse(null);

    return EntityReindexContext.builder()
        .entityType(entityType)
        .originalIndex(originalIndex)
        .canonicalIndex(stagedIndexContext.getCanonicalIndex(entityType).orElse(null))
        .activeIndex(originalIndex)
        .stagedIndex(stagedIndexContext.getStagedIndex(entityType).orElse(null))
        .stagedChunkIndex(stagedIndexContext.getStagedChunkIndex().orElse(null))
        .stagedChunkDeleteUnrecorded(stagedChunkDeleteUnrecorded)
        .canonicalAliases(stagedIndexContext.getCanonicalAlias(entityType).orElse(null))
        .existingAliases(stagedIndexContext.getExistingAliases(entityType))
        .parentAliases(new HashSet<>(listOrEmpty(stagedIndexContext.getParentAliases(entityType))))
        .build();
  }
}
