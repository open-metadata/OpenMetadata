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

import { Space, Typography } from 'antd';
import classNames from 'classnames';
import { t } from 'i18next';
import React, { useCallback, useMemo, useState } from 'react';
import { useHistory } from 'react-router';
import { EntityField } from '../../../constants/Feeds.constants';
import { Domain } from '../../../generated/entity/domains/domain';
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
import ExpandableCard from '../ExpandableCard/ExpandableCard';
import {
  CommentIconButton,
  EditIconButton,
  RequestIconButton,
} from '../IconButtons/EditIconButton';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';
import './description-v1.less';
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
  const { isVersionView } = useGenericContext<Domain>();
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

    const isTaskEntity = TASK_ENTITIES.includes(entityType);

    if (!isTaskEntity) {
      return null;
    }

    return (
      <RequestIconButton
        newLook
        data-testid="request-description"
        size="small"
        title={
          hasDescription
            ? t('message.request-update-description')
            : t('message.request-description')
        }
        onClick={
          hasDescription ? handleUpdateDescription : handleRequestDescription
        }
      />
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
        {!isVersionView && !isReadOnly && hasEditAccess && (
          <EditIconButton
            newLook
            data-testid="edit-description"
            size="small"
            title={t('label.edit-entity', {
              entity: t('label.description'),
            })}
            onClick={handleEditDescription}
          />
        )}
        {taskActionButton}
        {showCommentsIcon && (
          <CommentIconButton
            newLook
            data-testid="description-thread"
            size="small"
            title={t('label.list-entity', {
              entity: t('label.conversation'),
            })}
            onClick={() => {
              onThreadLinkSelect?.(entityLink);
            }}
          />
        )}
      </Space>
    ),
    [
      isReadOnly,
      isVersionView,
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

  const header = useMemo(() => {
    return (
      <div
        className={classNames('d-flex justify-between flex-wrap', {
          'm-t-sm': suggestions?.length > 0,
        })}>
        <div className="d-flex items-center gap-2">
          <Text className={classNames('text-sm font-medium')}>
            {t('label.description')}
          </Text>
          {showActions && actionButtons}
        </div>
        {showSuggestions && suggestions?.length > 0 && <SuggestionsSlider />}
      </div>
    );
  }, [showActions, actionButtons, suggestions, showSuggestions]);

  const content = (
    <EntityAttachmentProvider entityFqn={entityFqn} entityType={entityType}>
      <Space
        {...(wrapInCard
          ? {}
          : {
              'data-testid': 'asset-description-container',
            })}
        className={classNames('schema-description d-flex', className)}
        direction="vertical"
        size={16}>
        {!wrapInCard ? header : null}
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

  return wrapInCard ? (
    <ExpandableCard
      cardProps={{ title: header, className: 'new-description-card' }}
      dataTestId="asset-description-container">
      {content}
    </ExpandableCard>
  ) : (
    content
  );
};

export default DescriptionV1;
