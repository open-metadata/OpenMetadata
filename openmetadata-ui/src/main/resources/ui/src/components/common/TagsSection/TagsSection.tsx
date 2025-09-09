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
import { Button } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TagLabel } from '../../../generated/type/tagLabel';
import SectionWithEdit from '../SectionWithEdit/SectionWithEdit';
import './TagsSection.less';

interface TagsSectionProps {
  tags?: TagLabel[];
  onEdit?: () => void;
  showEditButton?: boolean;
  maxDisplayCount?: number;
}

const TagsSection: React.FC<TagsSectionProps> = ({
  tags = [],
  onEdit,
  showEditButton = true,
  maxDisplayCount = 3,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const displayedTags = isExpanded ? tags : tags.slice(0, maxDisplayCount);
  const remainingCount = tags.length - maxDisplayCount;
  const shouldShowMore = remainingCount > 0 && !isExpanded;

  const getTagDisplayName = (tag: TagLabel) => {
    return (
      tag.tagFQN?.split('.').pop() || tag.displayName || t('label.unknown')
    );
  };

  const getTagStyle = (tag: TagLabel, index: number) => {
    // First tag gets special styling (like "Sensitive PII" in the image)
    if (index === 0) {
      return {
        backgroundColor: '#fff2f0',
        borderColor: '#ff4d4f',
        color: '#ff4d4f',
      };
    }

    // Default styling for other tags
    return {
      backgroundColor: '#ffffff',
      borderColor: '#d9d9d9',
      color: '#262626',
    };
  };

  if (!tags.length) {
    return (
      <SectionWithEdit
        showEditButton={showEditButton}
        title={t('label.tag-plural')}
        onEdit={onEdit}>
        <span className="no-data-placeholder">{t('label.no-data-found')}</span>
      </SectionWithEdit>
    );
  }

  return (
    <SectionWithEdit
      showEditButton={showEditButton}
      title={t('label.tag-plural')}
      onEdit={onEdit}>
      <div className="tags-content">
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
    </SectionWithEdit>
  );
};

export default TagsSection;
