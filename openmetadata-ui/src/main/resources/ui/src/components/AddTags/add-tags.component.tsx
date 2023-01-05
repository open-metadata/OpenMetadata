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

import { Select } from 'antd';
import { EntityTags, TagOption } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { getAllTagsForOptions, getTagOptions } from '../../utils/TagsUtils';

export const AddTags = ({
  setTags,
}: {
  selectedTags?: Array<EntityTags>;
  setTags?: (tags: EntityTags[]) => void;
}) => {
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [tagList, setTagList] = useState<Array<string | TagOption>>([]);
  const [selectedTags, setSelectedTags] = useState<Array<EntityTags>>([]);

  const { t } = useTranslation();
  const options: React.ReactNode[] = [];

  const fetchTags = async () => {
    setIsTagLoading(true);
    const tags = await getAllTagsForOptions();
    setTagList(tags.map((t) => t.fullyQualifiedName || t.name));

    setIsTagLoading(false);
  };

  const tagsList = useMemo(() => {
    const newTags = (tagList as string[])
      .filter((tag) => !tag.startsWith(`Tier${FQN_SEPARATOR_CHAR}Tier`)) // To filter out Tier tags
      .map((tag) => {
        return {
          label: tag,
          value: tag,
        };
      });

    return newTags;
  }, [tagList]);

  const onClickSelect = useCallback(() => {
    fetchTags();
  }, []);

  const handleChange = useCallback((value: string[]) => {
    setSelectedTags && setSelectedTags(value);
  }, []);

  tagsList.forEach((tag) =>
    options.push(<Select.Option key={tag.label}>{tag.value}</Select.Option>)
  );

  useEffect(() => {
    const tags = getTagOptions(selectedTags);

    setTags?.(tags);
  }, [selectedTags]);

  return (
    <Select
      loading={isTagLoading}
      mode="multiple"
      placeholder={t('label.add-entity', {
        entity: t('label.tag-plural'),
      })}
      style={{ width: '100%' }}
      value={selectedTags}
      onChange={handleChange}
      onClick={onClickSelect}>
      {options}
    </Select>
  );
};
