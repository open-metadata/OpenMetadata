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
import { Button } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';
import './DescriptionSection.less';

interface DescriptionSectionProps {
  description?: string;
  onDescriptionUpdate?: (description: string) => Promise<void>;
  showEditButton?: boolean;
}

const DescriptionSection: React.FC<DescriptionSectionProps> = ({
  description,
  onDescriptionUpdate,
  showEditButton = true,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditDescription, setIsEditDescription] = useState(false);
  const [editValue, setEditValue] = useState(description || '');

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Callback to handle the edit button from description
  const handleEditDescription = useCallback(() => {
    setEditValue(description || '');
    setIsEditDescription(true);
  }, [description]);

  // Callback to handle the cancel button
  const handleCancelEditDescription = useCallback(() => {
    setEditValue(description || '');
    setIsEditDescription(false);
  }, [description]);

  // Callback to handle the save button
  const handleSaveDescription = useCallback(async () => {
    if (onDescriptionUpdate) {
      await onDescriptionUpdate(editValue);
    }
    setIsEditDescription(false);
  }, [editValue, onDescriptionUpdate]);

  // Update editValue when description prop changes
  useEffect(() => {
    setEditValue(description || '');
  }, [description]);

  // Check if text is long enough to need truncation
  const shouldShowButton = description && description.length > 100;

  if (!description?.trim()) {
    return (
      <div className="description-section">
        <div className="description-header">
          <span className="description-title">{t('label.description')}</span>
          {showEditButton && onDescriptionUpdate && (
            <Button
              className="edit-button"
              type="text"
              onClick={handleEditDescription}>
              {t('label.edit')}
            </Button>
          )}
        </div>
        <div className="description-content">
          {isEditDescription ? (
            <div className="inline-edit-container">
              <textarea
                className="description-textarea"
                placeholder={t('label.enter-entity', {
                  entity: t('label.description'),
                })}
                rows={4}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
              />
              <div className="edit-actions">
                <Button
                  className="cancel-button"
                  type="text"
                  onClick={handleCancelEditDescription}>
                  {t('label.cancel')}
                </Button>
                <Button
                  className="save-button"
                  type="primary"
                  onClick={handleSaveDescription}>
                  {t('label.save')}
                </Button>
              </div>
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
    <div className="description-section">
      <div className="description-header">
        <span className="description-title">{t('label.description')}</span>
        {showEditButton && onDescriptionUpdate && (
          <Button
            className="edit-button"
            type="text"
            onClick={handleEditDescription}>
            {t('label.edit')}
          </Button>
        )}
      </div>
      <div className="description-content">
        {isEditDescription ? (
          <div className="inline-edit-container">
            <textarea
              className="description-textarea"
              placeholder={t('label.enter-entity', {
                entity: t('label.description'),
              })}
              rows={4}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
            />
            <div className="edit-actions">
              <Button
                className="cancel-button"
                type="text"
                onClick={handleCancelEditDescription}>
                {t('label.cancel')}
              </Button>
              <Button
                className="save-button"
                type="primary"
                onClick={handleSaveDescription}>
                {t('label.save')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="description-display">
            <div
              className={`description-text ${
                isExpanded ? 'expanded' : 'collapsed'
              }`}>
              {isExpanded ? (
                <RichTextEditorPreviewerV1 markdown={description} />
              ) : (
                <div className="description-preview">
                  <div className="truncated-text">{description}</div>
                </div>
              )}
            </div>
            {shouldShowButton && (
              <button
                className="show-more-button"
                type="button"
                onClick={toggleExpanded}>
                {isExpanded ? t('label.show-less') : t('label.show-more')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DescriptionSection;
