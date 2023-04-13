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
import { Button, Select, Space, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import Tags from 'components/Tag/Tags/tags';
import { isEmpty } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, {
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
import Fqn from '../../../utils/Fqn';
import { TagsContainerProps } from './tags-container.interface';

const TagsContainer: FunctionComponent<TagsContainerProps> = ({
  children,
  editable,
  selectedTags,
  tagList,
  onCancel,
  onSelectionChange,
  onAddButtonClick,
  className,
  containerClass,
  showTags = true,
  showAddTagButton = false,
}: TagsContainerProps) => {
  const { t } = useTranslation();
  const [tags, setTags] = useState<Array<EntityTags>>(selectedTags);

  const tagOptions = useMemo(() => {
    const newTags = (tagList as TagOption[])
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
    <div
      className={classNames('w-full d-flex items-center gap-2', containerClass)}
      data-testid="tag-container">
      {showTags && !editable && (
        <Space wrap size={0}>
          {showAddTagButton && (
            <span className="tw-text-primary" onClick={onAddButtonClick}>
              <Tags
                className="tw-font-semibold"
                startWith="+ "
                tag={t('label.add')}
                type="border"
              />
            </span>
          )}
          {tags.map(getTagsElement)}
        </Space>
      )}
      {editable ? (
        <>
          <Select
            autoFocus
            className={classNames('flex-grow', className)}
            data-testid="tag-selector"
            defaultValue={selectedTagsInternal}
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
          <>
            <Button
              className="p-x-05"
              data-testid="cancelAssociatedTag"
              icon={<CloseOutlined size={12} />}
              size="small"
              onClick={handleCancel}
            />
            <Button
              className="p-x-05"
              data-testid="saveAssociatedTag"
              icon={<CheckOutlined size={12} />}
              size="small"
              type="primary"
              onClick={handleSave}
            />
          </>
        </>
      ) : (
        children
      )}
    </div>
  );
};

export default withLoader<TagsContainerProps>(TagsContainer);
