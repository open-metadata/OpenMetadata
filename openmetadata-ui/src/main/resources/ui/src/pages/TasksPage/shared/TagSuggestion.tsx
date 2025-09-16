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

import { DefaultOptionType, SelectProps } from 'antd/lib/select';

import { isArray, isEmpty } from 'lodash';
import { EntityTags } from 'Models';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import AsyncSelectList from '../../../components/common/AsyncSelectList/AsyncSelectList';
import { SelectOption } from '../../../components/common/AsyncSelectList/AsyncSelectList.interface';
import TreeAsyncSelectList from '../../../components/common/AsyncSelectList/TreeAsyncSelectList';
import { TagSource } from '../../../generated/entity/data/container';
import { TagLabel } from '../../../generated/type/tagLabel';
import tagClassBase from '../../../utils/TagClassBase';
import { fetchGlossaryList } from '../../../utils/TagsUtils';

export interface TagSuggestionProps {
  placeholder?: string;
  tagType?: TagSource;
  value?: TagLabel[];
  initialOptions?: SelectOption[];
  onChange?: (newTags: TagLabel[]) => void;
  selectProps?: SelectProps;
  isTreeSelect?: boolean;
  hasNoActionButtons?: boolean;
  open?: boolean;
  newLook?: boolean;
  autoFocus?: boolean;
  dropdownContainerRef?: React.RefObject<HTMLDivElement>;
}

const TagSuggestion: React.FC<TagSuggestionProps> = ({
  onChange,
  value,
  placeholder,
  initialOptions,
  tagType = TagSource.Classification,
  selectProps,
  isTreeSelect = false,
  hasNoActionButtons = false,
  open = true,
  newLook,
  autoFocus = false,
  dropdownContainerRef,
}) => {
  const isGlossaryType = useMemo(
    () => tagType === TagSource.Glossary,
    [tagType]
  );

  const { t } = useTranslation();

  const handleTagSelection = (
    newValue: DefaultOptionType | DefaultOptionType[]
  ) => {
    if (isArray(newValue)) {
      let newTags: EntityTags[] = [];
      if (!isEmpty(newValue)) {
        newTags = newValue.reduce((acc, tag) => {
          const oldTag = value?.find((oldTag) => oldTag.tagFQN === tag.value);
          if (oldTag) {
            return [...acc, oldTag];
          }
          let tagData: EntityTags = {
            tagFQN: tag.value,
            source: isGlossaryType
              ? TagSource.Glossary
              : TagSource.Classification,
          };

          if (tag.data) {
            tagData = {
              ...tagData,
              name: tag.data?.name,
              displayName: tag.data?.displayName,
              description: tag.data?.description,
              style: tag.data?.style,
            };
          }

          return [...acc, tagData];
        }, [] as EntityTags[]);
      }

      onChange?.(newTags);
    }
  };

  const commonProps = {
    fetchOptions: isGlossaryType ? fetchGlossaryList : tagClassBase.getTags,
    initialOptions,
    ...selectProps,
    mode: 'multiple' as const,
    placeholder:
      placeholder ??
      t('label.select-field', {
        field: t('label.tag-plural'),
      }),
    value: value?.map((item) => item.tagFQN) ?? [],
    onChange: handleTagSelection,
    newLook,
    autoFocus,
    dropdownContainerRef,
  };

  return isTreeSelect ? (
    <TreeAsyncSelectList
      {...commonProps}
      hasNoActionButtons={hasNoActionButtons}
      open={open}
    />
  ) : (
    <AsyncSelectList {...commonProps} />
  );
};

export default TagSuggestion;
