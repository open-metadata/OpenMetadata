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

import {
  Button,
  Divider,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Edit02,
  MessageChatSquare,
  MessagePlusSquare,
} from '@untitledui/icons';
import classNames from 'classnames';
import { ReactNode, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EntityField } from '../../../constants/Feeds.constants';
import { Domain } from '../../../generated/entity/domains/domain';
import { useFqn } from '../../../hooks/useFqn';
import { isDescriptionContentEmpty } from '../../../utils/BlockEditorUtils';
import { getEntityFeedLink } from '../../../utils/EntityUtils';
import { t } from '../../../utils/i18next/LocalUtil';
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
import DescriptionSourceBadge from '../DescriptionSourceBadge/DescriptionSourceBadge';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';
import { DescriptionProps } from './Description.interface';
import { EntityAttachmentProvider } from './EntityAttachmentProvider/EntityAttachmentProvider';

const Description = ({
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
  const navigate = useNavigate();
  const { isVersionView, changeSummary, onThreadLinkSelect } =
    useGenericContext<Domain>();
  const { suggestions, selectedUserSuggestions } = useSuggestionsContext();
  const [isEditDescription, setIsEditDescription] = useState(false);
  const { fqn } = useFqn();

  const entityFqn = useMemo(
    () => entityFullyQualifiedName ?? fqn,
    [entityFullyQualifiedName, fqn]
  );

  const handleRequestDescription = useCallback(() => {
    navigate(getRequestDescriptionPath(entityType, entityFqn));
  }, [entityType, entityFqn]);

  const handleUpdateDescription = useCallback(() => {
    navigate(getUpdateDescriptionPath(entityType, entityFqn));
  }, [entityType, entityFqn]);

  const handleEditDescription = useCallback(() => {
    setIsEditDescription(true);
  }, []);

  const handleCancelEditDescription = useCallback(() => {
    setIsEditDescription(false);
  }, []);

  const handleDescriptionChange = useCallback(
    async (updatedDescription: string) => {
      await onDescriptionUpdate?.(updatedDescription);
      setIsEditDescription(false);
    },
    [onDescriptionUpdate]
  );

  const { entityLink, entityLinkWithoutField } = useMemo(() => {
    return {
      entityLink: getEntityFeedLink(
        entityType,
        entityFqn,
        EntityField.DESCRIPTION
      ),
      entityLinkWithoutField: getEntityFeedLink(entityType, entityFqn),
    };
  }, [entityType, entityFqn]);

  const taskActionButton = useMemo(() => {
    const hasDescription = !isDescriptionContentEmpty(
      description?.trim() ?? ''
    );
    let button: ReactNode = null;

    if (TASK_ENTITIES.includes(entityType)) {
      button = (
        <Tooltip
          title={
            hasDescription
              ? t('message.request-update-description')
              : t('message.request-description')
          }>
          <Button
            color="secondary"
            data-testid="request-description"
            iconLeading={MessagePlusSquare}
            size="xxs"
            onPress={
              hasDescription
                ? handleUpdateDescription
                : handleRequestDescription
            }
          />
        </Tooltip>
      );
    }

    return button;
  }, [
    description,
    entityType,
    handleUpdateDescription,
    handleRequestDescription,
  ]);

  const actionButtons = useMemo(
    () => (
      <div className="tw:flex tw:items-center tw:gap-2">
        {!isVersionView && !isReadOnly && hasEditAccess && (
          <Tooltip
            title={t('label.edit-entity', {
              entity: t('label.description'),
            })}>
            <Button
              color="secondary"
              data-testid="edit-description"
              iconLeading={Edit02}
              size="xxs"
              onPress={handleEditDescription}
            />
          </Tooltip>
        )}
        {taskActionButton}
        {showCommentsIcon && (
          <Tooltip
            title={t('label.list-entity', {
              entity: t('label.conversation'),
            })}>
            <Button
              color="secondary"
              data-testid="description-thread"
              iconLeading={MessageChatSquare}
              size="xxs"
              onPress={() => onThreadLinkSelect?.(entityLink)}
            />
          </Tooltip>
        )}
      </div>
    ),
    [
      isReadOnly,
      isVersionView,
      hasEditAccess,
      handleEditDescription,
      taskActionButton,
      showCommentsIcon,
      onThreadLinkSelect,
      entityLink,
    ]
  );

  const suggestionData = useMemo(() => {
    const activeSuggestion = selectedUserSuggestions?.description.find(
      (suggestion) => suggestion.entityLink === entityLinkWithoutField
    );
    let alert: ReactNode = null;

    if (activeSuggestion?.entityLink === entityLinkWithoutField) {
      alert = (
        <SuggestionsAlert
          hasEditAccess={hasEditAccess}
          suggestion={activeSuggestion}
        />
      );
    }

    return alert;
  }, [hasEditAccess, entityLinkWithoutField, selectedUserSuggestions]);

  const descriptionContent = useMemo(() => {
    return (
      suggestionData ?? (
        <RichTextEditorPreviewerV1
          className={reduceDescription ? 'max-two-lines' : ''}
          enableSeeMoreVariant={!removeBlur}
          isDescriptionExpanded={isDescriptionExpanded}
          markdown={description}
        />
      )
    );
  }, [
    description,
    suggestionData,
    isDescriptionExpanded,
    reduceDescription,
    removeBlur,
  ]);

  const shouldShowDescriptionMetadata = useMemo(
    () => changeSummary?.['description']?.changeSource != null,
    [changeSummary]
  );

  const header = (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2">
      <div className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:gap-2">
        <Typography
          as="span"
          className="tw:text-text-secondary"
          size="text-sm"
          weight="semibold">
          {t('label.description')}
        </Typography>
        <DescriptionSourceBadge
          changeSummaryEntry={changeSummary?.['description']}
          showAcceptedBy={false}
          showTimestamp={false}
        />
        {showActions && actionButtons}
      </div>
      {showSuggestions && suggestions?.length > 0 && <SuggestionsSlider />}
    </div>
  );

  return (
    <EntityAttachmentProvider entityFqn={entityFqn} entityType={entityType}>
      <div
        className={classNames(
          wrapInCard
            ? 'tw:flex tw:flex-col tw:gap-4 tw:rounded-xl tw:border tw:border-gray-blue-100 tw:bg-bg-primary tw:p-4.5 tw:shadow-xs'
            : 'tw:flex tw:flex-col tw:gap-4',
          className
        )}
        data-testid="asset-description-container">
        {header}
        <div className="tw:[&_.tiptap.ProseMirror]:text-xs tw:[&_.tiptap.ProseMirror]:leading-[18px]">
          {descriptionContent}
        </div>
        {!suggestionData && shouldShowDescriptionMetadata && (
          <>
            <Divider />
            <DescriptionSourceBadge
              changeSummaryEntry={changeSummary?.['description']}
              showBadge={false}
            />
          </>
        )}
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
    </EntityAttachmentProvider>
  );
};

export default Description;
