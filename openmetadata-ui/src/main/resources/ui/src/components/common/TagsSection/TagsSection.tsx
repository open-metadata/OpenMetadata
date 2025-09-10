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
import { FolderOutlined, MinusOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../assets/svg/close-icon.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit.svg';
import { ReactComponent as TickIcon } from '../../../assets/svg/tick.svg';
import { TagLabel } from '../../../generated/type/tagLabel';
import tagClassBase from '../../../utils/TagClassBase';
import AsyncSelectList from '../AsyncSelectList/AsyncSelectList';
import { SelectOption } from '../AsyncSelectList/AsyncSelectList.interface';
import './TagsSection.less';
interface TagsSectionProps {
  tags?: TagLabel[];
  showEditButton?: boolean;
  maxDisplayCount?: number;
}

interface TagItem {
  id: string;
  name: string;
  displayName: string;
}

const TagsSection: React.FC<TagsSectionProps> = ({
  tags = [],
  showEditButton = true,
  maxDisplayCount = 3,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTags, setEditingTags] = useState<TagItem[]>([]);

  const displayedTags = isExpanded ? tags : tags.slice(0, maxDisplayCount);
  const remainingCount = tags.length - maxDisplayCount;
  const shouldShowMore = remainingCount > 0 && !isExpanded;

  const getTagDisplayName = (tag: TagLabel) => {
    return tag.tagFQN || tag.displayName || t('label.unknown');
  };

  const getTagStyle = (_tag: TagLabel, index: number) => {
    // Default styling for other tags
    return {
      backgroundColor: '#F9FAFC',
      borderColor: '#E3E8F0',
      color: '#262626',
    };
  };

  const convertToTagItems = (tags: TagLabel[]): TagItem[] => {
    return tags.map((tag) => ({
      id: tag.tagFQN || tag.displayName || '',
      name: tag.tagFQN || tag.displayName || '',
      displayName: tag.displayName || tag.tagFQN || '',
    }));
  };

  const convertToSelectOptions = (tags: TagItem[]): SelectOption[] => {
    return tags.map((tag) => ({
      label: tag.displayName,
      value: tag.name,
      data: {
        fullyQualifiedName: tag.name,
        name: tag.displayName,
        displayName: tag.displayName,
      } as any, // Type assertion to handle the data type mismatch
    }));
  };

  const handleEditClick = () => {
    setEditingTags(convertToTagItems(tags));
    setIsEditing(true);
  };

  const handleSave = () => {
    // TODO: Implement actual save functionality
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditingTags(convertToTagItems(tags));
    setIsEditing(false);
  };

  const handleTagSelection = (selectedOptions: unknown) => {
    const options = Array.isArray(selectedOptions)
      ? selectedOptions
      : [selectedOptions];
    const newTags = options.map((option: any) => ({
      id: option.value,
      name: option.value,
      displayName: option.data?.displayName || option.label,
    }));
    setEditingTags(newTags);
  };

  if (!tags.length) {
    return (
      <div className="tags-section">
        <div className="tags-header">
          <Typography.Text className="tags-title">
            {t('label.tag-plural')}
          </Typography.Text>
          {showEditButton && !isEditing && (
            <span className="cursor-pointer" onClick={handleEditClick}>
              <EditIcon />
            </span>
          )}
          {isEditing && (
            <div className="edit-actions">
              <span className="cursor-pointer" onClick={handleCancel}>
                <CloseIcon />
              </span>
              <span className="cursor-pointer" onClick={handleSave}>
                <TickIcon />
              </span>
            </div>
          )}
        </div>
        <div className="tags-content">
          {isEditing ? (
            <div className="inline-edit-container">
              <AsyncSelectList
                newLook
                className="tag-selector"
                fetchOptions={tagClassBase.getTags}
                initialOptions={convertToSelectOptions(editingTags)}
                mode="multiple"
                placeholder={t('label.add-a-entity', {
                  entity: t('label.tag'),
                })}
                value={editingTags.map((tag) => tag.name)}
                onChange={handleTagSelection}
              />
            </div>
          ) : (
            <span className="no-data-placeholder">
              {t('label.no-data-found')}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="tags-section">
      <div className="tags-header">
        <Typography.Text className="tags-title">
          {t('label.tag-plural')}
        </Typography.Text>
        {showEditButton && !isEditing && (
          <span className="cursor-pointer" onClick={handleEditClick}>
            <EditIcon />
          </span>
        )}
        {isEditing && (
          <div className="edit-actions">
            <span className="cursor-pointer" onClick={handleCancel}>
              <CloseIcon />
            </span>
            <span className="cursor-pointer" onClick={handleSave}>
              <TickIcon />
            </span>
          </div>
        )}
      </div>
      <div className="tags-content">
        {isEditing ? (
          <div className="inline-edit-container">
            <AsyncSelectList
              newLook
              className="tag-selector"
              fetchOptions={tagClassBase.getTags}
              initialOptions={convertToSelectOptions(editingTags)}
              mode="multiple"
              placeholder={t('label.add-a-entity', {
                entity: t('label.tag'),
              })}
              value={editingTags.map((tag) => tag.name)}
              onChange={handleTagSelection}
            />
          </div>
        ) : (
          <div className="tags-display">
            <div className="tags-list">
              {displayedTags.map((tag, index) => (
                <div
                  className="tag-item"
                  key={index}
                  style={getTagStyle(tag, index)}>
                  <FolderOutlined className="tag-icon" />
                  <MinusOutlined className="tag-minus-icon" />
                  <span className="tag-name">{getTagDisplayName(tag)}</span>
                </div>
              ))}
            </div>
            {shouldShowMore && (
              <Button
                className="show-more-button"
                size="small"
                type="link"
                onClick={() => setIsExpanded(true)}>
                {t('label.plus-count-more', { count: remainingCount })}
              </Button>
            )}
            {isExpanded && remainingCount > 0 && (
              <Button
                className="show-less-button"
                size="small"
                type="link"
                onClick={() => setIsExpanded(false)}>
                {t('label.show-less-lowercase')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagsSection;
