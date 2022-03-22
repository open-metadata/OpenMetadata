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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import React, { FC } from 'react';
import { Button } from '../../buttons/Button/Button';
import PopOver from '../../common/popover/PopOver';
import { FeedPanelHeaderProp } from './ActivityFeedPanel.interface';
const FeedPanelHeader: FC<FeedPanelHeaderProp> = ({
  onCancel,
  entityField,
  className,
  noun,
  onShowNewConversation,
}) => {
  return (
    <header className={className}>
      <div className="tw-flex tw-justify-between tw-py-3">
        <p data-testid="header-title">
          <span data-testid="header-noun">
            {noun ? noun : 'Conversation'} on{' '}
          </span>
          <span className="tw-heading">{entityField}</span>
        </p>
        <div className="tw-flex">
          {onShowNewConversation ? (
            <PopOver
              position="bottom"
              title="Start conversation"
              trigger="mouseenter">
              <Button
                className={classNames('tw-h-7 tw-px-2')}
                data-testid="add-new-conversation"
                size="small"
                theme="primary"
                variant="outlined"
                onClick={() => {
                  onShowNewConversation?.(true);
                }}>
                <FontAwesomeIcon icon="plus" />
              </Button>
            </PopOver>
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
