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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../assets/svg/close-icon.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit.svg';
import { ReactComponent as TickIcon } from '../../../assets/svg/tick.svg';
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
  const [shouldShowButton, setShouldShowButton] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Function to check if text is truncated
  const checkIfTextIsTruncated = useCallback(() => {
    if (containerRef.current) {
      const element = containerRef.current;
      // Look for the markdown-parser element within the rich-text-editor-container
      const markdownParser = element.querySelector('.markdown-parser');
      if (markdownParser) {
        // Check if the element's scroll height is greater than its client height
        // This indicates that the text is being truncated by CSS
        const isTruncated =
          markdownParser.scrollHeight > markdownParser.clientHeight;
        setShouldShowButton(isTruncated);
      }
    }
  }, []);

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

  // Check if text is truncated when description changes or component mounts
  useEffect(() => {
    if (description && !isEditDescription) {
      // Use setTimeout to ensure the DOM has been updated
      setTimeout(checkIfTextIsTruncated, 0);
    }
  }, [description, isEditDescription, checkIfTextIsTruncated]);

  if (!description?.trim()) {
    return (
      <div className="description-section">
        <div className="description-header">
          <span className="description-title">{t('label.description')}</span>
          {showEditButton && onDescriptionUpdate && !isEditDescription && (
            <span className="cursor-pointer" onClick={handleEditDescription}>
              <EditIcon />
            </span>
          )}
          {isEditDescription && (
            <div className="edit-actions">
              <span
                className="cursor-pointer"
                onClick={handleCancelEditDescription}>
                <CloseIcon />
              </span>
              <span className="cursor-pointer" onClick={handleSaveDescription}>
                <TickIcon />
              </span>
            </div>
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
        {showEditButton && onDescriptionUpdate && !isEditDescription && (
          <span className="cursor-pointer" onClick={handleEditDescription}>
            <EditIcon />
          </span>
        )}
        {isEditDescription && (
          <div className="edit-actions">
            <span
              className="cursor-pointer"
              onClick={handleCancelEditDescription}>
              <CloseIcon />
            </span>
            <span className="cursor-pointer" onClick={handleSaveDescription}>
              <TickIcon />
            </span>
          </div>
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
          </div>
        ) : (
          <div className="description-display">
            <div
              className={`description-text ${
                isExpanded ? 'expanded' : 'collapsed'
              }`}
              ref={containerRef}>
              <RichTextEditorPreviewerV1
                enableSeeMoreVariant={false}
                isDescriptionExpanded={isExpanded}
                markdown={description}
              />
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
