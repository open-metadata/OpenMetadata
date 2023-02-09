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

import { Space, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { t } from 'i18next';
import { isUndefined } from 'lodash';
import React, { Fragment } from 'react';
import { EntityField } from '../../../constants/Feeds.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../constants/HelperTextUtil';
import { Table } from '../../../generated/entity/data/table';
import { EntityFieldThreads } from '../../../interface/feed.interface';
import { getEntityFeedLink } from '../../../utils/EntityUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import RichTextEditorPreviewer from '../rich-text-editor/RichTextEditorPreviewer';
const { Text } = Typography;

interface Props {
  entityName?: string;
  owner?: Table['owner'];
  hasEditAccess?: boolean;
  removeBlur?: boolean;
  description?: string;
  isEdit?: boolean;
  isReadOnly?: boolean;
  entityType?: string;
  entityFqn?: string;
  entityFieldThreads?: EntityFieldThreads[];
  onThreadLinkSelect?: (value: string) => void;
  onDescriptionEdit?: () => void;
  onCancel?: () => void;
  onDescriptionUpdate?: (value: string) => Promise<void>;
  onSuggest?: (value: string) => void;
  onEntityFieldSelect?: (value: string) => void;
}
const DescriptionV1 = ({
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
  onEntityFieldSelect,
  entityType,
  entityFqn,
}: Props) => {
  const descriptionThread = entityFieldThreads?.[0];

  const editButton = () => {
    return !isReadOnly ? (
      <Tooltip
        title={hasEditAccess ? 'Edit Description' : NO_PERMISSION_FOR_ACTION}>
        <button
          className="focus:tw-outline-none tw-text-primary"
          data-testid="edit-description"
          disabled={!hasEditAccess}
          onClick={onDescriptionEdit}>
          <SVGIcons
            alt="edit"
            icon={Icons.IC_EDIT_PRIMARY}
            title="Edit"
            width="16px"
          />
        </button>
      </Tooltip>
    ) : (
      <></>
    );
  };

  return (
    <Space className="schema-description tw-flex" direction="vertical">
      <Space
        style={{
          display: 'flex',
          width: '100%',
          justifyContent: 'space-between',
        }}>
        <Text type="secondary">{t('label.description')}</Text>
        <div>{editButton()}</div>
      </Space>
      <div>
        {description?.trim() ? (
          <RichTextEditorPreviewer
            enableSeeMoreVariant={!removeBlur}
            markdown={description}
          />
        ) : (
          <span>{t('label.no-description')}</span>
        )}
        <ModalWithMarkdownEditor
          header={t('label.edit-description-for', { entityName })}
          placeholder={t('label.enter-entity', {
            entity: t('label.description'),
          })}
          value={description}
          visible={Boolean(isEdit)}
          onCancel={onCancel}
          onSave={onDescriptionUpdate}
        />
      </div>
      {!isReadOnly ? (
        <div
          className={classNames(
            'tw-w-5 tw-min-w-max tw-flex',
            description?.trim() ? 'tw-pl-1' : ''
          )}>
          {isUndefined(descriptionThread) &&
          onEntityFieldSelect &&
          !description?.trim() ? (
            <button
              className="focus:tw-outline-none tw-ml-2 tw--mt-6"
              data-testid="request-description"
              onClick={() => onEntityFieldSelect?.(EntityField.DESCRIPTION)}>
              <Tooltip
                placement="top"
                title="Request description"
                trigger="hover">
                <SVGIcons
                  alt="request-description"
                  className="tw-mt-2"
                  icon={Icons.REQUEST}
                />
              </Tooltip>
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
                      getEntityFeedLink(
                        entityType,
                        entityFqn,
                        EntityField.DESCRIPTION
                      )
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
    </Space>
  );
};

export default DescriptionV1;
