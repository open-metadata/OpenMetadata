/*
 *  Copyright 2023 Collate.
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

import { get, isUndefined } from 'lodash';
import type { SearchedDataProps } from '../../src/components/SearchedData/SearchedData.interface';
import type { ColumnOrTask } from '../components/Database/ColumnDetailPanel/ColumnDetailPanel.interface';
import type {
  BasicEntityInfo,
  HighlightedTagLabel,
} from '../components/Explore/EntitySummaryPanel/SummaryList/SummaryList.interface';
import { SummaryListHighlightKeys } from '../constants/EntitySummaryPanelUtils.constant';
import { SummaryEntityType } from '../enums/EntitySummary.enum';
import type { Chart } from '../generated/entity/data/chart';
import type { TagLabel } from '../generated/entity/data/container';
import type { MlFeature } from '../generated/entity/data/mlmodel';
import type { Task } from '../generated/entity/data/pipeline';
import type { Column } from '../generated/entity/data/table';
import type { Field } from '../generated/entity/data/topic';
import type { EntityData } from '../pages/TasksPage/TasksPage.interface';

export type SummaryListItem = Column | Field | Chart | Task | MlFeature;

export interface ListItemHighlights {
  highlightedTags?: BasicEntityInfo['tags'];
  highlightedTitle?: string;
  highlightedDescription?: string;
}

export const getSummaryListItemType = (
  entityType: SummaryEntityType,
  listItem: SummaryListItem
): BasicEntityInfo['type'] => {
  switch (entityType) {
    case SummaryEntityType.COLUMN:
    case SummaryEntityType.FIELD:
    case SummaryEntityType.MLFEATURE:
    case SummaryEntityType.SCHEMAFIELD:
      return (listItem as Column | Field | MlFeature).dataType;
    case SummaryEntityType.CHART:
      return (listItem as Chart).chartType;
    case SummaryEntityType.TASK:
      return (listItem as Task).taskType;
    default:
      return '';
  }
};

export const getSortedTagsWithHighlight = (
  tags: TagLabel[] = [],
  sortTagsBasedOnGivenTagFQNs: string[] = []
): ListItemHighlights['highlightedTags'] => {
  const { sortedTags, remainingTags } = tags.reduce(
    (acc, tag) => {
      if (sortTagsBasedOnGivenTagFQNs.includes(tag.tagFQN)) {
        acc.sortedTags.push({ ...tag, isHighlighted: true });
      } else {
        acc.remainingTags.push(tag);
      }

      return acc;
    },
    {
      sortedTags: [] as HighlightedTagLabel[],
      remainingTags: [] as TagLabel[],
    }
  );

  return [...sortedTags, ...remainingTags];
};

export const getMapOfListHighlights = (
  highlights?: SearchedDataProps['data'][number]['highlight']
): {
  listHighlights: string[];
  listHighlightsMap: { [key: string]: number };
} => {
  const listHighlights: string[] = [];
  SummaryListHighlightKeys.forEach((highlightKey) => {
    listHighlights.push(...get(highlights, highlightKey, []));
  });

  const listHighlightsMap: { [key: string]: number } = {};

  listHighlights?.reduce((acc, colHighlight, index) => {
    acc[colHighlight.replaceAll(/<\/?span(.*?)>/g, '')] = index;

    return acc;
  }, listHighlightsMap);

  return { listHighlights, listHighlightsMap };
};

export const getHighlightOfListItem = (
  listItem: SummaryListItem,
  tagHighlights: string[],
  listHighlights: string[],
  listHighlightsMap: { [key: string]: number }
): ListItemHighlights => {
  let highlightedTags;
  let highlightedTitle;
  let highlightedDescription;

  const shouldSortListItemTags = listItem.tags?.find((tag) =>
    tagHighlights.includes(tag.tagFQN)
  );

  if (shouldSortListItemTags) {
    highlightedTags = getSortedTagsWithHighlight(listItem.tags, tagHighlights);
  }

  const highlightedListItemNameIndex = listHighlightsMap[listItem.name ?? ''];

  const shouldApplyHighlightOnTitle = !isUndefined(
    highlightedListItemNameIndex
  );

  if (shouldApplyHighlightOnTitle) {
    highlightedTitle = listHighlights[highlightedListItemNameIndex];
  }

  const highlightedListItemDescriptionIndex =
    listHighlightsMap[listItem.description ?? ''];

  const shouldApplyHighlightOnDescription = !isUndefined(
    highlightedListItemDescriptionIndex
  );

  if (shouldApplyHighlightOnDescription) {
    highlightedDescription =
      listHighlights[highlightedListItemDescriptionIndex];
  }

  return {
    highlightedTags,
    highlightedTitle,
    highlightedDescription,
  };
};

export const toEntityData = (
  column: ColumnOrTask | null
): EntityData | undefined => {
  if (!column) {
    return undefined;
  }

  const extension =
    'extension' in column &&
    typeof column.extension === 'object' &&
    column.extension !== null
      ? column.extension
      : undefined;

  const entityData: EntityData = {} as EntityData;
  if (extension) {
    entityData.extension = extension;
  }

  return entityData;
};
