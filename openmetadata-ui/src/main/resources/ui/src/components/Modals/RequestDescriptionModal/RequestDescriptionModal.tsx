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
import React, { FC, HTMLAttributes } from 'react';
import AppState from '../../../AppState';
import { CreateThread } from '../../../generated/api/feed/createThread';
import ActivityFeedEditor from '../../ActivityFeed/ActivityFeedEditor/ActivityFeedEditor';

interface RequestDescriptionModalProp extends HTMLAttributes<HTMLDivElement> {
  header: string;
  threadLink: string;
  defaultValue?: string;
  headerClassName?: string;
  bodyClassName?: string;
  onCancel: () => void;
  createThread: (data: CreateThread) => void;
}

const RequestDescriptionModal: FC<RequestDescriptionModalProp> = ({
  header,
  headerClassName,
  onCancel,
  createThread,
  threadLink,
  defaultValue,
}) => {
  const onPostThread = (value: string) => {
    const currentUser = AppState.userDetails?.name ?? AppState.users[0]?.name;
    const data = {
      message: value,
      from: currentUser,
      about: threadLink,
    };
    createThread(data);
    onCancel();
  };

  return (
    <dialog className="tw-modal" data-testid="modal-container">
      <div className="tw-modal-backdrop" onClick={onCancel} />
      <div className="tw-modal-container tw-w-2/4 tw-pb-0 tw-pt-2">
        <div className={classNames('tw-modal-header tw-pb-2', headerClassName)}>
          <p className="tw-modal-title" data-testid="modal-header">
            {header}
          </p>
          <div className="tw-flex">
            <svg
              className="tw-w-6 tw-h-6 tw-ml-1 tw-cursor-pointer"
              data-testid="closeWhatsNew"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              onClick={onCancel}>
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1"
              />
            </svg>
          </div>
        </div>
        <div className={classNames('tw-px-0 tw-py-3')} data-testid="body-text">
          <ActivityFeedEditor
            buttonClass="tw-mr-4 tw-pb-3"
            defaultValue={defaultValue}
            onSave={onPostThread}
          />
        </div>
      </div>
    </dialog>
  );
};

export default RequestDescriptionModal;
