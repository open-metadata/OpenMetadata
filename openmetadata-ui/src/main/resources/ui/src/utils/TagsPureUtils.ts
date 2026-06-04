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
import { isString, omit } from 'lodash';
import type { EntityTags } from 'Models';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import {
  ResourceEntity,
  type UIPermission,
} from '../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../enums/entity.enum';
import { ExplorePageTabs } from '../enums/Explore.enum';
import type { Tag } from '../generated/entity/classification/tag';
import type {
  AssetCertification,
  Column,
} from '../generated/entity/data/table';
import { TagSource } from '../generated/entity/data/table';
import { Operation } from '../generated/entity/policies/policy';
import { LabelType, State, TagLabel } from '../generated/type/tagLabel';
import { getEntityName } from './EntityUtils';
import i18n from './i18next/LocalUtil';
import { checkPermissionEntityResource } from './PermissionsUtils';
import {
  getClassificationTagPath,
  getExplorePath,
  getGlossaryPath,
} from './RouterUtils';
import { getTermQuery } from './SearchPureUtils';
import { getTagsWithoutTier } from './TableUtils';

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

export const getTagDisplay = (tag?: string) => {
  const tagLevelsArray = tag?.split(FQN_SEPARATOR_CHAR) ?? [];

  if (tagLevelsArray.length > 3) {
    return `${tagLevelsArray[0]}...${tagLevelsArray
      .slice(-2)
      .join(FQN_SEPARATOR_CHAR)}`;
  }

  return tag;
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
    ? i18n.t('label.search-entity', {
        entity: i18n.t('label.glossary-term-plural'),
      })
    : i18n.t('label.search-entity', {
        entity: i18n.t('label.tag-plural'),
      });

export type ResultType = {
  label: string;
  value: string;
  data: Tag;
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
    expiryDate: Date.now() + 90 * 24 * 60 * 60 * 1000,
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
                terms: {
                  entityType: [
                    EntityType.CLASSIFICATION,
                    EntityType.TEST_SUITE,
                    EntityType.TEST_CASE,
                    EntityType.TEST_CASE_RESOLUTION_STATUS,
                    EntityType.TEST_CASE_RESULT,
                    EntityType.TAG,
                    EntityType.DATA_PRODUCT,
                    ...excludeEntityIndex,
                  ],
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
    [EntityType.TABLE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.TABLE,
      permissions,
      true
    ),
    [EntityType.TOPIC]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.TOPIC,
      permissions,
      true
    ),
    [EntityType.DASHBOARD]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.DASHBOARD,
      permissions,
      true
    ),
    [EntityType.MLMODEL]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.ML_MODEL,
      permissions,
      true
    ),
    [EntityType.PIPELINE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.PIPELINE,
      permissions,
      true
    ),
    [EntityType.CONTAINER]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.CONTAINER,
      permissions,
      true
    ),
    [EntityType.SEARCH_INDEX]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.SEARCH_INDEX,
      permissions,
      true
    ),
    [EntityType.API_SERVICE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.API_SERVICE,
      permissions,
      true
    ),
    [EntityType.API_ENDPOINT]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.API_ENDPOINT,
      permissions,
      true
    ),
    [EntityType.API_COLLECTION]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.API_COLLECTION,
      permissions,
      true
    ),
    [EntityType.DASHBOARD_DATA_MODEL]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.DASHBOARD_DATA_MODEL,
      permissions,
      true
    ),
    [EntityType.STORED_PROCEDURE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.STORED_PROCEDURE,
      permissions,
      true
    ),
    [EntityType.DATABASE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.DATABASE,
      permissions,
      true
    ),
    [EntityType.DATABASE_SERVICE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.DATABASE_SERVICE,
      permissions,
      true
    ),
    [EntityType.DATABASE_SCHEMA]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.DATABASE_SCHEMA,
      permissions,
      true
    ),
    [EntityType.MESSAGING_SERVICE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.PIPELINE_SERVICE,
      permissions,
      true
    ),
    [EntityType.DASHBOARD_SERVICE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.DASHBOARD_SERVICE,
      permissions,
      true
    ),
    [EntityType.MLMODEL_SERVICE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.ML_MODEL_SERVICE,
      permissions,
      true
    ),
    [EntityType.PIPELINE_SERVICE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.PIPELINE_SERVICE,
      permissions,
      true
    ),
    [EntityType.STORAGE_SERVICE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.STORAGE_SERVICE,
      permissions,
      true
    ),
    [EntityType.SEARCH_SERVICE]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.SEARCH_SERVICE,
      permissions,
      true
    ),
    [EntityType.GLOSSARY]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.GLOSSARY,
      permissions,
      true
    ),
    [EntityType.GLOSSARY_TERM]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.GLOSSARY_TERM,
      permissions,
      true
    ),
    [EntityType.DOMAIN]: checkPermissionEntityResource(
      Operation.EditTags,
      ResourceEntity.DOMAIN,
      permissions,
      true
    ),
  };

  return (Object.keys(entityPermission) as EntityType[]).reduce(
    (
      acc: {
        entitiesHavingPermission: EntityType[];
        entitiesNotHavingPermission: EntityType[];
      },
      cv: EntityType
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
  let fieldName = 'tags.tagFQN';

  if (fqn.startsWith(`Tier${FQN_SEPARATOR_CHAR}`)) {
    fieldName = 'tier.tagFQN';
  } else if (fqn.startsWith(`Certification${FQN_SEPARATOR_CHAR}`)) {
    fieldName = 'certification.tagLabel.tagFQN';
  }

  return getTermQuery({ [fieldName]: fqn });
};

export const isGlossaryTag = (tag: EntityTags): boolean => {
  return tag.source === TagSource.Glossary;
};

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

export const getTagRedirectLink = (
  tag: EntityTags,
  tagType?: TagSource
): string => {
  return (tagType ?? tag.source) === TagSource.Glossary
    ? getGlossaryPath(tag.tagFQN)
    : getClassificationTagPath(tag.tagFQN);
};

export const getGlossaryTags = (tags: TagLabel[] | undefined): TagLabel[] =>
  tags?.filter((tag) => tag.source === TagSource.Glossary) ?? [];

export const getClassificationTags = (
  tags: TagLabel[] | undefined
): TagLabel[] =>
  tags?.filter((tag) => tag.source === TagSource.Classification) ?? [];

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
