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

import { Typography } from 'antd';
import { get, isEmpty, isUndefined } from 'lodash';
import React from 'react';
import { Link } from 'react-router-dom';
import { SearchedDataProps } from '../../src/components/SearchedData/SearchedData.interface';
import { ReactComponent as IconExternalLink } from '../assets/svg/external-links.svg';
import {
  BasicEntityInfo,
  HighlightedTagLabel,
} from '../components/Explore/EntitySummaryPanel/SummaryList/SummaryList.interface';
import { NO_DATA_PLACEHOLDER } from '../constants/constants';
import { SummaryListHighlightKeys } from '../constants/EntitySummaryPanelUtils.constant';
import { SummaryEntityType } from '../enums/EntitySummary.enum';
import { Chart } from '../generated/entity/data/chart';
import { TagLabel } from '../generated/entity/data/container';
import { MlFeature } from '../generated/entity/data/mlmodel';
import { Task } from '../generated/entity/data/pipeline';
import { Column, TableConstraint } from '../generated/entity/data/table';
import { Field } from '../generated/entity/data/topic';
import { getEntityName } from './EntityUtils';
import { stringToHTML } from './StringsUtils';

const { Text } = Typography;

export interface EntityNameProps {
  name?: string;
  displayName?: string;
}

export type SummaryListItem = Column | Field | Chart | Task | MlFeature;

export interface ListItemHighlights {
  highlightedTags?: BasicEntityInfo['tags'];
  highlightedTitle?: string;
  highlightedDescription?: string;
}

/* @param {
    listItem: SummaryItem,
    highlightedTitle: will be a string if the title of given summaryItem is present in highlights | undefined
}

    @return SummaryItemTitle
*/
export const getTitle = (
  listItem: SummaryListItem,
  highlightedTitle?: ListItemHighlights['highlightedTitle']
): JSX.Element | JSX.Element[] => {
  const title = highlightedTitle
    ? stringToHTML(highlightedTitle)
    : getEntityName(listItem) || NO_DATA_PLACEHOLDER;
  const sourceUrl = (listItem as Chart | Task).sourceUrl;

  return sourceUrl ? (
    <Link target="_blank" to={{ pathname: sourceUrl }}>
      <div className="d-flex">
        <Text
          className="entity-title text-link-color font-medium m-r-xss"
          data-testid="entity-title"
          ellipsis={{ tooltip: true }}>
          {title}
        </Text>
        <IconExternalLink width={12} />
      </div>
    </Link>
  ) : (
    <Text className="entity-title" data-testid="entity-title">
      {title}
    </Text>
  );
};

/* @param {
    entityType: will be any type of SummaryEntityType,
    listItem: SummaryItem
}
    @return listItemType
*/
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

/*
    @params {
        sortTagsBasedOnGivenTagFQNs: array of TagFQNs,
        tags: Tags array,
    }

    @return array of tags highlighted and sorted if tagFQN present in sortTagsBasedOnGivenTagFQNs
*/
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

/* 
    @param {highlights: all the other highlights come from the query api
        only omitted displayName and description key as it is already updated in parent component
    }

    @return {
        listHighlights: single array of all highlights get from query api 
        listHighlightsMap: to reduce the search time complexity in listHighlight
    }

    Todo: apply highlights on entityData in parent where we apply highlight for entityDisplayName and entityDescription
    for that we need to update multiple summary components
*/
export const getMapOfListHighlights = (
  highlights?: SearchedDataProps['data'][number]['highlight']
): {
  listHighlights: string[];
  listHighlightsMap: { [key: string]: number };
} => {
  // checking for the all highlight key present in highlight get from query api
  // and create a array of highlights
  const listHighlights: string[] = [];
  SummaryListHighlightKeys.forEach((highlightKey) => {
    listHighlights.push(...get(highlights, highlightKey, []));
  });

  // using hashmap methodology to reduce the search time complexity from O(n) to O(1)
  // to get highlight from the listHighlights array for applying highlight
  const listHighlightsMap: { [key: string]: number } = {};

  listHighlights?.reduce((acc, colHighlight, index) => {
    acc[colHighlight.replaceAll(/<\/?span(.*?)>/g, '')] = index;

    return acc;
  }, listHighlightsMap);

  return { listHighlights, listHighlightsMap };
};

