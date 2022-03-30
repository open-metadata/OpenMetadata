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
import React, { Fragment } from 'react';
import { Table } from '../../../generated/entity/data/table';
import { Operation } from '../../../generated/entity/policies/accessControl/rule';
import { getHtmlForNonAdminAction } from '../../../utils/CommonUtils';
import { getEntityFeedLink } from '../../../utils/EntityUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import NonAdminAction from '../non-admin-action/NonAdminAction';
import PopOver from '../popover/PopOver';
import RichTextEditorPreviewer from '../rich-text-editor/RichTextEditorPreviewer';

interface Props {
  entityName?: string;
  owner?: Table['owner'];
  hasEditAccess?: boolean;
  blurWithBodyBG?: boolean;
  removeBlur?: boolean;
  description: string;
  isEdit?: boolean;
  isReadOnly?: boolean;
  entityType?: string;
  entityFqn?: string;
  entityFieldThreads?: EntityFieldThreads[];
  onThreadLinkSelect?: (value: string) => void;
  onDescriptionEdit?: () => void;
  onCancel?: () => void;
  onDescriptionUpdate?: (value: string) => void;
  onSuggest?: (value: string) => void;
  onEntityFieldSelect?: (value: string) => void;
}

const Description = ({
  owner,
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
}: Props) => {
  const descriptionThread = entityFieldThreads?.[0];

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
        {!isReadOnly ? (
          <div
            className={classNames(
              'tw-w-5 tw-min-w-max tw-flex',
              description?.trim() ? 'tw-pt-4' : 'tw-pt-2.5'
            )}>
            <NonAdminAction
              html={getHtmlForNonAdminAction(Boolean(owner))}
              isOwner={hasEditAccess}
              permission={Operation.UpdateDescription}
              position="right">
              <button
                className="focus:tw-outline-none"
                data-testid="edit-description"
                onClick={onDescriptionEdit}>
                <SVGIcons
                  alt="edit"
                  icon="icon-edit"
                  title="Edit"
                  width="12px"
                />
              </button>
            </NonAdminAction>
            {isUndefined(descriptionThread) &&
            onEntityFieldSelect &&
            !description?.trim() ? (
              <button
                className="focus:tw-outline-none tw-ml-2 tw-opacity-0 hover:tw-opacity-100 tw--mt-6"
                data-testid="request-description"
                onClick={() => onEntityFieldSelect?.('description')}>
                <PopOver
                  position="top"
                  title="Request description"
                  trigger="mouseenter">
                  <SVGIcons
                    alt="request-description"
                    icon={Icons.REQUEST}
                    width="22px"
                  />
                </PopOver>
              </button>
            ) : null}
            {!isUndefined(descriptionThread) ? (
              <p
                className="link-text tw-ml-2 tw-w-8 tw-h-8 tw-flex-none"
                data-testid="description-thread"
                onClick={() =>
                  onThreadLinkSelect?.(descriptionThread.entityLink)
                }>
                <span className="tw-flex">
                  <SVGIcons alt="comments" icon={Icons.COMMENT} width="20px" />{' '}
                  <span
                    className="tw-ml-1"
                    data-testid="description-thread-count">
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
                    <SVGIcons
                      alt="comments"
                      icon={Icons.COMMENT_PLUS}
                      width="20px"
                    />
                  </p>
                ) : null}
              </Fragment>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Description;
