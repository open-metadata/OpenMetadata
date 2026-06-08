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

import { isString, omit } from 'lodash';
import type { EntityTags } from 'Models';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import type { Tag } from '../generated/entity/classification/tag';
import {
  TagSource,
  type AssetCertification,
  type Column,
} from '../generated/entity/data/table';
import { LabelType, State, type TagLabel } from '../generated/type/tagLabel';
import { getEntityName } from './EntityNameUtils';
import i18n from './i18next/LocalUtil';
import { getTagsWithoutTier } from './TablePureUtils';

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

export const getTagPlaceholder = (isGlossaryType: boolean): string =>
  isGlossaryType
    ? i18n.t('label.search-entity', {
        entity: i18n.t('label.glossary-term-plural'),
      })
    : i18n.t('label.search-entity', {
        entity: i18n.t('label.tag-plural'),
      });

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
