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
import { BasicEntityInfo } from '../components/Explore/EntitySummaryPanel/SummaryList/SummaryList.interface';
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

export interface HighlightedTagLabel extends TagLabel {
  isHighlighted: boolean;
}

const getTitleName = (data: EntityNameProps) =>
  getEntityName(data) || NO_DATA_PLACEHOLDER;

const getTitle = ({
  content,
  sourceUrl,
}: {
  content: string | JSX.Element | JSX.Element[];
  sourceUrl: string;
}) => {
  return sourceUrl ? (
    <Link target="_blank" to={{ pathname: sourceUrl }}>
      <div className="d-flex">
        <Text
          className="entity-title text-link-color font-medium m-r-xss"
          data-testid="entity-title"
          ellipsis={{ tooltip: true }}>
          {content}
        </Text>
        <IconExternalLink width={12} />
      </div>
    </Link>
  ) : (
    <Text className="entity-title" data-testid="entity-title">
      {content}
    </Text>
  );
};

export const getSortedTagsWithHighlight = ({
  sortTagsBasedOnGivenTagFQNs,
  tags,
}: {
  sortTagsBasedOnGivenTagFQNs: string[];
  tags?: TagLabel[];
}): (TagLabel | HighlightedTagLabel)[] => {
  const ColumnDataTags: {
    tagForSort: HighlightedTagLabel[];
    remainingTags: TagLabel[];
  } = { tagForSort: [], remainingTags: [] };

  tags?.reduce((acc, tag) => {
    if (sortTagsBasedOnGivenTagFQNs.includes(tag.tagFQN)) {
      acc.tagForSort.push({ ...tag, isHighlighted: true });
    } else {
      acc.remainingTags.push(tag);
    }

    return acc;
  }, ColumnDataTags);

  return [...ColumnDataTags.tagForSort, ...ColumnDataTags.remainingTags];
};

export const getFormattedEntityData = (
  entityType: SummaryEntityType,
  entityInfo?: Array<Column | Field | Chart | Task | MlFeature>,
  tableConstraints?: TableConstraint[],
  highlights?: SearchedDataProps['data'][number]['highlight']
): BasicEntityInfo[] => {
  if (isEmpty(entityInfo)) {
    return [];
  }

  // sort and highlights list items based on tags and global search highlights data
  if (Object.values(SummaryEntityType).includes(entityType)) {
    const tagHighlights = get(highlights, 'tag.name', []);
    const listHighlights: string[] = [];
    const listHighlightsMap: { [key: string]: number } = {};
    const SummaryListData = {
      listItemWithSortOption: [] as BasicEntityInfo[],
      listItemWithoutSortOption: [] as BasicEntityInfo[],
    };

    SummaryListHighlightKeys.forEach((highlightKey) => {
      listHighlights.push(...get(highlights, highlightKey, []));
    });

    listHighlights?.reduce((acc, colHighlight, index) => {
      acc[colHighlight.replaceAll(/<\/?span(.*?)>/g, '')] = index;

      return acc;
    }, listHighlightsMap);

    entityInfo?.reduce((acc, listItem) => {
      const listItemModifiedData = {
        name: listItem.name || '',
        title: getTitle({
          content: getTitleName(listItem),
          sourceUrl: listItem.sourceUrl,
        }),
        type: listItem.dataType ?? listItem.chatType ?? listItem.taskType,
        tags: listItem.tags,
        description: listItem.description,
        ...(entityType === SummaryEntityType.COLUMN && {
          columnConstraint: listItem.constraint,
          tableConstraints: tableConstraints,
        }),
        ...(entityType === SummaryEntityType.MLFEATURE && {
          algorithm: listItem.featureAlgorithm,
        }),
        children: getFormattedEntityData(
          entityType,
          listItem.children,
          undefined,
          highlights
        ),
      };

      const isTagHighlightsPresentInListItemTags = listItem.tags?.find((tag) =>
        tagHighlights.includes(tag.tagFQN)
      );

      const highlightedListItemNameIndex =
        listHighlightsMap[listItem.name ?? ''];
      const highlightedListItemDescriptionIndex =
        listHighlightsMap[listItem.description ?? ''];

      if (
        isTagHighlightsPresentInListItemTags ||
        !isUndefined(highlightedListItemNameIndex) ||
        !isUndefined(highlightedListItemDescriptionIndex)
      ) {
        if (isTagHighlightsPresentInListItemTags) {
          listItemModifiedData.tags = getSortedTagsWithHighlight({
            sortTagsBasedOnGivenTagFQNs: tagHighlights,
            tags: listItem.tags,
          });
        }

        if (!isUndefined(highlightedListItemNameIndex)) {
          listItemModifiedData.title = getTitle({
            content: stringToHTML(listHighlights[highlightedListItemNameIndex]),
            sourceUrl: listItem.sourceUrl,
          });
        }

        if (!isUndefined(highlightedListItemDescriptionIndex)) {
          listItemModifiedData.description =
            listHighlights[highlightedListItemDescriptionIndex];
        }

        acc.listItemWithSortOption.push(listItemModifiedData);
      } else {
        acc.listItemWithoutSortOption.push(listItemModifiedData);
      }

      return acc;
    }, SummaryListData);

    return [
      ...SummaryListData.listItemWithSortOption,
      ...SummaryListData.listItemWithoutSortOption,
    ];
  } else {
    return [];
  }
};
