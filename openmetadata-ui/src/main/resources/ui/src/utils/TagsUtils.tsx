/*
 *  Copyright 2022 Collate.
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

import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Space, Tag as AntdTag, Tooltip, Typography } from 'antd';
import type { AxiosError } from 'axios';
import { isString, omit } from 'lodash';
import type { EntityTags } from 'Models';
import type { CustomTagProps } from 'rc-select/lib/BaseSelect';
import React from 'react';
import { ReactComponent as ClassificationIcon } from '../assets/svg/classification.svg';
import { ReactComponent as DeleteIcon } from '../assets/svg/ic-delete.svg';
import Loader from '../components/common/Loader/Loader';
import RichTextEditorPreviewerV1 from '../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { SettledStatus } from '../enums/Axios.enum';
import { SearchIndex } from '../enums/search.enum';
import type { Classification } from '../generated/entity/classification/classification';
import type { Tag } from '../generated/entity/classification/tag';
import type { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import {
  TagSource,
  type AssetCertification,
  type Column,
  type EntityReference,
} from '../generated/entity/data/table';
import type { Paging } from '../generated/type/paging';
import { LabelType, State, type TagLabel } from '../generated/type/tagLabel';
import { searchQuery } from '../rest/searchAPI';
import {
  getAllClassifications,
  getClassificationByName,
  getTags,
} from '../rest/tagAPI';
import { getEntityName } from './EntityUtils';
import { getQueryFilterToIncludeApprovedTerm } from './GlossaryUtils';
import i18n from './i18next/LocalUtil';
import { getTagsWithoutTier } from './TableUtils';

export const getClassifications = async (
  fields?: Array<string> | string,
  callGetClassificationByName = true
) => {
  try {
    const listOfClassifications: Array<Classification> = [];
    const classifications = await getAllClassifications({
      fields,
      limit: 1000,
    });
    const classificationList = classifications.data.map(
      (category: Classification) => {
        return {
          name: category.name,
          description: category.description,
        } as Classification;
      }
    );
    if (classificationList.length && callGetClassificationByName) {
      const promiseArr = classificationList.map((category: Classification) =>
        getClassificationByName(category.name, { fields })
      );

      const categories = await Promise.allSettled(promiseArr);

      categories.forEach((category) => {
        if (category.status === SettledStatus.FULFILLED) {
          listOfClassifications.push(category.value);
        }
      });
    }

    return Promise.resolve({ data: listOfClassifications });
  } catch (error) {
    return Promise.reject({ data: (error as AxiosError).response });
  }
};

/**
 * Return tags based on classifications
 * @param classifications -- Parent for tags
 * @param paging
 * @returns Tag[]
 */
export const getTaglist = async (
  classifications: Array<Classification> = [],
  paging?: Paging
) => {
  try {
    const tags: Tag[] = [];

    const tagsListPromise = classifications.map((classification) =>
      getTags({
        parent: classification.name,
        after: paging?.after,
        before: paging?.before,
        limit: 1000,
      })
    );

    return await Promise.allSettled(tagsListPromise)
      .then((tagList) => {
        tagList.forEach((tag) => {
          if (tag.status === SettledStatus.FULFILLED) {
            tags.push(...tag.value.data);
          }
        });

        return tags.map((tag) => tag.fullyQualifiedName || tag.name);
      })
      .catch((error) => {
        return Promise.reject({ data: (error as AxiosError).response });
      });
  } catch (error) {
    return Promise.reject({ data: (error as AxiosError).response });
  }
};

export const getTableTags = (
  columns: Array<Partial<Column>>
): Array<EntityTags> => {
  const flag: { [x: string]: boolean } = {};
  const uniqueTags: Array<EntityTags> = [];
  const tags = columns
    .map((column) => column.tags || [])
    .reduce((prev, curr) => prev.concat(curr), [])
    .map((tag) => tag);

  tags.forEach((elem) => {
    if (!flag[elem.tagFQN]) {
      flag[elem.tagFQN] = true;
      uniqueTags.push(elem);
    }
  });

  return uniqueTags;
};

//  Will return tag with ellipses if it exceeds the limit
export const getTagDisplay = (tag?: string) => {
  const tagLevelsArray = tag?.split(FQN_SEPARATOR_CHAR) ?? [];

  if (tagLevelsArray.length > 3) {
    return `${tagLevelsArray[0]}...${tagLevelsArray
      .slice(-2)
      .join(FQN_SEPARATOR_CHAR)}`;
  }

  return tag;
};

export const getTagTooltip = (fqn: string, description?: string) => (
  <div className="text-left p-xss">
    <div className="m-b-xs">
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant={false}
        markdown={`**${fqn}**\n${description ?? ''}`}
        textVariant="white"
      />
    </div>
  </div>
);

export const getDeleteIcon = (arg: {
  deleteTagId?: string;
  id: string;
  status?: string;
}) => {
  const { deleteTagId, id, status } = arg;
  if (deleteTagId === id) {
    if (status === 'success') {
      return <CheckOutlined data-testid="check-outline" />;
    }

    return <Loader size="small" type="default" />;
  }

  return <DeleteIcon data-testid="delete-icon" name="Delete" width={14} />;
};

// Re-exports from TagsPureUtils (backward compat)
export {
  getExcludedIndexesBasedOnEntityTypeEditTagPermission,
  getQueryFilterToExcludeTermsAndEntities,
  getTagAssetsQueryFilter,
  getTagRedirectLink,
  getUsageCountLink,
} from './TagsPureUtils';

