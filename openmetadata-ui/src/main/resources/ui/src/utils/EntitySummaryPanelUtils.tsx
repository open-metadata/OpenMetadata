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
import { SummaryListHighlightKeysMap } from '../constants/EntitySummaryPanelUtils.constant';
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
  sortTagsBasedOnGivenArr,
  tags,
}: {
  sortTagsBasedOnGivenArr: string[];
  tags?: TagLabel[];
}): (TagLabel | HighlightedTagLabel)[] => {
  const ColumnDataTags: {
    tagForSort: HighlightedTagLabel[];
    remainingTags: TagLabel[];
  } = { tagForSort: [], remainingTags: [] };

  tags?.reduce((acc, tag) => {
    if (sortTagsBasedOnGivenArr?.includes(tag.tagFQN)) {
      acc.tagForSort.push({ ...tag, isHighlighted: true });
    } else {
      acc.remainingTags.push(tag);
    }

    return acc;
  }, ColumnDataTags);

  return [...ColumnDataTags.tagForSort, ...ColumnDataTags.remainingTags];
};

// sort and highlight summary list based on tags and global search
const sortAndHighlightSummaryList = (
  listHighlights: string[],
  entityType: SummaryEntityType,
  entityInfo?: Array<Column | Field | Chart | Task | MlFeature>,
  tableConstraints?: TableConstraint[],
  highlights?: SearchedDataProps['data'][number]['highlights']
) => {
  const tagHighlights = get(highlights, 'tag.name', []);

  const listHighlightsMap: { [key: string]: number } = {};
  listHighlights?.reduce((acc, colHighlight, index) => {
    acc[colHighlight.replaceAll(/<\/?span(.*?)>/g, '')] = index;

    return acc;
  }, listHighlightsMap);

  const EntityData = {
    entityWithSortOption: [] as BasicEntityInfo[],
    entityWithoutSortOption: [] as BasicEntityInfo[],
  };

  entityInfo?.reduce((acc, listItem) => {
    const listData = {
      name: listItem.name,
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
      tagHighlights?.includes(tag.tagFQN)
    );

    if (
      isTagHighlightsPresentInListItemTags ||
      !isUndefined(listHighlightsMap[listItem.name ?? '']) ||
      !isUndefined(listHighlightsMap[listItem.description ?? ''])
    ) {
      listData.tags = getSortedTagsWithHighlight({
        sortTagsBasedOnGivenArr: tagHighlights,
        tags: listItem.tags,
      });

      if (!isUndefined(listHighlightsMap[listItem.name ?? ''])) {
        listData.title = getTitle({
          content: stringToHTML(
            listHighlights[listHighlightsMap[listItem.name]]
          ),
          sourceUrl: listItem.sourceUrl,
        });
      }

      if (!isUndefined(listHighlightsMap[listItem.description ?? ''])) {
        listData.description =
          listHighlights[listHighlightsMap[listItem.description]];
      }

      acc.entityWithSortOption.push(listData);
    } else {
      acc.entityWithoutSortOption.push(listData);
    }

    return acc;
  }, EntityData);

  return [
    ...EntityData.entityWithSortOption,
    ...EntityData.entityWithoutSortOption,
  ];
};

export const getFormattedEntityData = (
  entityType: SummaryEntityType,
  entityInfo?: Array<Column | Field | Chart | Task | MlFeature>,
  tableConstraints?: TableConstraint[],
  highlights?: SearchedDataProps['data'][number]['highlights']
): BasicEntityInfo[] => {
  if (isEmpty(entityInfo)) {
    return [];
  }

  if (Object.values(SummaryEntityType).includes(entityType)) {
    const listHighlights: string[] = [];

    SummaryListHighlightKeysMap[entityType]?.forEach((highlightKey) => {
      listHighlights.push(...get(highlights, highlightKey, []));
    });

    return sortAndHighlightSummaryList(
      listHighlights,
      entityType,
      entityInfo,
      tableConstraints,
      highlights
    );
  } else {
    return [];
  }
};
