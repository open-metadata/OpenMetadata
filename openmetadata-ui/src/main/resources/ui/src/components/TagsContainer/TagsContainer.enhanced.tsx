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

import { Tag, Tooltip, Space, Badge } from 'antd';
import { RobotOutlined, EditOutlined, CloseOutlined } from '@ant-design/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TagLabel } from '../../generated/entity/data/table';
import TagFeedback from './TagFeedback/TagFeedback.component';
import { getEntityLink } from '../../utils/EntityUtils';

interface EnhancedTagProps {
  tag: TagLabel;
  entityType: string;
  entityFQN: string;
  fieldPath?: string;
  editable?: boolean;
  onRemove?: (tag: TagLabel) => void;
  onEdit?: (tag: TagLabel) => void;
  onFeedbackSubmitted?: () => void;
}

/**
 * Enhanced tag component that shows auto-applied indicator and feedback options
 */
export const EnhancedTag: React.FC<EnhancedTagProps> = ({
  tag,
  entityType,
  entityFQN,
  fieldPath,
  editable = false,
  onRemove,
  onEdit,
  onFeedbackSubmitted
}) => {
  const { t } = useTranslation();
  
  // Generate entity link for feedback
  const entityLink = getEntityLink(entityType, entityFQN, fieldPath);
  
  const tagContent = (
    <Space size={2}>
      {tag.autoApplied && (
        <Tooltip title={t('message.auto-detected-tag')}>
          <RobotOutlined style={{ fontSize: 12 }} />
        </Tooltip>
      )}
      <span>{tag.displayName || tag.tagFQN}</span>
    </Space>
  );

  const tagActions = (
    <Space size={0}>
      {tag.autoApplied && (
        <TagFeedback
          tag={tag}
          entityLink={entityLink}
          onFeedbackSubmitted={onFeedbackSubmitted}
        />
      )}
      {editable && !tag.autoApplied && onEdit && (
        <EditOutlined 
          style={{ fontSize: 12, marginLeft: 4 }}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(tag);
          }}
        />
      )}
      {editable && onRemove && (
        <CloseOutlined
          style={{ fontSize: 12, marginLeft: 4 }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(tag);
          }}
        />
      )}
    </Space>
  );

  const tagColor = tag.autoApplied ? 'blue' : (tag.style?.color || 'default');
  
  return (
    <Badge.Ribbon
      text={tag.autoApplied ? 'Auto' : undefined}
      color="blue"
      style={{ display: tag.autoApplied ? 'block' : 'none' }}>
      <Tag
        color={tagColor}
        style={{
          borderStyle: tag.autoApplied ? 'dashed' : 'solid',
          ...tag.style
        }}>
        <Space size={4}>
          {tagContent}
          {tagActions}
        </Space>
      </Tag>
    </Badge.Ribbon>
  );
};

interface TagsContainerEnhancedProps {
  tags: TagLabel[];
  entityType: string;
  entityFQN: string;
  fieldPath?: string;
  editable?: boolean;
  onTagsUpdate?: (tags: TagLabel[]) => void;
}

/**
 * Container for displaying tags with feedback capabilities
 */
export const TagsContainerEnhanced: React.FC<TagsContainerEnhancedProps> = ({
  tags,
  entityType,
  entityFQN,
  fieldPath,
  editable = false,
  onTagsUpdate
}) => {
  const { t } = useTranslation();

  const handleRemoveTag = (tagToRemove: TagLabel) => {
    if (onTagsUpdate) {
      const updatedTags = tags.filter(tag => tag.tagFQN !== tagToRemove.tagFQN);
      onTagsUpdate(updatedTags);
    }
  };

  const handleFeedbackSubmitted = () => {
    // Refresh tags after feedback is submitted
    // This would trigger a re-fetch of the entity data
    window.location.reload(); // Simple approach, could be improved
  };

  // Separate auto-applied and manual tags
  const autoAppliedTags = tags.filter(tag => tag.autoApplied);
  const manualTags = tags.filter(tag => !tag.autoApplied);

  return (
    <div className="tags-container">
      {autoAppliedTags.length > 0 && (
        <div className="auto-applied-tags mb-sm">
          <Tooltip title={t('message.auto-detected-tags-description')}>
            <span className="text-muted text-xs">
              <RobotOutlined /> {t('label.auto-detected')}:
            </span>
          </Tooltip>
          <Space size={4} wrap className="mt-xs">
            {autoAppliedTags.map(tag => (
              <EnhancedTag
                key={tag.tagFQN}
                tag={tag}
                entityType={entityType}
                entityFQN={entityFQN}
                fieldPath={fieldPath}
                editable={editable}
                onRemove={handleRemoveTag}
                onFeedbackSubmitted={handleFeedbackSubmitted}
              />
            ))}
          </Space>
        </div>
      )}
      
      {manualTags.length > 0 && (
        <div className="manual-tags">
          {autoAppliedTags.length > 0 && (
            <span className="text-muted text-xs">
              {t('label.manual-tags')}:
            </span>
          )}
          <Space size={4} wrap className="mt-xs">
            {manualTags.map(tag => (
              <EnhancedTag
                key={tag.tagFQN}
                tag={tag}
                entityType={entityType}
                entityFQN={entityFQN}
                fieldPath={fieldPath}
                editable={editable}
                onRemove={handleRemoveTag}
              />
            ))}
          </Space>
        </div>
      )}
    </div>
  );
};

export default TagsContainerEnhanced;