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

import { Button, Card, Space, Tooltip, Typography } from 'antd';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import classNames from 'classnames';
import { DE_ACTIVE_COLOR } from 'constants/constants';
import { t } from 'i18next';
import { isUndefined } from 'lodash';
import React, { Fragment } from 'react';
import { EntityField } from '../../../constants/Feeds.constants';
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
  wrapInCard?: boolean;
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
  wrapInCard = false,
}: Props) => {
  const descriptionThread = entityFieldThreads?.[0];

  const editButton = () => {
    return !isReadOnly && hasEditAccess ? (
      <Button
        className="cursor-pointer d-inline-flex items-center justify-center"
        data-testid="edit-description"
        icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
        size="small"
        type="text"
        onClick={onDescriptionEdit}
      />
    ) : (
      <></>
    );
  };

  const content = (
    <>
      <Space className="schema-description tw-flex" direction="vertical">
        <div className="d-flex">
          <Text className="m-b-0 m-r-xss tw-text-base font-medium">
            {t('label.description')}
          </Text>
          {editButton()}
        </div>
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
                  title={t('message.request-description')}
                  trigger="hover">
                  <SVGIcons
                    alt={t('message.request-description')}
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
    </>
  );

  return wrapInCard ? <Card>{content}</Card> : content;
};

export default DescriptionV1;
