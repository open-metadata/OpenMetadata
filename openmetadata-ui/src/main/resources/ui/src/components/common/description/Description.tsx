/*
 *  Copyright 2021 Collate
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

import { Popover, Space } from 'antd';
import { isUndefined } from 'lodash';
import { EntityFieldThreads } from 'Models';
import React, { FC, Fragment } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuthContext } from '../../../authentication/auth-provider/AuthProvider';
import { EntityField } from '../../../constants/feed.constants';
import { EntityType } from '../../../enums/entity.enum';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { Operation } from '../../../generated/entity/policies/accessControl/rule';
import { useAuth } from '../../../hooks/authHooks';
import { isTaskSupported } from '../../../utils/CommonUtils';
import { getEntityFeedLink } from '../../../utils/EntityUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import {
  getRequestDescriptionPath,
  getUpdateDescriptionPath,
  TASK_ENTITIES,
} from '../../../utils/TasksUtils';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import RichTextEditorPreviewer from '../rich-text-editor/RichTextEditorPreviewer';
import { DescriptionProps } from './Description.interface';

const Description: FC<DescriptionProps> = ({
  hasEditAccess,
  onDescriptionEdit,
  description = '',
  isEdit,
  onCancel,
  onDescriptionUpdate,
  isReadOnly = false,
  blurWithBodyBG = false,
  removeBlur = false,
  entityName,
  entityFieldThreads,
  onThreadLinkSelect,
  entityType,
  entityFqn,
  entityFieldTasks,
}) => {
  const history = useHistory();

  const { isAdminUser, userPermissions } = useAuth();
  const { isAuthDisabled } = useAuthContext();

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

  const checkPermission = () => {
    return (
      isAdminUser ||
      Boolean(hasEditAccess) ||
      userPermissions[Operation.EditDescription] ||
      isAuthDisabled
    );
  };

  const handleUpdate = () => {
    onDescriptionEdit && onDescriptionEdit();
  };

  const RequestDescriptionEl = () => {
    const hasDescription = Boolean(description.trim());

    return TASK_ENTITIES.includes(entityType as EntityType) ? (
      <button
        data-testid="request-description"
        onClick={
          hasDescription ? handleUpdateDescription : handleRequestDescription
        }>
        <Popover
          destroyTooltipOnHide
          content={
            hasDescription
              ? 'Request update description'
              : 'Request description'
          }
          overlayClassName="ant-popover-request-description"
          trigger="hover"
          zIndex={9999}>
          <SVGIcons alt="request-description" icon={Icons.REQUEST} />
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
        className="link-text"
        data-testid="description-thread"
        onClick={() => onThreadLinkSelect?.(descriptionThread.entityLink)}>
        <span className="tw-flex">
          <SVGIcons alt="comments" icon={Icons.COMMENT} />{' '}
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
            <SVGIcons alt="comments" icon={Icons.COMMENT_PLUS} />
          </button>
        ) : null}
      </Fragment>
    );
  };

  const DescriptionTaskElement = ({
    descriptionTaskThread,
  }: {
    descriptionTaskThread?: EntityFieldThreads;
  }) => {
    return !isUndefined(descriptionTaskThread) ? (
      <button
        className="link-text"
        data-testid="description-task"
        onClick={() =>
          onThreadLinkSelect?.(
            descriptionTaskThread.entityLink,
            ThreadType.Task
          )
        }>
        <span className="tw-flex tw-items-center">
          <SVGIcons alt="tasks" icon={Icons.TASK_ICON} />
          <span className="tw-ml-1" data-testid="description-tasks-count">
            {' '}
            {descriptionTaskThread.count}
          </span>
        </span>
      </button>
    ) : null;
  };

  const DescriptionActions = () => {
    return !isReadOnly ? (
      <Space align="start" size={12}>
        {checkPermission() && (
          <button data-testid="edit-description" onClick={handleUpdate}>
            <SVGIcons alt="edit" icon="icon-edit" title="Edit" />
          </button>
        )}
        {isTaskSupported(entityType as EntityType) ? (
          <Fragment>
            <RequestDescriptionEl />
            <DescriptionTaskElement descriptionTaskThread={tasks} />
          </Fragment>
        ) : null}

        <DescriptionThreadEl descriptionThread={thread} />
      </Space>
    ) : null;
  };

  return (
    <div className="schema-description tw-relative">
      <Space align="baseline" className="tw-px-3" size={16}>
        <div
          className="description tw-h-full tw-overflow-y-scroll tw-min-h-12 tw-relative tw-py-1"
          data-testid="description"
          id="center">
          {description?.trim() ? (
            <RichTextEditorPreviewer
              blurClasses={
                blurWithBodyBG ? 'see-more-blur-body' : 'see-more-blur-white'
              }
              className="tw-pl-2"
              enableSeeMoreVariant={!removeBlur}
              markdown={description}
              maxHtClass="tw-max-h-36"
              maxLen={800}
            />
          ) : (
            <span className="tw-no-description tw-p-2">No description </span>
          )}
        </div>
        <DescriptionActions />
      </Space>
      {isEdit && (
        <ModalWithMarkdownEditor
          header={`Edit description for ${entityName}`}
          placeholder="Enter Description"
          value={description}
          onCancel={onCancel}
          onSave={onDescriptionUpdate}
        />
      )}
    </div>
  );
};

export default Description;
