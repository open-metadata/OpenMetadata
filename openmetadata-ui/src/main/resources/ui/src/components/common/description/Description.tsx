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

import { Button, Popover, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { t } from 'i18next';
import { isFunction, isUndefined } from 'lodash';
import React, { FC, Fragment } from 'react';
import { useHistory } from 'react-router-dom';
import { ReactComponent as IconTaskColor } from '../../../assets/svg/Task-ic.svg';
import { EntityField } from '../../../constants/Feeds.constants';
import { EntityType } from '../../../enums/entity.enum';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { EntityFieldThreads } from '../../../interface/feed.interface';
import { isTaskSupported } from '../../../utils/CommonUtils';
import { getEntityFeedLink } from '../../../utils/EntityUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
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
      <button
        className="tw-w-7 tw-h-7 tw-flex-none link-text focus:tw-outline-none"
        data-testid="request-entity-description"
        onClick={
          hasDescription ? handleUpdateDescription : handleRequestDescription
        }>
        <Popover
          destroyTooltipOnHide
          content={
            hasDescription
              ? t('message.request-update-description')
              : t('message.request-description')
          }
          overlayClassName="ant-popover-request-description"
          trigger="hover"
          zIndex={9999}>
          <SVGIcons
            alt={t('message.request-description')}
            icon={Icons.REQUEST}
            width="16px"
          />
        </Popover>
      </button>
    ) : null;
  };

  const DescriptionThreadEl = ({
    descriptionThread,
  }: {
    descriptionThread?: EntityFieldThreads;
  }) => {
    return !isUndefined(descriptionThread) ? (
      <button
        className="tw-w-7 tw-h-7 tw-flex-none link-text focus:tw-outline-none"
        data-testid="description-thread"
        onClick={() => onThreadLinkSelect?.(descriptionThread.entityLink)}>
        <span className="tw-flex">
          <SVGIcons alt="comments" icon={Icons.COMMENT} width="16px" />{' '}
          <span className="tw-ml-1" data-testid="description-thread-count">
            {' '}
            {descriptionThread.count}
          </span>
        </span>
      </button>
    ) : (
      <Fragment>
        {description?.trim() && onThreadLinkSelect ? (
          <button
            className="tw-w-7 tw-h-7 tw-flex-none link-text focus:tw-outline-none"
            data-testid="start-description-thread"
            onClick={() =>
              onThreadLinkSelect?.(
                getEntityFeedLink(
                  entityType,
                  entityFqn,
                  EntityField.DESCRIPTION
                )
              )
            }>
            <SVGIcons alt="comments" icon={Icons.COMMENT_PLUS} width="16px" />
          </button>
        ) : null}
      </Fragment>
    );
  };

  const getDescriptionTaskElement = () => {
    return !isUndefined(tasks) ? (
      <Button
        className="w-7 h-7 m-r-xs p-0"
        data-testid="description-task"
        type="text"
        onClick={() => onThreadLinkSelect?.(tasks.entityLink, ThreadType.Task)}>
        <Space align="center" className="w-full h-full" size={3}>
          <IconTaskColor height={16} name="tasks" width={16} />
          <Typography.Text data-testid="description-tasks-count">
            {tasks.count}
          </Typography.Text>
        </Space>
      </Button>
    ) : null;
  };

  const DescriptionActions = () => {
    return !isReadOnly ? (
      <div className={classNames('tw-w-5 tw-min-w-max tw-flex')}>
        {hasEditAccess && (
          <button
            className="tw-w-7 tw-h-7 tw-flex-none focus:tw-outline-none"
            data-testid="edit-description"
            onClick={handleUpdate}>
            <SVGIcons alt="edit" icon="icon-edit" title="Edit" width="16px" />
          </button>
        )}
        {isTaskSupported(entityType as EntityType) ? (
          <Fragment>
            {' '}
            <RequestDescriptionEl />
            {getDescriptionTaskElement()}
          </Fragment>
        ) : null}

        <DescriptionThreadEl descriptionThread={thread} />
      </div>
    ) : null;
  };

  return (
    <div className={`schema-description tw-relative ${className}`}>
      <div className="tw-flex description-inner-main-container tw-items-end">
        <div className="tw-relative">
          <div
            className="description tw-h-full tw-overflow-y-scroll tw-relative "
            data-testid="description"
            id="center">
            {description?.trim() ? (
              <RichTextEditorPreviewer
                enableSeeMoreVariant={!removeBlur}
                markdown={description}
              />
            ) : (
              <span className="tw-no-description p-y-xs">
                {t('label.no-entity', {
                  entity: t('label.description'),
                })}
              </span>
            )}
          </div>
          <ModalWithMarkdownEditor
            header={t('label.edit-description-for', { entityName })}
            placeholder={t('label.enter-entity', {
              entity: t('label.description'),
            })}
            value={description}
            visible={Boolean(isEdit)}
            onCancel={onCancel}
            onSave={handleSave}
          />
        </div>
        <DescriptionActions />
      </div>
    </div>
  );
};

export default Description;
