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

import { Popover } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { EntityFieldThreads } from 'Models';
import React, { FC, Fragment } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuthContext } from '../../../authentication/auth-provider/AuthProvider';
import { EntityField } from '../../../constants/feed.constants';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { Operation } from '../../../generated/entity/policies/accessControl/rule';
import { useAuth } from '../../../hooks/authHooks';
import { getEntityFeedLink } from '../../../utils/EntityUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import {
  getRequestDescriptionPath,
  getUpdateDescriptionPath,
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
  onEntityFieldSelect,
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
      userPermissions[Operation.UpdateDescription] ||
      isAuthDisabled
    );
  };

  const handleUpdate = () => {
    onDescriptionEdit && onDescriptionEdit();
  };

  const RequestDescriptionEl = () => {
    const hasDescription = Boolean(description.trim());

    return onEntityFieldSelect ? (
      <button
        className="tw-w-8 tw-h-8 tw-mr-1 tw-flex-none link-text focus:tw-outline-none"
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
          <SVGIcons
            alt="request-description"
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
        className="tw-w-8 tw-h-8 tw-mr-2 tw-flex-none link-text focus:tw-outline-none"
        data-testid="description-thread"
        onClick={() => onThreadLinkSelect?.(descriptionThread.entityLink)}>
        <span className="tw-flex">
          <SVGIcons alt="comments" icon={Icons.COMMENT} width="20px" />{' '}
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
            className="tw-w-8 tw-h-8 tw-mr-2 tw-flex-none link-text focus:tw-outline-none"
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
            <SVGIcons alt="comments" icon={Icons.COMMENT_PLUS} width="20px" />
          </button>
        ) : null}
      </Fragment>
    );
  };

  const getDescriptionTaskElement = () => {
    return !isUndefined(tasks) ? (
      <button
        className="tw-w-8 tw-h-8 tw-mr-2 tw-flex-none link-text focus:tw-outline-none"
        data-testid="description-task"
        onClick={() => onThreadLinkSelect?.(tasks.entityLink, ThreadType.Task)}>
        <span className="tw-flex">
          <SVGIcons alt="tasks" icon={Icons.TASK_ICON} width="16px" />{' '}
          <span className="tw-ml-1" data-testid="description-tasks-count">
            {' '}
            {tasks.count}
          </span>
        </span>
      </button>
    ) : null;
  };

  const DescriptionActions = () => {
    return !isReadOnly ? (
      <div className={classNames('tw-w-5 tw-min-w-max tw-flex tw--mt-0.5')}>
        {checkPermission() && (
          <button
            className="tw-w-7 tw-h-8 tw-flex-none focus:tw-outline-none"
            data-testid="edit-description"
            onClick={handleUpdate}>
            <SVGIcons alt="edit" icon="icon-edit" title="Edit" width="16px" />
          </button>
        )}

        <RequestDescriptionEl />
        <DescriptionThreadEl descriptionThread={thread} />
        {getDescriptionTaskElement()}
      </div>
    ) : null;
  };

  return (
    <div className="schema-description tw-relative">
      <div className="tw-px-3 tw-py-1 tw-flex">
        <div className="tw-relative">
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
        <DescriptionActions />
      </div>
    </div>
  );
};

export default Description;
