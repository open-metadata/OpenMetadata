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
import { Button, Select, Space, Tooltip } from 'antd';
import classNames from 'classnames';
import Tags from 'components/Tag/Tags/tags';
import { isEmpty } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, {
  Fragment,
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { TagSource } from '../../../generated/type/tagLabel';
import { withLoader } from '../../../hoc/withLoader';
import { TagsContainerProps } from './tags-container.interface';

const TagsContainer: FunctionComponent<TagsContainerProps> = ({
  children,
  editable,
  selectedTags,
  tagList,
  onCancel,
  onSelectionChange,
  className,
  containerClass,
  buttonContainerClass,
  showTags = true,
  showAddTagButton = false,
}: TagsContainerProps) => {
  const { t } = useTranslation();
  const [tags, setTags] = useState<Array<EntityTags>>(selectedTags);

  const tagOptions = useMemo(() => {
    const newTags = (tagList as TagOption[])
      .filter((tag) => !tag.fqn?.startsWith(`Tier${FQN_SEPARATOR_CHAR}Tier`)) // To filter out Tier tags
      .map((tag) => {
        return {
          label: tag.fqn,
          value: tag.fqn,
        };
      });

    return newTags;
  }, [tagList]);

  const handleTagSelection = (selectedTag: string[]) => {
    if (!isEmpty(selectedTag)) {
      setTags(() => {
        const updatedTags = selectedTag.map((t) => {
          return {
            tagFQN: t,
            source: (tagList as TagOption[]).find((tag) => tag.fqn === t)
              ?.source,
          } as EntityTags;
        });

        return updatedTags;
      });
    } else {
      setTags([]);
    }
  };

  const handleTagRemoval = (removedTag: string, tagIdx: number) => {
    const updatedTags = tags.filter(
      (tag, index) => !(tag.tagFQN === removedTag && index === tagIdx)
    );
    onSelectionChange && onSelectionChange(updatedTags);
    setTags(updatedTags);
  };

  const handleSave = useCallback(
    (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      event.preventDefault();
      event.stopPropagation();
      onSelectionChange && onSelectionChange(tags);
    },
    [tags]
  );

  const handleCancel = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
    event.preventDefault();
    event.stopPropagation();
    setTags(selectedTags);
    onCancel && onCancel(event);
  };

  const getTagsElement = (tag: EntityTags, index: number) => {
    return (
      <Tags
        editable
        isRemovable={tag.isRemovable}
        key={index}
        removeTag={(_e, removedTag: string) => {
          handleTagRemoval(removedTag, index);
        }}
        showOnlyName={tag.source === TagSource.Glossary}
        tag={tag}
        type="border"
      />
    );
  };

  useEffect(() => {
    setTags(selectedTags);
  }, [selectedTags]);

  const selectedTagsInternal = useMemo(
    () => selectedTags.map(({ tagFQN }) => tagFQN as string),
    [tags]
  );

  return (
    <Space
      align="center"
      className={classNames('w-full', containerClass)}
      data-testid="tag-container"
      size={16}>
      <Space className="flex-wrap">
        {showTags && !editable && (
          <Fragment>
            {showAddTagButton && (
              <span className="tw-text-primary">
                <Tags
                  className="tw-font-semibold cursor-pointer"
                  startWith="+ "
                  tag="Tags"
                  type="border"
                />
              </span>
            )}
            {tags.map(getTagsElement)}
          </Fragment>
        )}
        {editable ? (
          <Select
            autoFocus
            className={classNames('w-min-10', className)}
            data-testid="tag-selector"
            defaultValue={selectedTagsInternal}
            mode="multiple"
            placeholder={t('label.select-field', {
              field: t('label.tag-plural'),
            })}
            onChange={handleTagSelection}>
            {tagOptions.map(({ label, value }) => (
              <Select.Option key={label} value={value}>
                <Tooltip
                  destroyTooltipOnHide
                  placement="topLeft"
                  title={label}
                  trigger="hover">
                  {label}
                </Tooltip>
              </Select.Option>
            ))}
          </Select>
        ) : (
          children
        )}
      </Space>
      {editable && (
        <Space
          className={classNames('', buttonContainerClass)}
          data-testid="buttons"
          size={4}>
          <Button
            className="w-6 p-x-05"
            data-testid="cancelAssociatedTag"
            size="small"
            type="primary"
            onMouseDown={handleCancel}>
            <CloseOutlined height={14} width={14} />
          </Button>
          <Button
            className="w-6 p-x-05"
            data-testid="saveAssociatedTag"
            size="small"
            type="primary"
            onMouseDown={handleSave}>
            <CheckOutlined />
          </Button>
        </Space>
      )}
    </Space>
  );
};

export default withLoader<TagsContainerProps>(TagsContainer);
