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

import { PlusOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import classNames from 'classnames';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getEntityFieldDisplay,
  getFeedPanelHeaderText,
} from '../../../utils/FeedUtils';
import { Button } from '../../buttons/Button/Button';
import { FeedPanelHeaderProp } from './ActivityFeedPanel.interface';
const FeedPanelHeader: FC<FeedPanelHeaderProp> = ({
  onCancel,
  entityField,
  className,
  noun,
  onShowNewConversation,
  threadType,
  entityFQN = '',
}) => {
  const { t } = useTranslation();

  return (
    <header className={className}>
      <div className="tw-flex tw-justify-between tw-py-3">
        <p data-testid="header-title">
          <span data-testid="header-noun">
            {noun ? noun : getFeedPanelHeaderText(threadType)}{' '}
            {t('label.on-lowercase')}{' '}
          </span>
          <span className="tw-heading" data-testid="entity-attribute">
            {entityField ? getEntityFieldDisplay(entityField) : entityFQN}
          </span>
        </p>
        <div className="tw-flex">
          {onShowNewConversation ? (
            <Tooltip
              placement="bottom"
              title={t('label.start-entity', {
                entity: t('label.conversation-lowercase'),
              })}
              trigger="hover">
              <Button
                className={classNames('tw-h-7 tw-px-2')}
                data-testid="add-new-conversation"
                size="small"
                theme="primary"
                variant="outlined"
                onClick={() => {
                  onShowNewConversation?.(true);
                }}>
                <PlusOutlined />
              </Button>
            </Tooltip>
          ) : null}
          <svg
            className="tw-w-5 tw-h-5 tw-ml-2 tw-cursor-pointer tw-self-center"
            data-testid="closeDrawer"
            fill="none"
            stroke="#6B7280"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            onClick={onCancel}>
            <path
              d="M6 18L18 6M6 6l12 12"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>
      <hr className="tw--mx-4" data-testid="bottom-separator" />
    </header>
  );
};

export default FeedPanelHeader;
