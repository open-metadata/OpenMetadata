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

  public static EntityReindexContext fromStagedContext(
      ReindexContext stagedIndexContext, String entityType) {
    String originalIndex = stagedIndexContext.getOriginalIndex(entityType).orElse(null);

    return EntityReindexContext.builder()
        .entityType(entityType)
        .originalIndex(originalIndex)
        .canonicalIndex(stagedIndexContext.getCanonicalIndex(entityType).orElse(null))
        .activeIndex(originalIndex)
        .stagedIndex(stagedIndexContext.getStagedIndex(entityType).orElse(null))
        .canonicalAliases(stagedIndexContext.getCanonicalAlias(entityType).orElse(null))
        .existingAliases(stagedIndexContext.getExistingAliases(entityType))
        .parentAliases(new HashSet<>(listOrEmpty(stagedIndexContext.getParentAliases(entityType))))
        .build();
  }
}
