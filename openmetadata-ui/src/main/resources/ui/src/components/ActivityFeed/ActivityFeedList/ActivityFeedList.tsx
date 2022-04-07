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
import { EntityThread } from 'Models';
import React, { FC, Fragment, useEffect, useState } from 'react';
import { confirmStateInitialValue } from '../../../constants/feed.constants';
import { withLoader } from '../../../hoc/withLoader';
import { getFeedListWithRelativeDays } from '../../../utils/FeedUtils';
import { ConfirmState } from '../ActivityFeedCard/ActivityFeedCard.interface';
import ActivityFeedPanel from '../ActivityFeedPanel/ActivityFeedPanel';
import DeleteConfirmationModal from '../DeleteConfirmationModal/DeleteConfirmationModal';
import NoFeedPlaceholder from '../NoFeedPlaceholder/NoFeedPlaceholder';
import { ActivityFeedListProp } from './ActivityFeedList.interface';
import FeedListBody from './FeedListBody';
import FeedListSeparator from './FeedListSeparator';

const ActivityFeedList: FC<ActivityFeedListProp> = ({
  className,
  feedList,
  withSidePanel = false,
  isEntityFeed = false,
  postFeedHandler,
  entityName,
  deletePostHandler,
}) => {
  const { updatedFeedList, relativeDays } =
    getFeedListWithRelativeDays(feedList);
  const [selectedThread, setSelectedThread] = useState<EntityThread>();
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);

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

  const onThreadIdSelect = (id: string) => {
    setSelectedThreadId(id);
    setSelectedThread(undefined);
  };

  const onThreadIdDeselect = () => {
    setSelectedThreadId('');
  };

  const onThreadSelect = (id: string) => {
    const thread = feedList.find((f) => f.id === id);
    if (thread) {
      setSelectedThread(thread);
    }
  };

  const onViewMore = () => {
    setIsPanelOpen(true);
  };

  const onCancel = () => {
    setSelectedThread(undefined);
    setIsPanelOpen(false);
  };

  const postFeed = (value: string) => {
    postFeedHandler?.(value, selectedThread?.id ?? selectedThreadId);
  };

  useEffect(() => {
    onThreadSelect(selectedThread?.id ?? selectedThreadId);
  }, [feedList]);

  useEffect(() => {
    const escapeKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', escapeKeyHandler);

    return () => {
      document.removeEventListener('keydown', escapeKeyHandler);
    };
  }, []);

  return (
    <div className={classNames(className)} id="feedData">
      {feedList.length > 0 ? (
        <Fragment>
          {relativeDays.map((d, i) => {
            return (
              <div data-testid={`feed${i}`} key={i}>
                <FeedListSeparator
                  className="tw-relative tw-mt-1 tw-mb-3.5"
                  relativeDay={d}
                />
                <FeedListBody
                  deletePostHandler={deletePostHandler}
                  isEntityFeed={isEntityFeed}
                  postFeed={postFeed}
                  relativeDay={d}
                  selectedThreadId={selectedThreadId}
                  updatedFeedList={updatedFeedList}
                  withSidePanel={withSidePanel}
                  onConfirmation={onConfirmation}
                  onThreadIdDeselect={onThreadIdDeselect}
                  onThreadIdSelect={onThreadIdSelect}
                  onThreadSelect={onThreadSelect}
                  onViewMore={onViewMore}
                />
              </div>
            );
          })}
          {withSidePanel && selectedThread && isPanelOpen ? (
            <Fragment>
              <ActivityFeedPanel
                deletePostHandler={deletePostHandler}
                open={!isUndefined(selectedThread) && isPanelOpen}
                postFeed={postFeed}
                selectedThread={selectedThread}
                onCancel={onCancel}
              />
            </Fragment>
          ) : null}
        </Fragment>
      ) : (
        <Fragment>
          {entityName ? (
            <NoFeedPlaceholder entityName={entityName} />
          ) : (
            <Fragment>
              <FeedListSeparator
                className="tw-relative tw-mt-1 tw-mb-3.5 tw-pb-5"
                relativeDay=""
              />
              <>No conversations found. Try changing the filter.</>
            </Fragment>
          )}
        </Fragment>
      )}
      {confirmationState.state && (
        <DeleteConfirmationModal
          onDelete={onPostDelete}
          onDiscard={onDiscard}
        />
      )}
    </div>
  );
};

export default withLoader<ActivityFeedListProp>(ActivityFeedList);