/*
    @params {
        listItem: SummaryItem
        tagsHighlights: tagFQNs array to highlight and sort tags
        listHighlights: single array of all highlights get from query api 
        listHighlightsMap: to reduce the search time complexity in listHighlight
    }
    @return highlights of listItem
*/
export const getHighlightOfListItem = (
  listItem: SummaryListItem,
  tagHighlights: string[],
  listHighlights: string[],
  listHighlightsMap: { [key: string]: number }
): ListItemHighlights => {
  let highlightedTags;
  let highlightedTitle;
  let highlightedDescription;

  // if any of the listItem.tags present in given tagHighlights list then sort and highlights the tag
  const shouldSortListItemTags = listItem.tags?.find((tag) =>
    tagHighlights.includes(tag.tagFQN)
  );

  if (shouldSortListItemTags) {
    highlightedTags = getSortedTagsWithHighlight(listItem.tags, tagHighlights);
  }

  // highlightedListItemNameIndex will be undefined if listItem.name is not present in highlights
  const highlightedListItemNameIndex = listHighlightsMap[listItem.name ?? ''];

  const shouldApplyHighlightOnTitle = !isUndefined(
    highlightedListItemNameIndex
  );

  if (shouldApplyHighlightOnTitle) {
    highlightedTitle = listHighlights[highlightedListItemNameIndex];
  }

  // highlightedListItemDescriptionIndex will be undefined if listItem.description is not present in highlights
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

/*
    @params {
        entityType: SummaryEntityType,
        entityInfo: Array<SummaryListItem> = [],
        highlights: highlights get from the query api + highlights added for tags (i.e. tag.name)
        tableConstraints: only pass for SummayEntityType.Column
    }
    @return sorted and highlighted listItem array, but listItem will be type of BasicEntityInfo
    
    Note: SummaryItem will be sort and highlight only if -
        # if listItem.tags present in highlights.tags
        # if listItem.name present in highlights comes from query api
        # if listItem.description present in highlights comes from query api
*/
export const getFormattedEntityData = (
  entityType: SummaryEntityType,
  entityInfo: Array<SummaryListItem> = [],
  highlights?: SearchedDataProps['data'][number]['highlight'],
  tableConstraints?: TableConstraint[]
): BasicEntityInfo[] => {
  if (isEmpty(entityInfo)) {
    return [];
  }

  // Only go ahead if entityType is present in SummaryEntityType enum
  if (Object.values(SummaryEntityType).includes(entityType)) {
    // tagHighlights is the array of tagFQNs for highlighting tags
    const tagHighlights = get(highlights, 'tag.name', [] as string[]);

    // listHighlights i.e. highlight get from query api
    // listHighlightsMap i.e. map of highlight get from api to reduce search time complexity in highlights array
    const { listHighlights, listHighlightsMap } =
      getMapOfListHighlights(highlights);

    const { highlightedListItem, remainingListItem } = entityInfo.reduce(
      (acc, listItem) => {
        // return the highlight of listItem
        const { highlightedTags, highlightedTitle, highlightedDescription } =
          getHighlightOfListItem(
            listItem,
            tagHighlights,
            listHighlights,
            listHighlightsMap
          );

        // convert listItem in BasicEntityInfo type
        const listItemModifiedData = {
          name: listItem.name ?? '',
          title: getTitle(listItem, highlightedTitle),
          type: getSummaryListItemType(entityType, listItem),
          tags: highlightedTags ?? listItem.tags,
          description: highlightedDescription ?? listItem.description,
          ...(entityType === SummaryEntityType.COLUMN && {
            columnConstraint: (listItem as Column).constraint,
            tableConstraints: tableConstraints,
          }),
          ...(entityType === SummaryEntityType.MLFEATURE && {
            algorithm: (listItem as MlFeature).featureAlgorithm,
          }),
          ...((entityType === SummaryEntityType.COLUMN ||
            entityType === SummaryEntityType.FIELD) && {
            children: getFormattedEntityData(
              entityType,
              (listItem as Column | Field).children,
              highlights
            ),
          }),
        };

        // if highlights present in listItem then sort the listItem
        if (highlightedTags || highlightedTitle || highlightedDescription) {
          acc.highlightedListItem.push(listItemModifiedData);
        } else {
          acc.remainingListItem.push(listItemModifiedData);
        }

        return acc;
      },
      {
        highlightedListItem: [] as BasicEntityInfo[],
        remainingListItem: [] as BasicEntityInfo[],
      }
    );

    return [...highlightedListItem, ...remainingListItem];
  }

  return [];
};
