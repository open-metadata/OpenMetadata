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
import { Button, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { t } from 'i18next';
import { isFunction, isUndefined } from 'lodash';
import React, { FC, Fragment } from 'react';
import { useHistory } from 'react-router-dom';
import { ReactComponent as IconCommentPlus } from '../../../assets/svg/add-chat.svg';
import { ReactComponent as IconComments } from '../../../assets/svg/comment.svg';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconRequest } from '../../../assets/svg/request-icon.svg';
import { ReactComponent as IconTaskColor } from '../../../assets/svg/task-ic.svg';
import { DE_ACTIVE_COLOR, ICON_DIMENSION } from '../../../constants/constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { EntityType } from '../../../enums/entity.enum';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { EntityFieldThreads } from '../../../interface/feed.interface';
import { isTaskSupported } from '../../../utils/CommonUtils';
import { getEntityFeedLink } from '../../../utils/EntityUtils';
import {
  getRequestDescriptionPath,
  getUpdateDescriptionPath,
  TASK_ENTITIES,
} from '../../../utils/TasksUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import RichTextEditorPreviewer from '../rich-text-editor/RichTextEditorPreviewer';
import { DescriptionProps } from './Description.interface';

const Description: FC<DescriptionProps> = ({
  className,
  header,
  hasEditAccess,
  onDescriptionEdit,
  description = '',
  isEdit,
  onCancel,
  onDescriptionUpdate,
  isReadOnly = false,
  removeBlur = false,
  entityName,
  entityFieldThreads,
  onThreadLinkSelect,
  entityType,
  entityFqn,
  entityFieldTasks,
  reduceDescription,
}) => {
  const history = useHistory();

  const thread = entityFieldThreads?.[0];
  const tasks = entityFieldTasks?.[0];

  const handleRequestDescription = () => {
    history.push(
      getRequestDescriptionPath(entityType as string, entityFqn as string)
    );
  };

  const handleUpdateDescription = () => {
    history.push(
      getUpdateDescriptionPath(entityType as string, entityFqn as string)
    );
  };

  const handleUpdate = () => {
    onDescriptionEdit && onDescriptionEdit();
  };

  const handleSave = async (updatedDescription: string) => {
    if (onDescriptionUpdate && isFunction(onDescriptionUpdate)) {
      try {
        await onDescriptionUpdate(updatedDescription);

        onCancel && onCancel();
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };

  const RequestDescriptionEl = () => {
    const hasDescription = Boolean(description.trim());

    return TASK_ENTITIES.includes(entityType as EntityType) ? (
      <Button
        className="w-7 h-7 p-0 flex-center"
        data-testid="request-entity-description"
        type="text"
        onClick={
          hasDescription ? handleUpdateDescription : handleRequestDescription
        }>
        <Tooltip
          placement="right"
          title={
            hasDescription
              ? t('message.request-update-description')
              : t('message.request-description')
          }>
          <IconRequest
            name={t('message.request-description')}
            {...ICON_DIMENSION}
          />
        </Tooltip>
      </Button>
    ) : null;
  };

  const DescriptionThreadEl = ({
    descriptionThread,
  }: {
    descriptionThread?: EntityFieldThreads;
  }) =>
    !isUndefined(descriptionThread) ? (
      <Button
        className="w-9 h-7 p-0"
        data-testid="description-thread"
        type="text"
        onClick={() => onThreadLinkSelect?.(descriptionThread.entityLink)}>
        <Space align="center" className="h-full" size={2}>
          <IconComments {...ICON_DIMENSION} name="tasks" />
          <Typography.Text data-testid="description-thread-count">
            {descriptionThread.count}
          </Typography.Text>
        </Space>
      </Button>
    ) : (
      <Fragment>
        {description?.trim() && onThreadLinkSelect ? (
          <Button
            className="w-7 h-7 link-text p-0 flex-center"
            data-testid="start-description-thread"
            icon={<IconCommentPlus {...ICON_DIMENSION} name="comments" />}
            type="text"
            onClick={() =>
              onThreadLinkSelect?.(
                getEntityFeedLink(
                  entityType,
                  entityFqn,
                  EntityField.DESCRIPTION
                )
              )
            }
          />
        ) : null}
      </Fragment>
    );

  const getDescriptionTaskElement = () =>
    !isUndefined(tasks) ? (
      <Button
        className="w-9 h-7 p-0"
        data-testid="description-task"
        type="text"
        onClick={() => onThreadLinkSelect?.(tasks.entityLink, ThreadType.Task)}>
        <Space align="center" className="h-full" size={2}>
          <IconTaskColor {...ICON_DIMENSION} name="tasks" />
          <Typography.Text data-testid="description-tasks-count">
            {tasks.count}
          </Typography.Text>
        </Space>
      </Button>
    ) : null;

  const DescriptionActions = () => {
    return !isReadOnly ? (
      <Space align="end" size={0}>
        {hasEditAccess && (
          <Button
            className="w-7 h-7 p-0 flex-center"
            data-testid="edit-description"
            icon={<IconEdit color={DE_ACTIVE_COLOR} {...ICON_DIMENSION} />}
            type="text"
            onClick={handleUpdate}
          />
        )}
        {isTaskSupported(entityType as EntityType) ? (
          <Fragment>
            <RequestDescriptionEl />
            {getDescriptionTaskElement()}
          </Fragment>
        ) : null}

        <DescriptionThreadEl descriptionThread={thread} />
      </Space>
    ) : null;
  };

  return (
    <div className={`schema-description relative ${className}`}>
      <Space align="end" className="description-inner-main-container" size={4}>
        <div className="relative">
          <div
            className="description h-full relative overflow-y-scroll"
            data-testid="description"
            id="center">
            {description?.trim() ? (
              <RichTextEditorPreviewer
                className={reduceDescription ? 'max-two-lines' : ''}
                enableSeeMoreVariant={!removeBlur}
                markdown={description}
              />
            ) : (
              <span className="text-grey-muted p-y-xs">
                {t('label.no-entity', {
                  entity: t('label.description'),
                })}
              </span>
            )}
          </div>
        </div>
        <DescriptionActions />
      </Space>
      <ModalWithMarkdownEditor
        header={header || t('label.edit-description-for', { entityName })}
        placeholder={t('label.enter-entity', {
          entity: t('label.description'),
        })}
        value={description}
        visible={Boolean(isEdit)}
        onCancel={onCancel}
        onSave={handleSave}
      />
    </div>
  );
};

export default Description;
