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
import { Box } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { EditIconButton } from '../IconButtons/EditIconButton';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';
import { DescriptionSectionProps } from './DescriptionSection.interface';

const DescriptionSection: React.FC<DescriptionSectionProps> = ({
  description,
  onDescriptionUpdate,
  showEditButton = true,
  hasPermission = false,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditDescription, setIsEditDescription] = useState(false);
  const [shouldShowButton, setShouldShowButton] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Function to check if text is truncated
  const checkIfTextIsTruncated = useCallback(() => {
    if (containerRef.current) {
      const element = containerRef.current;
      // Look for the markdown-parser element within the rich-text-editor-container
      const markdownParser = element.querySelector('.markdown-parser');
      // Fallback to the container itself if markdown parser is not found
      const measureNode = (markdownParser as HTMLElement) || element;
      // If element is not visible (e.g., tab hidden), avoid recalculating to false
      const isVisible = measureNode.getClientRects().length > 0;
      if (!isVisible) {
        return;
      }
      // Check if the element's scroll height is greater than its client height
      // This indicates that the text is being truncated by CSS
      // Add a small threshold (1px) to account for sub-pixel rendering differences
      const isTruncated =
        measureNode.scrollHeight > measureNode.clientHeight + 1;
      setShouldShowButton(isTruncated);
    }
  }, []);

  // Callback to handle the edit button from description
  const handleEditDescription = useCallback(() => {
    setIsEditDescription(true);
  }, [description]);

  // Callback to handle the cancel button
  const handleCancelEditDescription = useCallback(() => {
    setIsEditDescription(false);
  }, [description]);

  // Callback to handle the description change from modal
  const handleDescriptionChange = useCallback(
    async (updatedDescription: string) => {
      if (onDescriptionUpdate) {
        await onDescriptionUpdate(updatedDescription);
      }
      setIsEditDescription(false);
    },
    [onDescriptionUpdate]
  );

  // Check if text is truncated when description changes or component mounts
  useEffect(() => {
    if (!description || isEditDescription) {
      return;
    }

    // Reset expanded state and button visibility when description changes
    setIsExpanded(false);
    setShouldShowButton(false);

    // Use setTimeout to ensure the DOM has been updated
    // Delay slightly to allow markdown to render fully
    const id = setTimeout(checkIfTextIsTruncated, 100);

    return () => clearTimeout(id);
  }, [description, isEditDescription, checkIfTextIsTruncated]);

  // Recalculate when container resizes or becomes visible after tab switch
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      checkIfTextIsTruncated();
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, [checkIfTextIsTruncated]);

  // Recalculate when the element becomes visible after tab/nav changes
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          checkIfTextIsTruncated();
        }
      }
    });
    io.observe(node);

    return () => io.disconnect();
  }, [checkIfTextIsTruncated]);

  const canShowEditButton =
    showEditButton && hasPermission && onDescriptionUpdate;

  if (!description?.trim()) {
    return (
      <Box
        data-testid="description-section"
        sx={{
          marginTop: '12px',
          paddingLeft: '14px',
          paddingRight: '14px',
          borderBottom: (theme) =>
            `0.6px solid ${theme.palette.allShades.blueGray[100]}`,
          paddingBottom: '16px',
          '& .block-editor-wrapper .tiptap.ProseMirror': {
            fontSize: '12px',
            fontWeight: 400,
          },
        }}>
        <Box
          sx={{
            display: 'flex',
            gap: '8px',
            marginBottom: '12px',
          }}>
          <Box
            component="span"
            sx={{
              fontWeight: 600,
              fontSize: '13px',
              color: (theme) => theme.palette.allShades.gray[900],
            }}>
            {t('label.description')}
          </Box>
          {canShowEditButton && (
            <EditIconButton
              newLook
              data-testid="edit-description"
              disabled={false}
              icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
              size="small"
              title={t('label.edit-entity', {
                entity: t('label.description'),
              })}
              onClick={handleEditDescription}
            />
          )}
        </Box>
        <Box>
          <Box
            component="span"
            sx={{
              color: (theme) => theme.palette.allShades.gray[500],
              fontSize: '12px',
            }}>
            {t('label.no-entity-added', {
              entity: t('label.description-lowercase'),
            })}
          </Box>
          <ModalWithMarkdownEditor
            header={t('label.edit-entity', { entity: t('label.description') })}
            placeholder={t('label.enter-entity', {
              entity: t('label.description'),
            })}
            value={description || ''}
            visible={Boolean(isEditDescription)}
            onCancel={handleCancelEditDescription}
            onSave={handleDescriptionChange}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      data-testid="description-section"
      sx={{
        marginTop: '12px',
        paddingLeft: '14px',
        paddingRight: '14px',
        borderBottom: (theme) =>
          `0.6px solid ${theme.palette.allShades.blueGray[100]}`,
        paddingBottom: '16px',
        '& .block-editor-wrapper .tiptap.ProseMirror': {
          fontSize: '12px',
          fontWeight: 400,
        },
      }}>
      <Box
        sx={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
        }}>
        <Box
          component="span"
          sx={{
            fontWeight: 600,
            fontSize: '13px',
            color: (theme) => theme.palette.allShades.gray[900],
          }}>
          {t('label.description')}
        </Box>
        {canShowEditButton && (
          <EditIconButton
            newLook
            data-testid="edit-description"
            disabled={false}
            icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
            size="small"
            title={t('label.edit-entity', {
              entity: t('label.description'),
            })}
            onClick={handleEditDescription}
          />
        )}
      </Box>
      <Box>
        <Box>
          <Box
            ref={containerRef}
            sx={{
              ...(isExpanded
                ? {
                    display: 'block',
                    lineHeight: 1.4,
                  }
                : {
                    '& .rich-text-editor-container .markdown-parser': {
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxHeight: '2.8em',
                      fontSize: '14px',
                      wordWrap: 'break-word',
                      wordBreak: 'break-word',
                      whiteSpace: 'normal',
                    },
                  }),
            }}>
            <RichTextEditorPreviewerV1
              enableSeeMoreVariant={false}
              isDescriptionExpanded={isExpanded}
              markdown={description}
            />
          </Box>
          {(shouldShowButton || isExpanded) && (
            <Box
              component="button"
              sx={{
                background: 'none',
                border: 'none',
                color: 'primary.main',
                cursor: 'pointer',
                fontSize: '12px',
                padding: 0,
                textDecoration: 'none',
                transition: 'color 0.2s ease',
                '&:hover': {
                  textDecoration: 'underline',
                },
                '&:focus': {
                  outline: 'none',
                },
              }}
              type="button"
              onClick={toggleExpanded}>
              {isExpanded ? t('label.show-less') : t('label.show-more')}
            </Box>
          )}
          <ModalWithMarkdownEditor
            header={t('label.edit-entity', { entity: t('label.description') })}
            placeholder={t('label.enter-entity', {
              entity: t('label.description'),
            })}
            value={description || ''}
            visible={Boolean(isEditDescription)}
            onCancel={handleCancelEditDescription}
            onSave={handleDescriptionChange}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default DescriptionSection;
