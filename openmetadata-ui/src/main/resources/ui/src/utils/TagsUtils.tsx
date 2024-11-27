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
import { Tag as AntdTag, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import i18next from 'i18next';
import { omit } from 'lodash';
import { EntityTags } from 'Models';
import type { CustomTagProps } from 'rc-select/lib/BaseSelect';
import React from 'react';
import { ReactComponent as DeleteIcon } from '../assets/svg/ic-delete.svg';
import Loader from '../components/common/Loader/Loader';
import RichTextEditorPreviewer from '../components/common/RichTextEditor/RichTextEditorPreviewer';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { getExplorePath } from '../constants/constants';
import {
  ResourceEntity,
  UIPermission,
} from '../context/PermissionProvider/PermissionProvider.interface';
import { SettledStatus } from '../enums/Axios.enum';
import { EntityType } from '../enums/entity.enum';
import { ExplorePageTabs } from '../enums/Explore.enum';
import { SearchIndex } from '../enums/search.enum';
import { Classification } from '../generated/entity/classification/classification';
import { Tag } from '../generated/entity/classification/tag';
import { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import { Column } from '../generated/entity/data/table';
import { Operation } from '../generated/entity/policies/policy';
import { Paging } from '../generated/type/paging';
import { LabelType, State, TagLabel } from '../generated/type/tagLabel';
import { searchQuery } from '../rest/searchAPI';
import {
  getAllClassifications,
  getClassificationByName,
  getTags,
} from '../rest/tagAPI';
import { getQueryFilterToIncludeApprovedTerm } from './GlossaryUtils';
import { checkPermissionEntityResource } from './PermissionsUtils';
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
      <RichTextEditorPreviewer
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

  return <DeleteIcon data-testid="delete-icon" name="Delete" width={16} />;
};

export const getUsageCountLink = (tagFQN: string) => {
  const type = tagFQN.startsWith('Tier') ? 'tier' : 'tags';

  return getExplorePath({
    tab: ExplorePageTabs.TABLES,
    extraParameters: {
      page: '1',
      quickFilter: JSON.stringify({
        query: {
          bool: {
            must: [
              {
                bool: {
                  should: [{ term: { [`${type}.tagFQN`]: tagFQN } }],
                },
              },
            ],
          },
        },
      }),
    },
    isPersistFilters: false,
  });
};

export const getTagPlaceholder = (isGlossaryType: boolean): string =>
  isGlossaryType
    ? i18next.t('label.search-entity', {
        entity: i18next.t('label.glossary-term-plural'),
      })
    : i18next.t('label.search-entity', {
        entity: i18next.t('label.tag-plural'),
      });

export const tagRender = (customTagProps: CustomTagProps) => {
  const { label, onClose } = customTagProps;
  const tagLabel = getTagDisplay(label as string);

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

export const updateTierTag = (oldTags: Tag[] | TagLabel[], newTier?: Tag) => {
  return newTier
    ? [...getTagsWithoutTier(oldTags), createTierTag(newTier)]
    : getTagsWithoutTier(oldTags);
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

export const getQueryFilterToExcludeTermsAndEntities = (
  fqn: string,
  excludeEntityIndex: string[] = []
) => ({
  query: {
    bool: {
      must: [
        {
          bool: {
            must_not: [
              {
                term: {
                  'tags.tagFQN': fqn,
                },
              },
            ],
          },
        },
        {
          bool: {
            must_not: [
              {
                term: {
                  entityType: EntityType.TAG,
                },
              },
              {
                term: {
                  entityType: EntityType.DATA_PRODUCT,
                },
              },
            ],
          },
        },
        {
          bool: {
            must_not: [
              {
                terms: {
                  _index: excludeEntityIndex,
                },
              },
            ],
          },
        },
      ],
    },
  },
});

export const getExcludedIndexesBasedOnEntityTypeEditTagPermission = (
  permissions: UIPermission
) => {
  const entityPermission = {
    [SearchIndex.TABLE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.TABLE,
      permissions
    ),
    [SearchIndex.TOPIC]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.TOPIC,
      permissions
    ),
    [SearchIndex.DASHBOARD]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.DASHBOARD,
      permissions
    ),
    [SearchIndex.MLMODEL]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.ML_MODEL,
      permissions
    ),
    [SearchIndex.PIPELINE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.PIPELINE,
      permissions
    ),
    [SearchIndex.CONTAINER]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.CONTAINER,
      permissions
    ),
    [SearchIndex.SEARCH_INDEX]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.SEARCH_INDEX,
      permissions
    ),
    [SearchIndex.API_SERVICE_INDEX]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.API_SERVICE,
      permissions
    ),
    [SearchIndex.API_ENDPOINT_INDEX]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.API_ENDPOINT,
      permissions
    ),
    [SearchIndex.API_COLLECTION_INDEX]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.API_COLLECTION,
      permissions
    ),
    [SearchIndex.DASHBOARD_DATA_MODEL]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.DASHBOARD_DATA_MODEL,
      permissions
    ),
    [SearchIndex.STORED_PROCEDURE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.STORED_PROCEDURE,
      permissions
    ),
    [SearchIndex.DATABASE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.DATABASE,
      permissions
    ),
    [SearchIndex.DATABASE_SERVICE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.DATABASE_SERVICE,
      permissions
    ),
    [SearchIndex.DATABASE_SCHEMA]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.DATABASE_SCHEMA,
      permissions
    ),
    [SearchIndex.MESSAGING_SERVICE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.PIPELINE_SERVICE,
      permissions
    ),
    [SearchIndex.DASHBOARD_SERVICE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.DASHBOARD_SERVICE,
      permissions
    ),
    [SearchIndex.ML_MODEL_SERVICE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.ML_MODEL_SERVICE,
      permissions
    ),
    [SearchIndex.PIPELINE_SERVICE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.PIPELINE_SERVICE,
      permissions
    ),
    [SearchIndex.STORAGE_SERVICE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.STORAGE_SERVICE,
      permissions
    ),
    [SearchIndex.SEARCH_SERVICE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.SEARCH_SERVICE,
      permissions
    ),
  };

  return (Object.keys(entityPermission) as SearchIndex[]).reduce(
    (
      acc: {
        entitiesHavingPermission: SearchIndex[];
        entitiesNotHavingPermission: SearchIndex[];
      },
      cv: SearchIndex
    ) => {
      const currentEntityPermission =
        entityPermission[cv as keyof typeof entityPermission];
      if (currentEntityPermission) {
        return {
          ...acc,
          entitiesHavingPermission: [...acc.entitiesHavingPermission, cv],
        };
      }

      return {
        ...acc,
        entitiesNotHavingPermission: [...acc.entitiesNotHavingPermission, cv],
      };
    },
    {
      entitiesHavingPermission: [],
      entitiesNotHavingPermission: [],
    }
  );
};

export const getTagAssetsQueryFilter = (fqn: string) => {
  if (fqn.includes('Tier.')) {
    return `(tier.tagFQN:"${fqn}")`;
  } else if (fqn.includes('Certification.')) {
    return `(certification.tagLabel.tagFQN:"${fqn}")`;
  } else {
    return `(tags.tagFQN:"${fqn}")`;
  }
};
