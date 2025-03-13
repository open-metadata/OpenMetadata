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

import Icon from '@ant-design/icons';
import { Card, Space, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { t } from 'i18next';
import React, { useCallback, useMemo, useState } from 'react';
import { useHistory } from 'react-router';
import { ReactComponent as CommentIcon } from '../../../assets/svg/comment.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as RequestIcon } from '../../../assets/svg/request-icon.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { EntityType } from '../../../enums/entity.enum';
import { useFqn } from '../../../hooks/useFqn';
import { isDescriptionContentEmpty } from '../../../utils/BlockEditorUtils';
import { getEntityFeedLink } from '../../../utils/EntityUtils';
import {
  getRequestDescriptionPath,
  getUpdateDescriptionPath,
  TASK_ENTITIES,
} from '../../../utils/TasksUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import SuggestionsAlert from '../../Suggestions/SuggestionsAlert/SuggestionsAlert';
import { useSuggestionsContext } from '../../Suggestions/SuggestionsProvider/SuggestionsProvider';
import SuggestionsSlider from '../../Suggestions/SuggestionsSlider/SuggestionsSlider';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';
import { DescriptionProps } from './Description.interface';
import { EntityAttachmentProvider } from './EntityAttachmentProvider/EntityAttachmentProvider';

const { Text } = Typography;

const DescriptionV1 = ({
  hasEditAccess,
  description = '',
  className,
  onDescriptionUpdate,
  isReadOnly = false,
  removeBlur = false,
  entityName,
  entityType,
  wrapInCard = false,
  showActions = true,
  showCommentsIcon = true,
  reduceDescription,
  showSuggestions = false,
  isDescriptionExpanded,
  entityFullyQualifiedName,
}: DescriptionProps) => {
  const history = useHistory();
  const { suggestions, selectedUserSuggestions } = useSuggestionsContext();
  const [isEditDescription, setIsEditDescription] = useState(false);
  const { fqn } = useFqn();
  const { onThreadLinkSelect } = useGenericContext();

  const entityFqn = useMemo(() => {
    return entityFullyQualifiedName ?? fqn;
  }, [entityFullyQualifiedName, fqn]);

  const handleRequestDescription = useCallback(() => {
    history.push(getRequestDescriptionPath(entityType, entityFqn));
  }, [entityType, entityFqn]);

  const handleUpdateDescription = useCallback(() => {
    history.push(getUpdateDescriptionPath(entityType, entityFqn));
  }, [entityType, entityFqn]);

  // Callback to handle the edit button from description
  const handleEditDescription = useCallback(() => {
    setIsEditDescription(true);
  }, []);

  // Callback to handle the cancel button from modal
  const handleCancelEditDescription = useCallback(() => {
    setIsEditDescription(false);
  }, []);

  // Callback to handle the description change from modal
  const handleDescriptionChange = useCallback(
    async (description: string) => {
      await onDescriptionUpdate?.(description);
      setIsEditDescription(false);
    },
    [onDescriptionUpdate]
  );

  const { entityLink, entityLinkWithoutField } = useMemo(() => {
    const entityLink = getEntityFeedLink(
      entityType,
      entityFqn,
      EntityField.DESCRIPTION
    );
    const entityLinkWithoutField = getEntityFeedLink(entityType, entityFqn);

    return {
      entityLink,
      entityLinkWithoutField,
    };
  }, [entityType, entityFqn]);

  const taskActionButton = useMemo(() => {
    const hasDescription = !isDescriptionContentEmpty(description.trim());

    const isTaskEntity = TASK_ENTITIES.includes(entityType as EntityType);

    if (!isTaskEntity) {
      return null;
    }

    return (
      <Tooltip
        title={
          hasDescription
            ? t('message.request-update-description')
            : t('message.request-description')
        }>
        <Icon
          component={RequestIcon}
          data-testid="request-description"
          style={{ color: DE_ACTIVE_COLOR }}
          onClick={
            hasDescription ? handleUpdateDescription : handleRequestDescription
          }
        />
      </Tooltip>
    );
  }, [
    description,
    entityType,
    handleUpdateDescription,
    handleRequestDescription,
  ]);

  const actionButtons = useMemo(
    () => (
      <Space size={12}>
        {!isReadOnly && hasEditAccess && (
          <Tooltip
            title={t('label.edit-entity', {
              entity: t('label.description'),
            })}>
            <Icon
              component={EditIcon}
              data-testid="edit-description"
              style={{ color: DE_ACTIVE_COLOR }}
              onClick={handleEditDescription}
            />
          </Tooltip>
        )}
        {taskActionButton}
        {showCommentsIcon && (
          <Tooltip
            title={t('label.list-entity', {
              entity: t('label.conversation'),
            })}>
            <Icon
              component={CommentIcon}
              data-testid="description-thread"
              style={{ color: DE_ACTIVE_COLOR }}
              width={20}
              onClick={() => {
                onThreadLinkSelect?.(entityLink);
              }}
            />
          </Tooltip>
        )}
      </Space>
    ),
    [
      isReadOnly,
      hasEditAccess,
      handleEditDescription,
      taskActionButton,
      showCommentsIcon,
      onThreadLinkSelect,
    ]
  );

  const suggestionData = useMemo(() => {
    const activeSuggestion = selectedUserSuggestions?.description.find(
      (suggestion) => suggestion.entityLink === entityLinkWithoutField
    );

    if (activeSuggestion?.entityLink === entityLinkWithoutField) {
      return (
        <SuggestionsAlert
          hasEditAccess={hasEditAccess}
          showSuggestedBy={false}
          suggestion={activeSuggestion}
        />
      );
    }

    return null;
  }, [hasEditAccess, entityLinkWithoutField, selectedUserSuggestions]);

  const descriptionContent = useMemo(() => {
    if (suggestionData) {
      return suggestionData;
    } else {
      return (
        <RichTextEditorPreviewerV1
          className={reduceDescription ? 'max-two-lines' : ''}
          enableSeeMoreVariant={!removeBlur}
          isDescriptionExpanded={isDescriptionExpanded}
          markdown={description}
        />
      );
    }
  }, [description, suggestionData, isDescriptionExpanded]);

  const content = (
    <EntityAttachmentProvider entityFqn={entityFqn} entityType={entityType}>
      <Space
        className={classNames('schema-description d-flex', className)}
        data-testid="asset-description-container"
        direction="vertical"
        size={16}>
        <div className="d-flex justify-between flex-wrap">
          <div className="d-flex items-center gap-2">
            <Text className="right-panel-label">{t('label.description')}</Text>
            {showActions && actionButtons}
          </div>
          {showSuggestions && suggestions?.length > 0 && <SuggestionsSlider />}
        </div>

        <div>
          {descriptionContent}
          <ModalWithMarkdownEditor
            header={t('label.edit-description-for', { entityName })}
            placeholder={t('label.enter-entity', {
              entity: t('label.description'),
            })}
            value={description}
            visible={Boolean(isEditDescription)}
            onCancel={handleCancelEditDescription}
            onSave={handleDescriptionChange}
          />
        </div>
      </Space>
    </EntityAttachmentProvider>
  );

  return wrapInCard ? <Card>{content}</Card> : content;
};

export default DescriptionV1;
