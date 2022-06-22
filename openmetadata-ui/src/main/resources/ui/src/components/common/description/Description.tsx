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

import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { EntityFieldThreads } from 'Models';
import React, { FC, Fragment } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuthContext } from '../../../authentication/auth-provider/AuthProvider';
import { EntityType } from '../../../enums/entity.enum';
import { Operation } from '../../../generated/entity/policies/accessControl/rule';
import { useAuth } from '../../../hooks/authHooks';
import { getEntityFeedLink } from '../../../utils/EntityUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import {
  getRequestDescriptionPath,
  getUpdateDescriptionPath,
  TASK_ENTITIES,
} from '../../../utils/TasksUtils';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import PopOver from '../popover/PopOver';
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
}) => {
  const history = useHistory();

  const { isAdminUser, userPermissions } = useAuth();
  const { isAuthDisabled } = useAuthContext();

  const thread = entityFieldThreads?.[0];

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
    const check =
      isAdminUser ||
      hasEditAccess ||
      isAuthDisabled ||
      userPermissions[Operation.UpdateDescription] ||
      !TASK_ENTITIES.includes(entityType as EntityType);
    if (check) {
      onDescriptionEdit && onDescriptionEdit();
    } else {
      handleUpdateDescription();
    }
  };

  const RequestDescriptionEl = ({
    descriptionThread,
  }: {
    descriptionThread?: EntityFieldThreads;
  }) => {
    return isUndefined(descriptionThread) &&
      onEntityFieldSelect &&
      !description?.trim() ? (
      <button
        className="focus:tw-outline-none tw-ml-2 tw--mt-6"
        data-testid="request-description"
        onClick={handleRequestDescription}>
        <PopOver
          position="top"
          title="Request description"
          trigger="mouseenter">
          <SVGIcons
            alt="request-description"
            className="tw-mt-2"
            icon={Icons.REQUEST}
          />
        </PopOver>
      </button>
    ) : null;
  };

  const DescriptionThreadEl = ({
    descriptionThread,
  }: {
    descriptionThread?: EntityFieldThreads;
  }) => {
    return !isUndefined(descriptionThread) ? (
      <p
        className="link-text tw-ml-2 tw-w-8 tw-h-8 tw-flex-none"
        data-testid="description-thread"
        onClick={() => onThreadLinkSelect?.(descriptionThread.entityLink)}>
        <span className="tw-flex">
          <SVGIcons alt="comments" icon={Icons.COMMENT} width="20px" />{' '}
          <span className="tw-ml-1" data-testid="description-thread-count">
            {' '}
            {descriptionThread.count}
          </span>
        </span>
      </p>
    ) : (
      <Fragment>
        {description?.trim() && onThreadLinkSelect ? (
          <p
            className="link-text tw-flex-none tw-ml-2"
            data-testid="start-description-thread"
            onClick={() =>
              onThreadLinkSelect?.(
                getEntityFeedLink(entityType, entityFqn, 'description')
              )
            }>
            <SVGIcons alt="comments" icon={Icons.COMMENT_PLUS} width="20px" />
          </p>
        ) : null}
      </Fragment>
    );
  };

  const DescriptionActions = () => {
    return !isReadOnly ? (
      <div
        className={classNames(
          'tw-w-5 tw-min-w-max tw-flex',
          description?.trim() ? 'tw-pt-4' : 'tw-pt-2.5'
        )}>
        <button
          className="focus:tw-outline-none tw-self-baseline"
          data-testid="edit-description"
          onClick={handleUpdate}>
          <SVGIcons alt="edit" icon="icon-edit" title="Edit" width="12px" />
        </button>

        <RequestDescriptionEl descriptionThread={thread} />
        <DescriptionThreadEl descriptionThread={thread} />
      </div>
    ) : null;
  };

  return (
    <div className="schema-description tw-relative">
      <div className="tw-px-3 tw-py-1 tw-flex">
        <div className="tw-relative">
          <div
            className="description tw-h-full tw-overflow-y-scroll tw-min-h-12 tw-relative tw-py-2.5"
            data-testid="description"
            id="center">
            {description?.trim() ? (
              <RichTextEditorPreviewer
                blurClasses={
                  blurWithBodyBG ? 'see-more-blur-body' : 'see-more-blur-white'
                }
                className="tw-p-2"
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
