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

import { Select, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import Loader from 'components/Loader/Loader';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { t } from 'i18next';
import { isEmpty } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { getAllTagsForOptions } from 'utils/TagsUtils';
import { TagLabel } from '../../../generated/type/tagLabel';
import Fqn from '../../../utils/Fqn';
import { showErrorToast } from '../../../utils/ToastUtils';

interface TagSuggestionProps {
  onChange?: (newTags: TagLabel[]) => void;
  value?: TagLabel[];
}

const TagSuggestion: React.FC<TagSuggestionProps> = ({ onChange, value }) => {
  const [tagList, setTagList] = useState<Array<TagOption>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [_, setTags] = useState<Array<EntityTags>>(value || []);
  const [defaultActiveItem, setDefaultActive] = useState<string[]>([]);

  const tagOptions = useMemo(() => {
    const newTags = tagList
      .filter((tag) => !tag.fqn?.startsWith(`Tier${FQN_SEPARATOR_CHAR}Tier`)) // To filter out Tier tags
      .map((tag) => {
        const parts = Fqn.split(tag.fqn);
        const lastPartOfTag = parts.slice(-1).join(FQN_SEPARATOR_CHAR);
        parts.pop();

        return {
          label: tag.fqn,
          displayName: (
            <Space className="w-full" direction="vertical" size={0}>
              <Typography.Paragraph
                ellipsis
                className="text-grey-muted m-0 p-0">
                {parts.join(FQN_SEPARATOR_CHAR)}
              </Typography.Paragraph>
              <Typography.Text ellipsis>{lastPartOfTag}</Typography.Text>
            </Space>
          ),
          value: tag.fqn,
        };
      });

    return newTags;
  }, [tagList]);

  const fetchTags = async () => {
    setIsTagLoading(true);
    try {
      const tags = await getAllTagsForOptions();
      setTagList(
        tags.map((tag) => {
          return {
            fqn: tag.fullyQualifiedName ?? tag.name,
            source: 'Classification',
          };
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsTagLoading(false);
    }
  };

  const handleTagSelection = (selectedTag: string[]) => {
    let newTags = [];
    if (!isEmpty(selectedTag)) {
      newTags = selectedTag.map((t) => {
        return {
          tagFQN: t,
          source: tagList.find((tag) => tag.fqn === t)?.source,
        } as EntityTags;
      });
    }
    setTags(newTags);
    onChange && onChange(newTags);
  };

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    setTags(value || []);
    setDefaultActive(value?.map((item) => item.tagFQN) || []);
  }, [value]);

  if (isTagLoading) {
    return <Loader size="small" />;
  }

  return (
    <Select
      className="w-full"
      data-testid="tag-selector"
      defaultValue={defaultActiveItem}
      mode="multiple"
      optionLabelProp="label"
      placeholder={t('label.select-field', {
        field: t('label.tag-plural'),
      })}
      onChange={handleTagSelection}>
      {tagOptions.map(({ label, value, displayName }) => (
        <Select.Option key={label} value={value}>
          <Tooltip
            destroyTooltipOnHide
            placement="topLeft"
            title={label}
            trigger="hover">
            {displayName}
          </Tooltip>
        </Select.Option>
      ))}
    </Select>
  );
};

export default TagSuggestion;