export const getTagPlaceholder = (isGlossaryType: boolean): string =>
  isGlossaryType
    ? i18n.t('label.search-entity', {
        entity: i18n.t('label.glossary-term-plural'),
      })
    : i18n.t('label.search-entity', {
        entity: i18n.t('label.tag-plural'),
      });

export const tagRender = (customTagProps: CustomTagProps) => {
  const { label, onClose } = customTagProps;
  const tagLabel = isString(label) ? getTagDisplay(label) : label;

  const onPreventMouseDown = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <AntdTag
      closable
      className="text-sm flex-center m-r-xss p-r-xss m-y-2 border-light-gray"
      closeIcon={
        <CloseOutlined data-testid="remove-tags" height={8} width={8} />
      }
      data-testid={`selected-tag-${tagLabel}`}
      onClose={onClose}
      onMouseDown={onPreventMouseDown}>
      <Tooltip
        className="cursor-pointer"
        mouseEnterDelay={1.5}
        placement="topLeft"
        title={getTagTooltip(label as string)}
        trigger="hover">
        <Typography.Paragraph className="m-0 d-inline-block break-all whitespace-normal">
          {tagLabel}
        </Typography.Paragraph>
      </Tooltip>
    </AntdTag>
  );
};

export type ResultType = {
  label: string;
  value: string;
  data: Tag;
};

export const fetchGlossaryList = async (
  searchQueryParam: string,
  page: number
): Promise<{
  data: {
    label: string;
    value: string;
    data: GlossaryTerm;
  }[];
  paging: Paging;
}> => {
  const glossaryResponse = await searchQuery({
    query: searchQueryParam ? `*${searchQueryParam}*` : '*',
    pageNumber: page,
    pageSize: 10,
    queryFilter: getQueryFilterToIncludeApprovedTerm(),
    searchIndex: SearchIndex.GLOSSARY_TERM,
  });

  const hits = glossaryResponse.hits.hits;

  return {
    data: hits.map(({ _source }) => ({
      label: _source.fullyQualifiedName ?? '',
      value: _source.fullyQualifiedName ?? '',
      data: _source,
    })),
    paging: {
      total: glossaryResponse.hits.total.value,
    },
  };
};

export const createTierTag = (tag: Tag) => {
  return {
    displayName: tag.displayName,
    name: tag.name,
    description: tag.description,
    tagFQN: tag.fullyQualifiedName,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  };
};

export const createCertificationTag = (tag: Tag) => {
  return {
    tagLabel: {
      displayName: tag.displayName,
      name: tag.name,
      href: tag.href,
      description: tag.description,
      tagFQN: tag.fullyQualifiedName,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
  };
};
export const updateTierTag = (oldTags: Tag[] | TagLabel[], newTier?: Tag) => {
  return newTier
    ? [...getTagsWithoutTier(oldTags), createTierTag(newTier)]
    : getTagsWithoutTier(oldTags);
};

export const updateCertificationTag = (
  newCertification?: Tag
): AssetCertification | undefined => {
  if (!newCertification) {
    return undefined;
  }

  return {
    tagLabel: {
      tagFQN: newCertification.fullyQualifiedName || '',
      name: newCertification.name,
      displayName: newCertification.displayName,
      description: newCertification.description || '',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
      style: newCertification.style,
    },
    appliedDate: Date.now(),
    expiryDate: Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days from now
  };
};

export const createTagObject = (tags: EntityTags[]) => {
  return tags.map(
    (tag) =>
      ({
        ...omit(tag, 'isRemovable'),
        state: State.Confirmed,
        source: tag.source,
        tagFQN: tag.tagFQN,
      } as TagLabel)
  );
};

/**
 * Check if a tag is a glossary tag
 */
export const isGlossaryTag = (tag: EntityTags): boolean => {
  return tag.source === TagSource.Glossary;
};

/**
 * Get the display name for a tag
 */
export const getTagName = (tag: EntityTags, showOnlyName?: boolean): string => {
  return (
    getEntityName(tag) ||
    getTagDisplay(
      showOnlyName
        ? tag.tagFQN
            .split(FQN_SEPARATOR_CHAR)
            .slice(-2)
            .join(FQN_SEPARATOR_CHAR)
        : tag.tagFQN
    ) ||
    tag.tagFQN
  );
};

export const getGlossaryTags = (tags: TagLabel[] | undefined): TagLabel[] =>
  tags?.filter((tag) => tag.source === TagSource.Glossary) ?? [];

export const getClassificationTags = (
  tags: TagLabel[] | undefined
): TagLabel[] =>
  tags?.filter((tag) => tag.source === TagSource.Classification) ?? [];

export const TagListItemRenderer = (props: EntityReference) => {
  return (
    <Space>
      <ClassificationIcon className="d-block'" height={22} width={16} />
      <Typography.Text>{getEntityName(props)}</Typography.Text>
    </Space>
  );
};

export const getTagValue = (tag: string | TagLabel): string | TagLabel => {
  if (isString(tag)) {
    return tag.startsWith(`Tier${FQN_SEPARATOR_CHAR}`)
      ? tag.split(FQN_SEPARATOR_CHAR)[1]
      : tag;
  } else {
    return {
      ...tag,
      tagFQN: tag.tagFQN.startsWith(`Tier${FQN_SEPARATOR_CHAR}`)
        ? tag.tagFQN.split(FQN_SEPARATOR_CHAR)[1]
        : tag.tagFQN,
    };
  }
};
