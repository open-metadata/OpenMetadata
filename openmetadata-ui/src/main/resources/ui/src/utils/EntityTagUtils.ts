/*
 *  Copyright 2025 Collate.
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

import { EntityDetailUnion } from 'Models';
import { EntityType } from '../enums/entity.enum';
import { Table } from '../generated/entity/data/table';
import { TagLabel } from '../generated/type/tagLabel';
import { getTagsWithoutTier } from './TablePureUtils';
import { getTableTags } from './TagsPureUtils';;

export const getEntityTags = (
  type: string,
  entityDetail: EntityDetailUnion
): Array<TagLabel> => {
  switch (type) {
    case EntityType.TABLE: {
      const tableTags: Array<TagLabel> = [
        ...getTableTags((entityDetail as Table).columns ?? []),
        ...(entityDetail.tags ?? []),
      ];

      return tableTags;
    }
    case EntityType.DASHBOARD:
    case EntityType.SEARCH_INDEX:
    case EntityType.PIPELINE:
      return getTagsWithoutTier(entityDetail.tags ?? []);

    case EntityType.TOPIC:
    case EntityType.MLMODEL:
    case EntityType.STORED_PROCEDURE:
    case EntityType.DASHBOARD_DATA_MODEL: {
      return entityDetail.tags ?? [];
    }

    default:
      return [];
  }
};
