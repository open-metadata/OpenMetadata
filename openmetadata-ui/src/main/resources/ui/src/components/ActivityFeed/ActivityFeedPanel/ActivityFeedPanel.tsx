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

import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { EntityThread } from 'Models';
import React, { FC, useEffect, useState } from 'react';
import { getFeedById } from '../../../axiosAPIs/feedsAPI';
import { confirmStateInitialValue } from '../../../constants/feed.constants';
import jsonData from '../../../jsons/en';
import { getEntityField } from '../../../utils/FeedUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ConfirmState } from '../ActivityFeedCard/ActivityFeedCard.interface';
import ActivityFeedEditor from '../ActivityFeedEditor/ActivityFeedEditor';
import DeleteConfirmationModal from '../DeleteConfirmationModal/DeleteConfirmationModal';
import { ActivityFeedPanelProp } from './ActivityFeedPanel.interface';
import FeedPanelBody from './FeedPanelBody';
import FeedPanelHeader from './FeedPanelHeader';
import FeedPanelOverlay from './FeedPanelOverlay';

const ActivityFeedPanel: FC<ActivityFeedPanelProp> = ({
  open,
  selectedThread,
  onCancel,
  className,
  postFeed,
  deletePostHandler,
}) => {
  const [threadData, setThreadData] = useState<EntityThread>(selectedThread);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const entityField = getEntityField(selectedThread.about);

  const [confirmationState, setConfirmationState] = useState<ConfirmState>(
    confirmStateInitialValue
  );

  const onDiscard = () => {
    setConfirmationState(confirmStateInitialValue);
  };

  const onPostDelete = () => {
    if (confirmationState.postId && confirmationState.threadId) {
      deletePostHandler?.(confirmationState.threadId, confirmationState.postId);
    }
    onDiscard();
  };

  const onConfirmation = (data: ConfirmState) => {
    setConfirmationState(data);
  };

  useEffect(() => {
    getFeedById(selectedThread.id)
      .then((res: AxiosResponse) => {
        setThreadData(res.data);
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['fetch-feed-error']);
      })
      .finally(() => setIsLoading(false));
  }, [selectedThread]);

  return (
    <div className={classNames('tw-h-full', className)}>
      <FeedPanelOverlay
        className="tw-z-10 tw-fixed tw-inset-0 tw-top-16 tw-h-full tw-w-3/5 tw-bg-black tw-opacity-40"
        onCancel={onCancel}
      />
      <div
        className={classNames(
          'tw-top-16 tw-right-0 tw-bottom-0 tw-w-2/5 tw-bg-white tw-fixed tw-shadow-md tw-transform tw-ease-in-out tw-duration-1000 tw-overflow-y-auto tw-z-10',
          {
            'tw-translate-x-0': open,
            'tw-translate-x-full': !open,
          }
        )}>
        <FeedPanelHeader
          className="tw-px-4 tw-shadow-sm"
          entityField={entityField as string}
          onCancel={onCancel}
        />

        <FeedPanelBody
          className="tw-p-4 tw-pl-8 tw-mb-3"
          deletePostHandler={deletePostHandler}
          isLoading={isLoading}
          threadData={threadData as EntityThread}
          onConfirmation={onConfirmation}
        />
        <ActivityFeedEditor
          buttonClass="tw-mr-4"
          className="tw-ml-5 tw-mr-2 tw-mb-2"
          onSave={postFeed}
        />
      </div>
      {confirmationState.state && (
        <DeleteConfirmationModal
          onDelete={onPostDelete}
          onDiscard={onDiscard}
        />
      )}
    </div>
  );
};

export default ActivityFeedPanel;
