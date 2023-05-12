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
import { Button, Select, Space, Tag, Tooltip, Typography } from 'antd';
import { ReactComponent as IconEdit } from 'assets/svg/edit-new.svg';
import classNames from 'classnames';
import Tags from 'components/Tag/Tags/tags';
import { NO_DATA_PLACEHOLDER } from 'constants/constants';
import { TAG_CONSTANT, TAG_START_WITH } from 'constants/Tag.constants';
import { isEmpty } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import type { CustomTagProps } from 'rc-select/lib/BaseSelect';
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { getTagDisplay, getTagTooltip } from 'utils/TagsUtils';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { withLoader } from '../../../hoc/withLoader';
import Fqn from '../../../utils/Fqn';
import TagsViewer from '../TagsViewer/tags-viewer';
import { TagsContainerProps } from './tags-container.interface';

const TagsContainer: FunctionComponent<TagsContainerProps> = ({
  editable,
  selectedTags,
  tagList,
  onCancel,
  onSelectionChange,
  onAddButtonClick,
  onEditButtonClick,
  className,
  containerClass,
  showTags = true,
  showAddTagButton = false,
  showEditTagButton = false,
  placeholder,
  showLimited,
}: TagsContainerProps) => {
  const { t } = useTranslation();

  const [tags, setTags] = useState<Array<EntityTags>>(selectedTags);

  const showNoDataPlaceholder = useMemo(
    () => !showAddTagButton && tags.length === 0,
    [showAddTagButton, tags]
  );

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

  const getUpdatedTags = (selectedTag: string[]): EntityTags[] => {
    const updatedTags = selectedTag.map((t) => ({
      tagFQN: t,
      source: (tagList as TagOption[]).find((tag) => tag.fqn === t)?.source,
    }));

    return updatedTags;
  };

  const handleTagSelection = (selectedTag: string[]) => {
    if (!isEmpty(selectedTag)) {
      setTags(getUpdatedTags(selectedTag));
    } else {
      setTags([]);
    }
  };

  const handleSave = useCallback(() => {
    onSelectionChange(tags);
    setTags(selectedTags);
  }, [onSelectionChange, tags, selectedTags]);

  const handleCancel = useCallback(() => {
    setTags(selectedTags);
    onCancel?.();
  }, [selectedTags, onCancel]);

  const getTagsElement = (tag: EntityTags, index: number) => {
    return (
      <Tags
        editable
        key={index}
        startWith={TAG_START_WITH.SOURCE_ICON}
        tag={tag}
        type="border"
      />
    );
  };

  const tagRenderer = (customTagProps: CustomTagProps) => {
    const { label, onClose } = customTagProps;
    const tagLabel = getTagDisplay(label as string);

    const onPreventMouseDown = (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault();
      event.stopPropagation();
    };

    return (
      <Tag
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
          <Typography.Paragraph
            className="m-0"
            style={{
              display: 'inline-block',
              whiteSpace: 'normal',
              wordBreak: 'break-all',
            }}>
            {tagLabel}
          </Typography.Paragraph>
        </Tooltip>
      </Tag>
    );
  };

  const addTagButton = useMemo(
    () =>
      showAddTagButton ? (
        <span onClick={onAddButtonClick}>
          <Tags
            className="tw-font-semibold tw-text-primary"
            startWith={TAG_START_WITH.PLUS}
            tag={TAG_CONSTANT}
            type="border"
          />
        </span>
      ) : null,
    [showAddTagButton, onAddButtonClick]
  );

  const editTagButton = useMemo(
    () =>
      !isEmpty(tags) && showEditTagButton ? (
        <Button
          className="p-0 flex-center text-primary"
          data-testid="edit-button"
          icon={
            <IconEdit
              className="anticon"
              height={16}
              name={t('label.edit')}
              width={16}
            />
          }
          size="small"
          type="text"
          onClick={onEditButtonClick}
        />
      ) : null,
    [tags, showEditTagButton, onEditButtonClick]
  );

  const renderTags = useMemo(
    () =>
      showLimited ? (
        <TagsViewer
          isTextPlaceholder
          showNoDataPlaceholder={showNoDataPlaceholder}
          tags={tags}
          type="border"
        />
      ) : (
        <>
          {!showAddTagButton && isEmpty(selectedTags) ? (
            <Typography.Text data-testid="no-tags">
              {NO_DATA_PLACEHOLDER}
            </Typography.Text>
          ) : null}
          {tags.map(getTagsElement)}
        </>
      ),
    [
      showLimited,
      showNoDataPlaceholder,
      tags,
      getTagsElement,
      showAddTagButton,
      selectedTags,
    ]
  );

  const selectedTagsInternal = useMemo(
    () => selectedTags.map(({ tagFQN }) => tagFQN as string),
    [tags]
  );

  const tagsSelectContainer = useMemo(() => {
    return (
      <>
        <Select
          autoFocus
          className={classNames('flex-grow w-max-95', className)}
          data-testid="tag-selector"
          defaultValue={selectedTagsInternal}
          mode="multiple"
          optionLabelProp="label"
          placeholder={
            placeholder
              ? placeholder
              : t('label.select-field', {
                  field: t('label.tag-plural'),
                })
          }
          removeIcon={
            <CloseOutlined data-testid="remove-tags" height={8} width={8} />
          }
          tagRender={tagRenderer}
          onChange={handleTagSelection}>
          {tagOptions.map(({ label, value, displayName }) => (
            <Select.Option key={label} value={value}>
              <Tooltip
                destroyTooltipOnHide
                mouseEnterDelay={1.5}
                placement="leftTop"
                title={label}
                trigger="hover">
                {displayName}
              </Tooltip>
            </Select.Option>
          ))}
        </Select>
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
    );
  }, [
    className,
    selectedTagsInternal,
    tagRenderer,
    handleTagSelection,
    tagOptions,
    handleCancel,
    handleSave,
    placeholder,
  ]);

  useEffect(() => {
    setTags(selectedTags);
  }, [selectedTags]);

  return (
    <div
      className={classNames('w-full d-flex items-center gap-2', containerClass)}
      data-testid="tag-container">
      {showTags && !editable && (
        <Space wrap align="center" size={4}>
          {addTagButton}
          {renderTags}
          {editTagButton}
        </Space>
      )}
      {editable && tagsSelectContainer}
    </div>
  );
};

export default withLoader<TagsContainerProps>(TagsContainer);
